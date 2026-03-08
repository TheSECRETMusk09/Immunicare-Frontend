import React from "react";
import { Key } from "lucide-react";
import { Button } from "../UI";

export default function SystemUsersPasswordControl({ onResetPassword, disabled = false }) {
  return (
    <Button
      variant="info"
      size="sm"
      onClick={onResetPassword}
      className="whitespace-nowrap gap-1.5"
      title="Reset Password"
      disabled={disabled}
    >
      <Key className="w-4 h-4 flex-shrink-0" />
      <span>Reset</span>
    </Button>
  );
}

