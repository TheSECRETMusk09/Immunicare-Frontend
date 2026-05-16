import React from "react";
import { User, Mail, Phone, MapPin, Save, X, Key, ChevronRight } from "lucide-react";
import { Button, Input } from "../UI";

/**
 * PersonalInfoCard Component
 * Displays and edits personal information with view/edit toggle
 *
 * @param {Object} props
 * @param {Object} props.formData - Form data object
 * @param {Function} props.onChange - Input change handler
 * @param {boolean} props.isEditing - Edit mode state
 * @param {Function} props.onSave - Save handler
 * @param {Function} props.onCancel - Cancel handler
 * @param {boolean} props.loading - Loading state
 */
const PersonalInfoCard = ({
  formData,
  onChange,
  isEditing,
  onSave,
  onCancel,
  onChangePassword,
  loading = false,
  fieldErrors = {},
}) => {
  const fields = [
    {
      key: "name",
      label: "Full Name",
      icon: User,
      type: "text",
      placeholder: "Enter your full name",
      required: true,
    },
    {
      key: "email",
      label: "Email Address",
      icon: Mail,
      type: "email",
      placeholder: "Enter your email",
      required: false,
    },
    {
      key: "phone",
      label: "Phone Number",
      icon: Phone,
      type: "tel",
      placeholder: "Enter your phone number",
      required: false,
    },
    {
      key: "address",
      label: "Home Address",
      icon: MapPin,
      type: "text",
      placeholder: "Enter your address",
      required: false,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Personal Information
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your contact details
            </p>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => {
            const Icon = field.icon;
            const value = formData[field.key] || "";
            const fieldError = fieldErrors?.[field.key];

            return (
              <div key={field.key} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Icon className="w-4 h-4 text-gray-400" />
                  {field.label}
                  {field.required && (
                    <span className="text-red-500">*</span>
                  )}
                </label>

                {isEditing ? (
                  <Input
                    type={field.type}
                    name={field.key}
                    value={value}
                    onChange={onChange}
                    error={fieldError}
                    placeholder={field.placeholder}
                    disabled={loading}
                    className="w-full min-h-[48px] sm:min-h-[44px] text-base sm:text-sm"
                  />
                ) : (
                  <div className="min-h-[48px] sm:min-h-[44px] flex items-center px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <span className={`text-base ${value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>
                      {value || `No ${field.label.toLowerCase()} provided`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {typeof onChangePassword === "function" && (
          <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-6">
            <button
              type="button"
              onClick={onChangePassword}
              className="w-full flex items-center gap-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group text-left min-h-[56px] sm:min-h-[48px] p-3 sm:p-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 dark:bg-gray-700 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-all duration-300">
                <Key className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  Change Password
                </p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Update your security credentials
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Card Footer - Actions */}
      {isEditing && (
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px]"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={loading}
              className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalInfoCard;
