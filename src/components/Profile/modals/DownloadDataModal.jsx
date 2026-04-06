import React, { useState } from "react";
import { Download, FileText, Calendar, Users, AlertCircle } from "lucide-react";
import { Modal, Button } from "../../UI";

/**
 * DownloadDataModal Component
 * Modal for downloading user data in various formats
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal open state
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onDownload - Download handler with options
 * @param {boolean} props.loading - Loading state
 */
const DownloadDataModal = ({ isOpen, onClose, onDownload, loading = false }) => {
  const [format, setFormat] = useState("pdf");
  const [options, setOptions] = useState({
    include_vaccination_records: true,
    include_appointment_history: true,
    include_profile_data: true,
  });

  const handleOptionToggle = (key) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownload = () => {
    onDownload({ format, options });
  };

  const handleClose = () => {
    // Reset to defaults on close
    setFormat("pdf");
    setOptions({
      include_vaccination_records: true,
      include_appointment_history: true,
      include_profile_data: true,
    });
    onClose();
  };

  const formatOptions = [
    { value: "pdf", label: "PDF Report", description: "Formatted document" },
    { value: "excel", label: "Excel Spreadsheet", description: "Data tables" },
    { value: "csv", label: "CSV Data", description: "Comma-separated values" },
    { value: "json", label: "JSON Data", description: "Machine-readable format" },
  ];

  const dataOptions = [
    {
      key: "include_profile_data",
      label: "Profile Information",
      description: "Your personal and contact details",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      key: "include_vaccination_records",
      label: "Vaccination Records",
      description: "All vaccination history for your children",
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      key: "include_appointment_history",
      label: "Appointment History",
      description: "Past and upcoming appointments",
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  const atLeastOneOption = Object.values(options).some((v) => v);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Download Your Data"
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
            onClick={handleDownload}
            disabled={loading || !atLeastOneOption}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[44px]"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Preparing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download Data
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Download Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {formatOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={`p-4 rounded-xl border text-left transition-all
                  ${format === opt.value
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-500"
                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${format === opt.value
                        ? "border-emerald-500"
                        : "border-gray-300 dark:border-gray-500"
                      }
                    `}
                  >
                    {format === opt.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {opt.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Data Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Include in Download
          </label>
          <div className="space-y-2">
            {dataOptions.map((item) => {
              const Icon = item.icon;
              const isEnabled = options[item.key];

              return (
                <label
                  key={item.key}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all
                    ${isEnabled
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                      : "bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700 opacity-60"
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
                      onChange={() => handleOptionToggle(item.key)}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Notice */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Your data will be prepared and downloaded to your device.
              Large exports may take a moment to generate.
            </p>
          </div>
        </div>

        {!atLeastOneOption && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">
                Please select at least one data type to download.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default DownloadDataModal;
