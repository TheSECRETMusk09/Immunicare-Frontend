import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Chip,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  IconButton,
  Menu,
  ListItemIcon,
  Box,
  Grid,
  Paper,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  CircularProgress,
} from "@mui/material";
import {
  Notifications as NotificationsIcon,
  WarningAmber as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  MarkEmailRead as MarkEmailReadIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsNone as NotificationsNoneIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  PushPin as PushPinIcon,
} from "@mui/icons-material";
import { useAuth } from "../../contexts/AuthContext";
import { format } from "date-fns";
import useSocket from "../../hooks/useSocket";
import apiClient from "../../utils/api";

const PRIORITY_WEIGHT = {
  urgent: 5,
  high: 4,
  normal: 3,
  medium: 3,
  low: 2,
  info: 1,
};

const toPriorityWeight = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(5, value));
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return PRIORITY_WEIGHT[normalized] || 1;
};

const toPriorityLabel = (value) => {
  const weight = toPriorityWeight(value);
  if (weight >= 5) return "Critical";
  if (weight >= 4) return "High";
  if (weight >= 3) return "Medium";
  return "Low";
};

const EnhancedNotificationsDashboard = () => {
  useAuth(); // Keep hook call for authentication context initialization
  const {
    isConnected,
    notifications: socketNotifications,
    alerts: socketAlerts,
    unreadCount,
    markNotificationAsRead,
    dismissNotification,
  } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState(null);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [preferencesDialogOpen, setPreferencesDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Filter states
  const [filters, setFilters] = useState({
    priority: "all",
    category: "all",
    type: "all",
    isRead: "all",
    minPriority: 1,
    maxPriority: 5,
  });

  // Sort state
  const [sortBy, setSortBy] = useState("priority");
  // eslint-disable-next-line no-unused-vars
  const [sortOrder, setSortOrder] = useState("desc");

  // Fetch notifications and alerts from API with error handling and fallback
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch notifications with filters
        const params = new URLSearchParams();
        if (filters.priority !== "all")
          params.append("priority", filters.priority);
        if (filters.category !== "all")
          params.append("category", filters.category);
        if (filters.type !== "all") params.append("type", filters.type);
        if (filters.isRead !== "all") params.append("isRead", filters.isRead);

        // Try enhanced endpoint first, fall back to regular endpoint
        try {
          const data = await apiClient.get(
            `/notifications-enhanced?${params.toString()}`,
          );
          if (data) {
            setNotifications(data.notifications || []);
          } else {
            throw new Error("Enhanced endpoint failed");
          }
        } catch (enhancedError) {
          // Fallback to regular notifications endpoint
          console.warn(
            "Enhanced notifications failed, using fallback:",
            enhancedError,
          );
          const fallbackData = await apiClient.get(
            `/notifications?${params.toString()}`,
          );
          if (fallbackData) {
            setNotifications(Array.isArray(fallbackData) ? fallbackData : []);
          } else {
            // Set empty array as final fallback
            setNotifications([]);
          }
        }

        // Fetch alerts with fallback
        try {
          const alertsData = await apiClient.get("/notifications-enhanced/alerts");
          if (alertsData) {
            setAlerts(Array.isArray(alertsData) ? alertsData : []);
          } else {
            setAlerts([]);
          }
        } catch (alertsError) {
          console.warn("Alerts fetch failed:", alertsError);
          setAlerts([]);
        }

        // Fetch notification preferences with fallback
        try {
          const prefsData = await apiClient.get("/notifications-enhanced/preferences");
          if (prefsData) {
            setPreferences(prefsData);
          } else {
            // Set default preferences
            setPreferences({
              channels: { inApp: true, email: true, sms: false, push: false },
              priority: {
                critical: { enabled: true, sound: true, vibration: true },
                high: { enabled: true, sound: true, vibration: true },
                medium: { enabled: true, sound: false, vibration: false },
                low: { enabled: true, sound: false, vibration: false },
              },
              quietHours: {
                enabled: false,
                startTime: "22:00",
                endTime: "08:00",
                allowCritical: true,
              },
            });
          }
        } catch (prefsError) {
          console.warn("Preferences fetch failed, using defaults:", prefsError);
          setPreferences({
            channels: { inApp: true, email: true, sms: false, push: false },
            priority: {
              critical: { enabled: true, sound: true, vibration: true },
              high: { enabled: true, sound: true, vibration: true },
              medium: { enabled: true, sound: false, vibration: false },
              low: { enabled: true, sound: false, vibration: false },
            },
            quietHours: {
              enabled: false,
              startTime: "22:00",
              endTime: "08:00",
              allowCritical: true,
            },
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
        // Set empty arrays on complete failure
        setNotifications([]);
        setAlerts([]);
        setPreferences({
          channels: { inApp: true, email: true, sms: false, push: false },
          priority: {
            critical: { enabled: true, sound: true, vibration: true },
            high: { enabled: true, sound: true, vibration: true },
            medium: { enabled: true, sound: false, vibration: false },
            low: { enabled: true, sound: false, vibration: false },
          },
          quietHours: {
            enabled: false,
            startTime: "22:00",
            endTime: "08:00",
            allowCritical: true,
          },
        });
        setIsLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  // Merge socket notifications with API notifications
  useEffect(() => {
    if (socketNotifications.length > 0) {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newNotifications = socketNotifications.filter(
          (n) => !existingIds.has(n.id),
        );
        return [...newNotifications, ...prev];
      });
    }
  }, [socketNotifications]);

  // Merge socket alerts with API alerts
  useEffect(() => {
    if (socketAlerts.length > 0) {
      setAlerts((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newAlerts = socketAlerts.filter((a) => !existingIds.has(a.id));
        return [...newAlerts, ...prev];
      });
    }
  }, [socketAlerts]);

  const handleMarkAsRead = async (id) => {
    try {
      await apiClient.customRequest(`/notifications-enhanced/${id}/read`, {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id ? { ...notif, isRead: true, is_read: true } : notif,
        ),
      );
      markNotificationAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.customRequest("/notifications-enhanced/read-all", {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true, is_read: true })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await apiClient.customRequest(`/notifications-enhanced/${id}/dismiss`, {
        method: "PATCH",
      });

      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
      dismissNotification(id);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const handleTrackClick = async (id, actionType) => {
    try {
      await apiClient.customRequest(`/notifications-enhanced/${id}/click`, {
        method: "POST",
        data: { actionType },
      });
    } catch (error) {
      console.error("Failed to track click:", error);
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
      case "dismiss":
        handleDismiss(selectedNotification.id);
        break;
      case "archive":
        console.log("Archive notification:", selectedNotification.id);
        break;
      case "pin":
        console.log("Pin notification:", selectedNotification.id);
        break;
      default:
        break;
    }

    handleContextMenuClose();
  };

  const handleNavigate = (notification) => {
    if (notification.actionUrl) {
      handleTrackClick(notification.id, "navigate");
      window.location.href = notification.actionUrl;
    }
  };

  const handleFetchAnalytics = async () => {
    try {
      const data = await apiClient.get(
        "/notifications-enhanced/analytics?timeRange=30days",
      );
      if (data) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
  };

  const handleSavePreferences = async () => {
    try {
      const updatedPrefs = await apiClient.customRequest(
        "/notifications-enhanced/preferences",
        {
        method: "PUT",
        data: preferences,
      },
      );

      if (updatedPrefs?.data) {
        setPreferences(updatedPrefs.data);
      }
      setPreferencesDialogOpen(false);
    } catch (error) {
      console.error("Error saving preferences:", error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
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
      case "critical":
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

  const getPriorityColor = (priority) => {
    const weight = toPriorityWeight(priority);
    if (weight >= 4) return "error";
    if (weight >= 3) return "warning";
    if (weight >= 2) return "info";
    return "default";
  };

  const getPriorityLabel = (priority) => {
    return toPriorityLabel(priority);
  };

  // Sort notifications
  const sortedNotifications = [...notifications].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "priority":
        comparison = toPriorityWeight(b.priority) - toPriorityWeight(a.priority);
        break;
      case "date":
        comparison = new Date(b.createdAt) - new Date(a.createdAt);
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? -comparison : comparison;
  });

  // Filter notifications
  const filteredNotifications = sortedNotifications.filter((notif) => {
    const priorityWeight = toPriorityWeight(notif.priority);
    if (filters.minPriority && priorityWeight < filters.minPriority)
      return false;
    if (filters.maxPriority && priorityWeight > filters.maxPriority)
      return false;
    return true;
  });

  if (isLoading) {
    return (
      <Card sx={{ p: 3, mt: 3 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={200}
        >
          <CircularProgress />
        </Box>
      </Card>
    );
  }

  return (
    <div>
      <Card sx={{ p: 3, mt: 3, mb: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon fontSize="large" />
            </Badge>
            <Typography variant="h4" component="h1">
              Notifications & Alerts
            </Typography>
            {!isConnected && (
              <Chip
                label="Offline"
                color="default"
                size="small"
                icon={<NotificationsNoneIcon />}
              />
            )}
            {isConnected && (
              <Chip
                label="Live"
                color="success"
                size="small"
                icon={<NotificationsActiveIcon />}
              />
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setFilterDialogOpen(true)}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              startIcon={<SortIcon />}
              onClick={() =>
                setSortBy(sortBy === "priority" ? "date" : "priority")
              }
            >
              Sort by {sortBy === "priority" ? "Date" : "Priority"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setPreferencesDialogOpen(true)}
            >
              Settings
            </Button>
            <Button
              variant="outlined"
              startIcon={<BarChartIcon />}
              onClick={() => {
                handleFetchAnalytics();
                setAnalyticsDialogOpen(true);
              }}
            >
              Analytics
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleMarkAllAsRead}
              disabled={notifications.every((notif) => notif.isRead)}
              startIcon={<MarkEmailReadIcon />}
            >
              Mark All as Read
            </Button>
          </Box>
        </Box>

        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ mb: 2 }}
        >
          <Tab label={`Notifications (${notifications.length})`} />
          <Tab label={`Alerts (${alerts.length})`} />
        </Tabs>

        {activeTab === 0 && (
          <>
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
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {!notification.isRead && (
                            <Chip label="New" color="primary" size="small" />
                          )}
                          <Chip
                            label={getPriorityLabel(notification.priority)}
                            color={getPriorityColor(notification.priority)}
                            size="small"
                          />
                          <IconButton
                            onClick={(e) =>
                              handleContextMenuOpen(e, notification)
                            }
                            size="small"
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Box>
                      }
                      sx={{
                        backgroundColor: notification.isRead
                          ? "inherit"
                          : "#f0f7ff",
                        borderLeft: `4px solid ${getPriorityColor(notification.priority)}.main`,
                        mb: 1,
                        "&:hover": { backgroundColor: "#f5f5f5" },
                        cursor: "pointer",
                      }}
                      onClick={() => handleMarkAsRead(notification.id)}
                      onContextMenu={(e) =>
                        handleContextMenuOpen(e, notification)
                      }
                    >
                      <ListItemAvatar>
                        {getSeverityIcon(notification.priority)}
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography variant="subtitle1">
                              {notification.title}
                            </Typography>
                            {notification.actionRequired && (
                              <Chip
                                label="Action Required"
                                color="warning"
                                size="small"
                              />
                            )}
                          </Box>
                        }
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
                                  notification.createdAt ||
                                    notification.created_at,
                                ),
                                "PPpp",
                              )}
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    {notification.actionUrl && (
                      <Box sx={{ pl: 9, pb: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          endIcon={<ArrowForwardIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigate(notification);
                          }}
                        >
                          Take Action
                        </Button>
                      </Box>
                    )}
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Card
                sx={{ p: 4, textAlign: "center", backgroundColor: "#f5f5f5" }}
              >
                <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6">No notifications found</Typography>
                <Typography variant="body2" color="text.secondary">
                  You're all caught up!
                </Typography>
              </Card>
            )}
          </>
        )}

        {activeTab === 1 && (
          <>
            <Typography variant="h6" gutterBottom>
              Active Alerts ({alerts.length})
            </Typography>

            {alerts.length > 0 ? (
              <List>
                {alerts.map((alert) => (
                  <React.Fragment key={alert.id}>
                    <ListItem
                      secondaryAction={
                        <Chip
                          label={alert.severity?.toUpperCase()}
                          color={getSeverityColor(alert.severity)}
                          size="small"
                        />
                      }
                      sx={{
                        borderLeft: `4px solid ${getSeverityColor(alert.severity)}.main`,
                        mb: 1,
                      }}
                    >
                      <ListItemAvatar>
                        {getSeverityIcon(alert.severity)}
                      </ListItemAvatar>
                      <ListItemText
                        primary={alert.type?.replace("_", " ").toUpperCase()}
                        secondary={
                          <React.Fragment>
                            <Typography
                              component="span"
                              variant="body2"
                              color="text.primary"
                            >
                              {alert.message || alert.title}
                            </Typography>
                            {alert.currentValue && (
                              <Typography
                                component="span"
                                variant="caption"
                                display="block"
                              >
                                Current: {alert.currentValue} | Threshold:{" "}
                                {alert.thresholdValue}
                              </Typography>
                            )}
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Card
                sx={{ p: 4, textAlign: "center", backgroundColor: "#f5f5f5" }}
              >
                <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6">No active alerts</Typography>
                <Typography variant="body2" color="text.secondary">
                  Everything is running smoothly!
                </Typography>
              </Card>
            )}
          </>
        )}
      </Card>

      {/* Context Menu */}
      <Menu
        open={contextMenuPosition !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuPosition !== null
            ? { top: contextMenuPosition.top, left: contextMenuPosition.left }
            : undefined
        }
      >
        <MenuItem onClick={() => handleQuickAction("mark-read")}>
          <ListItemIcon>
            <CheckIcon fontSize="small" />
          </ListItemIcon>
          Mark as Read
        </MenuItem>
        <MenuItem onClick={() => handleQuickAction("pin")}>
          <ListItemIcon>
            <PushPinIcon fontSize="small" />
          </ListItemIcon>
          Pin Notification
        </MenuItem>
        <MenuItem onClick={() => handleQuickAction("archive")}>
          <ListItemIcon>
            <ArchiveIcon fontSize="small" />
          </ListItemIcon>
          Archive
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleQuickAction("dismiss")}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Dismiss
        </MenuItem>
      </Menu>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Filter Notifications</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters({ ...filters, priority: e.target.value })
                  }
                  label="Priority"
                >
                  <MenuItem value="all">All Priorities</MenuItem>
                  <MenuItem value="5">Critical (5)</MenuItem>
                  <MenuItem value="4">High (4)</MenuItem>
                  <MenuItem value="3">Medium (3)</MenuItem>
                  <MenuItem value="2">Low (2)</MenuItem>
                  <MenuItem value="1">Very Low (1)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters({ ...filters, category: e.target.value })
                  }
                  label="Category"
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  <MenuItem value="appointment">Appointments</MenuItem>
                  <MenuItem value="inventory">Inventory</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="compliance">Compliance</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value })
                  }
                  label="Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="alert">Alert</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Read Status</InputLabel>
                <Select
                  value={filters.isRead}
                  onChange={(e) =>
                    setFilters({ ...filters, isRead: e.target.value })
                  }
                  label="Read Status"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="false">Unread Only</MenuItem>
                  <MenuItem value="true">Read Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setFilterDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => setFilterDialogOpen(false)}
            variant="contained"
          >
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preferences Dialog */}
      <Dialog
        open={preferencesDialogOpen}
        onClose={() => setPreferencesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Notification Preferences</DialogTitle>
        <DialogContent>
          {preferences && (
            <Box sx={{ mt: 2 }}>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Channels</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.channels?.inApp}
                            onChange={(e) =>
                              setPreferences({
                                ...preferences,
                                channels: {
                                  ...preferences.channels,
                                  inApp: e.target.checked,
                                },
                              })
                            }
                          />
                        }
                        label="In-App Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.channels?.email}
                            onChange={(e) =>
                              setPreferences({
                                ...preferences,
                                channels: {
                                  ...preferences.channels,
                                  email: e.target.checked,
                                },
                              })
                            }
                          />
                        }
                        label="Email Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.channels?.sms}
                            onChange={(e) =>
                              setPreferences({
                                ...preferences,
                                channels: {
                                  ...preferences.channels,
                                  sms: e.target.checked,
                                },
                              })
                            }
                          />
                        }
                        label="SMS Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={preferences.channels?.push}
                            onChange={(e) =>
                              setPreferences({
                                ...preferences,
                                channels: {
                                  ...preferences.channels,
                                  push: e.target.checked,
                                },
                              })
                            }
                          />
                        }
                        label="Push Notifications"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Priority Settings</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {["critical", "high", "medium", "low"].map((priority) => (
                      <Grid item xs={12} key={priority}>
                        <Paper sx={{ p: 2 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ mb: 1, textTransform: "capitalize" }}
                          >
                            {priority} Priority
                          </Typography>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={
                                  preferences.priority?.[priority]?.enabled
                                }
                                onChange={(e) =>
                                  setPreferences({
                                    ...preferences,
                                    priority: {
                                      ...preferences.priority,
                                      [priority]: {
                                        ...preferences.priority[priority],
                                        enabled: e.target.checked,
                                      },
                                    },
                                  })
                                }
                              />
                            }
                            label="Enabled"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={
                                  preferences.priority?.[priority]?.sound
                                }
                                onChange={(e) =>
                                  setPreferences({
                                    ...preferences,
                                    priority: {
                                      ...preferences.priority,
                                      [priority]: {
                                        ...preferences.priority[priority],
                                        sound: e.target.checked,
                                      },
                                    },
                                  })
                                }
                              />
                            }
                            label="Sound"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={
                                  preferences.priority?.[priority]?.vibration
                                }
                                onChange={(e) =>
                                  setPreferences({
                                    ...preferences,
                                    priority: {
                                      ...preferences.priority,
                                      [priority]: {
                                        ...preferences.priority[priority],
                                        vibration: e.target.checked,
                                      },
                                    },
                                  })
                                }
                              />
                            }
                            label="Vibration"
                          />
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Quiet Hours</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.quietHours?.enabled}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            quietHours: {
                              ...preferences.quietHours,
                              enabled: e.target.checked,
                            },
                          })
                        }
                      />
                    }
                    label="Enable Quiet Hours"
                  />
                  <TextField
                    fullWidth
                    label="Start Time"
                    type="time"
                    value={preferences.quietHours?.startTime || "22:00"}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        quietHours: {
                          ...preferences.quietHours,
                          startTime: e.target.value,
                        },
                      })
                    }
                    sx={{ mt: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="End Time"
                    type="time"
                    value={preferences.quietHours?.endTime || "08:00"}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        quietHours: {
                          ...preferences.quietHours,
                          endTime: e.target.value,
                        },
                      })
                    }
                    sx={{ mt: 2 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.quietHours?.allowCritical}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            quietHours: {
                              ...preferences.quietHours,
                              allowCritical: e.target.checked,
                            },
                          })
                        }
                      />
                    }
                    label="Allow Critical Notifications"
                    sx={{ mt: 2 }}
                  />
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setPreferencesDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSavePreferences} variant="contained">
            Save Preferences
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog
        open={analyticsDialogOpen}
        onClose={() => setAnalyticsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Notification Analytics</DialogTitle>
        <DialogContent>
          {analytics && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: "center" }}>
                    <Typography variant="h4" color="primary">
                      {analytics.overall?.total || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Notifications
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: "center" }}>
                    <Typography variant="h4" color="success.main">
                      {analytics.performance?.openRate?.rate || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Open Rate
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: "center" }}>
                    <Typography variant="h4" color="info.main">
                      {analytics.performance?.clickRate?.rate || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click Rate
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: "center" }}>
                    <Typography variant="h4" color="warning.main">
                      {analytics.performance?.dismissRate?.rate || 0}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Dismiss Rate
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
                Trending Notification Types
              </Typography>
              <Grid container spacing={2}>
                {analytics.trending?.map((trend, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle1">{trend.type}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {trend.category}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          mt: 1,
                        }}
                      >
                        <Typography variant="body2">
                          Count: {trend.count}
                        </Typography>
                        <Typography variant="body2">
                          Open Rate: {trend.openRate}%
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setAnalyticsDialogOpen(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default EnhancedNotificationsDashboard;
