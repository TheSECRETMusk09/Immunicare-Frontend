import React, { Component } from "react";
import Button from "./Button";
import Alert from "./Alert";
import FormActions from "./FormActions";

/**
 * ErrorBoundary component to catch JavaScript errors anywhere in the child component tree.
 * Prevents the entire application from crashing when a component throws an error.
 *
 * Usage:
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to a logging service (console, Sentry, etc.)
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack trace:", errorInfo.componentStack);

    // Store error info for display if needed
    this.setState({ errorInfo });

    // Optional: Report to error tracking service
    this.reportError(error, errorInfo);
  }

  reportError(error, errorInfo) {
    // You can integrate with error tracking services like Sentry, Bugsnag, etc.
    // Example: Sentry.captureException(error, { extra: errorInfo });

    // For development, log to console
    if (process.env.NODE_ENV === "development") {
      console.group("🔴 Error Details");
      console.error("Error:", error);
      console.error("Error Info:", errorInfo);
      console.groupEnd();
    }
  }

  handleRetry = () => {
    // Reset error state to attempt re-rendering
    this.setState({ hasError: false, error: null, errorInfo: null });

    // Optionally trigger a page refresh
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      fallback,
      title = "Something went wrong",
      showDetails = false,
      showReload = true,
      showRetry = true,
    } = this.props;

    if (hasError) {
      // Custom fallback component
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="p-6 max-w-2xl mx-auto">
          <Alert
            variant="error"
            title={title}
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            }
          >
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-300">
                An unexpected error occurred. Please try again or contact support if the problem persists.
              </p>

              {/* Show error message in development or if explicitly enabled */}
              {(process.env.NODE_ENV === "development" || showDetails) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700">
                    Error Details
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-auto max-h-40">
                    {error?.toString()}
                    {errorInfo && (
                      <pre className="mt-2 whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Action buttons */}
              <FormActions className="pt-4">
                {showReload && (
                  <Button onClick={this.handleReload} variant="secondary">
                    Reload Page
                  </Button>
                )}
                {showRetry && (
                  <Button onClick={this.handleRetry} variant="primary">
                    Try Again
                  </Button>
                )}
              </FormActions>
            </div>
          </Alert>
        </div>
      );
    }

    return children;
  }
}

/**
 * HOC (Higher Order Component) wrapper for functional components
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} [options] - Configuration options
 */
export const withErrorBoundary = (WrappedComponent, options = {}) => {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary {...options}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
};

/**
 * Hook-based error boundary wrapper for functional components
 * @param {React.Component} Component - Component to wrap
 * @param {Object} [options] - Configuration options
 */
export const createBoundaryWrapper = (Component, options = {}) => {
  return function BoundaryWrapper(props) {
    return (
      <ErrorBoundary {...options}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

/**
 * Simple error display component for non-critical errors
 * Can be used inline without the class-based ErrorBoundary
 */
export const ErrorDisplay = ({
  error,
  onDismiss,
  onRetry,
  title = "Error",
  className = "",
}) => {
  if (!error) return null;

  return (
    <div className={`p-4 ${className}`}>
      <Alert
        variant="error"
        title={title}
        onDismiss={onDismiss}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {error.message || error.toString()}
          </p>

          {(onRetry || onDismiss) && (
            <div className="flex gap-2 pt-2">
              {onRetry && (
                <Button size="sm" onClick={onRetry} variant="primary">
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button size="sm" onClick={onDismiss} variant="secondary">
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      </Alert>
    </div>
  );
};

export default ErrorBoundary;
