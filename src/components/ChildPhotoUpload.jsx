import React, { useState, useRef } from "react";
import apiClient from "../utils/api";

/**
 * ChildPhotoUpload Component
 * Handles child photo upload with preview and validation
 *
 * Wireframe Specification:
 * - Actual child photos in profile cards
 * - Photo upload functionality
 * - Fallback to emoji if no photo uploaded
 */

export default function ChildPhotoUpload({
  infantId,
  currentPhoto,
  onPhotoUpdate,
}) {
  const [preview, setPreview] = useState(currentPhoto || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setError(null);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadPhoto(file);
  };

  const uploadPhoto = async (file) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file); // Must match the backend multer 'file' field
      formData.append("infantId", infantId);

      const response = await apiClient.uploadInfantPhoto(formData);
      const photoUrl = response?.data?.downloadUrl || response?.downloadUrl;

      if (onPhotoUpdate && photoUrl) {
        onPhotoUpdate(photoUrl);
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      setError("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        className="w-12 h-12 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
        title="Click to upload photo"
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <span className="text-indigo-600 dark:text-indigo-400 text-xl">
              👶
            </span>
          </div>
        )}
      </div>

      {uploading && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload child photo"
      />

      {error && (
        <div className="absolute -bottom-8 left-0 right-0 bg-red-500 text-white text-xs p-1 rounded text-center whitespace-nowrap overflow-hidden text-ellipsis">
          {error}
        </div>
      )}
    </div>
  );
}
