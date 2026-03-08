/**
 * Mobile Bottom Navigation Component
 *
 * Optimized for 360px × 800px baseline viewport.
 * Shows on mobile, hides on tablet/desktop.
 */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Calendar, Syringe, Bell, Settings } from "lucide-react";

const MobileBottomNav = ({ onNotificationClick }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: "dashboard",
      icon: Home,
      label: "Home",
      path: "/guardian/dashboard",
    },
    {
      id: "children",
      icon: Users,
      label: "Children",
      path: "/guardian/children",
    },
    {
      id: "appointments",
      icon: Calendar,
      label: "Schedule",
      path: "/guardian/appointments",
    },
    {
      id: "vaccinations",
      icon: Syringe,
      label: "Vaccines",
      path: "/guardian/vaccination-records",
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Alerts",
      path: "/guardian/notifications",
      onClick: onNotificationClick,
    },
    {
      id: "settings",
      icon: Settings,
      label: "Settings",
      path: "/guardian/settings",
    },
  ];

  const isActive = (item) => {
    if (item.path === "/guardian/dashboard") {
      return (
        location.pathname === item.path || location.pathname === "/guardian"
      );
    }
    return location.pathname.startsWith(item.path);
  };

  const handleClick = (item) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <nav
      className="mobile-bottom-nav"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mobile-bottom-nav__inner">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleClick(item)}
              className={`mobile-bottom-nav__item ${
                active ? "mobile-bottom-nav__item--active" : ""
              }`}
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <div className="mobile-bottom-nav__icon-wrapper">
                <Icon className="mobile-bottom-nav__icon" />
                {item.id === "notifications" && (
                  <span className="mobile-bottom-nav__badge" />
                )}
              </div>
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
