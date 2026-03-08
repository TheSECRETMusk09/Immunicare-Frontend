import React, { useState, useEffect } from "react";
import {
  AdminModalActions,
  Card,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Alert,
  PageHeader,
} from "../components/UI";
import { Volume2 } from "lucide-react";
import apiClient from "../utils/api";
import {
  findDuplicateRecord,
  hasFieldErrors,
  normalizeEnumValue,
  sanitizeText,
  validateLength,
  validateRequired,
} from "../utils/adminFormValidation";

const AUDIENCE_OPTIONS = ["all", "patients", "staff"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const STATUS_OPTIONS = ["draft", "published", "archived"];

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    target_audience: "all",
    priority: "medium",
    status: "draft",
  });

  // Fetch announcements from API
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    const title = sanitizeText(formData.title, { maxLength: 150 });
    const content = sanitizeText(formData.content, {
      maxLength: 2000,
      preserveNewLines: true,
    });
    const targetAudience = normalizeEnumValue(
      formData.target_audience,
      AUDIENCE_OPTIONS,
      "all",
    );
    const priority = normalizeEnumValue(
      formData.priority,
      PRIORITY_OPTIONS,
      "medium",
    );
    const status = normalizeEnumValue(formData.status, STATUS_OPTIONS, "draft");

    const nextErrors = {};
    const titleRequired = validateRequired(title, "Title is required.");
    if (titleRequired) {
      nextErrors.title = titleRequired;
    } else {
      const titleLengthError = validateLength(title, {
        min: 3,
        max: 150,
        label: "Title",
      });
      if (titleLengthError) {
        nextErrors.title = titleLengthError;
      }
    }

    const contentRequired = validateRequired(content, "Content is required.");
    if (contentRequired) {
      nextErrors.content = contentRequired;
    } else {
      const contentLengthError = validateLength(content, {
        min: 10,
        max: 2000,
        label: "Content",
      });
      if (contentLengthError) {
        nextErrors.content = contentLengthError;
      }
    }

    if (!AUDIENCE_OPTIONS.includes(targetAudience)) {
      nextErrors.target_audience = "Target audience is invalid.";
    }

    if (!PRIORITY_OPTIONS.includes(priority)) {
      nextErrors.priority = "Priority is invalid.";
    }

    if (!STATUS_OPTIONS.includes(status)) {
      nextErrors.status = "Status is invalid.";
    }

    const duplicate = findDuplicateRecord({
      records: announcements.filter(
        (announcement) =>
          String(announcement.status || "")
            .trim()
            .toLowerCase() !== "archived",
      ),
      candidate: { title, content },
      keys: ["title", "content"],
    });

    if (duplicate) {
      nextErrors.title =
        "An active announcement with the same title already exists.";
      nextErrors.content =
        "An active announcement with the same content already exists.";
    }

    if (hasFieldErrors(nextErrors)) {
      setFormErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setFormErrors({});
      const payload = {
        title,
        content,
        target_audience: targetAudience,
        priority,
        status,
      };
      const newAnnouncement = await apiClient.createAnnouncement(payload);
      setAnnouncements([newAnnouncement, ...announcements]);
      setShowCreateModal(false);
      setFormData({
        title: "",
        content: "",
        target_audience: "all",
        priority: "medium",
        status: "draft",
      });
      setFormErrors({});
    } catch (err) {
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setFormErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      setError(err.message || "Failed to create announcement");
      console.error("Error creating announcement:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const getPriorityVariant = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "danger";
      case "medium":
        return "warning";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-40 ml-auto"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Announcements"
        subtitle="Create and manage facility announcements and updates"
        icon={<Volume2 className="w-6 h-6" />}
        actions={
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Create Announcement
          </Button>
        }
      />

      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {announcements.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📢</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No Announcements
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              There are no announcements yet. Create one to get started.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    {announcement.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                    {announcement.content}
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Posted on{" "}
                    {new Date(
                      announcement.created_at || announcement.date,
                    ).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={getPriorityVariant(announcement.priority)}>
                  {announcement.priority}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Announcement Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormErrors({});
        }}
        title="Create New Announcement"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                setFormErrors({});
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="announcementCreateForm"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Announcement"}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="announcementCreateForm" className="admin-form" onSubmit={handleCreateAnnouncement}>
          {hasFieldErrors(formErrors) && (
            <Alert variant="error" className="mb-2">
              Please resolve the highlighted field errors before submitting.
            </Alert>
          )}

          <div className="admin-field-group">
            <label className="admin-field-label required">Title</label>
            <Input
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter announcement title"
              disabled={isSubmitting}
              error={formErrors.title}
              maxLength={150}
            />
          </div>

          <div className="admin-field-group">
            <label className="admin-field-label required">Content</label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="Enter announcement content"
              rows={4}
              disabled={isSubmitting}
              className={`admin-textarea ${formErrors.content ? "admin-textarea-error" : ""}`}
              maxLength={2000}
            />
            {formErrors.content && (
              <span className="admin-field-error">{formErrors.content}</span>
            )}
          </div>

          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <label className="admin-field-label required">Target Audience</label>
              <Select
                name="target_audience"
                value={formData.target_audience}
                onChange={handleInputChange}
                disabled={isSubmitting}
                error={formErrors.target_audience}
              >
                <option value="all">All Users</option>
                <option value="patients">Guardians / Patients</option>
                <option value="staff">Staff</option>
              </Select>
            </div>

            <div className="admin-field-group">
              <label className="admin-field-label required">Priority</label>
              <Select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                disabled={isSubmitting}
                error={formErrors.priority}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>

            <div className="admin-field-group">
              <label className="admin-field-label required">Status</label>
              <Select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                disabled={isSubmitting}
                error={formErrors.status}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Announcements;
