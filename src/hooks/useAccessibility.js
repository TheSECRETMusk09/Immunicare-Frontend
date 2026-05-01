import { useEffect, useRef, useState, useCallback } from "react";

let sharedAnnouncementRegion = null;
let sharedAnnouncementTimeout = null;

/**
 * useFocusTrap Hook
 * Traps focus within a modal or dialog for keyboard navigation
 * WCAG 2.1 Level AA compliant
 */
export const useFocusTrap = (isActive) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    const handleEscapeKey = (e) => {
      if (e.key === "Escape") {
        container.dispatchEvent(new CustomEvent("close"));
      }
    };

    // Focus first element
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

/**
 * useAnnounce Hook
 * Announces content to screen readers using ARIA live regions
 * WCAG 4.1.3 Status Messages
 */
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

/**
 * useReducedMotion Hook
 * Detects if user prefers reduced motion
 * WCAG 2.2.2 Pause, Stop, Hide
 */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
};

/**
 * useKeyboardNavigation Hook
 * Enhanced keyboard navigation for lists and menus
 */
export const useKeyboardNavigation = (itemCount) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (e) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % itemCount);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
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

/**
 * useClickOutside Hook
 * Handles click outside detection with accessibility considerations
 */
export const useClickOutside = (onClickOutside, isActive = true) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClickOutside();
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
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

/**
 * usePageTitle Hook
 * Manages document title for accessibility
 * WCAG 2.4.2 Page Titled
 */
export const usePageTitle = (title) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | Immunicare` : "Immunicare";

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
};

/**
 * useSkipLink Hook
 * Manages skip to main content functionality
 */
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

/**
 * useHighContrast Hook
 * Detects high contrast mode preference
 */
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: high)");
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e) => setIsHighContrast(e.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isHighContrast;
};

/**
 * useAriaExpanded Hook
 * Manages aria-expanded state for togglable content
 */
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
