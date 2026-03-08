import React from "react";

/**
 * VisuallyHidden Component
 * Hides content visually while keeping it accessible to screen readers
 * WCAG compliant method for providing context to assistive technologies
 */
const VisuallyHidden = ({ children, as: Component = "span", ...props }) => {
  return (
    <Component
      className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
      style={{
        clip: "rect(0, 0, 0, 0)",
        clipPath: "inset(50%)",
      }}
      {...props}
    >
      {children}
    </Component>
  );
};

export default VisuallyHidden;
