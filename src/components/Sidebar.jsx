import React, { useState, useEffect, memo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePrefetchDashboard } from "../hooks/useCachedData";
import AdminHeader from "./UI/AdminHeader";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Baby,
  Syringe,
  Package,
  Calendar,
  ClipboardList,
  Megaphone,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  LogOut,
} from "lucide-react";

const Sidebar = memo(({ isOpen, onClose, darkMode, onToggleDarkMode }) => {
  const [expandedSections, setExpandedSections] = useState({
    healthAlerts: false,
    facilities: false,
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { prefetchDashboardData } = usePrefetchDashboard();

  // Prefetch data on hover with debouncing
  const handleMouseEnter = useCallback(() => {
    // Use requestIdleCallback for non-blocking prefetch
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(
        () => {
          prefetchDashboardData();
        },
        { timeout: 2000 },
      );
    } else {
      setTimeout(prefetchDashboardData, 100);
    }
  }, [prefetchDashboardData]);

  // Handle dark mode toggle - use the onToggleDarkMode prop if provided
  const handleToggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else if (typeof darkMode === "object" && darkMode?.toggle) {
      darkMode.toggle();
    }
  };

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Analytics", icon: BarChart3 },
    { name: "User Management", icon: Users },
    { name: "Infant Management", icon: Baby },
    { name: "Vaccinations", icon: Syringe },
    { name: "Inventory", icon: Package },
    { name: "Appointments", icon: Calendar },
    { name: "Reports", icon: ClipboardList },
    { name: "Announcements", icon: Megaphone },
    { name: "Notifications", icon: Bell },
    { name: "Settings", icon: Settings },
  ];

  const datePart = currentDateTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timePart = currentDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Keep sidebar date/time synchronized with real-world clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Route mapping for sidebar items
  const getRoutePath = (itemName, subItemName) => {
    const routeMap = {
      Dashboard: "/dashboard",
      Analytics: "/analytics",
      "User Management": "/users",
      "Infant Management": "/infants",
      Vaccinations: "/vaccination-management",
      Inventory: "/inventory",
      Appointments: "/appointments",
      Reports: "/reports",
      Announcements: "/announcements",
      Notifications: "/notifications",
      Settings: "/settings",
    };

    if (subItemName) {
      return routeMap[subItemName] || "/";
    }
    return routeMap[itemName] || "/";
  };

  // Get current active item based on location
  const getActiveItem = () => {
    const path = location.pathname;

    // Check for inventory path
    if (path === "/inventory") {
      return "Inventory";
    }

    // Check paths
    if (path.includes("/inventory")) return "Inventory";
    if (path.includes("/vaccination-management")) return "Vaccinations";
    if (path.includes("/users")) return "User Management";
    if (path.includes("/infants")) return "Infant Management";
    if (path.includes("/analytics")) return "Analytics";
    if (path.includes("/appointments")) return "Appointments";
    if (path.includes("/reports")) return "Reports";
    if (path.includes("/announcements")) return "Announcements";
    if (path.includes("/notifications")) return "Notifications";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/dashboard")) return "Dashboard";

    return "Dashboard";
  };

  const toggleSection = (sectionName) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  // Handle logout with confirmation
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (itemName) => {
    const activeItem = getActiveItem();
    return activeItem === itemName;
  };

  const isSubItemActive = (subItemName) => {
    const activeItem = getActiveItem();
    return activeItem === subItemName;
  };

  const handleItemClick = (item) => {
    if (item.hasSubItems) {
      toggleSection(item.name.toLowerCase().replace(" ", "_"));
    } else {
      const routePath = getRoutePath(item.name);
      navigate(routePath);
      if (window.innerWidth < 768) {
        onClose();
      }
    }
  };

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen && window.innerWidth < 768) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Sticky on desktop, fixed slide-out on mobile */}
      <aside
        className={`admin-sidebar md:sticky md:top-0 md:h-screen z-30 w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col transform transition-transform duration-300 ease-out h-screen
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="p-4 font-bold text-xl text-indigo-600 dark:text-indigo-400 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <img
              src="/immunicare_LOGO.avif"
              alt="Immunicare Logo"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = "none";
              }}
            />
            <span className="text-lg hidden md:block">Immunicare</span>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-4 py-6 space-y-2 overflow-y-auto"
          onMouseEnter={handleMouseEnter}
        >
          {/* Live Date & Time Display */}
          <div
            className="admin-sidebar-datetime mb-4"
            aria-live="polite"
            aria-label="Current date and time"
          >
            <p className="admin-sidebar-datetime__text" data-testid="admin-sidebar-datetime-text">
              <span>{datePart}</span>
              <span className="admin-sidebar-datetime__separator" aria-hidden="true">
                •
              </span>
              <span>{timePart}</span>
            </p>
          </div>

          {navItems.map((item, index) => (
            <div key={item.name}>
              <button
                type="button"
                onClick={() => handleItemClick(item)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group relative flex items-center gap-3 sidebar-link
                ${
                  isActive(item.name) ||
                  (item.hasSubItems &&
                    item.subItems.some((sub) => isSubItemActive(sub.name)))
                    ? "active bg-indigo-600 text-white shadow-lg font-bold"
                    : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 hover:translate-x-1 font-bold"
                }`}
                aria-expanded={
                  item.hasSubItems
                    ? expandedSections[
                        item.name.toLowerCase().replace(" ", "_")
                      ]
                    : undefined
                }
                aria-current={isActive(item.name) ? "page" : undefined}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden md:block font-bold">{item.name}</span>
                {item.badge && (
                  <span className="ml-auto flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
                <span className="ml-auto text-sm hidden md:block">
                  {item.hasSubItems &&
                    (expandedSections[
                      item.name.toLowerCase().replace(" ", "_")
                    ] ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    ))}
                </span>

                {/* Mobile tooltip */}
                <div className="md:hidden absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 pointer-events-none shadow-lg font-bold">
                  {item.name}
                  <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              </button>

              {/* Sub Items */}
              {item.hasSubItems &&
                expandedSections[item.name.toLowerCase().replace(" ", "_")] && (
                  <div className="ml-4 mt-2 space-y-1 animate-slide-down">
                    {item.subItems.map((subItem) => (
                      <button
                        type="button"
                        key={subItem.name}
                        onClick={() => {
                          if (subItem.tab) {
                            navigate(`/digital-papers?tab=${subItem.tab}`);
                          } else {
                            navigate(subItem.path);
                          }
                          if (window.innerWidth < 768) {
                            onClose();
                          }
                        }}
                        className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 group relative flex items-center gap-3 text-sm sidebar-link
                      ${
                        isSubItemActive(subItem.name)
                          ? "active bg-indigo-500 text-white font-bold"
                          : "hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:translate-x-1 font-bold"
                      }`}
                        aria-current={isSubItemActive(subItem.name) ? "page" : undefined}
                      >
                        <subItem.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden md:block font-bold">{subItem.name}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </nav>

        {/* User Profile Section - Top of sidebar */}
        <div className="mt-auto border-t dark:border-gray-700">
          {/* Health Center Info - Displayed at top */}
<div className="px-4 py-3 border-b dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20">
  <div className="flex items-center gap-2">
    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
    <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
      {(() => {
        const healthCenter = user?.clinic || user?.healthCenter;
        if (!healthCenter) return "San Nicolas Health Center";
        // Map "Main Health Center" to "San Nicolas Health Center" for display
        if (healthCenter === "Main Health Center") return "San Nicolas Health Center";
        return healthCenter;
      })()}
    </span>
  </div>
</div>

          <AdminHeader
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
            onLogout={() => setShowLogoutConfirm(true)}
          />
        </div>
      </aside>

      {/* Logout Confirmation Modal - Outside aside for proper viewport centering */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3
              id="logout-dialog-title"
              className="text-lg font-bold text-gray-900 dark:text-white mb-2"
            >
              Confirm Logout
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Are you sure you want to log out from the admin panel?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 text-white bg-gray-500 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
