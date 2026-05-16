/**
 * Accessibility Utilities for Immunicare Guardian Dashboard
 * Provides hooks and utilities for WCAG 2.1 AA compliance
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook for managing focus trap within a container
 * @param {boolean} isOpen - Whether the trap is active
 * @param {string} focusableSelector - Selector for focusable elements
 */
export const useFocusTrap = (isOpen, focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') => {
  const containerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement;

      // Focus the first focusable element
      setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          const focusableElements = container.querySelectorAll(focusableSelector);
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          }
        }
      }, 0);

      // Handle keydown for tab trapping
      const handleKeyDown = (e) => {
        if (e.key !== 'Tab') return;

        const container = containerRef.current;
        if (!container) return;

        const focusableElements = container.querySelectorAll(focusableSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        // Restore focus to previous element
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, focusableSelector]);

  return containerRef;
};

/**
 * Hook for live region announcements
 * @param {string} politeness - 'polite' or 'assertive'
 */
export const useLiveAnnouncer = (politeness = 'polite') => {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef(null);

  const announce = useCallback((newMessage) => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set message to trigger announcement
    setMessage(newMessage);

    // Clear after announcement
    timeoutRef.current = setTimeout(() => {
      setMessage('');
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const announcer =(
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>)
   ;

  return { announce, announcer };
};

/**
 * Hook for keyboard navigation
 * @param {Object} keyHandlers - Map of keys to handler functions
 */
export const useKeyboardNavigation = (keyHandlers = {}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const handler = keyHandlers[e.key];
      if (handler) {
        handler(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyHandlers]);
};

/**
 * Hook for skip links
 */
export const useSkipLink = () => {
  const mainContentRef = useRef(null);

  const skipToMain = useCallback(() => {
    mainContentRef.current?.focus();
  }, []);

  return { mainContentRef, skipToMain };
};

/**
 * Focus management hook for modals
 */
export const useModalFocus = (isOpen) => {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;

      // Focus modal container
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  return modalRef;
};

/**
 * Generate unique ID for aria-describedby
 */
export const useAriaDescribedBy = (id, descriptions = []) => {
  const descriptionIds = descriptions
    .map((desc) =>( desc.id ? desc.id : null))
    .filter(Boolean);

  if (id) {
    descriptionIds.unshift(id);
  }

  return descriptionIds.join(' ') || undefined;
};

/**
 * Loading state announcer hook
 */
export const useLoadingAnnouncer = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const startLoading = useCallback((loadingMessage = 'Loading...') => {
    setLoading(true);
    setMessage(loadingMessage);
  }, []);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setMessage('');
  }, []);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return {
    loading,
    message,
    startLoading,
    stopLoading,
    announcer: loading ?(
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>)
      : null
  };
};

/**
 * Button with haptic feedback (mobile)
 */
export const useHapticFeedback = () => {
  const triggerHaptic = useCallback((type = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 40,
        success: [50, 50],
        warning: [50, 50, 50],
        error: [100, 50, 100]
      };

      navigator.vibrate(patterns[type] || patterns.light);
    }
  }, []);

  return triggerHaptic;
};

/**
 * Icon button with proper aria-label
 */
export const IconButton = ({
  icon: Icon,
  label,
  onClick,
  className = '',
  ariaLabel,
  ...props
}) => {
  const buttonLabel = ariaLabel || label;

  return(
    <button
      onClick={onClick}
      aria-label={buttonLabel}
      className={`min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-6 h-6" aria-hidden="true" />}
    </button>)
   ;
};

/**
 * Skip link component
 */
export const SkipLink = ({ targetRef, children = 'Skip to main content' }) => {
  return(
    <a
      href="#main-content"
      onClick={(e) => {
        e.preventDefault();
        targetRef.current?.focus();
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md"
    >
      {children}
    </a>)
   ;
};

/**
 * Form field with aria-describedby
 */
export const FormField = ({
  id,
  label,
  error,
  helpText,
  children,
  required = false
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const helpId = helpText ? `${id}-help` : undefined;

  return(
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
        {required && <span aria-hidden="true" className="text-red-500 ml-1">*</span>}
      </label>

      {children}

      {helpText &&(
        <p id={helpId} className="text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>)
       }

      {error &&(
        <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>)
       }
    </div>)
   ;
};

export default {
  useFocusTrap,
  useLiveAnnouncer,
  useKeyboardNavigation,
  useSkipLink,
  useModalFocus,
  useAriaDescribedBy,
  useLoadingAnnouncer,
  useHapticFeedback,
  IconButton,
  SkipLink,
  FormField
};
