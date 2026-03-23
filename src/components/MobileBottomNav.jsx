import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  User,
  ClipboardList,
} from "lucide-react";

/**
 * MobileBottomNav Component
 * Fixed bottom navigation bar for mobile devices (< 1024px)
 * Provides quick access to main dashboard sections
 *
 * Design: 5 icons with labels - Dashboard, Appointments, Records, Schedule, Profile
 * Active state: Green background with emerald color
 *
 * Matches reference design:
 * - Dashboard (grid icon)
 * - Appointments (calendar icon)
 * - Records (file text icon)
 * - Schedule (syringe icon)
 * - Profile (user icon)
 *
 * @version 5.0
 * @since 2026-03-03
 */

const navItems = [
  {
    name: "Dashboard",
    path: "/guardian/dashboard",
    icon: LayoutDashboard,
    ariaLabel: "Go to Dashboard",
    exact: true,
  },
  {
    name: "Appointments",
    path: "/guardian/appointments",
    icon: Calendar,
    ariaLabel: "View Appointments",
    exact: false,
  },
  {
    name: "Records",
    path: "/guardian/vaccination-records",
    icon: FileText,
    ariaLabel: "View Vaccination Records",
    exact: false,
  },
  {
    name: "Schedule",
    path: "/guardian/immunization-chart",
    icon: ClipboardList,
    ariaLabel: "View Immunization Schedule",
    exact: false,
  },
  {
    name: "Profile",
    path: "/guardian/profile",
    icon: User,
    ariaLabel: "View Profile",
    exact: false,
  },
];

/**
 * Check if a navigation item is active based on current location
 */
const isNavItemActive = (location, item) => {
  const { pathname } = location;
  const { path, exact } = item;

  // Dashboard special case - also matches /guardian base path
  if (path === "/guardian/dashboard") {
    return pathname === "/guardian/dashboard" ||
           pathname === "/guardian" ||
           pathname === "/guardian/";
  }

  // Exact match required
  if (exact) {
    return pathname === path;
  }

  // Prefix match for other routes
  return pathname.startsWith(path);
};

/**
 * Trigger haptic feedback if supported
 */
const triggerHapticFeedback = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(5);
  }
};

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Memoize active states to prevent unnecessary re-renders
  const activeStates = useMemo(() => {
    return navItems.map((item) => isNavItemActive(location, item));
  }, [location]);

  const handleNavigation = (path) => {
    triggerHapticFeedback();
    navigate(path);
  };

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-[100] bg-white min-[768px]:hidden"
      role="navigation"
      aria-label="Mobile guardian navigation"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div className="grid grid-cols-5 items-center gap-1 px-2 py-1.5">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = activeStates[index];

          return (
            <button
              type="button"
              key={item.name}
              onClick={() => handleNavigation(item.path)}
              className={`mobile-bottom-nav-item relative flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all duration-200 ${
                active
                  ? 'text-emerald-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label={item.ariaLabel}
              aria-current={active ? "page" : undefined}
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                className={`mobile-bottom-nav-icon-wrap flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-emerald-100'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.5 : 2}
                  className="mobile-bottom-nav-icon transition-all duration-200"
                />
              </div>
              <span
                className={`mobile-bottom-nav-label text-[9px] min-[360px]:text-[10px] font-semibold transition-all duration-200 ${
                  active ? 'text-emerald-600' : 'text-gray-500'
                }`}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings removed intentionally for guardian flow. */}
    </nav>
  );
}
