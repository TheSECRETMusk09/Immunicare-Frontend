import React from "react";
import { Pencil } from "lucide-react";
import { Button } from "../UI";

/**
 * ProfileHeader Component
 * Hero section displaying user identity with avatar and primary actions
 * Updated with improved mobile styling and touch targets
 *
 * @param {Object} props
 * @param {Object} props.user - User data object
 * @param {boolean} props.isEditing - Current edit mode state
 * @param {Function} props.onEditToggle - Callback to toggle edit mode
 * @param {boolean} props.loading - Loading state
 */
const ProfileHeader = ({ user, isEditing, onEditToggle, loading = false }) => {
  const userName = user?.name || user?.username || "Guardian";
  const userRole = user?.role === "guardian" ? "Parent/Guardian" : user?.role || "User";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "N/A";
  const initials = userName.charAt(0).toUpperCase();

  return (
    <div className="guardian-profile-hero-card relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-5 sm:p-8">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-40 h-40 sm:w-64 sm:h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

      {/* Mobile: Stacked layout | Desktop: Horizontal layout with avatar on left */}
      <div className="guardian-profile-hero-layout relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6 lg:gap-8">
        {/* Avatar - Left side on desktop */}
        <div className="guardian-profile-hero-avatar flex-shrink-0">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white/30">
            <span className="text-2xl sm:text-4xl font-bold text-emerald-600">
              {initials}
            </span>
          </div>
        </div>

        {/* Right-side content block - Username, Guardian Details, Edit Button */}
        <div className="guardian-profile-hero-content w-full flex-1">
          {/* Username and Details */}
          <div className="guardian-profile-hero-info text-center sm:text-left">
            <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">
              {userName}
            </h1>
            <div className="guardian-profile-hero-meta flex flex-col items-center gap-1 text-emerald-100 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-medium">{userRole}</span>
              <span className="hidden sm:inline text-emerald-200">•</span>
              <span className="text-sm">Member since {memberSince}</span>
            </div>
          </div>

          {/* Edit Profile Button */}
          <div className="guardian-profile-hero-actions mt-4 flex justify-center sm:justify-end">
            <Button
              onClick={onEditToggle}
              disabled={loading}
              className="min-h-[48px] w-full border-0 bg-white px-6 font-semibold text-emerald-600 shadow-md hover:bg-emerald-50 sm:w-auto"
            >
              {isEditing ? (
                "Done Editing"
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
