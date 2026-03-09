import React from "react";

const FormActions = ({
  children,
  className = "",
  stackOnMobile = true,
  unified = true,
  ...props
}) => {
  const responsiveClass = stackOnMobile
    ? "ui-form-actions--stack-mobile"
    : "ui-form-actions--row-mobile";
  const unifiedClass = unified ? "form-actions-unified" : "";

  return (
    <div
      className={`ui-form-actions ${unifiedClass} ${responsiveClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};

export default FormActions;
