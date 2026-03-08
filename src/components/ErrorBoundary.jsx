import React from "react";
import { Button } from "./UI";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log to console for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // In production, you might want to log to an error reporting service
    if (process.env.NODE_ENV === "production") {
      // TODO: Send to error reporting service like Sentry
      // Example: Sentry.captureException(error);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Reload the page to reset the application state
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            {/* Error Icon */}
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
              <svg
                className="h-10 w-10 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something Went Wrong
            </h1>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              We apologize for the inconvenience. An unexpected error has
              occurred.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 text-left">
                <details className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 overflow-auto max-h-64">
                  <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
                    {this.state.error.toString()}
                    {"\n"}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleReset} variant="primary">
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="secondary">
                Go to Home
              </Button>
            </div>

            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
