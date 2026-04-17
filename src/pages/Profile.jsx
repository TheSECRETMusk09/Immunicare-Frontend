import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, CheckCircle, RefreshCw, Bell, User } from "lucide-react";
import { Alert } from "../components/UI";
import apiClient from "../utils/api";
import { trackEvent } from "../utils/telemetry";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import "../css/guardian-profile.css";

// Profile Components
import {
  PersonalInfoCard,
  EmergencyContactCard,
  ChildrenSummaryCard,
  AccountStatsCard,
  QuickActionsCard,
  PasswordChangeModal,
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
        const userData = response?.data ?? response;
        if (userData) {
          setFormData({
            name: userData.name || userData.username || "",
            email: userData.email || "",
            phone: userData.phone || "",
            address: userData.address || "",
            emergency_contact: userData.emergency_contact || "",
            emergency_phone: userData.emergency_phone || "",
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
        trackEvent("profile_updated", { role: "guardian" });
      } else if (user?.id) {
        await apiClient.updateUserProfile(user.id, {
          username: formData.name,
          contact: formData.phone,
          email: formData.email,
        });
        trackEvent("profile_updated", { role: "system_user" });
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
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={fetchProfileData}
          isRefreshing={loading}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
        <GuardianModuleHeader
          title="My Profile"
          subtitle="Manage your account information, emergency contacts, and security settings"
          icon={<User className="w-8 h-8 text-white" />}
          className="guardian-profile-header-shell"
          actions={(
            <div className="hidden min-[1025px]:flex guardian-desktop-pageheader-actions">
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
          {loading ? (
            <div className="h-40 sm:h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse mb-6" />
          ) : (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden mb-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl pointer-events-none"></div>
              <div className="guardian-profile-hero-layout relative z-10 flex flex-row items-center gap-4 sm:gap-6 lg:gap-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border-4 border-white/30 shadow-xl flex-shrink-0">
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    {(user?.name || user?.username || "G").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white truncate drop-shadow-md">
                    {user?.name || user?.username || "Guardian Profile"}
                  </h2>
                  <p className="text-emerald-100 text-sm sm:text-base mt-1 truncate">
                    {user?.email || "Manage your account"}
                  </p>
                  <div className="mt-3 flex flex-row flex-wrap items-center justify-start gap-3 sm:gap-4">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white backdrop-blur-sm border border-white/20 uppercase tracking-wider">
                      {user?.role || "Guardian"}
                    </span>
                    <button
                      onClick={handleEditToggle}
                      className="bg-white/20 hover:bg-white/30 text-white border border-white/40 backdrop-blur-sm transition-all shadow-lg min-h-[36px] sm:min-h-[44px] px-4 sm:px-6 py-1.5 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm"
                    >
                      {isEditing ? "Cancel Editing" : "Edit Profile"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 lg:px-0">
            {/* Left Column - Main Content */}
            <div className="min-[768px]:col-span-2 min-[1025px]:col-span-2 space-y-4 sm:space-y-5 lg:space-y-6">
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
