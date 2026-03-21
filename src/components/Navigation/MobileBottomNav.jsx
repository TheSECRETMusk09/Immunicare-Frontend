/**
 * Mobile Bottom Navigation Component
 *
 * Optimized for 360px × 800px baseline viewport.
 * Shows on mobile, hides on tablet/desktop.
 */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Calendar, Syringe, Bell, User } from "lucide-react";
import { guardianRoutePaths } from "../../utils/routePaths";

const MobileBottomNav = ({ onNotificationClick }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: "dashboard",
      icon: Home,
      label: "Home",
      path: guardianRoutePaths.dashboard,
    },
    {
      id: "children",
      icon: Users,
      label: "Children",
      path: guardianRoutePaths.children,
    },
    {
      id: "appointments",
      icon: Calendar,
      label: "Schedule",
      path: guardianRoutePaths.appointments,
    },
    {
      id: "vaccinations",
      icon: Syringe,
      label: "Vaccines",
      path: guardianRoutePaths.vaccinationRecords,
    },
    {
      id: "notifications",
      icon: Bell,
      label: "Alerts",
      path: guardianRoutePaths.notifications,
      onClick: onNotificationClick,
    },
    {
      id: "profile",
      icon: User,
      label: "Profile",
      path: guardianRoutePaths.profile,
    },
  ];

  const isActive = (item) => {
    if (item.path === guardianRoutePaths.dashboard) {
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
