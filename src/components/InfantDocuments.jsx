import React, { useState, useEffect, useRef, useCallback } from "react";
import documentService from "../services/documentService";
import { Modal, Button, Input } from "./UI";

/**
 * InfantDocuments Component
 * Handles document upload, viewing, and management for infant profiles
 *
 * Features:
 * - File upload dropzone
 * - Document list with thumbnails for images, icons for PDF/DOCX
 * - View/Download buttons
 * - Delete button with confirmation
 * - Document type filter
 */

export default function InfantDocuments({ infantId, onDocumentChange }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  // Modal state for uploading
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({ documentType: "vaccination_card", description: "" });

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const options = {};
      if (selectedFilter) {
        options.documentType = selectedFilter;
      }

      const response = await documentService.getInfantDocuments(infantId, options);

      if (response.success && response.data) {
        setDocuments(response.data);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error("Error loading documents:", err);
      const errorMessage = err.response?.data?.error || err.message || "";
      // Gracefully handle 404 errors (often happens when infant records migrate tables or are newly created)
      if (err.response?.status === 404 || errorMessage.includes("Infant not found")) {
        setDocuments([]);
        setError(null);
      } else {
        setError(errorMessage || "Failed to load documents");
        setDocuments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [infantId, selectedFilter]);

  // Load documents on mount and when filter changes
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    initiateUploadForm(file);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      initiateUploadForm(files[0]);
    }
  };

  const initiateUploadForm = (file) => {
    // Validate file
    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Allowed: PDF, JPEG, PNG, GIF, DOC, DOCX");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setPendingFile(file);
    setUploadForm({ documentType: "vaccination_card", description: "" });
    setShowUploadModal(true);
  };

  const confirmUpload = async () => {
    if (!pendingFile) return;

    try {
      setUploading(true);
      setError(null);
      setUploadProgress(0);
      setShowUploadModal(false);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await documentService.uploadInfantDocument(
        infantId,
        pendingFile,
        uploadForm.documentType,
        uploadForm.description || null
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success) {
        // Reload documents
        await loadDocuments();

        // Notify parent component
        if (onDocumentChange) {
          onDocumentChange(response.data);
        }
      } else {
        setError(response.message || "Failed to upload document");
      }
    } catch (err) {
      console.error("Error uploading document:", err);
      setError(err.response?.data?.error || err.message || "Failed to upload document");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setPendingFile(null);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const response = await documentService.downloadDocument(documentId);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading document:", err);
      setError(err.response?.data?.error || err.message || "Failed to download document");
    }
  };

  const handleView = async (documentId) => {
    try {
      const response = await documentService.downloadDocument(documentId);

      // Open in new tab for viewing
      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, "_blank");
    } catch (err) {
      console.error("Error viewing document:", err);
      setError(err.response?.data?.error || err.message || "Failed to view document");
    }
  };

  const handleDelete = async (documentId) => {
    try {
      setError(null);
      const response = await documentService.deleteDocument(documentId);

      if (response.success) {
        // Reload documents
        await loadDocuments();

        // Notify parent component
        if (onDocumentChange) {
          onDocumentChange(null);
        }
      } else {
        setError(response.message || "Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      setError(err.response?.data?.error || err.message || "Failed to delete document");
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const getFileIcon = (mimeType) => {
    if (documentService.isImage(mimeType)) {
      return (
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (documentService.isPDF(mimeType)) {
      return (
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (documentService.isWordDocument(mimeType)) {
      return (
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const documentTypeOptions = [
    { value: "", label: "All Types" },
    { value: "vaccination_card", label: "Vaccination Card" },
    { value: "birth_certificate", label: "Birth Certificate" },
    { value: "medical_record", label: "Medical Record" },
    { value: "image", label: "Image" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Documents
        </h3>

        {/* Filter */}
        <select
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {documentTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-700 dark:text-red-300 rounded-md">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 mb-4 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
            : "border-gray-300 dark:border-gray-600 hover:border-indigo-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.jpeg,.jpg,.png,.gif,.doc,.docx"
        />

        {uploading ? (
          <div className="py-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Uploading... {uploadProgress}%
            </p>
          </div>
        ) : (
          <div className="py-4">
            <svg
              className="mx-auto h-10 w-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              PDF, JPEG, PNG, GIF, DOC, DOCX (max 10MB)
            </p>
          </div>
        )}
      </div>

      {/* Document List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Loading documents...
          </p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg
            className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2">No documents found</p>
          <p className="text-sm">Upload your first document using the dropzone above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              {/* File Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  {getFileIcon(doc.mime_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {doc.original_filename}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                      {documentService.getDocumentTypeLabel(doc.document_type)}
                    </span>
                    <span>{documentService.formatFileSize(doc.file_size)}</span>
                    <span>•</span>
                    <span>{documentService.formatDate(doc.uploaded_at)}</span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                      {doc.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4">
                {/* View Button */}
                <button
                  onClick={() => handleView(doc.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="View"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>

                {/* Download Button */}
                <button
                  onClick={() => handleDownload(doc.id, doc.original_filename)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Download"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => setShowDeleteConfirm(doc.id)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Confirm Delete
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete this document? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Details Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setPendingFile(null);
        }}
        title="Upload Document"
        size="md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="cancel" onClick={() => {
              setShowUploadModal(false);
              setPendingFile(null);
            }}>Cancel</Button>
            <Button onClick={confirmUpload} disabled={uploading}>Upload</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Selected file: <span className="font-semibold text-gray-900 dark:text-gray-100">{pendingFile?.name}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type *
            </label>
            <select
              value={uploadForm.documentType}
              onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              required
            >
              <option value="vaccination_card">Vaccination Card</option>
              <option value="birth_certificate">Birth Certificate</option>
              <option value="medical_record">Medical Record</option>
              <option value="image">Image</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <Input
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Enter a brief description..."
              className="w-full"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
