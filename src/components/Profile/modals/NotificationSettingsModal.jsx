import React, { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Calendar, Syringe, Heart, Info } from "lucide-react";
import { Modal, Button } from "../../UI";

const DEFAULT_NOTIFICATION_SETTINGS = {
  email_notifications: true,
  sms_notifications: false,
  appointment_reminders: true,
  vaccination_alerts: true,
  health_updates: false,
  system_announcements: true,
};

/**
 * NotificationSettingsModal Component
 * Modal for managing notification preferences
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onSave - Save handler with settings data
 * @param {Object} props.initialSettings - Initial notification settings
 * @param {boolean} props.loading - Loading state
 */
const NotificationSettingsModal = ({
  isOpen,
  onClose,
  onSave,
  initialSettings = {},
  loading = false,
}) => {
  const [settings, setSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);

  useEffect(() => {
    if (isOpen) {
      setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...initialSettings });
    }
  }, [initialSettings, isOpen]);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = () => {
    onSave(settings);
  };

  const handleClose = () => {
    onClose();
  };

  const notificationGroups = [
    {
      title: "Communication Channels",
      description: "How you want to receive notifications",
      items: [
        {
          key: "email_notifications",
          label: "Email Notifications",
          description: "Receive updates via email",
          icon: Mail,
          color: "text-blue-600",
          bgColor: "bg-blue-100",
        },
        {
          key: "sms_notifications",
          label: "SMS Notifications",
          description: "Receive text messages for urgent updates",
          icon: MessageSquare,
          color: "text-green-600",
          bgColor: "bg-green-100",
        },
      ],
    },
    {
      title: "Healthcare Alerts",
      description: "Notifications about your children's health",
      items: [
        {
          key: "appointment_reminders",
          label: "Appointment Reminders",
          description: "Get notified before scheduled appointments",
          icon: Calendar,
          color: "text-purple-600",
          bgColor: "bg-purple-100",
        },
        {
          key: "vaccination_alerts",
          label: "Vaccination Due Alerts",
          description: "Alerts when vaccinations are due",
          icon: Syringe,
          color: "text-emerald-600",
          bgColor: "bg-emerald-100",
        },
        {
          key: "health_updates",
          label: "Health Updates & Tips",
          description: "General health information and parenting tips",
          icon: Heart,
          color: "text-rose-600",
          bgColor: "bg-rose-100",
        },
        {
          key: "system_announcements",
          label: "System Announcements",
          description: "Important updates about the platform",
          icon: Info,
          color: "text-amber-600",
          bgColor: "bg-amber-100",
        },
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Notification Settings"
      size="lg"
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
            onClick={handleSave}
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
                <Bell className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto modern-scrollbar pr-2">
        {notificationGroups.map((group) => (
          <div key={group.title}>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {group.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {group.description}
            </p>

            <div className="space-y-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isEnabled = settings[item.key];

                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all
                      ${isEnabled
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }
                    `}
                  >
                    <div
                      className={`w-10 h-10 ${item.bgColor} dark:bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${item.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleToggle(item.key)}
                        className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default NotificationSettingsModal;
