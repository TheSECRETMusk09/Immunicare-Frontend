import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
} from "@mui/material";
import { ErrorOutline, Refresh, ArrowBack } from "@mui/icons-material";

const ErrorFallback = ({ error, resetErrorBoundary, context = "page" }) => {
  const getErrorMessage = () => {
    if (error?.response?.status === 404) {
      return {
        title: "Page Not Found",
        message:
          "The page you are looking for does not exist or has been moved.",
        severity: "warning",
      };
    }
    if (error?.response?.status === 403) {
      return {
        title: "Access Denied",
        message: "You do not have permission to access this resource.",
        severity: "error",
      };
    }
    if (error?.response?.status === 401) {
      return {
        title: "Session Expired",
        message: "Your session has expired. Please log in again.",
        severity: "warning",
      };
    }
    if (error?.response?.status >= 500) {
      return {
        title: "Server Error",
        message: "Our servers are experiencing issues. Please try again later.",
        severity: "error",
      };
    }
    return {
      title: "Something Went Wrong",
      message:
        error?.message || "An unexpected error occurred. Please try again.",
      severity: "error",
    };
  };

  const errorInfo = getErrorMessage();

  return (
    <Box
      sx={{
        p: 3,
        display: "flex",
        justifyContent: "center",
        alignItems: context === "full" ? "center" : "flex-start",
        minHeight: context === "full" ? "100vh" : "auto",
      }}
    >
      <Card sx={{ maxWidth: 500, width: "100%" }}>
        <CardContent sx={{ textAlign: "center", p: 4 }}>
          <ErrorOutline
            sx={{
              fontSize: 64,
              color: `${errorInfo.severity}.main`,
              mb: 2,
            }}
          />

          <Typography variant="h5" gutterBottom fontWeight="bold">
            {errorInfo.title}
          </Typography>

          <Alert
            severity={errorInfo.severity}
            sx={{ mb: 3, textAlign: "left" }}
          >
            <AlertTitle>Error</AlertTitle>
            {errorInfo.message}
          </Alert>

          {process.env.NODE_ENV === "development" && error?.stack && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                backgroundColor: "#f5f5f5",
                borderRadius: 1,
                textAlign: "left",
                overflow: "auto",
                maxHeight: 200,
              }}
            >
              <Typography
                variant="caption"
                component="pre"
                sx={{ fontFamily: "monospace" }}
              >
                {error.stack}
              </Typography>
            </Box>
          )}

          <Box display="flex" gap={2} justifyContent="center" mt={3}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={resetErrorBoundary}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ErrorFallback;
