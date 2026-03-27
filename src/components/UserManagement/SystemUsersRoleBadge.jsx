import React from "react";
import { Badge } from "../UI";

const normalizeRoleName = (value) => String(value || "").trim().toLowerCase();

const getRoleVariant = (roleName) => {
  const normalizedRole = normalizeRoleName(roleName);

  if (["super_admin", "system_admin"].includes(normalizedRole)) {
    return "danger";
  }

  if (["admin", "clinic_manager"].includes(normalizedRole)) {
    return "warning";
  }

  if (["doctor", "physician", "nurse", "midwife"].includes(normalizedRole)) {
    return "primary";
  }

  return "secondary";
};

const getRoleLabel = (user = {}) => {
  return user.display_name || user.role_name || "Unknown";
};

export default function SystemUsersRoleBadge({ user }) {
  return (
    <Badge variant={getRoleVariant(user?.role_name)}>{getRoleLabel(user)}</Badge>
  );
}
