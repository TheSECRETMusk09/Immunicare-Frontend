import React from "react";
import { Edit, Power, PowerOff, Trash2 } from "lucide-react";
import { Button, LoadingButton } from "../UI";

export default function SystemUsersActionGroup({
  user,
  isTogglingActive = false,
  isDeleting = false,
  onToggleActive,
  onEdit,
  onDelete,
  currentUserId,
}) {
  const isActive = Boolean(user?.is_active);
  // Self-protection: check if this is the current user's own account
  const isCurrentUser = String(user?.id) === String(currentUserId);

  return (
    <div className="flex items-center justify-start gap-1">
      <Button
        variant={isActive ? "warning" : "success"}
        size="xs"
        onClick={() => onToggleActive?.(user)}
        className="p-1.5"
        title={isCurrentUser ? "You cannot disable your own account" : (isActive ? "Disable User" : "Enable User")}
        disabled={isTogglingActive || isCurrentUser}
        aria-label={isActive ? "Disable user" : "Enable user"}
      >
        {isActive ? (
          <PowerOff className="w-3.5 h-3.5" />
        ) : (
          <Power className="w-3.5 h-3.5" />
        )}
      </Button>
      <Button
        variant="success"
        size="xs"
        onClick={() => onEdit?.(user)}
        className="p-1.5"
        title="Edit User"
        aria-label="Edit user"
      >
        <Edit className="w-3.5 h-3.5" />
      </Button>

      <LoadingButton
        variant="danger"
        size="xs"
        onClick={() => onDelete?.(user)}
        loading={isDeleting}
        className="p-1.5"
        title={isCurrentUser ? "You cannot delete your own account" : "Delete User"}
        aria-label={isCurrentUser ? "Cannot delete own account" : "Delete user"}
        disabled={isCurrentUser}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </LoadingButton>
    </div>
  );
}
