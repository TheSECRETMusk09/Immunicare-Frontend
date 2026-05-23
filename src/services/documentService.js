/**
 * Document Service
 * Handles all infant document-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const API_BASE = "/infant-documents";

const documentService = {
  /**
   * Upload a document for an infant
   * @param {number} infantId - The infant's ID
   * @param {File} file - The file to upload
   * @param {string} documentType - Type of document (vaccination_card, birth_certificate, medical_record, image, other)
   * @param {string} description - Optional description
   * @returns {Promise<Object>}
   */
  async uploadInfantDocument(infantId, file, documentType, description = null) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", documentType);
    if (description) {
      formData.append("description", description);
    }

    return handleApiResponse(
      apiClient.request(`${API_BASE}/${infantId}`, {
        method: "POST",
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
      "Upload infant document"
    );
  },

  /**
   * Get all documents for an infant
   * @param {number} infantId - The infant's ID
   * @param {Object} options - Optional filters (documentType, limit, offset)
   * @returns {Promise<Object>}
   */
  async getInfantDocuments(infantId, options = {}) {
    const { documentType, limit = 50, offset = 0 } = options;

    const params = new URLSearchParams();
    if (documentType) params.append("documentType", documentType);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const queryString = params.toString();
    const endpoint = queryString
      ? `${API_BASE}/${infantId}?${queryString}`
      : `${API_BASE}/${infantId}`;

    return handleApiResponse(
      apiClient.request(endpoint, { disableRetry: true }),
      "Fetch infant documents"
    );
  },

  /**
   * Get document metadata/info
   * @param {number} documentId - The document's ID
   * @returns {Promise<Object>}
   */
  async getDocumentInfo(documentId) {
    return handleApiResponse(
      apiClient.request(`${API_BASE}/info/${documentId}`),
      "Fetch document info"
    );
  },

  /**
   * Download/view a document
   * @param {number} documentId - The document's ID
   * @returns {Promise<Blob>}
   */
  async downloadDocument(documentId) {
    try {
      const response = await apiClient.customRequest(`${API_BASE}/file/${documentId}`, {
        method: "GET",
        responseType: "blob",
      });
      return response;
    } catch (error) {
      console.error("Error downloading document:", error);
      throw error;
    }
  },

  /**
   * Update document metadata
   * @param {number} documentId - The document's ID
   * @param {Object} updateData - Data to update (documentType, description)
   * @returns {Promise<Object>}
   */
  async updateDocument(documentId, updateData) {
    return handleApiResponse(
      apiClient.request(`${API_BASE}/${documentId}`, {
        method: "PUT",
        data: updateData,
      }),
      "Update document"
    );
  },

  /**
   * Delete a document (soft delete)
   * @param {number} documentId - The document's ID
   * @returns {Promise<Object>}
   */
  async deleteDocument(documentId) {
    return handleApiResponse(
      apiClient.request(`${API_BASE}/${documentId}`, {
        method: "DELETE",
      }),
      "Delete document"
    );
  },

  /**
   * Get document type label for display
   * @param {string} documentType - The document type
   * @returns {string}
   */
  getDocumentTypeLabel(documentType) {
    const labels = {
      vaccination_card: "Vaccination Card",
      birth_certificate: "Birth Certificate",
      medical_record: "Medical Record",
      image: "Image",
      other: "Other",
    };
    return labels[documentType] || documentType;
  },

  /**
   * Get document type options for form select
   * @returns {Array<{value: string, label: string}>}
   */
  getDocumentTypeOptions() {
    return [
      { value: "vaccination_card", label: "Vaccination Card" },
      { value: "birth_certificate", label: "Birth Certificate" },
      { value: "medical_record", label: "Medical Record" },
      { value: "image", label: "Image" },
      { value: "other", label: "Other" },
    ];
  },

  /**
   * Check if file is an image
   * @param {string} mimeType - The MIME type
   * @returns {boolean}
   */
  isImage(mimeType) {
    return mimeType && mimeType.startsWith("image/");
  },

  /**
   * Check if file is a PDF
   * @param {string} mimeType - The MIME type
   * @returns {boolean}
   */
  isPDF(mimeType) {
    return mimeType === "application/pdf";
  },

  /**
   * Check if file is a Word document
   * @param {string} mimeType - The MIME type
   * @returns {boolean}
   */
  isWordDocument(mimeType) {
    return (
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  },

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  /**
   * Format date for display
   * @param {string|Date} date - Date string or Date object
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  /**
   * Get file icon based on MIME type
   * @param {string} mimeType - The MIME type
   * @returns {string} - Icon class or name
   */
  getFileIcon(mimeType) {
    if (this.isImage(mimeType)) return "image";
    if (this.isPDF(mimeType)) return "pdf";
    if (this.isWordDocument(mimeType)) return "word";
    return "file";
  },
};

export default documentService;
