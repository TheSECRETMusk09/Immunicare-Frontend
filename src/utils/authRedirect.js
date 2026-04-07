const SYSTEM_ADMIN_ALIASES = [
  "system_admin",
  "super_admin",
  "superadmin",
  "superadministrator",
  "admin",
  "administrator",
  "clinic_manager",
  "public_health_nurse",
  "inventory_manager",
  "physician",
  "doctor",
  "health_worker",
  "healthcare_worker",
  "nurse",
  "midwife",
  "nutritionist",
  "dentist",
  "staff",
];

const GUARDIAN_ALIASES = ["guardian", "user", "parent"];

export const resolveRoleType = (roleOrType) => {
  if (!roleOrType) return null;

  if (roleOrType === "SYSTEM_ADMIN" || roleOrType === "GUARDIAN") {
    return roleOrType;
  }

  const normalized = String(roleOrType).toLowerCase();

  if (GUARDIAN_ALIASES.includes(normalized)) return "GUARDIAN";
  if (SYSTEM_ADMIN_ALIASES.includes(normalized)) return "SYSTEM_ADMIN";

  return null;
};

export const normalizeAuthUser = (rawUser) => {
  if (!rawUser || typeof rawUser !== "object") return rawUser;

  const resolvedRole =
    rawUser.role || rawUser.role_name || rawUser.role_type || null;
  const resolvedRoleType =
    rawUser.role_type || resolveRoleType(resolvedRole) || null;
  const forcePasswordChange = Boolean(
    rawUser.forcePasswordChange ?? rawUser.force_password_change,
  );

  return {
    ...rawUser,
    role: resolvedRole,
    role_type: resolvedRoleType,
    forcePasswordChange,
    force_password_change: forcePasswordChange,
  };
};

export const getDefaultAuthenticatedRouteFromRoleType = (roleType) => {
  const canonicalRoleType = resolveRoleType(roleType);
  if (canonicalRoleType === "GUARDIAN") return "/guardian/dashboard";
  if (canonicalRoleType === "SYSTEM_ADMIN") return "/analytics";
  return "/login";
};

export const getDefaultAuthenticatedRouteFromUser = (user) => {
  const normalized = normalizeAuthUser(user);
  return getDefaultAuthenticatedRouteFromRoleType(normalized?.role_type);
};

export const getLoginRouteFromPathname = (pathname = "") => {
  const normalizedPathname =
    typeof pathname === "string" ? pathname.trim() : "";

  if (normalizedPathname.startsWith("/guardian")) {
    return "/guardian/login";
  }

  return "/admin/login";
};

export const getDefaultAuthenticatedRouteFromFlags = ({
  isGuardian,
  isAdmin,
}) => {
  if (isGuardian) return "/guardian/dashboard";
  if (isAdmin) return "/analytics";
  return "/login";
};
