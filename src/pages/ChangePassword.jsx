import React, { useState } from "react";
import apiClient from "../utils/api";
import { PasswordInput } from "../components/UI";

const ChangePassword = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setLoading(true);
      await apiClient.changePassword(form.currentPassword, form.newPassword);
      setSuccess("Password updated successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Change Password
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Update your account password.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <PasswordInput
              label="Current Password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={onChange}
              showPasswordAriaLabel="Show current password"
              hidePasswordAriaLabel="Hide current password"
              autoComplete="current-password"
              theme="admin"
            />
          </div>

          <div>
            <PasswordInput
              label="New Password"
              name="newPassword"
              value={form.newPassword}
              onChange={onChange}
              showPasswordAriaLabel="Show new password"
              hidePasswordAriaLabel="Hide new password"
              autoComplete="new-password"
              theme="admin"
            />
          </div>

          <div>
            <PasswordInput
              label="Confirm New Password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={onChange}
              showPasswordAriaLabel="Show confirm new password"
              hidePasswordAriaLabel="Hide confirm new password"
              autoComplete="new-password"
              theme="admin"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {success ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
