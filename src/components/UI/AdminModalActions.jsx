import React from "react";
import FormActions from "./FormActions";

/**
 * Shared admin modal action container.
 * Refactored to use FormActions for consistent right-aligned footer layout across the dashboard.
 */
const AdminModalActions = ({ children, className = "", ...props }) => {
  return (
    <FormActions className={`admin-modal-actions ${className}`.trim()} {...props}>
      {children}
    </FormActions>
  );
};

export default AdminModalActions;
