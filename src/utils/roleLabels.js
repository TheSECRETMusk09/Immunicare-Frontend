const ADMIN_ROLE_LABELS = new Set([
  "super administrator",
  "super admin",
  "superadministrator",
  "administrator",
  "admin",
  "system administrator",
  "system admin",
  "systemadministrator",
]);

const normalizeRoleToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export const normalizeRoleLabel = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  const raw = String(value);
  const normalized = normalizeRoleToken(raw);

  if (!normalized) {
    return raw;
  }

  if (ADMIN_ROLE_LABELS.has(normalized)) {
    return "System Administrator";
  }

  if (normalized === "health worker" || normalized === "healthcare worker" || normalized === "health_worker") {
    return "Nurse";
  }

  return raw;
};
