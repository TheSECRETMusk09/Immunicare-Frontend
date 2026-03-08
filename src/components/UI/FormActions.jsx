import React from "react";

const FormActions = ({ children, className = "", ...props }) => {
  return (
    <div
      className={`flex w-full items-center justify-end gap-3 flex-nowrap ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export default FormActions;
