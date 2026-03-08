import React, { useEffect, useState } from "react";
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Typography,
  Button,
  Chip,
  Slide,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteIcon from "@mui/icons-material/Delete";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { useNavigate } from "react-router-dom";
import useSocket from "../../hooks/useSocket";

const NotificationToast = () => {
  const navigate = useNavigate();
  const { notifications, alerts, markNotificationAsRead, dismissNotification } =
    useSocket();
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [queue, setQueue] = useState([]);
  const [autoHideDuration, setAutoHideDuration] = useState(6000);

  // Process notification queue
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[0];
      if (
        !currentNotification ||
        latestNotification.id !== currentNotification.id
      ) {
        setQueue((prev) => [...prev, latestNotification]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  // Process alert queue
  useEffect(() => {
    if (alerts.length > 0) {
      const latestAlert = alerts[0];
      if (!currentNotification || latestAlert.id !== currentNotification.id) {
        setQueue((prev) => [...prev, { ...latestAlert, isAlert: true }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  // Show next notification in queue
  useEffect(() => {
    if (queue.length > 0 && !open) {
      const nextNotification = queue[0];
      setCurrentNotification(nextNotification);
      setQueue((prev) => prev.slice(1));
      setOpen(true);

      // Set auto-hide duration based on priority
      if (
        nextNotification.priority >= 4 ||
        nextNotification.severity === "critical"
      ) {
        setAutoHideDuration(10000); // Longer for critical
      } else if (nextNotification.priority >= 2) {
        setAutoHideDuration(6000); // Normal for high/medium
      } else {
        setAutoHideDuration(4000); // Shorter for low priority
      }
    }
  }, [queue, open]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  const handleExited = () => {
    setCurrentNotification(null);
  };

  const handleMarkAsRead = () => {
    if (currentNotification) {
      markNotificationAsRead(currentNotification.id);
      setOpen(false);
    }
  };

  const handleDismiss = () => {
    if (currentNotification) {
      dismissNotification(currentNotification.id);
      setOpen(false);
    }
  };

  const handleAction = () => {
    if (currentNotification?.actionUrl) {
      navigate(currentNotification.actionUrl);
      setOpen(false);
    }
  };

  const getSeverity = (notification) => {
    if (notification.isAlert) {
      return notification.severity === "critical" ? "error" : "warning";
    }
    if (notification.priority >= 4) return "error";
    if (notification.priority >= 3) return "warning";
    if (notification.priority >= 2) return "info";
    return "success";
  };

  const getIcon = (notification) => {
    if (notification.isAlert) {
      return notification.severity === "critical" ? (
        <ErrorIcon />
      ) : (
        <WarningIcon />
      );
    }
    if (notification.priority >= 4) return <ErrorIcon />;
    if (notification.priority >= 3) return <WarningIcon />;
    if (notification.priority >= 2) return <InfoIcon />;
    return <CheckCircleIcon />;
  };

  const getPriorityLabel = (priority) => {
    if (priority >= 4) return "Critical";
    if (priority >= 3) return "High";
    if (priority >= 2) return "Medium";
    return "Low";
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      TransitionComponent={Slide}
      TransitionProps={{ onExited: handleExited }}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: 8 }}
    >
      <Alert
        severity={getSeverity(currentNotification)}
        icon={getIcon(currentNotification)}
        action={
          <Stack direction="row" spacing={1}>
            {currentNotification.actionRequired && (
              <Button
                size="small"
                color="inherit"
                onClick={handleAction}
                endIcon={<ArrowForwardIcon />}
              >
                Take Action
              </Button>
            )}
            <IconButton size="small" onClick={handleMarkAsRead} color="inherit">
              <MarkEmailReadIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleDismiss} color="inherit">
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleClose} color="inherit">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
        sx={{
          minWidth: 400,
          maxWidth: 600,
          "& .MuiAlert-message": {
            width: "100%",
          },
        }}
      >
        <AlertTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              {currentNotification.title ||
                currentNotification.type?.replace("_", " ").toUpperCase()}
            </Typography>
            {currentNotification.priority && (
              <Chip
                label={getPriorityLabel(currentNotification.priority)}
                size="small"
                color={getSeverity(currentNotification)}
              />
            )}
            {currentNotification.isAlert && (
              <Chip label="ALERT" size="small" color="error" />
            )}
          </Box>
        </AlertTitle>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {currentNotification.message}
        </Typography>
        {currentNotification.currentValue && (
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Current: {currentNotification.currentValue} | Threshold:{" "}
            {currentNotification.thresholdValue}
          </Typography>
        )}
        {queue.length > 0 && (
          <Typography
            variant="caption"
            display="block"
            sx={{ mt: 1, color: "text.secondary" }}
          >
            {queue.length} more notification{queue.length > 1 ? "s" : ""}{" "}
            waiting...
          </Typography>
        )}
      </Alert>
    </Snackbar>
  );
};

export default NotificationToast;
