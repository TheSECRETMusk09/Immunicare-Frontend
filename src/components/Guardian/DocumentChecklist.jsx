/**
 * DocumentChecklist Component
 * Displays required documents and items checklist for vaccination appointments
 * Helps parents remember what to bring to appointments
 * Each item is clickable to upload a file
 * Radio button shows upload status: unfilled when not uploaded, emerald filled when uploaded
 */

import React, { useRef, useState } from "react";
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
} from "lucide-react";

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.docx', '.pdf'];
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
      error: `File type "${extension}" is not allowed. Allowed types: JPEG, PNG, DOCX, PDF.`
    };
  }

  // Check allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type "${extension}". Allowed types: JPEG, PNG, DOCX, PDF.`
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
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  return validMimeTypes.includes(file.type);
};

const DocumentChecklist = ({ completedItems = [], showStatus = true, onFileUpload }) => {
  const fileInputRef = useRef(null);
  // Track uploaded files by item ID: { [itemId]: { name, size, type, file } }
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  // Track currently selected item for upload
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Default required documents and items for vaccination appointments
  const defaultItems = [
    {
      id: "birth_cert",
      label: "Birth Certificate (Original)",
      description: "Original birth certificate for verification",
      icon: BookOpen,
    },
    {
      id: "parent_id",
      label: "Parent/Guardian Valid ID",
      description: "Any valid government ID",
      icon: FileText,
    },
    {
      id: "medbook",
      label: "Mother's / Child's Medical Book",
      description: "Pink book or vaccination record",
      icon: BookOpen,
    },
    {
      id: "previous_records",
      label: "Previous Vaccination Records",
      description: "If this is not the first vaccination",
      icon: ClipboardList,
    },
    {
      id: "consent_form",
      label: "Signed Consent Form",
      description: "Will be provided at the facility",
      icon: FileText,
      optional: true,
    },
    {
      id: "insurance",
      label: "Health Insurance Card (if applicable)",
      description: "PhilHealth or private insurance",
      icon: Heart,
      optional: true,
    },
  ];

  // Handle click on checklist item - trigger file upload
  const handleItemClick = (itemId) => {
    setSelectedItemId(itemId);
    setUploadError(null);
    // Trigger hidden file input
    fileInputRef.current?.click();
  };

  // Handle file selection from the hidden input
  const handleFileSelect = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

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
      setUploadError(`Invalid file MIME type. Please upload a valid image (JPEG, PNG) or document (PDF, DOCX).`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // File is valid - store it for the selected item
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file: file
    };

    // Update uploaded files state
    setUploadedFiles(prev => ({
      ...prev,
      [selectedItemId]: fileData
    }));

    // Clear the input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Upload the file immediately
    try {
      setIsUploading(true);
      if (onFileUpload) {
        await onFileUpload([file], selectedItemId);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
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
  const handleRemoveFile = (e, itemId) => {
    e.stopPropagation(); // Prevent triggering upload
    setUploadedFiles(prev => {
      const newState = { ...prev };
      delete newState[itemId];
      return newState;
    });
  };

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
        accept=".jpeg,.jpg,.png,.docx,.pdf"
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

          return (
            <div
              key={item.id}
              onClick={() => !isUploading && handleItemClick(item.id)}
              className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                isUploaded
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : isUploading
                    ? "bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 opacity-50 cursor-not-allowed"
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
                {isUploaded && uploadedFileName && (
                  <div className="flex items-center gap-2 mt-2">
                    <File className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                      {uploadedFileName}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFile(e, item.id)}
                      className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded"
                      aria-label={`Remove ${uploadedFileName}`}
                    >
                      <X className="w-3 h-3 text-emerald-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Upload status - Radio button indicator - using Circle for pending indicators */}
              {showStatus && (
                <div className="flex-shrink-0 flex items-center gap-2">
                  {isUploaded ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : (
                    // Using Circle component for pending document indicators
                    <Circle className="w-6 h-6 text-gray-300 dark:text-gray-500" />
                  )}

                  {/* Upload label with Upload icon and isUploading state */}
                  {isUploading ? (
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        Uploading...
                      </span>
                    </div>
                  ) : (
                    <span className={`text-xs font-medium ${isUploaded ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {isUploaded ? 'Uploaded' : (
                        <span className="flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          Upload
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {showStatus && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {Object.keys(uploadedFiles).length} of{" "}
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
