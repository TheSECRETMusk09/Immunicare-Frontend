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
    <div className="flex flex-wrap md:flex-nowrap items-center justify-start gap-1.5 min-w-[14rem]">
      <Button
        variant={isActive ? "warning" : "success"}
        size="sm"
        onClick={() => onToggleActive?.(user)}
        className="whitespace-nowrap gap-1.5 justify-center min-w-[92px]"
        title={isCurrentUser ? "You cannot disable your own account" : (isActive ? "Disable User" : "Enable User")}
        disabled={isTogglingActive || isCurrentUser}
      >
        {isActive ? (
          <>
            <PowerOff className="w-4 h-4 flex-shrink-0" />
            <span>Disable</span>
          </>
        ) : (
          <>
            <Power className="w-4 h-4 flex-shrink-0" />
            <span>Enable</span>
          </>
        )}
      </Button>
      <Button
        variant="success"
        size="sm"
        onClick={() => onEdit?.(user)}
        className="whitespace-nowrap gap-1.5 justify-center min-w-[92px]"
      >
        <Edit className="w-4 h-4 flex-shrink-0" />
        <span>Edit</span>
      </Button>

      <LoadingButton
        variant="danger"
        size="sm"
        onClick={() => onDelete?.(user)}
        loading={isDeleting}
        className="whitespace-nowrap gap-1.5 justify-center min-w-[92px]"
        loadingText="Deleting..."
        title={isCurrentUser ? "You cannot delete your own account" : "Delete User"}
        disabled={isCurrentUser}
      >
        <Trash2 className="w-4 h-4 flex-shrink-0" />
        <span>Delete</span>
      </LoadingButton>
    </div>
  );
}
