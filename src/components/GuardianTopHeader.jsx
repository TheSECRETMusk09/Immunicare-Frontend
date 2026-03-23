import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, RefreshCw, User } from "lucide-react";

/**
 * GuardianTopHeader
 * Standard sticky top bar for guardian pages.
 *
 * Shared across Guardian Dashboard, My Children, and Profile.
 */
export default function GuardianTopHeader({
  title,
  onRefresh,
  isRefreshing = false,
  className = "",
}) {
  const navigate = useNavigate();

  return (
    <header className={`guardian-top-header ${className}`}>
      <div className="guardian-top-header__inner">
        <div className="guardian-top-header__left-spacer min-[1025px]:hidden" aria-hidden="true" />

        <h1 className="guardian-top-header__title">{title}</h1>

        <div className="guardian-top-header__actions">
          <button
            type="button"
            onClick={() => onRefresh?.()}
            className="guardian-top-header__action-btn"
            aria-label={title ? `Refresh ${title}` : "Refresh page"}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => navigate("/guardian/notifications")}
            className="guardian-top-header__action-btn guardian-top-header__action-btn--notif"
            aria-label="Open notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="guardian-top-header__notif-dot" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/guardian/profile")}
            className="guardian-top-header__action-btn"
            aria-label="Open profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
