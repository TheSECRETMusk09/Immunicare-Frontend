import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  Button,
  Alert,
  PageHeader,
  PageContainer,
  TextInput,
} from "../components/UI";
import apiClient from "../utils/api";
import PasswordChangeModal from "../components/PasswordChangeModal";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  LogOut,
  Key,
  Loader2,
} from "lucide-react";

export default function UserProfile() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    phone: "",
    address: "",
    emergencyContact: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserProfile();
      setProfile(response.data || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validate email format
      if (profile.email && !/^[^@]+@[^@]+\.[^@]+$/.test(profile.email)) {
        setError("Please enter a valid email address");
        return;
      }

      // Validate phone number format
      if (profile.phone && !/^[0-9]{10,15}$/.test(profile.phone)) {
        setError("Please enter a valid phone number (10-15 digits)");
        return;
      }

      const response = await apiClient.updateUserProfile(profile);
      setSuccess("Profile updated successfully!");
      updateUser(response.data);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  if (loading && !profile.username) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* PageHeader - Standardized violet gradient design matching My Children module */}
      <PageHeader
        title="Profile Settings"
        subtitle="Manage your account information and security preferences"
        icon={<User className="w-8 h-8 text-white" />}
      />

      {/* Success/Error Messages */}
      <main className="guardian-page-content space-y-4 sm:space-y-6">
      {success && (
        <Alert variant="success" className="mb-6">
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2">
          <PageContainer title="Personal Information">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  label="Username"
                  name="username"
                  value={profile.username || user?.username || ""}
                  onChange={handleInputChange}
                  required
                  icon={User}
                />

                <TextInput
                  label="Email Address"
                  type="email"
                  name="email"
                  value={profile.email || ""}
                  onChange={handleInputChange}
                  icon={Mail}
                />

                <TextInput
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  value={profile.phone || ""}
                  onChange={handleInputChange}
                  icon={Phone}
                />

                <TextInput
                  label="Home Address"
                  type="text"
                  name="address"
                  value={profile.address || ""}
                  onChange={handleInputChange}
                  icon={MapPin}
                />

                <div className="md:col-span-2">
                  <TextInput
                    label="Emergency Contact"
                    type="text"
                    name="emergencyContact"
                    value={profile.emergencyContact || ""}
                    onChange={handleInputChange}
                    placeholder="Name and phone number"
                    icon={Shield}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Button type="submit" className="px-8">
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </form>
          </PageContainer>
        </div>

        {/* Account Information */}
        <div className="space-y-6">
          <Card title="Account Summary">
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-gray-700 shadow-sm">
                <span className="text-primary-600 dark:text-primary-400 text-3xl font-bold">
                  {(profile.username || user?.username || "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {profile.username || user?.username || "User"}
              </h4>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
                {user?.role === "guardian" ? "Parent/Guardian" : "System User"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Account Type
                </span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400 uppercase">
                  {user?.role || "User"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Member Since
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Last Login
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.lastLogin
                    ? new Date(user.lastLogin).toLocaleDateString()
                    : "Today"}
                </span>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card
            title="Security & Access"
            className="border-danger-100 dark:border-danger-900/30"
          >
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Log out of your account on this device.
                </p>
                <Button
                  variant="ghost"
                  className="w-full text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 border border-danger-100 dark:border-danger-900/30"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  Need to delete your account? Please contact system
                  administration.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setSuccess("Password changed successfully!");
          setShowPasswordModal(false);
          setTimeout(() => setSuccess(null), 5000);
        }}
      />
      </main>
    </div>
  );
}
