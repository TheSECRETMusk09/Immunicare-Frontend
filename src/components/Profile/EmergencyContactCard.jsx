import React from "react";
import { AlertTriangle, User, Phone, Save, X } from "lucide-react";
import { Button, Input } from "../UI";

/**
 * EmergencyContactCard Component
 * Displays and edits emergency contact information with distinctive styling
 *
 * @param {Object} props
 * @param {Object} props.formData - Form data object with emergency_contact and emergency_phone
 * @param {Function} props.onChange - Input change handler
 * @param {boolean} props.isEditing - Edit mode state
 * @param {Function} props.onSave - Save handler
 * @param {Function} props.onCancel - Cancel handler
 * @param {boolean} props.loading - Loading state
 */
const EmergencyContactCard = ({
  formData,
  onChange,
  isEditing,
  onSave,
  onCancel,
  loading = false,
  fieldErrors = {},
}) => {
  const emergencyFields = [
    {
      key: "emergency_contact",
      label: "Contact Name",
      icon: User,
      type: "text",
      placeholder: "Enter emergency contact name",
    },
    {
      key: "emergency_phone",
      label: "Contact Phone",
      icon: Phone,
      type: "tel",
      placeholder: "Enter emergency contact phone",
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 overflow-hidden">
      {/* Card Header with distinctive color */}
      <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Emergency Contact
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Who to contact in case of emergency
            </p>
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {emergencyFields.map((field) => {
            const Icon = field.icon;
            const value = formData[field.key] || "";
            const fieldError = fieldErrors?.[field.key];

            return (
              <div key={field.key} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Icon className="w-4 h-4 text-gray-400" />
                  {field.label}
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

        {/* Important Notice */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Important
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Please keep this information up to date. This contact will be used in case of emergencies related to your children's health.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer - Actions */}
      {isEditing && (
        <div className="px-6 py-4 border-t border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/5">
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
              className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px] bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Emergency Contact
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyContactCard;
