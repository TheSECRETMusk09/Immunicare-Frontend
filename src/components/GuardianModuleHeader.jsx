import React from "react";
import { PageHeader } from "./UI";

/**
 * GuardianModuleHeader
 * Shared guardian module header wrapper.
 *
 * Standardizes:
 * - Header structure (via PageHeader)
 * - Wrapper spacing pattern from Appointments source-of-truth
 *   (pt-2 md:px-3 lg:px-4)
 * - Consistent desktop/mobile alignment and styling
 */
export default function GuardianModuleHeader({
  title,
  subtitle,
  icon = null,
  actions = null,
  children,
  className = "",
  headerClassName = "",
  actionsClassName = "",
  showOnDesktop = true,
  showOnMobile = true,
}) {
  const resolvedActions = actions ?? children ?? null;

  const visibilityClassName = [
    showOnDesktop ? "" : "lg:hidden",
    showOnMobile ? "" : "max-lg:hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`guardian-module-mobile-header guardian-module-header-shell pt-2 md:px-3 lg:px-4 ${visibilityClassName} ${className}`}
    >
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        actions={
          resolvedActions ? (
            <div
              className={`guardian-module-header__actions-shell ${actionsClassName}`.trim()}
            >
              {resolvedActions}
            </div>
          ) : null
        }
        className={`w-full ${headerClassName}`.trim()}
      />
    </div>
  );
}
