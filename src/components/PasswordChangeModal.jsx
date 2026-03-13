import React, { useState } from "react";
import { Modal, Button, PasswordInput } from "./UI";
import apiClient, { clearAuthStorage } from "../utils/api";

const getPostPasswordChangeRedirect = () => {
  if (typeof window === "undefined") {
    return "/login";
  }

  const currentPath = window.location.pathname || "";
  return currentPath.startsWith("/guardian")
    ? "/guardian/login"
    : "/admin/login";
};

export default function PasswordChangeModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await apiClient.changePassword(
        formData.currentPassword,
        formData.newPassword,
      );

      if (response) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onSuccess();
          onClose();
          clearAuthStorage();
          window.location.href = getPostPasswordChangeRedirect();
        }, 2000);
      }
    } catch (err) {
      setError(err.message || "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="text-red-600 dark:text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-600 dark:text-green-400 text-sm text-center">
            Password changed successfully!
          </div>
        )}

        <PasswordInput
          label="Current Password"
          name="currentPassword"
          value={formData.currentPassword}
          onChange={handleChange}
          showPasswordAriaLabel="Show current password"
          hidePasswordAriaLabel="Hide current password"
          required
        />

        <PasswordInput
          label="New Password"
          name="newPassword"
          value={formData.newPassword}
          onChange={handleChange}
          showPasswordAriaLabel="Show new password"
          hidePasswordAriaLabel="Hide new password"
          required
          minLength={6}
        />

        <PasswordInput
          label="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          showPasswordAriaLabel="Show confirm new password"
          hidePasswordAriaLabel="Hide confirm new password"
          required
          minLength={6}
        />

        <div className="form-actions-standardized">
          <Button
            type="button"
            variant="cancel"
            actionRole="cancel"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            actionRole="primary"
            className="w-full sm:w-auto"
          >
            Change Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
