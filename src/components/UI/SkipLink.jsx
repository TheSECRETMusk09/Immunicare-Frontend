import React from "react";
import { useSkipLink } from "../../hooks/useAccessibility";

/**
 * SkipLink Component
 * Provides skip to main content link for keyboard navigation
 * WCAG 2.4.1 Bypass Blocks - Level A
 */
const SkipLink = ({
  targetId = "main-content",
  label = "Skip to main content",
}) => {
  const skipToContent = useSkipLink(targetId);

  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault();
        skipToContent();
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white 
                 focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 
                 focus:ring-offset-2 focus:ring-indigo-600"
    >
      {label}
    </a>
  );
};

export default SkipLink;
