import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Avatar,
  Tabs,
  Tab,
  Divider,
  Switch,

  Alert           ,
  Snackbar,
  Dialog  ,
  DialogTitle,
  DialogContent,
  DialogActions,

  List         ,
  ListItem  ,
  ListItemText,
  ListItemSecondaryAction,
  Chip        ,
} from "@mui/material";
import {
  Person,
  Lock,
  Notifications,
  Security,
  Edit,
  Save,
  Cancel,
  Phone,

  LocationOn,
  DarkMode  ,

} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  profileUpdateSchema,
  passwordChangeSchema,
} from "../../utils/validation";
import { PasswordToggleButton } from "../UI";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";

const TabPanel = ({ children, value, index }) =>
  value === index && <Box sx={{ p: 3 }}>{children}</Box>;

const ProfileManager = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Preferences
  const [preferences, setPreferences] = useState({
    darkMode: false,
    emailNotifications: true,
    smsNotifications: true,
    appointmentReminders: true,
    language: "en",
  });

  const {
    control: profileControl,
    handleSubmit: handleProfileSubmit,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm({
    resolver: yupResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
      phone: user?.phone || "",
      address: user?.address || "",
    },
  });

  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: yupResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  useEffect(() => {
    if (user) {
      resetProfile({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        phone: user.phone || "",
        address: user.address || "",
      });

      // Load preferences
      const savedPrefs = localStorage.getItem("userPreferences");
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    }
  }, [user, resetProfile]);

  const onProfileUpdate = async (data) => {
    setLoading(true);
    try {
      const response = await api.put(`/users/${user.id}`, {
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        address: data.address,
      });

      if (response.data.success) {
        updateUser(response.data.data);
        setSnackbar({
          open: true,
          message: "Profile updated successfully",
          severity: "success",
        });
        setEditMode(false);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Failed to update profile",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const onPasswordChange = async (data) => {
    setLoading(true);
    try {
      const response = await api.post("/auth/change-password", {
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: "Password changed successfully",
          severity: "success",
        });
        setPasswordDialogOpen(false);
        resetPassword();
      }
    } catch (err) {
      console.error("Error changing password:", err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || "Failed to change password",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    localStorage.setItem("userPreferences", JSON.stringify(newPrefs));

    setSnackbar({
      open: true,
      message: "Preference saved",
      severity: "success",
    });
  };

  const handleCancelEdit = () => {
    resetProfile({
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
      phone: user?.phone || "",
      address: user?.address || "",
    });
    setEditMode(false);
  };

  return(
    <Box sx={{ p: 3, maxWidth: 1200, margin: "0 auto" }}>
      <Typography variant="h4" component="h1" fontWeight="bold" mb={3}>
        Profile Management
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Summary Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ textAlign: "center", p: 3 }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                margin: "0 auto 16px",
                bgcolor: "primary.main",
                fontSize: 48,
              }}
            >
              {user?.first_name?.charAt(0)}
              {user?.last_name?.charAt(0)}
            </Avatar>
            <Typography variant="h5" fontWeight="bold">
              {user?.first_name} {user?.last_name}
            </Typography>
            <Typography color="textSecondary" gutterBottom>
              {user?.email}
            </Typography>
            <Chip
              label={user?.role?.toUpperCase()}
              color="primary"
              size="small"
              sx={{ mt: 1 }}
            />

            <Divider sx={{ my: 2 }} />

            <List dense>
              <ListItem>
                <Phone
                  fontSize="small"
                  sx={{ mr: 1, color: "text.secondary" }}
                />
                <ListItemText
                  primary="Phone"
                  secondary={user?.phone || "Not set"}
                />
              </ListItem>
              <ListItem>
                <LocationOn
                  fontSize="small"
                  sx={{ mr: 1, color: "text.secondary" }}
                />
                <ListItemText
                  primary="Address"
                  secondary={user?.address || "Not set"}
                />
              </ListItem>
              <ListItem>
                <Security
                  fontSize="small"
                  sx={{ mr: 1, color: "text.secondary" }}
                />
                <ListItemText
                  primary="Account Status"
                  secondary={user?.is_active ? "Active" : "Inactive"}
                />
              </ListItem>
            </List>
          </Card>
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Card>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab icon={<Person />} label="Personal Info" />
              <Tab icon={<Lock />} label="Security" />
              <Tab icon={<Notifications />} label="Preferences" />
            </Tabs>

            {/* Personal Info Tab */}
            <TabPanel value={activeTab} index={0}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Typography variant="h6">Personal Information</Typography>
                {!editMode ?(
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </Button>)
                  :(
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<Cancel />}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={handleProfileSubmit(onProfileUpdate)}
                      disabled={loading}
                    >
                      Save
                    </Button>
                  </Box>)
                 }
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="firstName"
                    control={profileControl}
                    render={({ field }) =>(
                      <TextField
                        {...field}
                        fullWidth
                        label="First Name"
                        disabled={!editMode}
                        error={!!profileErrors.firstName}
                        helperText={profileErrors.firstName?.message}
                      />)
                     }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="lastName"
                    control={profileControl}
                    render={({ field }) =>(
                      <TextField
                        {...field}
                        fullWidth
                        label="Last Name"
                        disabled={!editMode}
                        error={!!profileErrors.lastName}
                        helperText={profileErrors.lastName?.message}
                      />)
                     }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user?.email || ""}
                    disabled
                    helperText="Email cannot be changed"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="phone"
                    control={profileControl}
                    render={({ field }) =>(
                      <TextField
                        {...field}
                        fullWidth
                        label="Phone Number"
                        disabled={!editMode}
                        error={!!profileErrors.phone}
                        helperText={profileErrors.phone?.message}
                      />)
                     }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="address"
                    control={profileControl}
                    render={({ field }) =>(
                      <TextField
                        {...field}
                        fullWidth
                        label="Address"
                        multiline
                        rows={2}
                        disabled={!editMode}
                        error={!!profileErrors.address}
                        helperText={profileErrors.address?.message}
                      />)
                     }
                  />
                </Grid>
              </Grid>
            </TabPanel>

            {/* Security Tab */}
            <TabPanel value={activeTab} index={1}>
              <Typography variant="h6" gutterBottom>
                Security Settings
              </Typography>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium">
                        Change Password
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        It's a good idea to use a strong password that you don't
                        use elsewhere
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<Lock />}
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      Change
                    </Button>
                  </Box>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography
                    variant="subtitle1"
                    fontWeight="medium"
                    gutterBottom
                  >
                    Two-Factor Authentication
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Add an extra layer of security to your account
                  </Typography>
                  <Button variant="outlined" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography
                    variant="subtitle1"
                    fontWeight="medium"
                    gutterBottom
                  >
                    Login Sessions
                  </Typography>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Manage your active sessions across devices
                  </Typography>
                  <Button variant="outlined" color="error">
                    Sign Out All Devices
                  </Button>
                </CardContent>
              </Card>
            </TabPanel>

            {/* Preferences Tab */}
            <TabPanel value={activeTab} index={2}>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Dark Mode"
                    secondary="Switch between light and dark themes"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={preferences.darkMode}
                      onChange={(e) =>
                        handlePreferenceChange("darkMode", e.target.checked)
                      }
                      icon={<DarkMode />}
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemText
                    primary="Email Notifications"
                    secondary="Receive updates and alerts via email"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={preferences.emailNotifications}
                      onChange={(e) =>
                        handlePreferenceChange(
                          "emailNotifications",
                          e.target.checked,
                        )
                      }
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemText
                    primary="SMS Notifications"
                    secondary="Receive urgent alerts via SMS"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={preferences.smsNotifications}
                      onChange={(e) =>
                        handlePreferenceChange(
                          "smsNotifications",
                          e.target.checked,
                        )
                      }
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemText
                    primary="Appointment Reminders"
                    secondary="Get reminded about upcoming appointments"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={preferences.appointmentReminders}
                      onChange={(e) =>
                        handlePreferenceChange(
                          "appointmentReminders",
                          e.target.checked,
                        )
                      }
                    />
                  </ListItemSecondaryAction>
                </ListItem>

                <Divider />

                <ListItem>
                  <ListItemText
                    primary="Language"
                    secondary="Select your preferred language"
                  />
                  <ListItemSecondaryAction>
                    <select
                      value={preferences.language}
                      onChange={(e) =>
                        handlePreferenceChange("language", e.target.value)
                      }
                      style={{
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="en">English</option>
                      <option value="tl">Tagalog</option>
                    </select>
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
            </TabPanel>
          </Card>
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <form onSubmit={handlePasswordSubmit(onPasswordChange)}>
            <Controller
              name="currentPassword"
              control={passwordControl}
              render={({ field }) =>(
                <TextField
                  {...field}
                  fullWidth
                  type={showPassword.current ? "text" : "password"}
                  label="Current Password"
                  margin="normal"
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword?.message}
                  InputProps={{
                    endAdornment:(
                      <PasswordToggleButton
                        visible={showPassword.current}
                        onToggle={() =>
                          setShowPassword({
                            ...showPassword,
                            current: !showPassword.current,
                          })
                        }
                        showLabel="Show current password"
                        hideLabel="Hide current password"
                        className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                      />)
                     ,
                  }}
                />)
               }
            />

            <Controller
              name="newPassword"
              control={passwordControl}
              render={({ field }) =>(
                <TextField
                  {...field}
                  fullWidth
                  type={showPassword.new ? "text" : "password"}
                  label="New Password"
                  margin="normal"
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                  InputProps={{
                    endAdornment:(
                      <PasswordToggleButton
                        visible={showPassword.new}
                        onToggle={() =>
                          setShowPassword({
                            ...showPassword,
                            new: !showPassword.new,
                          })
                        }
                        showLabel="Show new password"
                        hideLabel="Hide new password"
                        className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                      />)
                     ,
                  }}
                />)
               }
            />

            <Controller
              name="confirmNewPassword"
              control={passwordControl}
              render={({ field }) =>(
                <TextField
                  {...field}
                  fullWidth
                  type={showPassword.confirm ? "text" : "password"}
                  label="Confirm New Password"
                  margin="normal"
                  error={!!passwordErrors.confirmNewPassword}
                  helperText={passwordErrors.confirmNewPassword?.message}
                  InputProps={{
                    endAdornment:(
                      <PasswordToggleButton
                        visible={showPassword.confirm}
                        onToggle={() =>
                          setShowPassword({
                            ...showPassword,
                            confirm: !showPassword.confirm,
                          })
                        }
                        showLabel="Show confirm new password"
                        hideLabel="Hide confirm new password"
                        className="p-2 rounded-md text-gray-600 hover:text-gray-900"
                      />)
                     ,
                  }}
                />)
               }
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="contained"
            onClick={() => setPasswordDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePasswordSubmit(onPasswordChange)}
            disabled={loading}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>)
   ;
};

export default ProfileManager;