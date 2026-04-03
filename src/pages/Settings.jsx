import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  Card,
  Button,
  LoadingSpinner,
  Alert,
  Badge,
} from "../components/UI";
import { Save } from "lucide-react";
import { useSettings } from "../hooks/useSettings";

/**
 * Tooltip Component - Contextual help for form fields
 * Supports both mouse hover and touch interactions
 */
const Tooltip = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = React.useRef(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 200);
  };

  const handleTouchStart = (e) => {
    e.stopPropagation();
    setIsVisible(true);
  };

  const handleTouchEnd = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(false), 1500);
  };

  // Close tooltip when clicking outside on mobile
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (isVisible) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("touchstart", handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isVisible]);

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="cursor-help touch-manipulation"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 max-w-[calc(100vw-32px)] p-3 text-sm text-white bg-gray-900 rounded-lg shadow-lg">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

/**
 * HelpIcon - Question mark icon with tooltip
 */
const HelpIcon = ({ tooltip }) => (
  <Tooltip content={tooltip}>
    <svg
      className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  </Tooltip>
);

/**
 * Toggle Switch Component - Mobile optimized with proper touch targets
 */
const ToggleSwitch = ({
  enabled,
  onChange,
  label,
  description,
  tooltip,
  disabled = false,
}) => {
  return (
    <div
      className="guardian-toggle-label py-3 min-h-[48px]"
      onClick={() => !disabled && onChange(!enabled)}
    >
      <div className="flex-1 pr-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label}
          </span>
          {tooltip && <HelpIcon tooltip={tooltip} />}
        </div>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        className={`
          relative inline-flex h-7 w-12 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          touch-manipulation
          ${enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
      >
        <span
          className={`
            pointer-events-none inline-block h-6 w-6 sm:h-5 sm:w-5 transform rounded-full
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${enabled ? "translate-x-5 sm:translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
};

/**
 * Collapsible Section Component - Mobile optimized
 */
const CollapsibleSection = ({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="guardian-settings-section border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[48px] touch-manipulation"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {icon && <span className="text-lg flex-shrink-0">{icon}</span>}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h3>
          {badge && (
            <Badge
              variant={badge.variant || "info"}
              size="sm"
              className="flex-shrink-0"
            >
              {badge.text}
            </Badge>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="px-3 sm:px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Form Field with Validation - Mobile optimized
 */
const FormField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  helpText,
  tooltip,
  placeholder,
  required = false,
  disabled = false,
  options = [],
  min,
  max,
  validate,
}) => {
  const [localError, setLocalError] = useState("");
  const [touched, setTouched] = useState(false);

  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange(name, newValue);

    // Real-time validation
    if (touched && validate) {
      const validationError = validate(newValue);
      setLocalError(validationError);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (validate) {
      const validationError = validate(value);
      setLocalError(validationError);
    }
    onBlur && onBlur(name);
  };

  const displayError = error || localError;

  const inputClassName = `
    w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm rounded-lg border transition-colors
    ${
      displayError
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-300 dark:border-gray-600 focus:ring-blue-500"
    }
    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
    focus:outline-none focus:ring-2
    disabled:opacity-50 disabled:cursor-not-allowed
    min-h-[48px] sm:min-h-[40px]
  `;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {tooltip && <HelpIcon tooltip={tooltip} />}
      </div>

      {type === "select" ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          className={inputClassName}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={inputClassName.replace(
            "min-h-[48px] sm:min-h-[40px]",
            "min-h-[80px]",
          )}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          className={inputClassName}
        />
      )}

      {helpText && !displayError && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
      {displayError && (
        <p className="mt-1.5 text-xs text-red-500" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
};

/**
 * Settings Search Component - Mobile optimized
 */
const SettingsSearch = ({
  searchTerm,
  onSearchChange,
  results,
  onResultClick,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search settings..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 sm:py-2 text-base sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] sm:min-h-[40px]"
          autoFocus
        />
      </div>
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto modern-scrollbar">
          {results.map((result, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onResultClick(result)}
              className="w-full px-3 sm:px-4 py-3 sm:py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 min-h-[48px] sm:min-h-[44px] touch-manipulation"
            >
              <span className="text-lg flex-shrink-0">{result.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {result.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {result.category} • {result.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {searchTerm && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500">
          No settings found for "{searchTerm}"
        </div>
      )}
    </div>
  );
};

/**
 * Main Settings Component
 */
const Settings = () => {
  const { settings, loading, error, updateSettings, resetCategory } =
    useSettings();
  const [activeTab, setActiveTab] = useState("facility");
  const [searchMode, setSearchMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [saveStatus, setSaveStatus] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [localSettings, setLocalSettings] = useState({});

  // Initialize local settings when settings are loaded
  useEffect(() => {
    if (settings) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings]);

  // Define all settings configuration
  const settingsConfig = useMemo(
    () => ({
      facility: {
        label: "Facility",
        icon: "🏥",
        description: "Clinic information and operating details",
        sections: [
          {
            id: "clinicInfo",
            title: "Clinic Information",
            icon: "📋",
            fields: [
              {
                key: "clinicName",
                label: "Clinic Name",
                type: "text",
                placeholder: "e.g., San Nicolas Health Center",
                required: true,
              },
              {
                key: "address",
                label: "Address",
                type: "text",
                placeholder: "Complete facility address",
              },
              {
                key: "contactEmail",
                label: "Contact Email",
                type: "email",
                placeholder: "clinic@example.com",
              },
              {
                key: "contactPhone",
                label: "Contact Phone",
                type: "text",
                placeholder: "+63 XXX XXX XXXX",
              },
            ],
          },
          {
            id: "operatingHours",
            title: "Operating Hours",
            icon: "⏰",
            fields: [
              {
                key: "hoursStart",
                label: "Opening Time",
                type: "time",
              },
              {
                key: "hoursEnd",
                label: "Closing Time",
                type: "time",
              },
            ],
          },
        ],
      },
      preferences: {
        label: "Preferences",
        icon: "🎨",
        description: "Display and system preferences",
        sections: [
          {
            id: "appearance",
            title: "Appearance",
            icon: "🌗",
            fields: [
              {
                key: "theme",
                label: "Theme",
                type: "select",
                options: [
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System Default" },
                ],
                tooltip: "Choose your preferred color theme for the interface",
              },
            ],
          },
          {
            id: "localization",
            title: "Date & Time Format",
            icon: "📅",
            fields: [
              {
                key: "dateFormat",
                label: "Date Format",
                type: "select",
                options: [
                  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                ],
              },
              {
                key: "timeFormat",
                label: "Time Format",
                type: "select",
                options: [
                  { value: "12h", label: "12-hour (AM/PM)" },
                  { value: "24h", label: "24-hour" },
                ],
              },
            ],
          },
        ],
      },
      alerts: {
        label: "Alerts & Thresholds",
        icon: "🔔",
        description: "Configure system alerts and reminders",
        sections: [
          {
            id: "inventoryAlerts",
            title: "Inventory Alerts",
            icon: "📦",
            fields: [
              {
                key: "lowStockThreshold",
                label: "Default Low Stock Threshold",
                type: "number",
                min: 1,
                helpText: "Default stock level to trigger a low stock warning",
              },
            ],
          },
          {
            id: "appointmentAlerts",
            title: "Appointment Reminders",
            icon: "📅",
            fields: [
              {
                key: "appointmentReminderLeadTime",
                label: "Reminder Lead Time (Hours)",
                type: "number",
                min: 1,
                max: 72,
                helpText: "Hours before appointment to send reminder",
              },
            ],
          },
        ],
      },
      security: {
        label: "Security",
        icon: "🔒",
        description: "Session and access controls",
        sections: [
          {
            id: "session",
            title: "Session Settings",
            icon: "⏱️",
            fields: [
              {
                key: "sessionTimeout",
                label: "Session Timeout (Minutes)",
                type: "number",
                min: 5,
                max: 120,
                helpText: "Automatically log out after inactivity",
              },
              {
                key: "requireReauth",
                label: "Require Re-authentication",
                type: "toggle",
                description: "Require password for sensitive actions like exports",
              },
            ],
          },
        ],
      },
    }),
    [],
  );

  // Flatten settings for search
  const searchableSettings = useMemo(() => {
    const results = [];
    Object.entries(settingsConfig).forEach(([categoryKey, category]) => {
      category.sections.forEach((section) => {
        if (section.fields) {
          section.fields.forEach((field) => {
            results.push({
              category: category.label,
              categoryKey,
              sectionId: section.id,
              label: field.label,
              description: field.tooltip || field.description || "",
              icon: section.icon,
              key: field.key,
            });
          });
        }
      });
    });
    return results;
  }, [settingsConfig]);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return searchableSettings.filter(
      (s) =>
        s.label.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term),
    );
  }, [searchTerm, searchableSettings]);

  // Handle setting change
  const handleSettingChange = useCallback((category, key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  }, []);

  // Handle save
  const handleSave = async () => {
    try {
      setSaveStatus("saving");
      const settingsArray = [];
      Object.entries(localSettings).forEach(([category, values]) => {
        Object.entries(values).forEach(([key, value]) => {
          settingsArray.push({ category, key, value });
        });
      });
      await updateSettings(settingsArray);
      setSaveStatus("saved");
      setHasChanges(false);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // Handle reset
  const handleReset = async (category) => {
    try {
      await resetCategory(category);
      setSaveStatus("reset");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus("error");
    }
  };

  // Handle search result click
  const handleSearchResultClick = (result) => {
    setActiveTab(result.categoryKey);
    setSearchMode(false);
    setSearchTerm("");
    // Could scroll to specific section here
  };

  // Get setting value
  const getSettingValue = (category, key, defaultValue = "") => {
    return (
      localSettings[category]?.[key] ??
      settings?.[category]?.[key] ??
      defaultValue
    );
  };

  // Render field based on type
  const renderField = (categoryKey, field) => {
    const value = getSettingValue(
      categoryKey,
      field.key,
      field.type === "toggle" ? false : "",
    );

    if (field.type === "toggle") {
      return (
        <ToggleSwitch
          enabled={value === true || value === "true"}
          onChange={(newValue) =>
            handleSettingChange(categoryKey, field.key, newValue)
          }
          label={field.label}
          description={field.description}
          tooltip={field.tooltip}
        />
      );
    }

    return (
      <FormField
        label={field.label}
        name={field.key}
        type={field.type}
        value={String(value || "")}
        onChange={(_, newValue) =>
          handleSettingChange(categoryKey, field.key, newValue)
        }
        placeholder={field.placeholder}
        helpText={field.helpText}
        tooltip={field.tooltip}
        options={field.options}
        min={field.min}
        max={field.max}
        validate={field.validate}
        required={field.required}
      />
    );
  };

  // Render tab content
  const renderTabContent = () => {
    const category = settingsConfig[activeTab];
    if (!category) return null;

    return (
      <div className="space-y-4">
        {category.sections.map((section) => (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            icon={section.icon}
            defaultOpen={true}
          >
            <div className="space-y-2">
              {section.fields?.map((field) => (
                <div key={field.key}>{renderField(activeTab, field)}</div>
              ))}
            </div>
          </CollapsibleSection>
        ))}

        <div className="flex justify-end pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleReset(activeTab)}
            className="mr-2"
          >
            Reset to Defaults
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6 -mx-6 -mt-6">
      {/* Top Header - Consistent with Dashboard and Analytics */}
      {/* Modern Gradient Page Header */}
      <header
        className="page-header bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-xl sm:rounded-2xl text-white shadow-lg w-full"
        role="banner"
        aria-label="Settings page header"
      >
        <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Left side: Icon + Title + Subtitle */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-xl sm:text-2xl flex-shrink-0">
                <span>⚙️</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
                  Settings
                </h2>
                <p className="text-sm sm:text-base text-white/80 truncate">
                  Configure system settings and preferences
                </p>
              </div>
            </div>
            {/* Right side: Action Buttons */}
            {hasChanges && (
              <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-0"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      </div>

      {/* Sticky Search Bar - Below header */}
      <div className="sticky top-[88px] z-20 bg-white dark:bg-gray-900 py-4 -mx-6 px-6">
      {/* Status Messages */}
      {error && <Alert variant="error">{error}</Alert>}
      {saveStatus === "saving" && (
        <Alert variant="info">Saving your changes...</Alert>
      )}
      {saveStatus === "saved" && (
        <Alert variant="success">Settings saved successfully!</Alert>
      )}
      {saveStatus === "reset" && (
        <Alert variant="success">Settings reset to defaults!</Alert>
      )}
      {saveStatus === "error" && (
        <Alert variant="error">
          Failed to save settings. Please try again.
        </Alert>
      )}

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          {searchMode ? (
            <SettingsSearch
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              results={searchResults}
              onResultClick={handleSearchResultClick}
              isVisible={searchMode}
            />
          ) : (
            <Button
              variant="secondary"
              onClick={() => setSearchMode(true)}
              className="w-full sm:w-auto justify-start text-gray-500 min-h-[44px]"
            >
              <svg
                className="w-5 h-5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="truncate">Search settings...</span>
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar Tabs - Horizontal scroll on mobile */}
        <div className="w-full md:w-64 flex-shrink-0 order-2 md:order-1">
          <Card noPadding className="overflow-hidden">
            <nav className="divide-y divide-gray-200 dark:divide-gray-700 overflow-x-auto">
              {Object.entries(settingsConfig).map(([key, category]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    setSearchMode(false);
                    setSearchTerm("");
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-colors whitespace-nowrap
                    ${
                      activeTab === key
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-2 md:border-l-4 border-blue-600"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }
                  `}
                >
                  <span className="text-lg flex-shrink-0">{category.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {category.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                      {category.description}
                    </p>
                  </div>
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 order-1 md:order-2">
          <Card className="h-full">
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">
                  {settingsConfig[activeTab]?.icon}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {settingsConfig[activeTab]?.label} Settings
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {settingsConfig[activeTab]?.description}
                  </p>
                </div>
              </div>
            </div>
            {renderTabContent()}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
