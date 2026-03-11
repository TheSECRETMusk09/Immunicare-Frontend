import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
} from "@mui/material";
import {
  ChevronLeft,
  ChevronRight,
  Event,
  AccessTime,
  ChildCare,
  LocalHospital,
  CheckCircle,
  Refresh,
  Cancel,
} from "@mui/icons-material";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isBefore,
  startOfDay,
} from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { appointmentSchema } from "../../utils/validation";
import { apiClient as api } from "../../utils/api";
import {
  isWeekend,
  isPhilippineHoliday,
  getUpcomingHolidays,
  formatHoliday,
} from "../../utils/holidays";

const steps = [
  "Select Date & Time",
  "Select Infant",
  "Choose Services",
  "Confirm Details",
];

// 8:00 AM - 4:00 PM schedule with lunch break from 12:00 PM - 1:00 PM
const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
];

const EnhancedAppointmentBooking = ({
  open,
  onClose,
  initialDate = null,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [infants, setInfants] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(appointmentSchema),
    mode: "onChange",
    defaultValues: {
      infantId: "",
      appointmentType: "vaccination",
      appointmentDate: initialDate || new Date(),
      startTime: "",
      endTime: "",
      notes: "",
      vaccines: [],
    },
  });

  const watchAppointmentType = watch("appointmentType");
  const watchInfantId = watch("infantId");
  const watchVaccines = watch("vaccines");

  // Fetch infants
  useEffect(() => {
    const fetchInfants = async () => {
      try {
        const response = await api.get("/infants");
        if (response.data.success) {
          setInfants(response.data.data || []);
        }
      } catch (error) {
        console.error("Error fetching infants:", error);
        setSnackbar({
          open: true,
          message: "Failed to load infants",
          severity: "error",
        });
      }
    };
    fetchInfants();
  }, []);

  // Fetch vaccines
  useEffect(() => {
    const fetchVaccines = async () => {
      try {
        const response = await api.get("/vaccinations/vaccines");
        if (response.data.success) {
          setVaccines(response.data.data || []);
        }
      } catch (error) {
        console.error("Error fetching vaccines:", error);
      }
    };
    fetchVaccines();
  }, []);

  // Fetch appointments for calendar
  const fetchAppointments = useCallback(async () => {
    try {
      const start = startOfWeek(selectedDate);
      const end = endOfWeek(selectedDate);

      const response = await api.get("/appointments", {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      });

      if (response.data.success) {
        setAppointments(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Get booked time slots for selected date
  const getBookedSlots = useCallback(() => {
    return appointments
      .filter((apt) => isSameDay(parseISO(apt.appointment_date), selectedDate))
      .map((apt) => apt.start_time.substring(0, 5));
  }, [appointments, selectedDate]);

  const handleDateSelect = (selectInfo) => {
    const selected = selectInfo.start;

    // Check for past dates
    if (isBefore(startOfDay(selected), startOfDay(new Date()))) {
      setSnackbar({
        open: true,
        message: "Cannot book appointments in the past",
        severity: "warning",
      });
      return;
    }

    // Check for weekend
    if (isWeekend(selected)) {
      setSnackbar({
        open: true,
        message:
          "Weekends are not available for appointments. Please select a weekday.",
        severity: "warning",
      });
      return;
    }

    // Check for Philippine holidays
    const holiday = isPhilippineHoliday(selected);
    if (holiday) {
      setSnackbar({
        open: true,
        message: `${holiday.name} (${holiday.type === "regular" ? "Regular Holiday" : "Special Holiday"}) is not available for appointments.`,
        severity: "warning",
      });
      return;
    }

    setSelectedDate(selected);
    setValue("appointmentDate", selected);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    setValue("startTime", time);
    // Calculate end time (30 minutes after start)
    const [hours, minutes] = time.split(":").map(Number);
    const endHours = minutes === 30 ? hours + 1 : hours;
    const endMinutes = minutes === 30 ? 0 : 30;
    setValue(
      "endTime",
      `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`,
    );
  };

  const handleNext = () => {
    if (activeStep === 0 && !selectedTime) {
      setSnackbar({
        open: true,
        message: "Please select a time slot",
        severity: "warning",
      });
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await api.post("/appointments", {
        infant_id: data.infantId,
        type: data.appointmentType,
        scheduled_date:
          format(data.appointmentDate, "yyyy-MM-dd") +
          "T" +
          data.startTime +
          ":00",
        duration_minutes: 30,
        notes: data.notes,
        status: "scheduled",
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: "Appointment booked successfully!",
          severity: "success",
        });
        setConfirmationOpen(true);
        if (onSuccess) onSuccess(response.data.data);
      }
    } catch (error) {
      console.error("Error booking appointment:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || "Failed to book appointment",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCalendarEvents = () => {
    return appointments.map((apt) => ({
      id: apt.id,
      title: `${apt.type} - ${apt.first_name} ${apt.last_name}`,
      start: apt.scheduled_date,
      end: new Date(
        new Date(apt.scheduled_date).getTime() +
          (apt.duration_minutes || 30) * 60000,
      ).toISOString(),
      backgroundColor:
        apt.status === "completed"
          ? "#4caf50"
          : apt.status === "cancelled"
            ? "#f44336"
            : "#2196f3",
      extendedProps: {
        status: apt.status,
        infantName: `${apt.first_name} ${apt.last_name}`,
      },
    }));
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper elevation={2} sx={{ p: 2 }}>
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  selectable={true}
                  selectMirror={true}
                  dayMaxEvents={true}
                  weekends={true}
                  events={getCalendarEvents()}
                  select={handleDateSelect}
                  headerToolbar={{
                    left: "prev,next today",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek",
                  }}
                  height={400}
                  validRange={{
                    start: new Date(),
                  }}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h6" gutterBottom>
                Available Slots (8:00 AM - 4:00 PM) for {format(selectedDate, "MMMM d, yyyy")}
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block">
                Lunch break: 12:00 PM - 1:00 PM
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                {timeSlots.map((time) => {
                  const isBooked = getBookedSlots().includes(time);
                  const isSelected = selectedTime === time;

                  return (
                    <Button
                      key={time}
                      variant={isSelected ? "contained" : "outlined"}
                      size="small"
                      disabled={isBooked}
                      onClick={() => handleTimeSelect(time)}
                      sx={{
                        minWidth: 80,
                        backgroundColor: isBooked
                          ? "#f5f5f5"
                          : isSelected
                            ? "primary.main"
                            : "inherit",
                      }}
                    >
                      {time}
                      {isBooked && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ ml: 0.5 }}
                        >
                          (Booked)
                        </Typography>
                      )}
                    </Button>
                  );
                })}
              </Box>
              {selectedTime && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Selected: {format(selectedDate, "MMMM d, yyyy")} at{" "}
                  {selectedTime}
                </Alert>
              )}
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Infant
            </Typography>
            <Controller
              name="infantId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.infantId}>
                  <InputLabel>Select Infant</InputLabel>
                  <Select {...field} label="Select Infant">
                    {infants.map((infant) => (
                      <MenuItem key={infant.id} value={infant.id}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <ChildCare />
                          {infant.first_name} {infant.last_name}
                          <Typography variant="caption" color="textSecondary">
                            (DOB:{" "}
                            {format(
                              parseISO(infant.date_of_birth),
                              "MMM d, yyyy",
                            )}
                            )
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {errors.infantId && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {errors.infantId.message}
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Appointment Details
            </Typography>

            <Controller
              name="appointmentType"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Appointment Type</InputLabel>
                  <Select {...field} label="Appointment Type">
                    <MenuItem value="vaccination">Vaccination</MenuItem>
                    <MenuItem value="checkup">Check-up</MenuItem>
                    <MenuItem value="followup">Follow-up</MenuItem>
                    <MenuItem value="consultation">Consultation</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            {watchAppointmentType === "vaccination" && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Select Vaccines
                </Typography>
                <Controller
                  name="vaccines"
                  control={control}
                  render={({ field }) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {vaccines.map((vaccine) => (
                        <Chip
                          key={vaccine.id}
                          label={vaccine.name}
                          onClick={() => {
                            const newValue = field.value.includes(vaccine.id)
                              ? field.value.filter((id) => id !== vaccine.id)
                              : [...field.value, vaccine.id];
                            field.onChange(newValue);
                          }}
                          color={
                            field.value.includes(vaccine.id)
                              ? "primary"
                              : "default"
                          }
                          variant={
                            field.value.includes(vaccine.id)
                              ? "filled"
                              : "outlined"
                          }
                          icon={<LocalHospital />}
                        />
                      ))}
                    </Box>
                  )}
                />
                {errors.vaccines && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {errors.vaccines.message}
                  </Alert>
                )}
              </Box>
            )}

            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  multiline
                  rows={3}
                  label="Additional Notes"
                  placeholder="Any special requirements or notes..."
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              )}
            />
          </Box>
        );

      case 3:
        const selectedInfant = infants.find((i) => i.id === watchInfantId);
        const selectedVaccineNames = vaccines
          .filter((v) => watchVaccines?.includes(v.id))
          .map((v) => v.name);

        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Appointment Details
            </Typography>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Date & Time
                    </Typography>
                    <Typography variant="body1">
                      <Event
                        sx={{
                          fontSize: 16,
                          mr: 0.5,
                          verticalAlign: "text-bottom",
                        }}
                      />
                      {format(selectedDate, "MMMM d, yyyy")}
                    </Typography>
                    <Typography variant="body1">
                      <AccessTime
                        sx={{
                          fontSize: 16,
                          mr: 0.5,
                          verticalAlign: "text-bottom",
                        }}
                      />
                      {selectedTime} -{" "}
                      {format(
                        new Date(`2000-01-01T${selectedTime}`).getTime() +
                          30 * 60000,
                        "HH:mm",
                      )}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Infant
                    </Typography>
                    <Typography variant="body1">
                      <ChildCare
                        sx={{
                          fontSize: 16,
                          mr: 0.5,
                          verticalAlign: "text-bottom",
                        }}
                      />
                      {selectedInfant?.first_name} {selectedInfant?.last_name}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Appointment Type
                    </Typography>
                    <Chip
                      label={watchAppointmentType
                        ?.replace("-", " ")
                        .toUpperCase()}
                      color="primary"
                      size="small"
                    />
                  </Grid>

                  {selectedVaccineNames.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">
                        Vaccines
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.5,
                          mt: 0.5,
                        }}
                      >
                        {selectedVaccineNames.map((name, idx) => (
                          <Chip
                            key={idx}
                            label={name}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>

            <Alert severity="info">
              Please review the appointment details above. Click 'Book
              Appointment' to confirm.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Book Appointment</Typography>
          <IconButton onClick={onClose} size="small">
            <Cancel />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit(onSubmit)}>
          {renderStepContent(activeStep)}
        </form>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<ChevronLeft />}
        >
          Back
        </Button>

        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            disabled={loading}
            startIcon={loading ? <Refresh className="spin" /> : <CheckCircle />}
          >
            {loading ? "Booking..." : "Book Appointment"}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<ChevronRight />}
          >
            Next
          </Button>
        )}
      </DialogActions>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircle color="success" />
            Appointment Confirmed!
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Your appointment has been successfully booked. You will receive a
            confirmation notification shortly.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmationOpen(false);
              onClose();
            }}
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default EnhancedAppointmentBooking;
