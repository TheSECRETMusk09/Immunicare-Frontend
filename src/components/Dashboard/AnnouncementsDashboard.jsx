import React, { useState, useEffect } from "react";
import { Card, Button, Alert, DataTable, FormActions } from "../UI";
import apiClient from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";

export const AnnouncementsDashboard = () => {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    priority: "medium",
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAnnouncements();
      setAnnouncements(response || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAnnouncement((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.updateAnnouncement(editingId, newAnnouncement);
      } else {
        await apiClient.createAnnouncement(newAnnouncement);
      }
      setNewAnnouncement({ title: "", content: "", priority: "medium" });
      setEditingId(null);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (announcement) => {
    setNewAnnouncement({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
    });
    setEditingId(announcement.id);
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.deleteAnnouncement(id);
      fetchAnnouncements();
    } catch (err) {
      setError(err.message);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const announcementColumns = [
    { Header: "Title", accessor: "title" },
    { Header: "Content", accessor: "content" },
    {
      Header: "Priority",
      accessor: "priority",
      Cell: ({ value }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(
            value,
          )}`}
        >
          {value}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            Header: "Actions",
            Cell: ({ row }) => (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleEdit(row.original)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDelete(row.original.id)}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (loading) return <div>Loading announcements...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="announcements-dashboard">
      <h1 className="text-2xl font-bold mb-6">Announcements Management</h1>

      {/* Create/Edit Form - only visible to admin/health workers */}
      {isAdmin && (
        <Card
          title={editingId ? "Edit Announcement" : "Create New Announcement"}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={newAnnouncement.title}
                onChange={handleInputChange}
                required
                className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content
              </label>
              <textarea
                name="content"
                value={newAnnouncement.content}
                onChange={handleInputChange}
                required
                rows="4"
                className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                name="priority"
                value={newAnnouncement.priority}
                onChange={handleInputChange}
                className="border rounded px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <FormActions>
              <Button type="button"
                variant="cancel"
                onClick={() => {
                  setNewAnnouncement({
                    title: "",
                    content: "",
                    priority: "medium",
                  });
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? "Update Announcement" : "Create Announcement"}
              </Button>
            </FormActions>
          </form>
        </Card>
      )}

      {/* Announcements List */}
      <Card title="Current Announcements" className="mt-6">
        <DataTable
          columns={announcementColumns}
          data={announcements}
          pagination
        />
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card title="Total Announcements">
          <div className="text-3xl font-bold">{announcements.length}</div>
        </Card>

        <Card title="High Priority">
          <div className="text-3xl font-bold">
            {announcements.filter((a) => a.priority === "high").length}
          </div>
        </Card>

        <Card title="Active Announcements">
          <div className="text-3xl font-bold">
            {announcements.filter((a) => a.isActive).length}
          </div>
        </Card>
      </div>
    </div>
  );
};
