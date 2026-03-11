import React, { useState, useEffect, memo, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrefetchGuardian } from "../hooks/useCachedData";
import useGuardianNotifications from "../hooks/useGuardianNotifications";
import apiClient from "../utils/api";
import {
  LayoutDashboard,
  Calendar,
  Users,
  LogOut,
  Syringe,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  User,
  Bell,
  Baby,
  Activity,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const GuardianSidebar = memo(
  ({ isOpen, onClose, onToggle, isDesktop: propsIsDesktop }) => {
    // Use centralized theme context
    const { darkMode, toggleDarkMode } = useTheme();

    // ✅ Independent toggles (stable keys)
    const [expandedSections, setExpandedSections] = useState({
      vaccinations: false,
      health_records: false,
    });

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [logoutPending, setLogoutPending] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [childrenCount, setChildrenCount] = useState(0);
    const [notificationCount, setNotificationCount] = useState(0);

    // Desktop collapsed state (session-persisted)
    const SIDEBAR_COLLAPSE_KEY = "immunicare.guardian.sidebarCollapsed";
    const [isCollapsedDesktop, setIsCollapsedDesktop] = useState(() => {
      try {
        return sessionStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1";
      } catch {
        return false;
      }
    });

    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, guardianId } = useAuth();
    const { prefetchGuardianData } = usePrefetchGuardian();

    const { unreadCount: hookUnreadCount } = useGuardianNotifications({
      pollingInterval: 30000, // Poll every 30 seconds
      limit: 10,
    });

    // ✅ Submenu refs (for reliable height measurement; fixes overlay)
    const submenuRefs = useRef({});

    // Watch for notification count updates
    useEffect(() => {
      setNotificationCount(hookUnreadCount);
    }, [hookUnreadCount]);

    // Fetch children count for mobile sidebar indicator
    useEffect(() => {
      let isSubscribed = true;

      const fetchChildrenCount = async () => {
        if (!guardianId) {
          if (isSubscribed) {
            setChildrenCount(0);
          }
          return;
        }

        try {
          const statsResponse = await apiClient.getGuardianStats(guardianId);
          const statsPayload =
            statsResponse && typeof statsResponse === "object" && "data" in statsResponse
              ? statsResponse.data
              : statsResponse;

          const resolvedCount = Number(statsPayload?.childrenCount);
          if (Number.isFinite(resolvedCount)) {
            if (isSubscribed) {
              setChildrenCount(resolvedCount);
            }
            return;
          }

          // Fallback for deployments where stats endpoint is unavailable
          const infantsResponse = await apiClient.getInfantsByGuardian(guardianId);
          const infantsPayload =
            infantsResponse && typeof infantsResponse === "object" && "data" in infantsResponse
              ? infantsResponse.data
              : infantsResponse;
          const infants = Array.isArray(infantsPayload) ? infantsPayload : [];

          if (isSubscribed) {
            setChildrenCount(infants.length);
          }
        } catch (error) {
          console.error("Failed to fetch children count:", error);
          if (isSubscribed) {
            setChildrenCount(0);
          }
        }
      };

      fetchChildrenCount();

      return () => {
        isSubscribed = false;
      };
    }, [guardianId]);

    // Prefetch guardian data on hover
    const handleMouseEnter = useCallback(() => {
      if (!guardianId) return;
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(
          () => {
            prefetchGuardianData(guardianId);
          },
          { timeout: 2000 },
        );
      } else {
        setTimeout(() => prefetchGuardianData(guardianId), 100);
      }
    }, [prefetchGuardianData, guardianId]);

    const isDarkMode = darkMode;

    const isCollapsed = !!propsIsDesktop && isCollapsedDesktop;

    // Persist collapse state during the session
    useEffect(() => {
      if (!propsIsDesktop) return;
      try {
        sessionStorage.setItem(SIDEBAR_COLLAPSE_KEY, isCollapsedDesktop ? "1" : "0");
      } catch {
        // ignore
      }
    }, [propsIsDesktop, isCollapsedDesktop]);

    // When collapsing, ensure sub-navigation is hidden
    useEffect(() => {
      if (!isCollapsed) return;
      setExpandedSections({
        vaccinations: false,
        health_records: false,
      });
    }, [isCollapsed]);

    const closeIfMobile = useCallback(() => {
      if (!propsIsDesktop) onClose?.();
    }, [propsIsDesktop, onClose]);

    // ✅ Stable section keys (prevents mismatched toggles)
    const sectionKeyFromItem = (item) =>
      item?.sectionKey || item?.name?.toLowerCase().replace(/\s+/g, "_");

    // Toggle collapsible section (independent toggles)
    const toggleSection = useCallback((sectionKey) => {
      if (!sectionKey) return;
      setExpandedSections((prev) => ({
        ...prev,
        [sectionKey]: !prev[sectionKey],
      }));
    }, []);

    // Handle logout with confirmation
    const handleLogout = async () => {
      setLogoutPending(true);
      setLogoutError("");

      try {
        await Promise.resolve(logout());
        navigate("/");
      } catch (error) {
        console.error("Failed to logout guardian user:", error);
        setLogoutError("Unable to logout right now. Please try again.");
      } finally {
        setLogoutPending(false);
      }
    };

    // Navigation items
    const navItems = [
      { name: "Dashboard", icon: LayoutDashboard, path: "/guardian/dashboard" },
      { name: "My Children", icon: Users, path: "/guardian/children" },

      // ✅ add stable keys for submenu parents
      {
        name: "Vaccinations",
        sectionKey: "vaccinations",
        icon: Syringe,
        path: "/guardian/vaccination-records",
        hasSubItems: true,
        subItems: [
          { name: "All Records", icon: Syringe, path: "/guardian/vaccination-records" },
          { name: "Immunization Chart", icon: FileSpreadsheet, path: "/guardian/immunization-chart" },
        ],
      },
      {
        name: "Health Records",
        sectionKey: "health_records",
        icon: FileText,
        path: "/guardian/health-charts",
        hasSubItems: true,
        subItems: [
          { name: "All Health Records", icon: FileText, path: "/guardian/health-charts" },
          { name: "Growth Charts", icon: Activity, path: "/guardian/health-charts" },
        ],
      },

      { name: "Appointments", icon: Calendar, path: "/guardian/appointments" },
      { name: "Notifications", icon: Bell, path: "/guardian/notifications", badge: notificationCount },
      { name: "Profile", icon: User, path: "/guardian/profile" },
    ];

    const isActive = useCallback(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/"),
      [location.pathname],
    );

    const isParentActive = useCallback(
      (item) =>
        isActive(item.path) || (item.hasSubItems && item.subItems?.some((sub) => isActive(sub.path))),
      [isActive],
    );

    // ✅ Auto-expand correct section if current route is inside sub-items
    useEffect(() => {
      const activeParents = navItems.filter(
        (it) => it.hasSubItems && it.subItems?.some((sub) => isActive(sub.path)),
      );

      if (!activeParents.length) return;

      setExpandedSections((prev) => {
        const next = { ...prev };
        activeParents.forEach((parent) => {
          const key = sectionKeyFromItem(parent);
          if (key) next[key] = true;
        });
        return next;
      });

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Handle navigation
    const handleNavClick = (item) => {
      // In collapsed desktop mode, parent items should route directly
      if (propsIsDesktop && isCollapsed && item.hasSubItems) {
        navigate(item.path);
        return;
      }

      if (item.hasSubItems) {
        toggleSection(sectionKeyFromItem(item));
        return;
      }

      navigate(item.path);
      closeIfMobile();
    };

    const shouldShowOverlay = !propsIsDesktop && isOpen;

    const sidebarStateClass = propsIsDesktop
      ? isCollapsed
        ? "desktop-icon-collapsed"
        : "desktop-open"
      : isOpen
        ? "open mobile-open"
        : "mobile-collapsed";

    return (
      <>
        {/* Mobile Overlay with fade transition - Only show on mobile */}
        {!propsIsDesktop && (
          <div
            className={`guardian-sidebar-overlay ${shouldShowOverlay ? "open" : ""}`}
            onClick={onClose}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          id="guardian-sidebar"
          className={`guardian-sidebar guardian-sidebar-shell ${sidebarStateClass}`}
          role="navigation"
          aria-label="Guardian navigation"
          aria-hidden={!isOpen && !propsIsDesktop}
        >
          {/* Logo Section */}
          <div className="guardian-sidebar-brand p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="guardian-sidebar-brand-logo-btn guardian-sidebar-brand-icon w-11 h-11 rounded-full flex items-center justify-center overflow-hidden shadow-sm bg-white"
                onClick={() => {
                  if (propsIsDesktop) {
                    setIsCollapsedDesktop((v) => !v);
                  } else {
                    onToggle?.();
                  }
                }}
                aria-label={
                  propsIsDesktop
                    ? isCollapsed
                      ? "Expand sidebar"
                      : "Collapse sidebar"
                    : isOpen
                      ? "Close sidebar"
                      : "Open sidebar"
                }
                aria-expanded={propsIsDesktop ? !isCollapsed : isOpen}
                aria-controls="guardian-sidebar"
              >
                <img
                  src="/immunicare_LOGO.avif"
                  alt="Immunicare Logo"
                  className="w-full h-full object-cover"
                />
              </button>

              <div className={`min-w-0 ${isCollapsed ? "hidden" : "block"}`}>
                <span className="text-[1.65rem] font-extrabold text-gray-900 dark:text-white block leading-tight tracking-tight truncate">
                  Immunicare
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Guardian Portal
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav
            className="guardian-sidebar-nav flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden"
            onMouseEnter={handleMouseEnter}
          >
            {navItems.map((item) => {
              const key = sectionKeyFromItem(item);
              const expanded = item.hasSubItems ? !!expandedSections[key] : false;
              const parentActive = isParentActive(item);
              const hasBadge = typeof item.badge === "number" && item.badge > 0;

              const rightPadding = isCollapsed
                ? "pr-4"
                : item.hasSubItems
                  ? "pr-16"
                  : hasBadge
                    ? "pr-12"
                    : "pr-4";

              const badgeRightClass = isCollapsed
                ? "right-2"
                : item.hasSubItems
                  ? "right-10"
                  : "right-4";

              // ✅ measured maxHeight prevents overlay in ALL CSS environments
              const measuredMaxHeight =
                expanded && submenuRefs.current[key]?.scrollHeight
                  ? `${submenuRefs.current[key].scrollHeight}px`
                  : "0px";

              return (
                <div key={item.name} className="w-full">
                  <button
                    type="button"
                    onClick={() => handleNavClick(item)}
                    title={isCollapsed ? item.name : undefined}
                    aria-label={isCollapsed ? item.name : undefined}
                    className={`relative w-full ${
                      isCollapsed ? "justify-center" : "text-left"
                    } px-4 ${rightPadding} py-3 rounded-xl transition-all duration-200 flex items-center gap-3 min-h-[48px] touch-manipulation cursor-pointer min-w-0 ${
                      parentActive
                        ? "bg-emerald-600 text-white shadow-md font-semibold"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                    }`}
                    aria-expanded={item.hasSubItems ? expanded : undefined}
                    aria-current={parentActive && !item.hasSubItems ? "page" : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />

                    {!isCollapsed && <span className="flex-1 min-w-0 truncate">{item.name}</span>}

                    {hasBadge && (
                      <span
                        className={`absolute ${badgeRightClass} top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center leading-none`}
                        aria-label={`${item.badge} unread notifications`}
                      >
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}

                    {item.hasSubItems && !isCollapsed && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                    )}
                  </button>

                  {/* ✅ FIX: Sub Items never overlay; always pushes layout down */}
                  {item.hasSubItems && !isCollapsed && (
                    <div
                      className="ml-4 overflow-hidden"
                      style={{
                        maxHeight: measuredMaxHeight,
                        opacity: expanded ? 1 : 0,
                        marginTop: expanded ? "0.25rem" : "0rem",
                        transition:
                          "max-height 300ms ease-in-out, opacity 300ms ease-in-out, margin-top 300ms ease-in-out",
                        pointerEvents: expanded ? "auto" : "none",
                      }}
                    >
                      <div ref={(el) => (submenuRefs.current[key] = el)} className="w-full min-w-0">
                        <div className="space-y-1">
                          {item.subItems.map((subItem) => (
                            <button
                              type="button"
                              key={subItem.path}
                              onClick={() => {
                                navigate(subItem.path);
                                closeIfMobile();
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm min-h-[40px] touch-manipulation min-w-0 ${
                                isActive(subItem.path)
                                  ? "bg-emerald-500 text-white font-semibold"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium"
                              }`}
                              aria-current={isActive(subItem.path) ? "page" : undefined}
                            >
                              <subItem.icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate min-w-0">{subItem.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Children Count Indicator - Mobile */}
          <div className="lg:hidden px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Baby className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-emerald-800">
                {childrenCount} Child{childrenCount !== 1 ? "ren" : ""} Active
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="guardian-sidebar-footer border-t border-gray-100 dark:border-gray-700 p-4 space-y-2 lg:mt-auto">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              title={isCollapsed ? (isDarkMode ? "Light Mode" : "Dark Mode") : undefined}
              aria-label={
                isCollapsed
                  ? isDarkMode
                    ? "Light Mode"
                    : "Dark Mode"
                  : isDarkMode
                    ? "Switch to light mode"
                    : "Switch to dark mode"
              }
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 font-medium"
            >
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                {isDarkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
              </div>
              {!isCollapsed && (
                <span className="flex-1 text-left text-sm font-semibold">
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </span>
              )}
            </button>

            {/* Logout / User */}
            <button
              onClick={() => {
                setLogoutError("");
                setShowLogoutConfirm(true);
              }}
              title={isCollapsed ? "User / Logout" : undefined}
              aria-label={isCollapsed ? "User / Logout" : undefined}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200 font-medium"
            >
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {user?.firstName || user?.username || "Guardian"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || "guardian@example.com"}
                  </p>
                </div>
              )}
              {!isCollapsed && <LogOut className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div
            className="fixed inset-0 z-[350] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm dark:bg-black/70"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guardian-logout-dialog-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
              <h3
                id="guardian-logout-dialog-title"
                className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                Confirm Logout
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to log out?
              </p>

              {logoutError && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-700/70 dark:bg-red-900/30 dark:text-red-200"
                >
                  {logoutError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLogoutError("");
                    setShowLogoutConfirm(false);
                  }}
                  disabled={logoutPending}
                  className="min-h-[48px] flex-1 rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutPending}
                  aria-busy={logoutPending}
                  className="min-h-[48px] flex-1 rounded-xl bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-red-500 dark:hover:bg-red-600 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {logoutPending ? "Logging out..." : "Logout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
);

GuardianSidebar.displayName = "GuardianSidebar";
export default GuardianSidebar;
