/**
 * DocumentChecklist Component
 * Displays required documents and items checklist for vaccination appointments
 * Helps parents remember what to bring to appointments
 * Each item is clickable to upload a file
 * Radio button shows upload status: unfilled when not uploaded, emerald filled when uploaded
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import documentService from "../../services/documentService";
import {
  Circle,
  FileText,
  BookOpen,
  Heart,
  ClipboardList,
  Upload,
  X,
  AlertCircle,
  File,
  Eye,
  Trash2,
  CheckCircle,
} from "lucide-react";

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.doc', '.docx', '.pdf'];
// Disallowed file extensions (including JSON)
const DISALLOWED_EXTENSIONS = ['.json', '.js', '.exe', '.zip', '.rar'];
// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validates file type based on extension and MIME type
 * @param {File} file - The file to validate
 * @returns {object} - { valid: boolean, error: string }
 */
const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  // Get file extension
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));

  // Check for disallowed extensions first (especially JSON)
  if (DISALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type "${extension}" is not allowed. Allowed types: JPEG, PNG, WEBP, GIF, DOC, DOCX, PDF.`
    };
  }

  // Check allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type "${extension}". Allowed types: JPEG, PNG, WEBP, GIF, DOC, DOCX, PDF.`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit. Selected file: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }

  return { valid: true, error: null };
};

/**
 * Get MIME type validation
 * @param {File} file - The file to validate
 * @returns {boolean}
 */
const isValidMimeType = (file) => {
  const validMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  return validMimeTypes.includes(file.type);
};

const formatFileSize = (bytes = 0) => {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const isImageFile = (mimeType = "") => String(mimeType).startsWith("image/");
const isPdfFile = (mimeType = "") => String(mimeType) === "application/pdf";
const isWordFile = (mimeType = "") =>
  mimeType === "application/msword" ||
  mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const CHECKLIST_DESCRIPTION_PREFIX = "guardian_checklist:";

export const CHECKLIST_ITEMS = [
  {
    id: "birth_cert",
    documentType: "birth_certificate",
    label: "Birth Certificate (Original)",
    description: "Original birth certificate for verification",
    icon: BookOpen,
  },
  {
    id: "parent_id",
    documentType: "other",
    label: "Parent/Guardian Valid ID",
    description: "Any valid government ID",
    icon: FileText,
  },
  {
    id: "medbook",
    documentType: "medical_record",
    label: "Mother's / Child's Medical Book",
    description: "Pink book or vaccination record",
    icon: BookOpen,
  },
  {
    id: "previous_records",
    documentType: "vaccination_card",
    label: "Previous Vaccination Records",
    description: "If this is not the first vaccination",
    icon: ClipboardList,
  },
  {
    id: "consent_form",
    documentType: "other",
    label: "Signed Consent Form",
    description: "Will be provided at the facility",
    icon: FileText,
    optional: true,
  },
  {
    id: "insurance",
    documentType: "other",
    label: "Health Insurance Card (if applicable)",
    description: "PhilHealth or private insurance",
    icon: Heart,
    optional: true,
  },
];

const normalizeChecklistSearchText = (...values) =>
  values
    .flat()
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

const includesChecklistKeyword = (text, keywords = []) =>
  keywords.some((keyword) => text.includes(keyword));

export const resolveChecklistItemIdFromDocument = (doc = {}) => {
  const explicitChecklistItemId = String(
    doc.checklist_item_id || doc.checklistItemId || "",
  ).trim();
  if (explicitChecklistItemId) {
    return explicitChecklistItemId;
  }

  const description = String(doc.description || "");
  const markerMatch = description.match(
    new RegExp(`${CHECKLIST_DESCRIPTION_PREFIX}([^\\s|]+)`),
  );
  if (markerMatch?.[1]) {
    return markerMatch[1];
  }

  const searchText = normalizeChecklistSearchText(
    description,
    doc.original_filename,
    doc.file_name,
    doc.filename,
    doc.name,
    doc.document_type,
    doc.documentType,
  );

  if (
    doc.document_type === "birth_certificate" ||
    doc.documentType === "birth_certificate" ||
    includesChecklistKeyword(searchText, ["birth certificate"])
  ) {
    return "birth_cert";
  }

  if (
    doc.document_type === "medical_record" ||
    doc.documentType === "medical_record" ||
    includesChecklistKeyword(searchText, [
      "medical book",
      "mother's medical book",
      "child's medical book",
      "pink book",
      "medical record",
    ])
  ) {
    return "medbook";
  }

  if (
    doc.document_type === "vaccination_card" ||
    doc.documentType === "vaccination_card" ||
    includesChecklistKeyword(searchText, [
      "previous vaccination",
      "vaccination record",
      "vaccination records",
      "vaccination card",
      "immunization record",
    ])
  ) {
    return "previous_records";
  }

  if (
    includesChecklistKeyword(searchText, [
      "parent guardian valid id",
      "parent/guardian valid id",
      "guardian valid id",
      "parent valid id",
      "government id",
      "guardian id",
      "parent id",
      "valid id",
    ])
  ) {
    return "parent_id";
  }

  if (
    includesChecklistKeyword(searchText, [
      "signed consent form",
      "consent form",
      "signed consent",
    ])
  ) {
    return "consent_form";
  }

  if (
    includesChecklistKeyword(searchText, [
      "health insurance",
      "insurance card",
      "insurance",
      "philhealth",
    ])
  ) {
    return "insurance";
  }

  return null;
};

const DocumentChecklist = ({ showStatus = true, onFilesChange, infantId = null }) => {
  const fileInputRef = useRef(null);
  const uploadedFilesRef = useRef({});
  const previewBlobUrlRef = useRef("");
  // Track uploaded files by item ID: { [itemId]: { name, size, type, file } }
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [uploadError, setUploadError] = useState(null);
  // Track currently selected item for upload
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);

  // Default required documents and items for vaccination appointments
  const defaultItems = CHECKLIST_ITEMS;

  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
    if (onFilesChange) {
      onFilesChange(uploadedFiles);
    }
  }, [uploadedFiles, onFilesChange]);

  const revokeFilePreviewUrl = useCallback((fileData) => {
    if (fileData?.previewUrl) {
      URL.revokeObjectURL(fileData.previewUrl);
    }
  }, []);

  const rememberUploadedFiles = useCallback((filesByItem) => {
    uploadedFilesRef.current = filesByItem;
  }, []);

  const resolvePersistedDocumentId = useCallback((doc = {}) =>
    doc.id || doc.document_id || doc.documentId || doc.data?.id || doc.data?.document_id || null, []);

  const normalizeDocumentUploadResponse = useCallback((response = {}) => {
    const candidate =
      response?.data?.data ||
      response?.data?.document ||
      response?.document ||
      response?.data ||
      response;
    const persistedId = resolvePersistedDocumentId(candidate) || resolvePersistedDocumentId(response);

    return persistedId
      ? {
          ...candidate,
          id: persistedId,
          document_id: candidate?.document_id || persistedId,
          documentId: candidate?.documentId || persistedId,
        }
      : candidate;
  }, [resolvePersistedDocumentId]);

  const getPersistedFileData = useCallback((doc = {}) => {
    const persistedId = resolvePersistedDocumentId(doc);

    return {
      name: doc.original_filename || doc.file_name || doc.filename || doc.name || "",
      size: doc.file_size || doc.size || 0,
      type: doc.mime_type || doc.file_type || doc.type || "",
      lastModified: doc.uploaded_at ? new Date(doc.uploaded_at).getTime() : null,
      file: null,
      persisting: false,
      previewUrl: "",
      persistedId,
      downloadUrl:
        doc.downloadUrl ||
        doc.download_url ||
        doc.fileUrl ||
        doc.file_url ||
        (persistedId ? `/api/infant-documents/file/${persistedId}` : ""),
      documentType: doc.document_type || doc.documentType,
      description: doc.description,
    };
  }, [resolvePersistedDocumentId]);

  const getChecklistItemFromDocument = useCallback((doc, restoredFiles) => {
    const checklistItemId = resolveChecklistItemIdFromDocument(doc);
    if (checklistItemId) {
      return CHECKLIST_ITEMS.find(
        (item) => item.id === checklistItemId && !restoredFiles[item.id],
      );
    }

    return CHECKLIST_ITEMS.find(
      (item) =>
        item.documentType === doc.document_type &&
        item.documentType !== "other" &&
        !restoredFiles[item.id],
    );
  }, []);

  const persistChecklistFile = useCallback(async (item, itemId, file, localFileData, previousFile) => {
    const parsedInfantId = Number.parseInt(infantId, 10);
    if (!Number.isFinite(parsedInfantId) || parsedInfantId <= 0) {
      return;
    }

    try {
      const response = await documentService.uploadInfantDocument(
        parsedInfantId,
        file,
        item.documentType,
        `${CHECKLIST_DESCRIPTION_PREFIX}${itemId}`,
      );
      if (!response?.success) {
        throw new Error(response?.error || response?.message || "Document upload failed");
      }

      const persistedDoc = normalizeDocumentUploadResponse(response);
      const persistedDocId = resolvePersistedDocumentId(persistedDoc);

      if (!persistedDocId) {
        throw new Error("Upload succeeded but did not return a document ID");
      }

      const currentFile = uploadedFilesRef.current[itemId];
      const isStillCurrent =
        currentFile?.previewUrl === localFileData.previewUrl &&
        currentFile?.lastModified === localFileData.lastModified &&
        currentFile?.name === localFileData.name;

      if (!isStillCurrent) {
        await documentService.deleteDocument(persistedDocId).catch((deleteError) => {
          console.error("Failed to remove superseded checklist document:", deleteError);
        });
        return;
      }

      const persistedFileData = getPersistedFileData({
        ...persistedDoc,
        id: persistedDocId,
      });

      setUploadedFiles((prev) => {
        const nextFiles = {
          ...prev,
          [itemId]: persistedFileData,
        };
        revokeFilePreviewUrl(prev[itemId]);
        rememberUploadedFiles(nextFiles);
        return nextFiles;
      });

      if (previousFile?.persistedId && previousFile.persistedId !== persistedDocId) {
        await documentService.deleteDocument(previousFile.persistedId).catch((deleteError) => {
          console.error("Failed to remove replaced checklist document:", deleteError);
        });
      }

      setUploadError(null);
    } catch (error) {
      console.error("Failed to persist appointment checklist document:", error);
      setUploadError("File selected but could not be saved. Please try uploading it again.");
    }
  }, [
    getPersistedFileData,
    infantId,
    normalizeDocumentUploadResponse,
    rememberUploadedFiles,
    resolvePersistedDocumentId,
    revokeFilePreviewUrl,
  ]);

  useEffect(() => () => {
    Object.values(uploadedFilesRef.current).forEach((fileData) => {
      if (fileData?.previewUrl) {
        URL.revokeObjectURL(fileData.previewUrl);
      }
    });
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
    }
  }, []);

  useEffect(() => {
    const parsedInfantId = Number.parseInt(infantId, 10);
    if (!Number.isFinite(parsedInfantId) || parsedInfantId <= 0) {
      return;
    }

    let isActive = true;

    const loadPersistedChecklistFiles = async () => {
      try {
        const response = await documentService.getInfantDocuments(parsedInfantId);
        if (!isActive) {
          return;
        }

        const documents = Array.isArray(response?.data) ? response.data : [];
        const restoredFiles = {};

        documents.forEach((doc) => {
          const matchingItem = getChecklistItemFromDocument(doc, restoredFiles);

          if (!matchingItem || restoredFiles[matchingItem.id]) {
            return;
          }

          restoredFiles[matchingItem.id] = getPersistedFileData(doc);
        });

        setUploadedFiles((prev) => {
          const localOnlyFiles = Object.fromEntries(
            Object.entries(prev).filter(([, fileData]) => fileData?.file && !fileData?.persistedId),
          );
          const nextFiles = {
            ...restoredFiles,
            ...localOnlyFiles,
          };

          Object.values(prev).forEach((fileData) => {
            const stillUsed = Object.values(nextFiles).some(
              (nextFile) => nextFile?.previewUrl === fileData?.previewUrl,
            );
            if (fileData?.previewUrl && !stillUsed) {
              URL.revokeObjectURL(fileData.previewUrl);
            }
          });
          rememberUploadedFiles(nextFiles);
          return nextFiles;
        });
      } catch (loadError) {
        if (isActive) {
          console.error("Failed to load persisted appointment checklist documents:", loadError);
        }
      }
    };

    loadPersistedChecklistFiles();

    return () => {
      isActive = false;
    };
  }, [getChecklistItemFromDocument, getPersistedFileData, infantId, rememberUploadedFiles]);

  useEffect(() => {
    const parsedInfantId = Number.parseInt(infantId, 10);
    if (!Number.isFinite(parsedInfantId) || parsedInfantId <= 0) {
      return;
    }

    Object.entries(uploadedFilesRef.current).forEach(([itemId, fileData]) => {
      if (!fileData?.file || fileData?.persistedId) {
        return;
      }

      const checklistItem = CHECKLIST_ITEMS.find((item) => item.id === itemId);
      if (!checklistItem) {
        return;
      }

      const uploadFileData = {
        ...fileData,
        persisting: true,
      };

      setUploadedFiles((prev) => {
        const currentFile = prev[itemId];
        if (
          currentFile?.previewUrl !== fileData.previewUrl ||
          currentFile?.lastModified !== fileData.lastModified ||
          currentFile?.name !== fileData.name
        ) {
          return prev;
        }

        const nextFiles = {
          ...prev,
          [itemId]: uploadFileData,
        };
        rememberUploadedFiles(nextFiles);
        return nextFiles;
      });

      persistChecklistFile(checklistItem, itemId, fileData.file, uploadFileData, null);
    });
  }, [infantId, persistChecklistFile, rememberUploadedFiles]);

  // Handle click on checklist item - trigger file upload
  const handleItemClick = (itemId) => {
    setSelectedItemId(itemId);
    setUploadError(null);
    // Trigger hidden file input
    fileInputRef.current?.click();
  };

  // Handle file selection from the hidden input
  const handleFileSelect = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!selectedItemId) return;

    const file = files[0];
    const selectedItem = defaultItems.find((item) => item.id === selectedItemId);
    if (!selectedItem) return;

    setUploadError(null);

    // Validate file type and size
    const validation = validateFile(file);

    if (!validation.valid) {
      setUploadError(validation.error);
      // Clear the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Additional MIME type check
    if (!isValidMimeType(file)) {
      setUploadError(`Invalid file MIME type. Please upload a valid image (JPEG, PNG, WEBP, GIF) or document (PDF, DOC, DOCX).`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // File is valid - store it for the selected item
    const previousFile = uploadedFiles[selectedItemId];
    revokeFilePreviewUrl(previousFile);

    const canPreviewWithObjectUrl = isImageFile(file.type) || isPdfFile(file.type);
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file,
      persisting: true,
      previewUrl: canPreviewWithObjectUrl ? URL.createObjectURL(file) : "",
    };

    // Update uploaded files state
    setUploadedFiles(prev => {
      const nextFiles = {
        ...prev,
        [selectedItemId]: fileData
      };
      rememberUploadedFiles(nextFiles);
      return nextFiles;
    });

    persistChecklistFile(selectedItem, selectedItemId, file, fileData, previousFile);

    // Clear the input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Check if an item has been uploaded
  const isItemUploaded = (itemId) => {
    return !!uploadedFiles[itemId];
  };

  // Get uploaded file name for an item
  const getUploadedFileName = (itemId) => {
    return uploadedFiles[itemId]?.name || null;
  };

  // Remove uploaded file from an item
  const handleRemoveFile = async (e, itemId) => {
    e.stopPropagation(); // Prevent triggering upload
    const fileData = uploadedFilesRef.current[itemId] || uploadedFiles[itemId];

    if (fileData?.persistedId) {
      try {
        setUploadError(null);
        const deleteResponse = await documentService.deleteDocument(fileData.persistedId);
        if (!deleteResponse?.success) {
          throw new Error(deleteResponse?.error || deleteResponse?.message || "Document delete failed");
        }
      } catch (error) {
        console.error("Failed to delete appointment checklist document:", error);
        setUploadError("Could not remove this uploaded document. Please try again.");
        return;
      }
    }

    setUploadedFiles(prev => {
      const newState = { ...prev };
      revokeFilePreviewUrl(newState[itemId]);
      delete newState[itemId];
      rememberUploadedFiles(newState);
      return newState;
    });
  };

  const handleReplaceFile = (event, itemId) => {
    event.stopPropagation();
    handleItemClick(itemId);
  };

  const getFileMimeType = (fileData = {}) =>
    fileData.type || fileData.mime_type || fileData.mimeType || "";

  const getFilePreviewUrl = (fileData = {}) =>
    fileData.previewUrl ||
    fileData.downloadUrl ||
    fileData.download_url ||
    fileData.fileUrl ||
    fileData.file_url ||
    fileData.url ||
    "";

  const closePreviewModal = () => {
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = "";
    }
    setPreviewModal(null);
  };

  const handlePreviewFile = async (event, itemId) => {
    event.stopPropagation();
    const fileData = uploadedFiles[itemId];
    if (!fileData) return;

    // Local file already has a valid blob URL — open modal immediately
    if (fileData.previewUrl) {
      setPreviewModal(fileData);
      return;
    }

    // Persisted file (uploaded in a previous session): fetch via authenticated API
    // so auth-protected content is served with the correct Authorization header
    if (fileData.persistedId) {
      try {
        const response = await documentService.downloadDocument(fileData.persistedId);
        if (previewBlobUrlRef.current) {
          URL.revokeObjectURL(previewBlobUrlRef.current);
        }
        const blobType = fileData.type || "application/octet-stream";
        const blob =
          response.data instanceof Blob
            ? response.data
            : new Blob([response.data], { type: blobType });
        const blobUrl = URL.createObjectURL(blob);
        previewBlobUrlRef.current = blobUrl;
        setPreviewModal({ ...fileData, previewUrl: blobUrl });
      } catch (err) {
        console.error("Failed to load document preview:", err);
        // Still open modal — it will show the fallback message
        setPreviewModal(fileData);
      }
      return;
    }

    setPreviewModal(fileData);
  };

  const renderFilePreview = (fileData) => {
    const mimeType = getFileMimeType(fileData);
    const previewUrl = getFilePreviewUrl(fileData);

    if (isImageFile(mimeType) && previewUrl) {
      return (
        <img
          src={previewUrl}
          alt={`${fileData.name} preview`}
          className="w-12 h-12 rounded-lg border border-emerald-200 object-cover dark:border-emerald-800"
        />
      );
    }

    if (isPdfFile(mimeType)) {
      return (
        <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-center">
          <FileText className="w-6 h-6 text-red-500" />
        </div>
      );
    }

    return (
      <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
        <FileText className={`w-6 h-6 ${isWordFile(mimeType) ? "text-blue-500" : "text-gray-500"}`} />
      </div>
    );
  };

  const requiredUploadedCount = defaultItems.filter(
    (item) => !item.optional && uploadedFiles[item.id],
  ).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <ClipboardList className="w-5 h-5" />
          <h3 className="font-bold text-sm sm:text-base">
            Required Documents Checklist
          </h3>
        </div>
        <p className="text-emerald-100 text-xs mt-1">
          Tap on a document to upload your file
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpeg,.jpg,.png,.webp,.gif,.doc,.docx,.pdf"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload document"
      />

      {/* Error message */}
      {uploadError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                Upload Error
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {uploadError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className="p-4 space-y-3">
        {defaultItems.map((item) => {
          const Icon = item.icon;
          const isUploaded = isItemUploaded(item.id);
          const uploadedFileName = getUploadedFileName(item.id);
          const uploadedFile = uploadedFiles[item.id];

          return (
            <div
              key={item.id}
              onClick={() => !isUploaded && handleItemClick(item.id)}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                isUploaded
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-700"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isUploaded
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-gray-200 dark:bg-gray-600"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isUploaded
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-semibold text-sm ${
                      isUploaded
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {item.label}
                  </h4>
                  {item.optional && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-full">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.description}
                </p>

                {/* Uploaded file name */}
                {isUploaded && uploadedFile && uploadedFileName && (
                  <button
                    type="button"
                    onClick={(event) => handleReplaceFile(event, item.id)}
                    className="mt-2 flex w-full min-w-0 items-center gap-2 rounded-lg text-left hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30"
                    aria-label={`Replace ${uploadedFileName}`}
                  >
                    <div className="flex-shrink-0">
                      {renderFilePreview(uploadedFile)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {uploadedFileName}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {formatFileSize(uploadedFile.size)}
                      </p>
                    </div>
                  </button>
                )}
              </div>

              {/* Upload status - Radio button indicator - using Circle for pending indicators */}
              {showStatus && (
                <div className="flex-shrink-0 flex items-center gap-2">
                  {isUploaded ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    // Using Circle component for pending document indicators
                    <Circle className="w-6 h-6 text-gray-300 dark:text-gray-500" />
                  )}

                  {isUploaded ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => handlePreviewFile(event, item.id)}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                        aria-label={`Preview ${uploadedFileName}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleRemoveFile(event, item.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                        aria-label={`Remove ${uploadedFileName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        Upload
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Image and document preview modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4"
          onClick={closePreviewModal}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white p-4 shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePreviewModal}
              className="absolute right-3 top-3 rounded-full bg-gray-100 p-1 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-h-[82vh] overflow-auto pt-8">
              {isImageFile(getFileMimeType(previewModal)) && getFilePreviewUrl(previewModal) ? (
                <img
                  src={getFilePreviewUrl(previewModal)}
                  alt={`${previewModal.name} full preview`}
                  className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain"
                />
              ) : isPdfFile(getFileMimeType(previewModal)) && getFilePreviewUrl(previewModal) ? (
                <iframe
                  src={getFilePreviewUrl(previewModal)}
                  title={`${previewModal.name} PDF preview`}
                  className="h-[75vh] w-full rounded-lg border border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
                  <File className="mb-3 h-12 w-12 text-gray-400" />
                  <p className="max-w-full truncate text-sm font-medium text-gray-900 dark:text-white">
                    {previewModal.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Preview not available for this file type.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {showStatus && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {requiredUploadedCount} of{" "}
              {defaultItems.filter((item) => !item.optional).length} required
              documents
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentChecklist;
