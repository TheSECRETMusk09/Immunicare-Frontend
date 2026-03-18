import React, { useState, useEffect, useCallback } from "react";
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
import { Volume2, Trash2 } from "lucide-react";
import apiClient from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
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

const EMPTY_DELIVERY_SUMMARY = {
  total_recipients: 0,
  pending_count: 0,
  queued_count: 0,
  sent_count: 0,
  delivered_count: 0,
  read_count: 0,
  failed_count: 0,
  cancelled_count: 0,
};

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [deliverySummaryByAnnouncement, setDeliverySummaryByAnnouncement] =
    useState({});
  const [deliverySummaryLoading, setDeliverySummaryLoading] = useState(false);
  const [isPublishingAnnouncementId, setIsPublishingAnnouncementId] =
    useState(null);
  const [isArchivingAnnouncementId, setIsArchivingAnnouncementId] =
    useState(null);
  const [deliveryModalAnnouncement, setDeliveryModalAnnouncement] =
    useState(null);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [deliveryRowsLoading, setDeliveryRowsLoading] = useState(false);
  const [deleteModalAnnouncement, setDeleteModalAnnouncement] = useState(null);
  const [isDeletingAnnouncementId, setIsDeletingAnnouncementId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    target_audience: "all",
    priority: "medium",
    status: "draft",
  });
  const { user } = useAuth();

  // Fetch announcements from API
  const fetchDeliverySummaries = useCallback(async (announcementRows = []) => {
    const ids = (announcementRows || [])
      .map((announcement) => announcement.id)
      .filter((id) => Number.isInteger(parseInt(id, 10)));

    if (ids.length === 0) {
      setDeliverySummaryByAnnouncement({});
      return;
    }

    try {
      setDeliverySummaryLoading(true);
      const summaries =
        await apiClient.getAnnouncementDeliverySummaryForMany(ids);
      setDeliverySummaryByAnnouncement(summaries || {});
    } catch (_error) {
      setDeliverySummaryByAnnouncement({});
    } finally {
      setDeliverySummaryLoading(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAnnouncements();
      const normalized = Array.isArray(data) ? data : [];
      setAnnouncements(normalized);
      await fetchDeliverySummaries(normalized);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching announcements:", err);
      setDeliverySummaryByAnnouncement({});
    } finally {
      setLoading(false);
    }
  }, [fetchDeliverySummaries]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

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

      if (status === "published" && newAnnouncement?.id) {
        await apiClient.publishAnnouncement(newAnnouncement.id);
      }

      await fetchAnnouncements();
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

  const handlePublishAnnouncement = async (announcement) => {
    try {
      setIsPublishingAnnouncementId(announcement.id);
      setError(null);
      await apiClient.publishAnnouncement(announcement.id);
      await fetchAnnouncements();
    } catch (err) {
      setError(err.message || "Failed to publish announcement");
    } finally {
      setIsPublishingAnnouncementId(null);
    }
  };

    const handleArchiveAnnouncement = async (announcement) => {
      try {
        setIsArchivingAnnouncementId(announcement.id);
        setError(null);
        await apiClient.archiveAnnouncement(announcement.id);
        await fetchAnnouncements();
      } catch (err) {
        setError(err.message || "Failed to archive announcement");
      } finally {
        setIsArchivingAnnouncementId(null);
      }
    };

    const handleDeleteAnnouncement = async (announcement) => {
      try {
        setIsDeletingAnnouncementId(announcement.id);
        setError(null);
        await apiClient.deleteAnnouncement(announcement.id);
        // Optimistically remove the announcement from the list
        setAnnouncements(prevAnnouncements => prevAnnouncements.filter(a => a.id !== announcement.id));
        await fetchDeliverySummaries(); // Update delivery summaries
      } catch (err) {
        setError(err.message || "Failed to delete announcement");
        // Refetch announcements on error to ensure consistency
        await fetchAnnouncements();
      } finally {
        setIsDeletingAnnouncementId(null);
        setDeleteModalAnnouncement(null);
      }
    };

  const openDeliveryModal = async (announcement) => {
    try {
      setDeliveryModalAnnouncement(announcement);
      setDeliveryRows([]);
      setDeliveryRowsLoading(true);
      const result = await apiClient.getAnnouncementDeliveries(announcement.id, {
        limit: 200,
        offset: 0,
      });
      setDeliveryRows(Array.isArray(result?.rows) ? result.rows : []);
    } catch (err) {
      setError(err.message || "Failed to load delivery details");
    } finally {
      setDeliveryRowsLoading(false);
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

  const getStatusVariant = (status) => {
    switch (String(status || "").toLowerCase()) {
      case "published":
        return "success";
      case "archived":
        return "secondary";
      case "draft":
      default:
        return "warning";
    }
  };

  const getDeliverySummary = (announcementId) => {
    const summary =
      deliverySummaryByAnnouncement?.[String(announcementId)] ||
      EMPTY_DELIVERY_SUMMARY;
    return {
      ...EMPTY_DELIVERY_SUMMARY,
      ...summary,
    };
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
    <div className="space-y-6 px-6">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6 -mx-6 -mt-6">
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
      </div>

      {error && (
        <Alert variant="error" className="mb-4" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="animate-fade-in px-6 -mx-6">
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
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                        {announcement.title}
                      </h3>
                      <Badge variant={getStatusVariant(announcement.status)}>
                        {announcement.status || "draft"}
                      </Badge>
                      <Badge variant="secondary">
                        {announcement.target_audience || "all"}
                      </Badge>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
                      {announcement.content}
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      Posted on{" "}
                      {new Date(
                        announcement.created_at || announcement.date,
                      ).toLocaleDateString()}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {deliverySummaryLoading ? (
                        <span className="text-gray-500">Loading delivery summary...</span>
                      ) : (
                        <>
                          <Badge variant="secondary">
                            Recipients: {getDeliverySummary(announcement.id).total_recipients}
                          </Badge>
                          <Badge variant="success">
                            Delivered: {getDeliverySummary(announcement.id).delivered_count}
                          </Badge>
                          <Badge variant="warning">
                            Pending: {getDeliverySummary(announcement.id).pending_count}
                          </Badge>
                          <Badge variant="info">
                            Read: {getDeliverySummary(announcement.id).read_count}
                          </Badge>
                          <Badge variant="danger">
                            Failed: {getDeliverySummary(announcement.id).failed_count}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                     <div className="flex flex-col items-end gap-2">
                       <Badge variant={getPriorityVariant(announcement.priority)}>
                         {announcement.priority}
                       </Badge>
                       <div className="flex flex-wrap justify-end gap-2">
                         {announcement.status === "draft" && (
                           <Button
                             variant="primary"
                             size="sm"
                             onClick={() => handlePublishAnnouncement(announcement)}
                             disabled={isPublishingAnnouncementId === announcement.id}
                             loading={isPublishingAnnouncementId === announcement.id}
                           >
                             Publish
                           </Button>
                         )}
                         {announcement.status === "published" && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleArchiveAnnouncement(announcement)}
                             disabled={isArchivingAnnouncementId === announcement.id}
                             loading={isArchivingAnnouncementId === announcement.id}
                           >
                             Archive
                           </Button>
                         )}
                         {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'SYSTEM_ADMIN') && (
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               setDeleteModalAnnouncement(announcement);
                             }}
                             disabled={isDeletingAnnouncementId === announcement.id}
                             loading={isDeletingAnnouncementId === announcement.id}
                           >
                             Delete
                           </Button>
                         )}
                         <Button
                           variant="secondary"
                           size="sm"
                           onClick={() => openDeliveryModal(announcement)}
                         >
                           Delivery Details
                         </Button>
                       </div>
                     </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

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

       {/* Delivery details modal */}
       <Modal
         isOpen={Boolean(deliveryModalAnnouncement)}
         onClose={() => setDeliveryModalAnnouncement(null)}
         title={`Delivery Details${deliveryModalAnnouncement ? ": " + deliveryModalAnnouncement.title : ""}`}
         size="lg"
         footer={
           <AdminModalActions>
             <Button
               variant="cancel"
               type="button"
               onClick={() => setDeliveryModalAnnouncement(null)}
             >
               Close
             </Button>
           </AdminModalActions>
         }
       >
         {deliveryRowsLoading ? (
           <div className="py-6 text-sm text-gray-500">Loading delivery details...</div>
         ) : deliveryRows.length === 0 ? (
           <div className="py-6 text-sm text-gray-500">
             No delivery records found for this announcement.
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="w-full text-sm">
               <thead>
                 <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                   <th className="py-2 pr-3">Recipient</th>
                   <th className="py-2 pr-3">Audience</th>
                   <th className="py-2 pr-3">Status</th>
                   <th className="py-2 pr-3">Attempts</th>
                   <th className="py-2 pr-3">Delivered At</th>
                 </tr>
               </thead>
               <tbody>
                 {deliveryRows.map((row) => (
                   <tr
                     key={row.id}
                     className="border-b border-gray-100 dark:border-gray-800"
                   >
                     <td className="py-2 pr-3">{row.recipient_label || "N/A"}</td>
                     <td className="py-2 pr-3">{row.resolved_target_audience || "N/A"}</td>
                     <td className="py-2 pr-3">
                       <Badge variant={getStatusVariant(row.delivery_status)}>
                         {row.delivery_status || "pending"}
                       </Badge>
                     </td>
                     <td className="py-2 pr-3">{row.delivery_attempts ?? 0}</td>
                     <td className="py-2 pr-3">
                       {row.delivered_at
                         ? new Date(row.delivered_at).toLocaleString()
                         : "-"}
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}
       </Modal>

       {/* Delete Confirmation Modal */}
       <Modal
         isOpen={Boolean(deleteModalAnnouncement)}
         onClose={() => setDeleteModalAnnouncement(null)}
         title="Delete Announcement"
         size="sm"
         footer={
           <div className="flex justify-end space-x-3">
             <Button
               variant="cancel"
               type="button"
               onClick={() => setDeleteModalAnnouncement(null)}
               disabled={isDeletingAnnouncementId === deleteModalAnnouncement?.id}
             >
               Cancel
             </Button>
             <Button
               variant="danger"
               type="button"
               onClick={() => handleDeleteAnnouncement(deleteModalAnnouncement)}
               disabled={isDeletingAnnouncementId === deleteModalAnnouncement?.id}
               loading={isDeletingAnnouncementId === deleteModalAnnouncement?.id}
             >
               {isDeletingAnnouncementId === deleteModalAnnouncement?.id ? "Deleting..." : "Delete"}
             </Button>
           </div>
         }
       >
         {deleteModalAnnouncement && (
           <div className="space-y-4">
             <div className="flex items-center justify-center mb-4">
               <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                 <Trash2 className="w-6 h-6" />
               </div>
             </div>
             <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center">
               Are you sure you want to delete this announcement?
             </h3>
             <p className="text-gray-600 dark:text-gray-400 text-center">
               This action cannot be undone. The announcement will be permanently removed.
             </p>
             <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded">
               <p className="font-medium text-gray-900 dark:text-gray-100">
                 {deleteModalAnnouncement.title}
               </p>
               <p className="text-gray-500 dark:text-gray-400 text-sm">
                 Posted on{" "}
                 {new Date(
                   deleteModalAnnouncement.created_at || deleteModalAnnouncement.date,
                 ).toLocaleDateString()}
               </p>
             </div>
           </div>
         )}
       </Modal>
    </div>
  );
};

export default Announcements;
