import React from "react";
import { Badge } from "../UI";
import { normalizeRoleLabel } from "../../utils/roleLabels";

const normalizeRoleName = (value) => String(value || "").trim().toLowerCase();

const getRoleVariant = (roleName) => {
  const normalizedRole = normalizeRoleName(roleName);

  if (["super_admin", "system_admin"].includes(normalizedRole)) {
    return "danger";
  }

  if (["admin"].includes(normalizedRole)) {
    return "warning";
  }

  if (["doctor", "physician", "nurse", "midwife", "healthcare_worker", "hcw"].includes(normalizedRole)) {
    return "primary";
  }

  return "secondary";
};

const getRoleLabel = (user = {}) => {
  return normalizeRoleLabel(user.display_name || user.role_name || "Unknown");
};

export default function SystemUsersRoleBadge({ user }) {
  return (
    <Badge variant={getRoleVariant(user?.role_name)}>{getRoleLabel(user)}</Badge>
  );
}
