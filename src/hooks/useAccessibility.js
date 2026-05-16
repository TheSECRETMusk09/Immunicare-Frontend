import { useEffect, useRef, useState, useCallback } from "react";

let sharedAnnouncementRegion = null;
let sharedAnnouncementTimeout = null;
const focusableSelector =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Keep tab focus inside an active dialog.
export const useFocusTrap = (isActive) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(focusableSelector);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (event) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          event.preventDefault();
        }
      } else if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        container.dispatchEvent(new CustomEvent("close"));
      }
    };

    // Opening a modal without moving focus is a rough experience.
    firstElement?.focus();

    container.addEventListener("keydown", handleTabKey);
    container.addEventListener("keydown", handleEscapeKey);

    return () => {
      container.removeEventListener("keydown", handleTabKey);
      container.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isActive]);

  return containerRef;
};

// Reuse one live region so announcements don't pile up in the DOM.
export const useAnnounce = () => {
  const announce = useCallback((message, priority = "polite") => {
    if (typeof document === "undefined") {
      return;
    }

    if (!sharedAnnouncementRegion || !document.body.contains(sharedAnnouncementRegion)) {
      sharedAnnouncementRegion = document.createElement("div");
      sharedAnnouncementRegion.id = "immunicare-live-region";
      sharedAnnouncementRegion.setAttribute("role", "status");
      sharedAnnouncementRegion.setAttribute("aria-atomic", "true");
      sharedAnnouncementRegion.className = "sr-only";
      document.body.appendChild(sharedAnnouncementRegion);
    }

    if (sharedAnnouncementTimeout) {
      clearTimeout(sharedAnnouncementTimeout);
      sharedAnnouncementTimeout = null;
    }

    sharedAnnouncementRegion.setAttribute("aria-live", priority);
    sharedAnnouncementRegion.textContent = message;

    sharedAnnouncementTimeout = setTimeout(() => {
      if (sharedAnnouncementRegion?.parentNode) {
        sharedAnnouncementRegion.parentNode.removeChild(sharedAnnouncementRegion);
      }
      sharedAnnouncementRegion = null;
      sharedAnnouncementTimeout = null;
    }, 1000);
  }, []);

  return announce;
};

// Watch the user's reduced motion preference.
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};

// Simple arrow-key navigation for menus and listboxes.
export const useKeyboardNavigation = (itemCount) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % itemCount);
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;
        default:
          break;
      }
    },
    [itemCount],
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
};

// Useful for popovers, drawers, and other dismissible UI.
export const useClickOutside = (onClickOutside, isActive = true) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClickOutside();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClickOutside, isActive]);

  return ref;
};

// Restore the previous title when the page unmounts.
export const usePageTitle = (title) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | Immunicare` : "Immunicare";

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
};

// Handy for skip links and keyboard shortcuts.
export const useSkipLink = (mainContentId = "main-content") => {
  const skipToContent = useCallback(() => {
    const mainContent = document.getElementById(mainContentId);
    if (mainContent) {
      mainContent.tabIndex = -1;
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: "smooth" });
    }
  }, [mainContentId]);

  return skipToContent;
};

// Watch for high-contrast mode where the browser supports it.
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: high)");
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (event) => setIsHighContrast(event.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isHighContrast;
};

// Small helper for collapsible UI.
export const useAriaExpanded = (initialState = false) => {
  const [isExpanded, setIsExpanded] = useState(initialState);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return {
    isExpanded,
    toggle,
    expand,
    collapse,
    ariaProps: {
      "aria-expanded": isExpanded,
    },
  };
};

const accessibilityExports = {
  useFocusTrap,
  useAnnounce,
  useReducedMotion,
  useKeyboardNavigation,
  useClickOutside,
  usePageTitle,
  useSkipLink,
  useHighContrast,
  useAriaExpanded,
};

export default accessibilityExports;
