import React, { useState, useEffect, memo, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Outlet, useLocation } from "react-router-dom";
import PasswordChangeModal from "../components/PasswordChangeModal";
import MobileBottomNav from "../components/MobileBottomNav";
import GuardianSidebar from "../components/GuardianSidebar";
import PageTransitionLoader from "../components/PageTransitionLoader";
import QuickActionFAB from "../components/QuickActionFAB";
import { AlertCircle } from "lucide-react";
import { Button } from "../components/UI";
import ErrorBoundary from "./ErrorBoundary";
import "../css/design-tokens.css";
import "../css/guardian-master-responsive.css";

/**
 * GuardianLayout Component
 * Main layout wrapper for Guardian Dashboard
 *
 * Features:
 * - Responsive sidebar (slide-out on mobile, fixed on desktop)
 * - Mobile bottom navigation
 * - Password change modal for first login
 * - Light theme design
 * - Proper z-index hierarchy
 * - Safe area insets for notched devices
 *
 * @version 3.0
 * @since 2026-03-03
 */

const GuardianLayout = memo(function GuardianLayout({ children }) {
  const { logout, forcePasswordChange, updateUserPasswordStatus, user } = useAuth();
  const location = useLocation();
  const initialDesktopState =
    typeof window !== "undefined" ? window.innerWidth >= 1024 : false;

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(initialDesktopState);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isDesktop, setIsDesktop] = useState(initialDesktopState);
  const previousPathRef = useRef(location.pathname);
  const navigateTimeoutRef = useRef(null);
  const isInitialMountRef = useRef(true);
  const hasUserToggledSidebarRef = useRef(false);
  const previousDesktopRef = useRef(initialDesktopState);
  const sidebarVisible = isDesktop ? true : sidebarOpen;

  // Check if user is a guardian (canonical role model)
  const normalizedRoleType = String(user?.role_type || '').toUpperCase();
  const normalizedRole = String(user?.role || '').toUpperCase();
  const normalizedLegacyRole = String(user?.legacy_role || '').toUpperCase();
  const isGuardian =
    normalizedRoleType === 'GUARDIAN' ||
    normalizedRole === 'GUARDIAN' ||
    normalizedLegacyRole === 'GUARDIAN';

  // Detect screen size
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);

      if (desktop !== previousDesktopRef.current) {
        // Mobile should always start with a closed drawer.
        if (!desktop) {
          setSidebarOpen(false);
        }

        // Desktop should default to open unless user explicitly toggled.
        if (desktop && !hasUserToggledSidebarRef.current) {
          setSidebarOpen(true);
        }

        previousDesktopRef.current = desktop;
      }
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ensure desktop starts with visible sidebar on first mount.
  useEffect(() => {
    if (isDesktop && !hasUserToggledSidebarRef.current && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [isDesktop, sidebarOpen]);

  // Track navigation state
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    setIsNavigating(true);

    if (navigateTimeoutRef.current) {
      clearTimeout(navigateTimeoutRef.current);
    }

    navigateTimeoutRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, 300);

    previousPathRef.current = location.pathname;

    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, [location.pathname]);

  // Use backend-provided force_password_change flag
  useEffect(() => {
    setNeedsPasswordChange(forcePasswordChange);
  }, [forcePasswordChange]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen, isDesktop]);

  const handleSidebarClose = useCallback(() => {
    hasUserToggledSidebarRef.current = true;
    setSidebarOpen(false);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    hasUserToggledSidebarRef.current = true;
    setSidebarOpen((previous) => !previous);
  }, []);

  // Handle escape key to close sidebar (mobile drawer only)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && sidebarOpen && !isDesktop) {
        handleSidebarClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen, isDesktop, handleSidebarClose]);

  const handlePasswordChangeSuccess = () => {
    if (updateUserPasswordStatus) {
      updateUserPasswordStatus(false);
    }
    setNeedsPasswordChange(false);
    setShowPasswordModal(false);
  };

  return (
    <ErrorBoundary>
      <div className="guardian-layout-wrapper">
        <div
          className={`guardian-dashboard ${sidebarVisible ? 'sidebar-open' : 'sidebar-collapsed'} ${
            isDesktop ? 'desktop-mode' : 'mobile-mode'
          }`}
        >
          {/* Page Transition Loader */}
          {isNavigating && <PageTransitionLoader message="Loading page..." />}

          {/* Floating ImmuniCare logo toggle - visible whenever sidebar is collapsed */}
          {!sidebarVisible && (
            <button
              type="button"
              onClick={handleSidebarToggle}
              className="guardian-menu-btn guardian-logo-menu-btn"
              aria-label="Open sidebar navigation"
              aria-expanded={sidebarVisible}
              aria-controls="guardian-sidebar"
            >
              <img
                src="/immunicare_LOGO.avif"
                alt="Open ImmuniCare navigation"
                className="w-full h-full object-cover"
              />
            </button>
          )}

          {/* Sidebar - Fixed on left side */}
          <GuardianSidebar
            isOpen={sidebarVisible}
            onClose={handleSidebarClose}
            onToggle={handleSidebarToggle}
            isDesktop={isDesktop}
          />

          {/* Main Content */}
          <div className="guardian-main-content">
            {/* Main Content Area - Single optimized content layer */}
            <div className="flex-1 w-full min-w-0 h-full overflow-x-hidden">
              <div className="guardian-content-area">
                {children ? children : <Outlet />}
              </div>

              {/* Mobile Bottom Navigation - Only for guardian users */}
              {isGuardian && <MobileBottomNav />}
            </div>

            {/* Quick Action FAB */}
            {isGuardian && (
              <QuickActionFAB
                isGuardian={isGuardian}
                emergencyContact={user?.emergencyContact || null}
              />
            )}

            {/* Password Change Overlay for first login */}
            {needsPasswordChange && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[400] p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby="password-change-title"
              >
                <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8 text-amber-600" />
                    </div>
                    <h3
                      id="password-change-title"
                      className="text-lg sm:text-xl font-bold text-gray-900"
                    >
                      Password Change Required
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                      Security notice for new accounts
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mb-6 sm:mb-8 text-center">
                    For security reasons, you must change your password from the
                    default on first login.
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button
                      onClick={() => setShowPasswordModal(true)}
                      size="lg"
                      className="w-full min-h-[48px] font-bold"
                    >
                      Change Password Now
                    </Button>
                    <Button
                      onClick={() => {
                        setNeedsPasswordChange(false);
                        logout();
                      }}
                      variant="ghost"
                      className="w-full text-gray-500 min-h-[44px] font-semibold"
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Password Change Modal */}
            <PasswordChangeModal
              isOpen={showPasswordModal}
              onClose={() => setShowPasswordModal(false)}
              onSuccess={handlePasswordChangeSuccess}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
});

GuardianLayout.displayName = "GuardianLayout";

export default GuardianLayout;
