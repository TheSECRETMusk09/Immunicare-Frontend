export const PERMISSION_GROUPS = Object.freeze({
  transferValidation: ["transfer:validate", "transfer:approve", "patient:update"],
  inventoryCorrections: ["inventory:correct", "inventory:update", "inventory:delete"],
  documentAccess: ["document:view", "document:export", "document:create"],
  reportGeneration: ["report:create", "report:export"],
  adminOverride: ["admin:override", "user:update", "user:delete"],
  systemAudit: ["system:audit"],
  systemSettings: ["system:settings"],
});

export const normalizePermissions = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return [...new Set(permissions.filter(Boolean).map((permission) => String(permission).trim()))];
};

export const hasPermission = (permissions = [], permission) => {
  if (!permission) {
    return false;
  }

  return normalizePermissions(permissions).includes(String(permission).trim());
};

export const hasAnyPermission = (permissions = [], requiredPermissions = []) => {
  const normalizedRequiredPermissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return normalizedRequiredPermissions.some((permission) => hasPermission(permissions, permission));
};

export const buildPermissionCapabilities = (permissions = []) => ({
  canValidateTransfers: hasAnyPermission(permissions, PERMISSION_GROUPS.transferValidation),
  canCorrectInventory: hasAnyPermission(permissions, PERMISSION_GROUPS.inventoryCorrections),
  canAccessDocuments: hasAnyPermission(permissions, PERMISSION_GROUPS.documentAccess),
  canGenerateReports: hasAnyPermission(permissions, PERMISSION_GROUPS.reportGeneration),
  canUseAdminOverrides: hasAnyPermission(permissions, PERMISSION_GROUPS.adminOverride),
  canViewAuditLogs: hasAnyPermission(permissions, PERMISSION_GROUPS.systemAudit),
  canManageSystemSettings: hasAnyPermission(permissions, PERMISSION_GROUPS.systemSettings),
});
