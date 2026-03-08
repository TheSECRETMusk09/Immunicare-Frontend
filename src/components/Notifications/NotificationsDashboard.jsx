import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Chip,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  IconButton,
  Menu,
  ListItemIcon,
  CircularProgress,
} from "@mui/material";
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import { format } from "date-fns";

import { apiClient as api } from "../../utils/api";

const NotificationsDashboard = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [settings, setSettings] = useState({
    emailEnabled: true,
    smsEnabled: false,
    lowStockThreshold: 10,
    appointmentReminderDays: [1, 3, 7],
    regulatoryUpdates: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState(null);

  // Fetch notifications and alerts from API with error handling and fallback
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);

        // Fetch notifications with filters
        const params = {};
        if (filter !== "all") params.category = filter;

        // Try to fetch notifications with fallback
        let data = [];
        try {
          data = await api.request("/notifications", { params });
          setNotifications(Array.isArray(data) ? data : []);
        } catch (notifError) {
          console.warn("Notifications fetch failed:", notifError);
          setNotifications([]);
        }

        // Fetch alerts with fallback
        try {
          const alertsData = await api.request("/notifications/alerts");
          setAlerts(Array.isArray(alertsData) ? alertsData : []);
        } catch (alertsError) {
          console.warn("Alerts fetch failed:", alertsError);
          setAlerts([]);
        }

        // Fetch notification settings with fallback
        try {
          const settingsData = await api.request("/notifications/settings");
          if (settingsData) setSettings(settingsData);
        } catch (e) {
          console.warn("Failed to load settings, using defaults");
          // Keep default settings
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        // Ensure arrays are always set even on complete failure
        if (!Array.isArray(notifications)) setNotifications([]);
        if (!Array.isArray(alerts)) setAlerts([]);
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, [filter]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.request(`/notifications/${id}/read`, {
        method: "PATCH",
      });

      setNotifications(
        notifications.map((notif) =>
          notif.id === id ? { ...notif, isRead: true } : notif,
        ),
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.request("/notifications/read-all", {
        method: "PATCH",
      });

      setNotifications(
        notifications.map((notif) => ({ ...notif, isRead: true })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const updatedSettings = await api.request("/notifications/settings", {
        method: "PUT",
        data: settings,
      });

      if (updatedSettings) {
        setSettings(updatedSettings);
        console.log("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContextMenuOpen = (event, notification) => {
    event.preventDefault();
    setSelectedNotification(notification);
    setContextMenuPosition({
      top: event.clientY,
      left: event.clientX,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenuPosition(null);
    setSelectedNotification(null);
  };

  const handleQuickAction = (actionType) => {
    if (!selectedNotification) return;

    switch (actionType) {
      case "mark-read":
        handleMarkAsRead(selectedNotification.id);
        break;
      case "view-details":
        console.log("View details for:", selectedNotification.id);
        // Navigate to detailed view or show modal
        break;
      case "take-action":
        console.log("Take action for:", selectedNotification.id);
        // Handle specific action based on notification type
        break;
      default:
        break;
    }

    handleContextMenuClose();
  };

  const handleNavigate = (notification) => {
    // Navigate based on notification type
    console.log("Navigate to:", notification);
    // Example: navigate(`/notifications/${notification.id}`);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "default";
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "high":
        return <WarningIcon color="error" />;
      case "medium":
        return <WarningIcon color="warning" />;
      case "low":
        return <InfoIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((notif) => notif.category === filter);

  if (isLoading) {
    return (
      <Card sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6">Loading notifications...</Typography>
      </Card>
    );
  }

  return (
    <div>
      <Card sx={{ p: 3, mt: 3, mb: 3 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Notifications & Alerts
          </Typography>
          <div>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              sx={{ mr: 2 }}
              onClick={() =>
                document.getElementById("settings-section").scrollIntoView()
              }
            >
              Settings
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleMarkAllAsRead}
              disabled={notifications.every((notif) => notif.read)}
            >
              Mark All as Read
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Filter"
            >
              <MenuItem value="all">All Notifications</MenuItem>
              <MenuItem value="inventory">Inventory</MenuItem>
              <MenuItem value="appointment">Appointments</MenuItem>
              <MenuItem value="regulatory">Regulatory</MenuItem>
            </Select>
          </FormControl>
        </div>

        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Active Alerts ({alerts.length})
        </Typography>

        {alerts.length > 0 ? (
          <List sx={{ mb: 3 }}>
            {alerts.map((alert) => (
              <ListItem
                key={alert.id}
                secondaryAction={
                  <Chip
                    label={alert.severity.toUpperCase()}
                    color={getSeverityColor(alert.severity)}
                    size="small"
                  />
                }
                sx={{
                  borderLeft: `4px solid ${getSeverityColor(
                    alert.severity,
                  )}.main`,
                  mb: 1,
                }}
              >
                <ListItemAvatar>
                  {getSeverityIcon(alert.severity)}
                </ListItemAvatar>
                <ListItemText
                  primary={alert.type.replace("_", " ").toUpperCase()}
                  secondary={
                    <React.Fragment>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                      >
                        {alert.vaccine || alert.patient || alert.title}
                      </Typography>
                      {alert.currentStock &&
                        ` - ${alert.currentStock} doses remaining`}
                      {alert.daysUntilExpiration &&
                        ` - Expires in ${alert.daysUntilExpiration} days`}
                    </React.Fragment>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Card sx={{ p: 2, textAlign: "center", backgroundColor: "#f5f5f5" }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body1">No active alerts</Typography>
          </Card>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Recent Notifications ({filteredNotifications.length})
        </Typography>

        {filteredNotifications.length > 0 ? (
          <List>
            {filteredNotifications.map((notification) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  alignItems="flex-start"
                  secondaryAction={
                    !notification.read && (
                      <Chip label="New" color="primary" size="small" />
                    )
                  }
                  sx={{
                    backgroundColor: notification.read ? "inherit" : "#f0f7ff",
                    borderLeft: `4px solid ${getSeverityColor(
                      notification.severity,
                    )}.main`,
                    mb: 1,
                    "&:hover": { backgroundColor: "#f5f5f5" },
                  }}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <ListItemAvatar>
                    {getSeverityIcon(notification.severity)}
                  </ListItemAvatar>
                  <ListItemText
                    primary={notification.title}
                    secondary={
                      <React.Fragment>
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                        >
                          {notification.message}
                        </Typography>
                        <br />
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                        >
                          {format(
                            new Date(
                              notification.createdAt || notification.created_at,
                            ),
                            "PPpp",
                          )}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Card sx={{ p: 2, textAlign: "center", backgroundColor: "#f5f5f5" }}>
            <InfoIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body1">No notifications found</Typography>
          </Card>
        )}
      </Card>

      <Card id="settings-section" sx={{ p: 3, mt: 3 }}>
        <Typography
          variant="h5"
          gutterBottom
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <SettingsIcon /> Notification Settings
        </Typography>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "20px",
            mt: 2,
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={settings.emailEnabled}
                onChange={handleSettingsChange}
                name="emailEnabled"
              />
            }
            label="Enable Email Notifications"
            sx={{ alignItems: "flex-start" }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.smsEnabled}
                onChange={handleSettingsChange}
                name="smsEnabled"
              />
            }
            label="Enable SMS Notifications"
            sx={{ alignItems: "flex-start" }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.regulatoryUpdates}
                onChange={handleSettingsChange}
                name="regulatoryUpdates"
              />
            }
            label="Receive Regulatory Updates"
            sx={{ alignItems: "flex-start" }}
          />

          <TextField
            label="Low Stock Threshold"
            type="number"
            name="lowStockThreshold"
            value={settings.lowStockThreshold}
            onChange={handleSettingsChange}
            InputProps={{ inputProps: { min: 1, max: 100 } }}
            helperText="Trigger alert when stock falls below this number"
          />

          <FormControl fullWidth>
            <InputLabel>Appointment Reminders</InputLabel>
            <Select
              multiple
              value={settings.appointmentReminderDays}
              onChange={handleSettingsChange}
              name="appointmentReminderDays"
              renderValue={(selected) => selected.join(", ")}
            >
              <MenuItem value={1}>1 day before</MenuItem>
              <MenuItem value={3}>3 days before</MenuItem>
              <MenuItem value={7}>1 week before</MenuItem>
              <MenuItem value={14}>2 weeks before</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary">
              Select when to send appointment reminders
            </Typography>
          </FormControl>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "20px",
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={
              isSaving ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SettingsIcon />
              )
            }
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          Notification Channels
        </Typography>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "15px",
          }}
        >
          <Card
            sx={{
              p: 2,
              textAlign: "center",
              backgroundColor: settings.emailEnabled ? "#e3f2fd" : "#f5f5f5",
            }}
          >
            <EmailIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
            <Typography variant="body1">Email Notifications</Typography>
            <Typography variant="caption">
              {settings.emailEnabled ? "Enabled" : "Disabled"}
            </Typography>
          </Card>

          <Card
            sx={{
              p: 2,
              textAlign: "center",
              backgroundColor: settings.smsEnabled ? "#e8f5e9" : "#f5f5f5",
            }}
          >
            <SmsIcon sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
            <Typography variant="body1">SMS Notifications</Typography>
            <Typography variant="caption">
              {settings.smsEnabled ? "Enabled" : "Disabled"}
            </Typography>
          </Card>

          <Card sx={{ p: 2, textAlign: "center", backgroundColor: "#f3e5f5" }}>
            <NotificationsIcon
              sx={{ fontSize: 40, color: "secondary.main", mb: 1 }}
            />
            <Typography variant="body1">In-App Alerts</Typography>
            <Typography variant="caption">Always Active</Typography>
          </Card>
        </div>
      </Card>
    </div>
  );
};

export default NotificationsDashboard;
