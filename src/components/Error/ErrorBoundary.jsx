import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Divider,
  Paper,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
} from "@mui/icons-material";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log error to monitoring service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // You can also send to error tracking service here
    if (window.errorReporter) {
      window.errorReporter.captureException(error, { extra: errorInfo });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f5f5f5",
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
            <CardContent sx={{ p: 4 }}>
              <ErrorIcon sx={{ fontSize: 80, color: "error.main", mb: 2 }} />

              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                color="error"
              >
                Oops! Something went wrong
              </Typography>

              <Typography variant="body1" color="textSecondary" paragraph>
                We apologize for the inconvenience. An unexpected error has
                occurred. Our team has been notified and is working to fix the
                issue.
              </Typography>

              {this.state.error && (
                <Paper
                  sx={{
                    p: 2,
                    mt: 2,
                    mb: 2,
                    backgroundColor: "#ffebee",
                    textAlign: "left",
                    overflow: "auto",
                  }}
                >
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    Error Details:
                  </Typography>
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{ fontFamily: "monospace" }}
                  >
                    {this.state.error.toString()}
                  </Typography>
                  {this.state.errorInfo && (
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        fontFamily: "monospace",
                        color: "text.secondary",
                        mt: 1,
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  )}
                </Paper>
              )}

              <Divider sx={{ my: 3 }} />

              <Box
                display="flex"
                gap={2}
                justifyContent="center"
                flexWrap="wrap"
              >
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReload}
                  size="large"
                >
                  Reload Page
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<HomeIcon />}
                  onClick={this.handleGoHome}
                  size="large"
                >
                  Go Home
                </Button>
                <Button
                  variant="text"
                  startIcon={<BugReportIcon />}
                  onClick={() =>
                    window.open("https://github.com/your-repo/issues", "_blank")
                  }
                  size="large"
                >
                  Report Issue
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
