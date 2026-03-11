import React from "react";
import { DataTable } from "../UI";
import SystemUsersRoleBadge from "./SystemUsersRoleBadge";
import SystemUsersActionGroup from "./SystemUsersActionGroup";
import SystemUsersPasswordControl from "./SystemUsersPasswordControl";

const getSystemUserRowKey = (row) => `system:${String(row?.id)}`;

export default function SystemUsersTable({
  users = [],
  isTogglingActive = false,
  isResettingPassword = false,
  isDeleting = false,
  onToggleActive,
  onResetPassword,
  onEdit,
  onDelete,
  currentUserId,
}) {
  const renderGuardianManagedNotice = () => (
    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      Managed in Guardians tab
    </span>
  );

  const columns = [
    {
      key: "username",
      label: "Username",
      width: "14%",
      headerClassName: "min-w-[100px]",
      cellClassName: "min-w-[100px]",
      render: (value) => (
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={value}>
          {value}
        </div>
      ),
    },
    {
      key: "role_name",
      label: "Role",
      width: "11%",
      headerClassName: "min-w-[90px]",
      cellClassName: "min-w-[90px]",
      render: (_value, row) => <SystemUsersRoleBadge user={row} />,
    },
    {
      key: "password_control",
      label: "Password",
      width: "10%",
      headerClassName: "min-w-[80px]",
      cellClassName: "min-w-[80px]",
      render: (_value, row) => (
        row?.is_guardian_account ? (
          renderGuardianManagedNotice()
        ) : (
          <SystemUsersPasswordControl
            onResetPassword={() => onResetPassword?.(row)}
            disabled={isResettingPassword}
          />
        )
      ),
    },
    {
      key: "clinic_name",
      label: "Clinic",
      width: "14%",
      headerClassName: "min-w-[100px] max-w-[140px]",
      cellClassName: "min-w-[100px] max-w-[140px]",
      render: (value) =>
        value ? (
          <span className="text-gray-700 dark:text-gray-200 truncate block" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-gray-400 italic">N/A</span>
        ),
    },
    {
      key: "contact",
      label: "Contact",
      width: "14%",
      headerClassName: "min-w-[100px] max-w-[140px]",
      cellClassName: "min-w-[100px] max-w-[140px] break-all",
      render: (value) =>
        value ? (
          <span className="text-gray-700 dark:text-gray-200 truncate block" title={value}>
            {value}
          </span>
        ) : (
          <span className="text-gray-400 italic">N/A</span>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      width: "8%",
      headerClassName: "min-w-[70px] w-[70px]",
      cellClassName: "min-w-[70px] w-[70px]",
      render: (value) =>
        value ? (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-[var(--theme-success-bg)] text-[var(--theme-success)]">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]">
            Disabled
          </span>
        ),
    },
  ];

  return (
    <DataTable
      data={users}
      columns={columns}
      actions={(row) => (
        row?.is_guardian_account ? (
          renderGuardianManagedNotice()
        ) : (
          <SystemUsersActionGroup
            user={row}
            isTogglingActive={isTogglingActive}
            isDeleting={isDeleting}
            onToggleActive={onToggleActive}
            onEdit={onEdit}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        )
      )}
      getRowKey={getSystemUserRowKey}
      actionsHeaderClassName="w-[100px] min-w-[100px]"
      actionsCellClassName="w-[100px] min-w-[100px]"
      emptyMessage="No users found."
      emptyIcon={<span className="text-4xl">🛡️</span>}
    />
  );
}
