import React from "react";
import { Key } from "lucide-react";
import { Button } from "../UI";

export default function SystemUsersPasswordControl({ onResetPassword, disabled = false }) {
  return (
    <Button
      variant="info"
      size="xs"
      onClick={onResetPassword}
      className="p-1.5"
      title="Reset Password"
      aria-label="Reset password"
      disabled={disabled}
    >
      <Key className="w-3.5 h-3.5" />
    </Button>
  );
}

