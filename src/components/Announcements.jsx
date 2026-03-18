import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../utils/api";
import { Button, Input, Card, Modal, Select, Tabs, Tab } from "./UI";
import { useAuth } from "../contexts/AuthContext";

/**
 * Announcements Component
 * Implements comprehensive announcement management with:
 * - Create, edit, publish announcements
 * - Target specific audiences (roles, departments, locations)
 * - Track read receipts and acknowledgments
 * - Attach files and manage content
 */
export default function Announcements() {
  const { isAdmin, user } = useAuth();

  // Active tab state
  const [activeTab, setActiveTab] = useState("list");

  // Data states
  const [announcements, setAnnouncements] = useState([]);
  const [myAnnouncements, setMyAnnouncements] = useState([]);
  const [categories, setCategories] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    priority: "",
    dateRange: {
      start: "",
      end: "",
    },
    searchQuery: "",
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Form state for new/edit announcement
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "general",
    priority: "normal",
    category: "system",
    requires_acknowledgment: false,
    acknowledgment_deadline: "",
    target_audience_type: "all",
    target_roles: [],
    publish_date: new Date().toISOString().split("T")[0],
    expiration_date: "",
    tags: "",
  });

  // Stats
  const [stats, setStats] = useState({
    totalAnnouncements: 0,
    unreadCount: 0,
    pendingAcknowledgments: 0,
    activeAnnouncements: 0,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        status: filters.status || undefined,
        category: filters.category || undefined,
        priority: filters.priority || undefined,
        period_start: filters.dateRange.start || undefined,
        period_end: filters.dateRange.end || undefined,
        search: filters.searchQuery || undefined,
      };

      const [
        announcementsData,
        myAnnouncementsData,
        categoriesData,
        statsData,
      ] = await Promise.all([
        apiClient.getAnnouncements(params),
        apiClient.getMyAnnouncements(),
        apiClient.getAnnouncementCategories(),
        apiClient.getAnnouncementStats(),
      ]);

      setAnnouncements(announcementsData || []);
      setMyAnnouncements(myAnnouncementsData || []);
      setCategories(categoriesData || []);
      setStats(statsData || {});
    } catch (err) {
      console.error("Error fetching announcements:", err);
      setError(err.message || "Failed to load announcements");

      // Set mock data for demo
      const mockAnnouncements = getMockAnnouncements();
      setAnnouncements(mockAnnouncements);
      setMyAnnouncements(
        mockAnnouncements.filter((a) => a.status === "published"),
      );
      setCategories(getMockCategories());
      setStats({
        totalAnnouncements: mockAnnouncements.length,
        unreadCount: 3,
        pendingAcknowledgments: 2,
        activeAnnouncements: mockAnnouncements.filter(
          (a) => a.status === "published",
        ).length,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        if (
          !announcement.title.toLowerCase().includes(query) &&
          !announcement.content.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [announcements, filters.searchQuery]);

  // Create announcement
  const handleCreate = async () => {
    try {
      const data = {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        created_by: user?.id,
      };

      await apiClient.createAnnouncement(data);
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error creating announcement:", err);
      alert("Failed to create announcement. Please try again.");
    }
  };

  // Publish announcement
  const handlePublish = async (announcementId) => {
    try {
      await apiClient.publishAnnouncement(announcementId);
      fetchData();
    } catch (err) {
      console.error("Error publishing announcement:", err);
      alert("Failed to publish announcement. Please try again.");
    }
  };

  // Archive announcement
  const handleArchive = async (announcementId) => {
    try {
      await apiClient.archiveAnnouncement(announcementId);
      fetchData();
    } catch (err) {
      console.error("Error archiving announcement:", err);
      alert("Failed to archive announcement. Please try again.");
    }
  };

  // Acknowledge announcement
  const handleAcknowledge = async (announcementId) => {
    try {
      await apiClient.acknowledgeAnnouncement(announcementId);
      fetchData();
    } catch (err) {
      console.error("Error acknowledging announcement:", err);
      alert("Failed to acknowledge announcement. Please try again.");
    }
  };

  // Delete announcement
  const handleDelete = async (announcementId) => {
    if (!window.confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
      return;
    }
    try {
      await apiClient.deleteAnnouncement(announcementId);
      fetchData();
    } catch (err) {
      console.error("Error deleting announcement:", err);
      alert("Failed to delete announcement. Please try again.");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      content_type: "general",
      priority: "normal",
      category: "system",
      requires_acknowledgment: false,
      acknowledgment_deadline: "",
      target_audience_type: "all",
      target_roles: [],
      publish_date: new Date().toISOString().split("T")[0],
      expiration_date: "",
      tags: "",
    });
  };

  // View announcement details
  const handleView = (announcement) => {
    setSelectedAnnouncement(announcement);
    setShowViewModal(true);
  };

  // Content type badge helper
  const getContentTypeBadge = (type) => {
    const variants = {
      general: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        icon: "📢",
      },
      urgent: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        icon: "🚨",
      },
      maintenance: {
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        icon: "🔧",
      },
      policy: {
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
        icon: "📋",
      },
      update: {
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        icon: "✨",
      },
      alert: {
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
        icon: "⚠️",
      },
    };
    const variant = variants[type] || variants.general;
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${variant.color}`}
      >
        {variant.icon} {type}
      </span>
    );
  };

  // Priority badge helper
  const getPriorityBadge = (priority) => {
    const variants = {
      critical: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Critical",
      },
      urgent: {
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
        label: "Urgent",
      },
      high: {
        color:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
        label: "High",
      },
      normal: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Normal",
      },
      low: {
        color:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Low",
      },
    };
    const variant = variants[priority] || variants.normal;
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${variant.color}`}>
        {variant.label}
      </span>
    );
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    const variants = {
      draft: {
        color:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
        label: "Draft",
      },
      scheduled: {
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
        label: "Scheduled",
      },
      published: {
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
        label: "Published",
      },
      archived: {
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
        label: "Archived",
      },
      expired: {
        color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Expired",
      },
    };
    const variant = variants[status] || variants.draft;
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${variant.color}`}>
        {variant.label}
      </span>
    );
  };

  // Display error message if there's an error
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium">Error Loading Announcements</span>
          </div>
          <p className="text-red-600 dark:text-red-300 mt-2">{error}</p>
          <Button variant="outline" className="mt-3" onClick={fetchData}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Display loading spinner while data is being fetched
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">
            Loading announcements...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {/* Header for non-admin users */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Announcements
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Stay updated with the latest news and announcements
            </p>
          </div>
        </div>

        {/* Stats for non-admin */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalAnnouncements}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Announcements
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.unreadCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Unread
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pendingAcknowledgments}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pending Acknowledgment
              </div>
            </div>
          </Card>
        </div>

        {/* Announcements List for non-admin */}
        <div className="space-y-4">
          {filteredAnnouncements
            .filter((a) => a.status === "published")
            .map((announcement) => (
              <Card
                key={announcement.announcement_id}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getContentTypeBadge(announcement.content_type)}
                      {getPriorityBadge(announcement.priority)}
                      {announcement.requires_acknowledgment && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded">
                          Requires Acknowledgment
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                      {announcement.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Published:{" "}
                        {new Date(
                          announcement.publish_date,
                        ).toLocaleDateString()}
                      </span>
                      {announcement.expiration_date && (
                        <span>
                          Expires:{" "}
                          {new Date(
                            announcement.expiration_date,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleView(announcement)}
                  >
                    Read More
                  </Button>
                </div>
              </Card>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            Announcements Management
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create, manage, and publish system announcements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilterModal(true)}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Announcement
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Announcements
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalAnnouncements}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Published
              </p>
              <p className="text-2xl font-bold text-green-600">
                {stats.activeAnnouncements}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pending Acknowledgment
              </p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pendingAcknowledgments}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
              <svg
                className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Unread</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.unreadCount}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search announcements..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters({ ...filters, searchQuery: e.target.value })
              }
              className="w-full"
            />
          </div>
          <Button variant="outline" onClick={fetchData}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
        <Tab id="list" label="All Announcements" icon="📋">
          {/* Announcements Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Target
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Publish Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAnnouncements.map((announcement) => (
                    <tr
                      key={announcement.announcement_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">
                        {getStatusBadge(announcement.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {announcement.title}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getContentTypeBadge(announcement.content_type)}
                      </td>
                      <td className="px-4 py-3">
                        {getPriorityBadge(announcement.priority)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {announcement.target_audience_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(
                          announcement.publish_date,
                        ).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleView(announcement)}
                          >
                            View
                          </Button>
                          {announcement.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handlePublish(announcement.announcement_id)
                              }
                            >
                              Publish
                            </Button>
                          )}
                          {announcement.status === "published" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleArchive(announcement.announcement_id)
                              }
                            >
                              Archive
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              handleDelete(announcement.announcement_id)
                            }
                            title="Delete announcement"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Tab>

        <Tab id="my-announcements" label="My Announcements" icon="📬">
          {/* My Announcements List */}
          <div className="space-y-4">
            {myAnnouncements.map((announcement) => (
              <Card
                key={announcement.announcement_id}
                className="p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getContentTypeBadge(announcement.content_type)}
                      {getPriorityBadge(announcement.priority)}
                      {announcement.requires_acknowledgment && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded">
                          Requires Acknowledgment
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                      {announcement.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-3 mb-4">
                      {announcement.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Published:{" "}
                        {new Date(
                          announcement.publish_date,
                        ).toLocaleDateString()}
                      </span>
                      {announcement.expiration_date && (
                        <span>
                          Expires:{" "}
                          {new Date(
                            announcement.expiration_date,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleView(announcement)}
                    >
                      Read More
                    </Button>
                    {announcement.requires_acknowledgment &&
                      !announcement.has_acknowledged && (
                        <Button
                          onClick={() =>
                            handleAcknowledge(announcement.announcement_id)
                          }
                        >
                          Acknowledge
                        </Button>
                      )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Tab>
      </Tabs>

      {/* Create Announcement Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Announcement"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter announcement title"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Enter announcement content"
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content Type
              </label>
              <Select
                value={formData.content_type}
                onChange={(e) =>
                  setFormData({ ...formData, content_type: e.target.value })
                }
                className="w-full"
              >
                <option value="general">General</option>
                <option value="urgent">Urgent</option>
                <option value="maintenance">Maintenance</option>
                <option value="policy">Policy</option>
                <option value="update">Update</option>
                <option value="alert">Alert</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <Select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full"
              >
                <option value="system">System</option>
                <option value="inventory">Inventory</option>
                <option value="vaccination">Vaccination</option>
                <option value="policy">Policy</option>
                <option value="event">Event</option>
                <option value="training">Training</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <Select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value })
                }
                className="w-full"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Audience
              </label>
              <Select
                value={formData.target_audience_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_audience_type: e.target.value,
                  })
                }
                className="w-full"
              >
                <option value="all">All Users</option>
                <option value="role">By Role</option>
                <option value="department">By Department</option>
                <option value="location">By Location</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Publish Date
              </label>
              <Input
                type="date"
                value={formData.publish_date}
                onChange={(e) =>
                  setFormData({ ...formData, publish_date: e.target.value })
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration Date
              </label>
              <Input
                type="date"
                value={formData.expiration_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiration_date: e.target.value })
                }
                className="w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.requires_acknowledgment}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    requires_acknowledgment: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Requires Acknowledgment
              </span>
            </label>

            {formData.requires_acknowledgment && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Acknowledgment Deadline
                </label>
                <Input
                  type="date"
                  value={formData.acknowledgment_deadline}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      acknowledgment_deadline: e.target.value,
                    })
                  }
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <Input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="e.g., important, maintenance, update"
              className="w-full"
            />
          </div>

          <div className="flex justify-center gap-2 pt-4 border-t">
            <Button
              variant="cancel"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={handleCreate}>
              Save as Draft
            </Button>
            <Button onClick={handleCreate}>Publish</Button>
          </div>
        </div>
      </Modal>

      {/* View Announcement Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Announcement Details"
        size="lg"
      >
        {selectedAnnouncement && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              {getContentTypeBadge(selectedAnnouncement.content_type)}
              {getPriorityBadge(selectedAnnouncement.priority)}
              {getStatusBadge(selectedAnnouncement.status)}
            </div>

            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              {selectedAnnouncement.title}
            </h3>

            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Published By
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedAnnouncement.created_by_name || "System"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Publish Date
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(selectedAnnouncement.publish_date).toLocaleString()}
                </p>
              </div>
              {selectedAnnouncement.expiration_date && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Expiration Date
                  </label>
                  <p className="text-gray-900 dark:text-gray-100">
                    {new Date(
                      selectedAnnouncement.expiration_date,
                    ).toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Target Audience
                </label>
                <p className="text-gray-900 dark:text-gray-100">
                  {selectedAnnouncement.target_audience_type}
                </p>
              </div>
            </div>

            {selectedAnnouncement.requires_acknowledgment && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                      This announcement requires acknowledgment
                    </p>
                    {selectedAnnouncement.acknowledgment_deadline && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Deadline:{" "}
                        {new Date(
                          selectedAnnouncement.acknowledgment_deadline,
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {!selectedAnnouncement.has_acknowledged && (
                    <Button
                      onClick={() => {
                        handleAcknowledge(selectedAnnouncement.announcement_id);
                        setShowViewModal(false);
                      }}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {selectedAnnouncement.has_acknowledged && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      ✓ Acknowledged
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center pt-4 border-t">
              <Button variant="cancel" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Filter Modal */}
      <Modal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Announcements"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <Select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <Select
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
              className="w-full"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <Select
              value={filters.priority}
              onChange={(e) =>
                setFilters({ ...filters, priority: e.target.value })
              }
              className="w-full"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
          </div>

          <div className="flex justify-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  category: "",
                  status: "",
                  priority: "",
                  dateRange: { start: "", end: "" },
                  searchQuery: "",
                })
              }
            >
              Clear Filters
            </Button>
            <Button onClick={() => setShowFilterModal(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Mock data functions
function getMockAnnouncements() {
  return [
    {
      announcement_id: "1",
      announcement_code: "ANN-001",
      title: "System Maintenance Scheduled",
      content:
        "The inventory management system will undergo scheduled maintenance on February 15, 2024, from 10:00 PM to 2:00 AM. During this time, the system may be temporarily unavailable.\n\nPlease save your work before the maintenance window begins.",
      content_type: "maintenance",
      priority: "high",
      category: "system",
      status: "published",
      target_audience_type: "all",
      requires_acknowledgment: true,
      acknowledgment_deadline: "2024-02-14",
      publish_date: "2024-02-10",
      expiration_date: "2024-02-16",
      created_by_name: "System Admin",
      has_acknowledged: false,
      created_at: "2024-02-10T10:00:00Z",
    },
    {
      announcement_id: "2",
      announcement_code: "ANN-002",
      title: "New Vaccine Inventory Guidelines",
      content:
        "We have updated the vaccine inventory management guidelines. Please review the new procedures for storing and handling temperature-sensitive vaccines.\n\nKey changes include:\n- Updated storage temperature requirements\n- New expiration tracking procedures\n- Enhanced quality control measures",
      content_type: "policy",
      priority: "normal",
      category: "inventory",
      status: "published",
      target_audience_type: "role",
      target_roles: ["nurse", "medical_technician"],
      requires_acknowledgment: true,
      acknowledgment_deadline: "2024-02-20",
      publish_date: "2024-02-12",
      expiration_date: "",
      created_by_name: "Medical Director",
      has_acknowledged: true,
      created_at: "2024-02-12T09:00:00Z",
    },
    {
      announcement_id: "3",
      announcement_code: "ANN-003",
      title: "Flu Vaccination Drive Next Week",
      content:
        "Our annual flu vaccination drive will be held next week. All staff are encouraged to participate.\n\nDate: February 19-23, 2024\nTime: 9:00 AM - 4:00 PM\nLocation: Main Clinic\n\nPlease register in advance through the patient portal.",
      content_type: "update",
      priority: "normal",
      category: "vaccination",
      status: "published",
      target_audience_type: "all",
      requires_acknowledgment: false,
      publish_date: "2024-02-14",
      expiration_date: "2024-02-24",
      created_by_name: "Health Services",
      has_acknowledged: false,
      created_at: "2024-02-14T14:00:00Z",
    },
    {
      announcement_id: "4",
      announcement_code: "ANN-004",
      title: "Draft: New Supplier Approval Process",
      content:
        "This is a draft announcement for the new supplier approval process. Please review and provide feedback.\n\nThe new process includes:\n- Enhanced vendor verification\n- Quality certification requirements\n- Performance metrics tracking",
      content_type: "policy",
      priority: "low",
      category: "system",
      status: "draft",
      target_audience_type: "all",
      requires_acknowledgment: false,
      publish_date: "",
      expiration_date: "",
      created_by_name: "Admin",
      has_acknowledged: false,
      created_at: "2024-02-14T16:00:00Z",
    },
  ];
}

function getMockCategories() {
  return ["system", "inventory", "vaccination", "policy", "event", "training"];
}
