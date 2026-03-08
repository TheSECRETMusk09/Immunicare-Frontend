import React, { useState } from "react";
import { Key, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Modal, Button, Input } from "../../UI";

/**
 * PasswordChangeModal Component
 * Modal for changing user password
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSubmit - Submit handler with password data
 * @param {boolean} props.loading - Loading state
 */
const PasswordChangeModal = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});

  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your new password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData);
    }
  };

  const handleClose = () => {
    setFormData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setErrors({});
    setShowPasswords({ current: false, new: false, confirm: false });
    onClose();
  };

  const passwordFields = [
    {
      name: "currentPassword",
      label: "Current Password",
      placeholder: "Enter your current password",
      showKey: "current",
    },
    {
      name: "newPassword",
      label: "New Password",
      placeholder: "Enter new password (min 8 characters)",
      showKey: "new",
    },
    {
      name: "confirmPassword",
      label: "Confirm New Password",
      placeholder: "Confirm your new password",
      showKey: "confirm",
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Changing...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Security Notice */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              For security, you'll be logged out after changing your password.
            </p>
          </div>
        </div>

        {/* Password Fields */}
        {passwordFields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {field.label}
            </label>
            <div className="relative">
              <input
                type={showPasswords[field.showKey] ? "text" : "password"}
                name={field.name}
                value={formData[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                disabled={loading}
                className={`w-full px-4 py-3 pr-12 text-base sm:text-sm rounded-lg border transition-colors min-h-[48px] sm:min-h-[44px]
                  ${errors[field.name]
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-gray-300 dark:border-gray-600 focus:ring-emerald-500 focus:border-emerald-500"
                  }
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:outline-none focus:ring-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility(field.showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={showPasswords[field.showKey] ? "Hide password" : "Show password"}
              >
                {showPasswords[field.showKey] ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors[field.name] && (
              <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                {errors[field.name]}
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default PasswordChangeModal;
