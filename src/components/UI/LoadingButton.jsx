/**
 * LoadingButton Component
 * Enhanced button with loading state, error handling, and duplicate submission prevention
 *
 * Features:
 * - Circular loading spinner while processing
 * - Automatically disables while loading
 * - Prevents duplicate submissions
 * - Handles success and error states
 * - WCAG 2.1 AA compliant
 * - Minimum 44px touch target
 */

import React, { useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";

const LoadingButton = ({
  children,
  type = "button",
  loading: externalLoading = false,
  disabled = false,
  loadingText = "Loading...",
  onClick,
  onSuccess,
  onError,
  className = "",
  variant = "primary",
  size = "md",
  theme = "admin",
  fullWidth = false,
  ariaLabel,
  showSuccessState = false,
  successText = "Success!",
  successDuration = 2000,
  spinnerSize = "md",
  ...props
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [successState, setSuccessState] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const clickTimeoutRef = useRef(null);

  // Use either external or internal loading state
  const isLoading = externalLoading || internalLoading;
  const isDisabled = disabled || isLoading || successState;

  // Get variant classes based on theme and state
  const getVariantClasses = () => {
    const isGuardian = theme === "guardian";

    if (successState && showSuccessState) {
      return "bg-green-600 text-white";
    }

    if (errorState) {
      return "bg-red-600 text-white";
    }

    const variants = {
      primary: isGuardian
        ? "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 text-white"
        : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-600 text-white",
      secondary:
        "bg-gray-200 hover:bg-gray-300 focus:ring-gray-500 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100",
      danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
      success:
        "bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white",
      warning:
        "bg-amber-500 hover:bg-amber-600 focus:ring-amber-500 text-white",
      outline: isGuardian
        ? "border-2 border-orange-600 text-orange-600 hover:bg-orange-50 focus:ring-orange-500 dark:hover:bg-orange-900/20"
        : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-600 dark:hover:bg-blue-900/20",
      ghost:
        "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
    };
    return variants[variant] || variants.primary;
  };

  // Get size classes
  const getSizeClasses = () => {
    const sizes = {
      xs: "px-2 py-1 text-xs min-h-[32px]",
      sm: "px-3 py-1.5 text-sm min-h-[36px]",
      md: "px-4 py-2 text-sm min-h-[40px]",
      lg: "px-6 py-2.5 text-base min-h-[44px]",
      xl: "px-8 py-3 text-lg min-h-[48px]",
    };
    return sizes[size] || sizes.md;
  };

  // Get spinner size
  const getSpinnerSizeClass = () => {
    const sizes = {
      xs: "w-3 h-3",
      sm: "w-4 h-4",
      md: "w-5 h-5",
      lg: "w-6 h-6",
      xl: "w-7 h-7",
    };
    return sizes[spinnerSize] || sizes.md;
  };

  // Handle click with async support and duplicate prevention
  const handleClick = useCallback(
    async (event) => {
      // Prevent duplicate clicks
      if (isLoading || isDisabled) {
        event.preventDefault();
        return;
      }

      // Clear any existing timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }

      // If no onClick handler, just return
      if (!onClick) return;

      try {
        setInternalLoading(true);
        setErrorState(null);

        // Execute the onClick handler
        const result = await onClick(event);

        // Handle success
        if (showSuccessState) {
          setSuccessState(true);
          clickTimeoutRef.current = setTimeout(() => {
            setSuccessState(false);
          }, successDuration);
        }

        // Call onSuccess callback if provided
        if (onSuccess && result !== undefined) {
          onSuccess(result);
        }
      } catch (error) {
        console.error("LoadingButton error:", error);
        setErrorState(error.message || "An error occurred");

        // Clear error state after delay
        clickTimeoutRef.current = setTimeout(() => {
          setErrorState(null);
        }, 3000);

        // Call onError callback if provided
        if (onError) {
          onError(error);
        }
      } finally {
        setInternalLoading(false);
      }
    },
    [
      onClick,
      isLoading,
      isDisabled,
      showSuccessState,
      successDuration,
      onSuccess,
      onError,
    ],
  );

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Render loading spinner
  const renderSpinner = () => (
    <svg
      className={`animate-spin ${getSpinnerSizeClass()} flex-shrink-0`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  // Render success icon
  const renderSuccessIcon = () => (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );

  // Render error icon
  const renderErrorIcon = () => (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );

  // Determine button content
  const getButtonContent = () => {
    if (successState && showSuccessState) {
      return (
        <>
          {renderSuccessIcon()}
          <span className="ml-2">{successText}</span>
        </>
      );
    }

    if (errorState) {
      return (
        <>
          {renderErrorIcon()}
          <span className="ml-2">Error</span>
        </>
      );
    }

    if (isLoading) {
      return (
        <>
          {renderSpinner()}
          <span className="ml-2">{loadingText}</span>
          <span className="sr-only">
            Please wait while we process your request.
          </span>
        </>
      );
    }

    return children;
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        font-semibold
        rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-60 disabled:cursor-not-allowed
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    >
      {getButtonContent()}
    </button>
  );
};

LoadingButton.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  loadingText: PropTypes.string,
  onClick: PropTypes.func,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "danger",
    "success",
    "warning",
    "outline",
    "ghost",
  ]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
  theme: PropTypes.oneOf(["admin", "guardian"]),
  fullWidth: PropTypes.bool,
  ariaLabel: PropTypes.string,
  showSuccessState: PropTypes.bool,
  successText: PropTypes.string,
  successDuration: PropTypes.number,
  spinnerSize: PropTypes.oneOf(["xs", "sm", "md", "lg", "xl"]),
};

export default LoadingButton;

/**
 * useLoadingButton Hook
 * Custom hook to manage loading button state with async operations
 *
 * Usage:
 * const { loading, error, success, execute } = useLoadingButton();
 *
 * <LoadingButton loading={loading} onClick={() => execute(asyncOperation)}>
 *   Submit
 * </LoadingButton>
 */
export const useLoadingButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const execute = useCallback(
    async (asyncFn, onSuccessCallback, onErrorCallback) => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(false);

        const result = await asyncFn();

        setSuccess(true);

        if (onSuccessCallback) {
          onSuccessCallback(result);
        }

        return { success: true, data: result };
      } catch (err) {
        const errorMessage = err.message || "An error occurred";
        setError(errorMessage);

        if (onErrorCallback) {
          onErrorCallback(err);
        }

        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
  }, []);

  return {
    loading,
    error,
    success,
    execute,
    reset,
    setError,
    setSuccess,
  };
};
