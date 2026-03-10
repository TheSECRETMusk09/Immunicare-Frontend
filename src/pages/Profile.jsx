import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, CheckCircle, RefreshCw, Bell, User } from "lucide-react";
import { Alert } from "../components/UI";
import apiClient from "../utils/api";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import "../css/guardian-profile.css";

// Profile Components
import {
  ProfileHeader,
  PersonalInfoCard,
  EmergencyContactCard,
  ChildrenSummaryCard,
  AccountStatsCard,
  QuickActionsCard,
  PasswordChangeModal,
  DownloadDataModal,
  LogoutConfirmationModal,
} from "../components/Profile";

/**
 * Profile Page - Guardian Profile Management
 *
 * A modern, card-based profile page with:
 * - Responsive grid layout (mobile-first)
 * - Modular component architecture
 * - Improved mobile touch targets
 * - Dark mode support
 * - Smooth transitions
 *
 * @version 2.0
 */
export default function Profile() {
  const { user, logout, isGuardian, guardianId } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    emergency_contact: "",
    emergency_phone: "",
  });

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    childrenCount: 0,
    vaccinationCount: 0,
  });

  const parseBackendFieldErrors = useCallback((err) => {
    const fields = err?.response?.data?.fields;
    if (!fields || typeof fields !== "object") {
      return {};
    }

    return Object.entries(fields).reduce((acc, [field, message]) => {
      if (typeof message === "string" && message.trim()) {
        acc[field] = message;
      } else if (Array.isArray(message) && message.length > 0) {
        acc[field] = String(message[0]);
      }
      return acc;
    }, {});
  }, []);

  // Fetch profile data
  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setFieldErrors({});

      const profileGuardianId = guardianId || user?.guardian_id || user?.id;

      if (isGuardian && profileGuardianId) {
        // Fetch guardian profile
        const profileResponse = await apiClient.getGuardianProfile(profileGuardianId);
        if (profileResponse.data) {
          setFormData({
            name: profileResponse.data.name || "",
            email: profileResponse.data.email || "",
            phone: profileResponse.data.phone || "",
            address: profileResponse.data.address || "",
            emergency_contact: profileResponse.data.emergency_contact || "",
            emergency_phone: profileResponse.data.emergency_phone || "",
          });
        }

        // Fetch children for stats
        const infantsResponse = await apiClient.getInfantsByGuardian(profileGuardianId);
        const childrenData = Array.isArray(infantsResponse)
          ? infantsResponse
          : infantsResponse?.data || [];

        // Calculate vaccination count
        const vaccinationCount = childrenData.reduce((acc, child) => {
          return acc + (child.vaccinations?.filter((v) => v.status === "completed")?.length || 0);
        }, 0);

        setStats({
          childrenCount: childrenData.length,
          vaccinationCount,
        });
      } else {
        // Fetch regular user profile
        if (!user?.id) {
          setError("Unable to load profile data. User session is missing.");
          return;
        }

        const response = await apiClient.getUserProfile(user.id);
        if (response.data) {
          setFormData({
            name: response.data.name || response.data.username || "",
            email: response.data.email || "",
            phone: response.data.phone || "",
            address: response.data.address || "",
            emergency_contact: response.data.emergency_contact || "",
            emergency_phone: response.data.emergency_phone || "",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [guardianId, user, isGuardian]);

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user, fetchProfileData]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Save profile changes
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      setFieldErrors({});

      const profileGuardianId = guardianId || user?.guardian_id || user?.id;

      if (isGuardian && profileGuardianId) {
        await apiClient.updateGuardianProfile(profileGuardianId, formData);
      } else if (user?.id) {
        await apiClient.updateUserProfile(user.id, formData);
      }

      setSuccess("Profile updated successfully!");
      setIsEditing(false);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Error saving profile:", err);

      const backendFieldErrors = parseBackendFieldErrors(err);
      if (Object.keys(backendFieldErrors).length > 0) {
        setFieldErrors(backendFieldErrors);
        setError(
          err?.response?.data?.error ||
            "Please correct the highlighted profile fields.",
        );
        return;
      }

      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    fetchProfileData(); // Reload original data
    setError(null);
    setFieldErrors({});
  };

  // Toggle edit mode
  const handleEditToggle = () => {
    if (isEditing) {
      handleCancel();
    } else {
      setIsEditing(true);
      setSuccess(null);
      setError(null);
      setFieldErrors({});
    }
  };

  // Handle password change
  const handlePasswordChange = async (passwordData) => {
    try {
      setSaving(true);
      setError(null);

      await apiClient.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      setSuccess("Password changed successfully!");
      setShowPasswordModal(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  // Handle data download
  const handleDownloadData = async ({ format, options }) => {
    try {
      setSaving(true);
      setError(null);

      const profileGuardianId = guardianId || user?.guardian_id || user?.id;

      // Prepare export data
      const exportData = {
        exportDate: new Date().toISOString(),
        format,
        includeProfile: options.include_profile_data,
        includeVaccinations: options.include_vaccination_records,
        includeAppointments: options.include_appointment_history,
      };

      // For now, create a JSON download
      // In production, this would call an API endpoint
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `immunicare-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess("Data download started!");
      setShowDownloadModal(false);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message || "Failed to download data.");
    } finally {
      setSaving(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const profileGuardianId = guardianId || user?.guardian_id || user?.id;

  return (
    <div className="guardian-page-wrapper profile-page min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 guardian-profile-mobile-ui">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={fetchProfileData}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 lg:pt-0">
        <GuardianModuleHeader
          title="My Profile"
          subtitle="Manage your account information, emergency contacts, and security settings"
          icon={<User className="w-8 h-8 text-white" />}
          className="guardian-profile-header-shell"
          actions={(
            <div className="hidden lg:flex guardian-desktop-pageheader-actions">
              <button
                type="button"
                onClick={fetchProfileData}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Refresh My Profile"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/notifications")}
                className="guardian-desktop-pageheader-icon-btn guardian-desktop-pageheader-icon-btn--notif"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="guardian-desktop-pageheader-notif-dot" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/profile")}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Open profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          )}
        />

        {/* Main Content */}
        <main className="guardian-page-content">
        <div className="space-y-4 guardian-profile-mobile-content">
          {/* Alerts */}
          {error && (
            <Alert variant="danger" className="animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5 mr-2" />
              {success}
            </Alert>
          )}

          {/* Profile Header */}
          <ProfileHeader
            user={user}
            isEditing={isEditing}
            onEditToggle={handleEditToggle}
            loading={loading}
          />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 lg:px-0">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-5 lg:space-y-6">
              {/* Personal Information */}
              <PersonalInfoCard
                formData={formData}
                onChange={handleInputChange}
                isEditing={isEditing}
                onSave={handleSave}
                onCancel={handleCancel}
                loading={saving}
                fieldErrors={fieldErrors}
              />

              {/* Emergency Contact */}
              <EmergencyContactCard
                formData={formData}
                onChange={handleInputChange}
                isEditing={isEditing}
                onSave={handleSave}
                onCancel={handleCancel}
                loading={saving}
                fieldErrors={fieldErrors}
              />

              {/* Children Summary (Guardians only) */}
              {isGuardian && (
                <ChildrenSummaryCard
                  guardianId={profileGuardianId}
                  loading={loading}
                />
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {/* Account Stats */}
              <AccountStatsCard
                user={user}
                childrenCount={stats.childrenCount}
                vaccinationCount={stats.vaccinationCount}
              />

              {/* Quick Actions */}
              <QuickActionsCard
                onChangePassword={() => setShowPasswordModal(true)}
                onDownloadData={() => setShowDownloadModal(true)}
                onOpenLogoutModal={() => setShowLogoutModal(true)}
              />
            </div>
          </div>
        </div>

        {/* Modals */}
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSubmit={handlePasswordChange}
          loading={saving}
        />

        <DownloadDataModal
          isOpen={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          onDownload={handleDownloadData}
          loading={saving}
        />

        <LogoutConfirmationModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={logout}
        />
        </main>
      </div>
    </div>
  );
}
