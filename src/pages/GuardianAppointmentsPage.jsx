import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import { Alert, Button, Input, Modal, Select } from "../components/UI";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import GuardianTopHeader from "../components/GuardianTopHeader";
import { Calendar, Plus } from "lucide-react";
import moment from "moment";

// FullCalendar imports (same as Admin Dashboard)
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// Philippine Holidays utility
import {
  isPhilippineHoliday,
  isWeekend,
  isDateAvailableForBooking,
  getHolidayTypeClass,
} from "../utils/holidays";
import { trackEvent } from "../utils/telemetry";
import {
  toDateKey,
  toMonthKey,
  fromDateKey,
  formatClinicDateLabel,
  formatTimeSlotLabel,
  getClinicDateTimeParts,
  toClinicDateKey,
} from "../utils/dateUtils";
import { getStatusPillClass } from "../constants/statusMappings";
import { normalizeArrayPayload } from "../utils/apiUtils";

const isWeekendDate = (value) => {
  return isWeekend(value);
};

const getEventColor = (status) => {
  switch (status) {
    case "completed":
    case "attended":
      return "#10b981"; // green
    case "scheduled":
    case "confirmed":
      return "#3b82f6"; // blue
    case "cancelled":
      return "#ef4444"; // red
    default:
      return "#f59e0b"; // amber
  }
};

const canMutateAppointment = (status) => !["completed", "attended", "cancelled"].includes(status);
const CALENDAR_WEEK_START = 0;
const MAX_DAILY_VACCINATION_SLOTS = 400;

const normalizeAppointmentDateDetails = (details) => {
  if (!details || typeof details !== "object") {
    return null;
  }

  const appointments = Array.isArray(details.appointments) ? details.appointments : [];
  const isUnavailable =
    details?.availability?.available === false ||
    Boolean(details?.holiday) ||
    Boolean(details?.isWeekend);

  return {
    ...details,
    appointments: isUnavailable ? [] : appointments,
    summary: {
      ...(details.summary || {}),
      total: isUnavailable ? 0 :( details?.summary?.total ?? appointments.length),
    },
  };
};

const normalizeTimeValue = (value) => {
  const match = String(value || "").trim().match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return "";
  }

  return `${match[1]}:${match[2]}`;
};

const parseLocalDateTimeFromClinicParts = (dateKey, timeValue = "00:00") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "").trim())) {
    return null;
  }

  const [year, month, day] = String(dateKey).split("-").map((part) => Number.parseInt(part, 10));
  const normalizedTime = normalizeTimeValue(timeValue) || "00:00";
  const [hours, minutes] = normalizedTime.split(":").map((part) => Number.parseInt(part, 10));

  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return null;
  }

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveAppointmentClinicDateParts = (appointment) => {
  const scheduledDateTimeParts = getClinicDateTimeParts(appointment?.scheduled_date);
  const dateKey = scheduledDateTimeParts?.dateKey || toClinicDateKey(appointment?.scheduled_date);
  if (!dateKey) {
    return null;
  }

  return {
    dateKey,
    time:
      normalizeTimeValue(appointment?.scheduled_time) ||
      scheduledDateTimeParts?.time ||
      "09:00",
  };
};

const buildAppointmentDateSummary = (appointmentsForDate = []) =>
  appointmentsForDate.reduce(
    (summary, appointment) => {
      const status = appointment?.status || "unknown";
      summary.total += 1;
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      return summary;
    },
    { total: 0, byStatus: {} },
  );

export default function GuardianAppointmentsPage() {
  const navigate = useNavigate();
  const { guardianId } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchParams] = useSearchParams();
  const childIdFromQuery = searchParams.get("childId");

  const [children, setChildren] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [appointments, setAppointments] = useState([]);

  // FullCalendar state (from Admin Dashboard)
  const [calendarView, setCalendarView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(new Date());
  const calendarRef = useRef(null);

  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [selectedDateDetails, setSelectedDateDetails] = useState(null);
  const [blockedDates, setBlockedDates] = useState({});
  const [calendarAvailabilityByDate, setCalendarAvailabilityByDate] = useState({});
  const [calendarDailyCapacities, setCalendarDailyCapacities] = useState({});

  const [pageLoading, setPageLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [dateDetailsLoading, setDateDetailsLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [postTransactionSyncing, setPostTransactionSyncing] = useState(false);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [timeSlotsFeedback, setTimeSlotsFeedback] = useState(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [availabilityFeedback, setAvailabilityFeedback] = useState(null);
  const [calendarGuardFeedback, setCalendarGuardFeedback] = useState("");

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDateDetailsModal, setShowDateDetailsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState("calendar");

  const [editingAppointment, setEditingAppointment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const [rowAction, setRowAction] = useState({ id: null, action: null });

  const [formData, setFormData] = useState({
    infant_id: childIdFromQuery || "",
    vaccine_id: "",
    scheduled_date: toDateKey(new Date()),
    scheduled_time: "",
    type: "Vaccination",
    notes: "",
  });

  const buildBookingQuery = useCallback(({ childId, scheduledDate } = {}) => {
    const params = new URLSearchParams();

    if (childId) {
      params.set("childId", String(childId));
    }

    if (scheduledDate) {
      params.set("date", scheduledDate);
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }, []);

  const calendarCurrentLabel = useMemo(() => {
    const safeCurrentDate =
      currentDate instanceof Date && !Number.isNaN(currentDate.getTime())
        ? currentDate
        : new Date();

    if (calendarView === "timeGridDay") {
      const selectedDateObject = fromDateKey(selectedDate);
      return moment(selectedDateObject || safeCurrentDate).format("dddd, MMMM D, YYYY");
    }

    if (calendarView === "timeGridWeek") {
      const weekStart = moment(safeCurrentDate).startOf("week");
      const weekEnd = moment(safeCurrentDate).endOf("week");
      return `${weekStart.format("MMM D")} - ${weekEnd.format("MMM D, YYYY")}`;
    }

    return moment(safeCurrentDate).format("MMMM YYYY");
  }, [calendarView, currentDate, selectedDate]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }, [appointments]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return sortedAppointments.filter((appointment) => {
      return(
        new Date(appointment.scheduled_date).getTime() >= now.getTime() &&
        appointment.status !== "cancelled")
       ;
    });
  }, [sortedAppointments]);

  const appointmentHistory = useMemo(() => {
    const now = new Date();
    return sortedAppointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.scheduled_date).getTime();
      return(
        appointmentDate < now.getTime() ||
        appointment.status === "cancelled" ||
        appointment.status === "completed" ||
        appointment.status === "attended")
       ;
    });
  }, [sortedAppointments]);

  const selectedDateAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const appointmentDateParts = resolveAppointmentClinicDateParts(appointment);
        return appointmentDateParts?.dateKey === selectedDate;
      }),
    [appointments, selectedDate],
  );

  // Transform appointments for FullCalendar.
  //
  // IMPORTANT: We pass `start`/`end` as floating ISO strings (no timezone
  // suffix) so FullCalendar plots the event on the clinic-local Manila date
  // regardless of the viewer's browser timezone. Previously we used
  // `new Date(year, month-1, day, ...)` (local browser time) which caused the
  // appointment to render on the wrong calendar cell whenever the viewer's
  // browser timezone differed from Asia/Manila.
  const transformAppointmentsForCalendar = (appointments) => {
    return appointments
      .filter((appointment) => {
        const appointmentDateParts = resolveAppointmentClinicDateParts(appointment);
        if (!appointmentDateParts?.dateKey) {
          return false;
        }

        const dateAvailability = isDateAvailableForBooking(appointmentDateParts.dateKey, {
          allowPast: true,
          blockedDate: blockedDates[appointmentDateParts.dateKey] || null,
        });

        return dateAvailability.isAvailable;
      })
      .map((appointment) => {
        const appointmentDateParts = resolveAppointmentClinicDateParts(appointment);
        if (!appointmentDateParts) {
          return null;
        }

        const { dateKey, time } = appointmentDateParts;
        const [hour, minute] = String(time || "08:00").split(":").map((part) => Number.parseInt(part, 10));
        if (Number.isNaN(hour) || Number.isNaN(minute)) {
          return null;
        }

        // End time (30 min duration), kept in clinic-local floating time.
        const totalEndMinutes = hour * 60 + minute + 30;
        const endHour = Math.floor(totalEndMinutes / 60) % 24;
        const endMinute = totalEndMinutes % 60;
        const pad = (value) => String(value).padStart(2, "0");
        const startIso = `${dateKey}T${pad(hour)}:${pad(minute)}:00`;
        const endIso = `${dateKey}T${pad(endHour)}:${pad(endMinute)}:00`;

        return {
          id: appointment.id,
          title: `${appointment.first_name || "Infant"} - ${appointment.type || "Vaccination"}`,
          start: startIso,
          end: endIso,
          backgroundColor: getEventColor(appointment.status),
          borderColor: getEventColor(appointment.status),
          textColor: "#ffffff",
          extendedProps: {
            appointment: appointment,
          },
        };
      })
      .filter((event) => event?.start);
  };

  // Handle calendar date change (from Admin Dashboard)
  const handleDatesSet = (dateInfo) => {
    const activeStart = dateInfo?.start ? new Date(dateInfo.start) : new Date();
    const viewType = dateInfo?.view?.type;
    const visibleStart = dateInfo?.view?.currentStart
      ? new Date(dateInfo.view.currentStart)
      : activeStart;
    const calendarAnchorDate = dateInfo?.view?.calendar?.getDate?.();
    const resolvedAnchorDate =
      calendarAnchorDate instanceof Date && !Number.isNaN(calendarAnchorDate.getTime())
        ? calendarAnchorDate
        : visibleStart;

    setCalendarView((previous) =>
      viewType && previous !== viewType ? viewType : previous,
    );

    setCurrentDate((previous) =>
      previous instanceof Date && previous.getTime() === visibleStart.getTime()
        ? previous
        : visibleStart,
    );

    // Keep month cursor stable unless the actual month changes.
    // This prevents redundant availability fetches and effect churn.
    setMonthCursor((previous) =>
      previous instanceof Date && toMonthKey(previous) === toMonthKey(visibleStart)
        ? previous
        : visibleStart,
    );

    if (viewType === "timeGridDay" || viewType === "timeGridWeek") {
      const visibleDayKey = toDateKey(resolvedAnchorDate);
      setSelectedDate((previous) =>
        previous === visibleDayKey ? previous : visibleDayKey,
      );
    }
  };

  // Handle view change (from Admin Dashboard)
  const handleViewChange = (viewName) => {
    if (!calendarRef.current) {
      setCalendarView(viewName);
      return;
    }

    const calendarApi = calendarRef.current.getApi();
    const selectedDateObject = fromDateKey(selectedDate);
    const calendarDate = calendarApi?.getDate?.();
    const fallbackDate = currentDate instanceof Date ? currentDate : new Date();
    const anchorDate =
      selectedDateObject ||(
       calendarDate instanceof Date ? calendarDate : fallbackDate);

    if (viewName === "timeGridDay") {
      calendarApi.changeView(viewName, anchorDate);
      setCurrentDate(anchorDate);
      setSelectedDate(toDateKey(anchorDate));
      setCalendarView(viewName);
      return;
    }

    calendarApi.changeView(viewName, anchorDate);
    setCurrentDate(anchorDate);
    setCalendarView(viewName);
  };

  // Navigate to previous period
  const handlePrev = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.prev();
    }
  };

  // Navigate to next period
  const handleNext = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.next();
    }
  };

  // Navigate to today
  const handleToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      const today = new Date();
      setCurrentDate(today);
      setSelectedDate(toDateKey(today));
      setCalendarGuardFeedback("");
    }
  };

  // Handle event click - open appointment details
  const handleEventClick = (info) => {
    const appointment = info.event.extendedProps.appointment;
    const appointmentDateKey =
      resolveAppointmentClinicDateParts(appointment)?.dateKey ||
      toClinicDateKey(appointment?.scheduled_date);
    if (appointmentDateKey) {
      setSelectedDate(appointmentDateKey);
    }
    handleViewAppointment(appointment);
  };

  // Handle date click - route to the dedicated booking page for a fuller workflow.
  const handleDateClick = (info) => {
    const clickedDate = toDateKey(info.date) || info.dateStr;
    if (!clickedDate) return;

    const clickedDateObject = info.date instanceof Date ? info.date : fromDateKey(clickedDate);
    if (clickedDateObject) {
      setCurrentDate(clickedDateObject);
    }

    setSelectedDate(clickedDate);

    const availability = isDateAvailableForBooking(info.date, {
      blockedDate: blockedDates[clickedDate] || null,
    });
    if (!availability.isAvailable) {
      setCalendarGuardFeedback(availability.reason);
      return;
    }

    setCalendarGuardFeedback("");
    const targetChildId = formData.infant_id || childIdFromQuery || "";
    const querySuffix = buildBookingQuery({
      childId: targetChildId,
      scheduledDate: clickedDate,
    });

    navigate(`/guardian/appointments/new${querySuffix}`, {
      state: {
        selectedDate: clickedDate,
        childId: targetChildId || undefined,
        source: "guardian-appointments-calendar",
      },
    });
  };

  const getDayCellClassNames = useCallback((args) => {
    const classNames = [];
    const dateKey = toDateKey(args.date);
    const blockedDate = blockedDates[dateKey];

    if (isWeekendDate(args.date)) {
      classNames.push("guardian-appointments-calendar-day--weekend");
    }

    const holiday = isPhilippineHoliday(args.date);
    if (holiday) {
      classNames.push(getHolidayTypeClass(holiday.type));
    }

    if (blockedDate?.is_blocked) {
      classNames.push("guardian-appointments-calendar-day--blocked");
    }


    if (dateKey === toDateKey(new Date())) {
      classNames.push("guardian-appointments-calendar-day--today");
    }

    return classNames;
  }, [blockedDates, calendarAvailabilityByDate]);

  const getDayHeaderClassNames = useCallback(
    (args) =>
      toDateKey(args.date) === toDateKey(new Date())
        ? ["guardian-appointments-calendar-header--today"]
        : [],
    [],
  );

  const renderDayHeaderContent = useCallback((args) => {
    const day = moment(args.date);
    const isToday = day.isSame(new Date(), "day");

    if (args.view.type === "timeGridDay") {
      return(
        <span className={`guardian-appointments-day-header ${isToday ? "is-today" : ""}`}>
          {day.format("dddd, MMMM D, YYYY")}
        </span>)
       ;
    }

    if (args.view.type === "timeGridWeek") {
      return(
        <span
          className={`guardian-appointments-day-header-compact ${isToday ? "is-today" : ""}`}
        >
          {day.format("ddd D")}
        </span>)
       ;
    }

    return day.format("ddd");
  }, []);

  const handleOpenDateDetails = () => {
    setShowDateDetailsModal(true);
  };

  const refreshAppointments = useCallback(async () => {
    setIsRefreshing(true);
    setAppointmentsLoading(true);
    try {
      const response = guardianId
        ? await apiClient.getGuardianAppointments(guardianId, { limit: 100 })
        : await apiClient.getAppointments();
      const list = Array.isArray(response) ? response : response?.data || [];
      setAppointments(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      setAppointments([]);
    } finally {
      setAppointmentsLoading(false);
      setIsRefreshing(false);
    }
  }, [guardianId]);

  const fetchCalendarAvailability = useCallback(async (signal) => {
    if (!guardianId) {
      return;
    }

    setCalendarLoading(true);
    try {
      const result = await apiClient.getAppointmentCalendarAvailability({
        month: toMonthKey(monthCursor),
      }, { signal });

      const calendarDates = Array.isArray(result?.dates) ? result.dates : [];
      const availabilityByDate = calendarDates.reduce((accumulator, entry) => {
        if (entry?.date) {
          accumulator[entry.date] = entry;
        }
        return accumulator;
      }, {});
      const todayDateKey = toDateKey(new Date());
      const capacityEntries = await Promise.all(
        calendarDates
          .filter((entry) =>
            entry?.date &&
            entry.date >= todayDateKey &&
            !entry.isWeekend &&
            !entry.isHoliday &&
            !entry.isAdminBlocked &&
            entry.blocked !== true,
          )
          .map(async (entry) => {
            try {
              const capacity = await apiClient.getAppointmentDailyCapacity(
                { date: entry.date },
                { signal },
              );
              return [entry.date, capacity];
            } catch (capacityError) {
              if (capacityError.name === 'CanceledError' || capacityError.code === 'ERR_CANCELED') {
                throw capacityError;
              }
              return [entry.date, null];
            }
          }),
      );
      const capacitiesByDate = capacityEntries.reduce((accumulator, [dateKey, capacity]) => {
        if (dateKey && capacity) {
          accumulator[dateKey] = capacity;
        }
        return accumulator;
      }, {});

      setCalendarAvailabilityByDate(availabilityByDate);
      setCalendarDailyCapacities(capacitiesByDate);
      setBlockedDates(result?.blockedDates || {});
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setCalendarAvailabilityByDate({});
      setCalendarDailyCapacities({});
      setBlockedDates({});
    } finally {
      setCalendarLoading(false);
    }
  }, [guardianId, monthCursor]);

  const fetchDateDetails = useCallback(async (signal) => {
    if (!guardianId || !selectedDate) {
      setSelectedDateDetails(null);
      return;
    }

    setDateDetailsLoading(true);
    try {
      const details = await apiClient.getAppointmentDateDetails(selectedDate, {}, { signal });
      const baseDetails = details && typeof details === "object" ? details : {};
      const selectedDateAvailability = calendarAvailabilityByDate[selectedDate] || null;
      const selectedDateValidation = isDateAvailableForBooking(selectedDate, {
        allowPast: true,
        blockedDate: blockedDates[selectedDate] || null,
      });
      const fallbackAvailability = selectedDateAvailability?.blocked === true || !selectedDateValidation.isAvailable
        ? {
            available: false,
            message:
              selectedDateAvailability?.blockedReason === "no_vaccine_available"
                ? "No slots available for this date."
                : selectedDateValidation.reason,
          }
        : {
            available: true,
            message: "This date is open for booking and monitoring.",
          };
      setSelectedDateDetails(
        normalizeAppointmentDateDetails({
          date: selectedDate,
          ...baseDetails,
          appointments: selectedDateAppointments,
          summary: buildAppointmentDateSummary(selectedDateAppointments),
          availability:
            selectedDateAvailability?.blocked === true || !selectedDateValidation.isAvailable
              ? fallbackAvailability
              : (baseDetails.availability || fallbackAvailability),
          isWeekend: Boolean(baseDetails.isWeekend ?? selectedDateAvailability?.isWeekend),
          holiday:
            baseDetails.holiday ||
            (selectedDateAvailability?.isHoliday
              ? {
                  name: selectedDateAvailability.holidayName || "Holiday",
                }
              : null),
          inventory: baseDetails.inventory || null,
        }),
      );
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      const selectedDateAvailability = calendarAvailabilityByDate[selectedDate] || null;
      const selectedDateValidation = isDateAvailableForBooking(selectedDate, {
        allowPast: true,
        blockedDate: blockedDates[selectedDate] || null,
      });
      setSelectedDateDetails(
        normalizeAppointmentDateDetails({
          date: selectedDate,
          availability:
            selectedDateAvailability?.blocked === true || !selectedDateValidation.isAvailable
              ? {
                  available: false,
                  message:
                    selectedDateAvailability?.blockedReason === "no_vaccine_available"
                      ? "No slots available for this date."
                      : selectedDateValidation.reason,
                }
              : {
                  available: true,
                  message: "This date is open for booking and monitoring.",
                },
          isWeekend: Boolean(selectedDateAvailability?.isWeekend),
          holiday: selectedDateAvailability?.isHoliday
            ? {
                name: selectedDateAvailability.holidayName || "Holiday",
              }
            : null,
          appointments: selectedDateAppointments,
          summary: buildAppointmentDateSummary(selectedDateAppointments),
        }),
      );
    } finally {
      setDateDetailsLoading(false);
    }
  }, [blockedDates, calendarAvailabilityByDate, guardianId, selectedDate, selectedDateAppointments]);

  const bootstrapPage = useCallback(async () => {
    if (!guardianId) {
      setPageLoading(false);
      return;
    }

    setPageLoading(true);
    setError("");

    try {
      const [childrenResponse, vaccinesResponse] = await Promise.all([
        apiClient.getInfantsByGuardian(guardianId),
        apiClient.getVaccines(),
      ]);

      const childList = normalizeArrayPayload(childrenResponse, ["infants", "children", "patients"]);
      const vaccineList = Array.isArray(vaccinesResponse)
        ? vaccinesResponse
        : vaccinesResponse?.data || [];

      setChildren(Array.isArray(childList) ? childList : []);
      setVaccines(Array.isArray(vaccineList) ? vaccineList : []);

      await refreshAppointments();
    } catch (bootstrapError) {
      setError(bootstrapError?.message || "Failed to load guardian appointments");
    } finally {
      setPageLoading(false);
    }
  }, [guardianId, refreshAppointments]);

  useEffect(() => {
    bootstrapPage();
  }, [bootstrapPage]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchCalendarAvailability(abortController.signal);
    return () => abortController.abort();
  }, [fetchCalendarAvailability]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchDateDetails(abortController.signal);
    return () => abortController.abort();
  }, [fetchDateDetails]);

  useEffect(() => {
    const runAvailabilityCheck = async () => {
      if (!guardianId || !formData.scheduled_date) {
        setAvailabilityFeedback(null);
        return;
      }

      const dateAvailability = isDateAvailableForBooking(formData.scheduled_date, {
        blockedDate: blockedDates[formData.scheduled_date] || null,
      });
      if (!dateAvailability.isAvailable) {
        setAvailabilityFeedback({
          available: false,
          code: dateAvailability.code,
          message: dateAvailability.reason,
          holiday: dateAvailability.holiday || null,
          blockedDate: dateAvailability.blockedDate || null,
        });
        return;
      }

      setAvailabilityChecking(true);
      const abortController = new AbortController();
      try {
        const result = await apiClient.checkAppointmentAvailability({
          scheduled_date: formData.scheduled_date,
          vaccine_id: formData.vaccine_id || undefined,
        }, { signal: abortController.signal });
        setAvailabilityFeedback(result);
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        setAvailabilityFeedback(null);
      } finally {
        setAvailabilityChecking(false);
      }
      return () => abortController.abort();
    };

    runAvailabilityCheck();
  }, [guardianId, formData.scheduled_date, formData.vaccine_id, blockedDates]);

  const fetchTimeSlots = useCallback(async (signal) => {
    if (!guardianId || !showBookingModal || !formData.scheduled_date) {
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      return;
    }

    const dateAvailability = isDateAvailableForBooking(formData.scheduled_date, {
      blockedDate: blockedDates[formData.scheduled_date] || null,
    });
    if (!dateAvailability.isAvailable) {
      setTimeSlots([]);
      setTimeSlotsFeedback({
        available: false,
        code: dateAvailability.code,
        message: dateAvailability.reason,
        holiday: dateAvailability.holiday || null,
        blockedDate: dateAvailability.blockedDate || null,
      });
      return;
    }

    setTimeSlotsLoading(true);
    setTimeSlotsFeedback(null);

    try {
      const result = await apiClient.getAppointmentTimeSlots({
        scheduled_date: formData.scheduled_date,
        vaccine_id: formData.vaccine_id || undefined,
        exclude_appointment_id: editingAppointment?.id || undefined,
      }, { signal });

      const slots = Array.isArray(result?.slots) ? result.slots : [];
      setTimeSlots(slots);
      setTimeSlotsFeedback(result || null);

      setFormData((previous) => {
        if (!previous.scheduled_time) return previous;
        if (slots.includes(previous.scheduled_time)) return previous;
        return { ...previous, scheduled_time: "" };
      });
    } catch (slotError) {
      if (slotError.name === 'CanceledError' || slotError.code === 'ERR_CANCELED') return;
      setTimeSlots([]);
      setTimeSlotsFeedback({
        available: false,
        message: slotError?.message || "Failed to load time slots.",
      });
      setFormData((previous) =>( { ...previous, scheduled_time: "" }));
    } finally {
      setTimeSlotsLoading(false);
    }
  }, [blockedDates, guardianId, showBookingModal, formData.scheduled_date, formData.vaccine_id, editingAppointment?.id]);

  useEffect(() => {
    const abortController = new AbortController();
    fetchTimeSlots(abortController.signal);
    return () => abortController.abort();
  }, [fetchTimeSlots]);

  const openBookingPage = useCallback(
    ({ scheduledDate } = {}) => {
      const targetChildId = formData.infant_id || childIdFromQuery;
      const querySuffix = buildBookingQuery({
        childId: targetChildId,
        scheduledDate,
      });

      navigate(`/guardian/appointments/new${querySuffix}`, {
        state: scheduledDate
          ? {
              selectedDate: scheduledDate,
              childId: targetChildId || undefined,
              source: "guardian-appointments-calendar",
            }
          : undefined,
      });
    },
    [buildBookingQuery, childIdFromQuery, formData.infant_id, navigate],
  );

  const openEditModal = (appointment) => {
    const appointmentDateParts = resolveAppointmentClinicDateParts(appointment);
    setEditingAppointment(appointment);
    setTimeSlots([]);
    setTimeSlotsFeedback(null);
    setFormData({
      infant_id: String(appointment.infant_id || ""),
      vaccine_id: "",
      scheduled_date: appointmentDateParts?.dateKey || "",
      scheduled_time: appointmentDateParts?.time || "",
      type: appointment.type || "Vaccination",
      notes: appointment.notes || "",
    });
    setCalendarGuardFeedback("");
    setShowBookingModal(true);
  };

  const syncAfterMutation = async () => {
    setPostTransactionSyncing(true);
    await Promise.all([refreshAppointments(), fetchCalendarAvailability(), fetchDateDetails()]);
    setPostTransactionSyncing(false);
  };

  const handleSubmitAppointment = async (event) => {
    event.preventDefault();

    if (!formData.infant_id || !formData.scheduled_date || !formData.scheduled_time) {
      setError("Please select a child, date, and time before submitting.");
      return;
    }

    const dateAvailability = isDateAvailableForBooking(formData.scheduled_date, {
      blockedDate: blockedDates[formData.scheduled_date] || null,
    });
    if (!dateAvailability.isAvailable) {
      setError(dateAvailability.reason);
      return;
    }

    if (availabilityFeedback && !availabilityFeedback.available) {
      setError(availabilityFeedback.message || "Selected schedule is not available.");
      return;
    }

    if (timeSlotsFeedback && !timeSlotsFeedback.available) {
      setError(timeSlotsFeedback.message || "No available time slots for the selected date.");
      return;
    }

    if (timeSlots.length > 0 && !timeSlots.includes(formData.scheduled_time)) {
      setError("Selected time is no longer available. Please choose another slot.");
      return;
    }

    setFormSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        scheduled_date: `${formData.scheduled_date}T${formData.scheduled_time}:00`,
        type: formData.type,
        notes: formData.notes,
        duration_minutes: 30,
      };

      if (editingAppointment) {
        await apiClient.updateAppointment(editingAppointment.id, payload);
        setSuccessMessage("Appointment updated successfully.");
      } else {
        await apiClient.createAppointment({
          ...payload,
          infant_id: parseInt(formData.infant_id, 10),
          vaccine_id: formData.vaccine_id ? parseInt(formData.vaccine_id, 10) : undefined,
        });
        setSuccessMessage("Appointment created successfully.");
        trackEvent("appointment_booked", {
          appointmentType: formData.type,
          source: "calendar_modal"
        });
      }

      setShowBookingModal(false);
      setSelectedDate(formData.scheduled_date);
      await syncAfterMutation();
    } catch (submitError) {
      setError(submitError?.message || "Failed to save appointment.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;

    setRowAction({ id: cancelTarget.id, action: "cancel" });
    setError("");
    setSuccessMessage("");

    try {
      await apiClient.cancelAppointment(cancelTarget.id, cancelReason || "Cancelled by guardian");
      setShowCancelModal(false);
      setCancelReason("");
      setCancelTarget(null);
      setSuccessMessage("Appointment cancelled successfully.");
      await syncAfterMutation();
    } catch (cancelError) {
      setError(cancelError?.message || "Failed to cancel appointment.");
    } finally {
      setRowAction({ id: null, action: null });
    }
  };

  // Handle View Appointment
  const handleViewAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setShowDateDetailsModal(true);
  };

  if (pageLoading) {
    return(
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-infinity loading-xl text-primary-600" />
          <p className="mt-3 text-sm text-gray-500">Loading guardian appointments...</p>
        </div>
      </div>)
     ;
  }

  return(
    <div className="guardian-page-wrapper min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 guardian-module-mobile-header-spacing">
      <div className="min-[1025px]:hidden fixed top-0 left-0 right-0 z-40 w-full bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={refreshAppointments}
          isRefreshing={isRefreshing}
        />
      </div>

      <div className="pt-14 sm:pt-16 min-[1025px]:pt-0">
        <GuardianModuleHeader
          title="Appointments"
          subtitle="Book, edit, cancel, and monitor your baby's vaccination appointments"
          icon={<Calendar className="w-8 h-8 text-white" />}
          className="guardian-appointments-mobile-ui"
          actionsClassName="guardian-appointments-header-actions"
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="guardian-appointments-header-actions-inner flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <Button variant="secondary" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <Button variant="primary" size="sm" onClick={openBookingPage}>
                  <Plus className="w-4 h-4 mr-1" />
                  New Appointment
                </Button>
              </div>
            </div>
          }
        />
      </div>

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">
        {error && <Alert variant="error">{error}</Alert>}
        {successMessage && <Alert variant="success">{successMessage}</Alert>}
        {calendarGuardFeedback && <Alert variant="warning">{calendarGuardFeedback}</Alert>}

        <section className="guardian-appointments-mobile-switch md:hidden block mb-4" aria-label="Appointments view switcher">
          <div className="guardian-appointments-mobile-switch__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobileViewMode === "calendar"}
              className={`guardian-appointments-mobile-switch__tab ${mobileViewMode === "calendar" ? "is-active" : ""}`}
              onClick={() => setMobileViewMode("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileViewMode === "upcoming"}
              className={`guardian-appointments-mobile-switch__tab ${mobileViewMode === "upcoming" ? "is-active" : ""}`}
              onClick={() => setMobileViewMode("upcoming")}
            >
              Upcoming
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileViewMode === "history"}
              className={`guardian-appointments-mobile-switch__tab ${mobileViewMode === "history" ? "is-active" : ""}`}
              onClick={() => setMobileViewMode("history")}
            >
              History
            </button>
          </div>
        </section>

        <div className="guardian-appointments-layout grid grid-cols-1 min-[768px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
          {/* Left Column - FullCalendar (Admin-style) */}
          <section
            className={`guardian-calendar-wrapper-expanded md:col-span-2 lg:col-span-2 ${
              mobileViewMode !== "calendar" ? "hidden md:block" : "block"
            }`}
          >
            {/* Calendar Navigation Controls (Admin-style) */}
            <div className="guardian-appointments-calendar-toolbar mb-4 rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:px-4">
              <div className="guardian-appointments-calendar-nav flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={handlePrev}>
                  ← Prev
                </Button>
                <Button variant="secondary" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <Button variant="secondary" size="sm" onClick={handleNext}>
                  Next →
                </Button>
              </div>
              <div className="guardian-appointments-calendar-current text-sm font-medium text-gray-700 dark:text-gray-300">
                {calendarCurrentLabel}
              </div>
              <div className="guardian-appointments-calendar-views flex flex-wrap gap-2">
                <Button
                  variant={calendarView === "dayGridMonth" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleViewChange("dayGridMonth")}
                >
                  Month
                </Button>
              </div>
            </div>

            {/* FullCalendar (Admin Dashboard style) */}
            <div className="guardian-appointments-calendar-shell relative px-4 pb-4">
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                viewDidMount={(info) => {
                  setCalendarView(info.view.type);
                  setCurrentDate(info.view.activeStart);
                }}
                datesSet={handleDatesSet}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                events={transformAppointmentsForCalendar(appointments)}
                dayCellClassNames={getDayCellClassNames}
                dayHeaderClassNames={getDayHeaderClassNames}
                dayHeaderContent={renderDayHeaderContent}
                dayCellContent={(arg) => {
                  const dateKey = toDateKey(arg.date);
                  const holiday = isPhilippineHoliday(arg.date);
                  const blockedDate = blockedDates[dateKey];
                  const isUnavailable =
                    Boolean(blockedDate?.is_blocked) ||
                    Boolean(holiday) ||
                    isWeekendDate(arg.date);
                  const isPastDate = !isUnavailable && dateKey < toDateKey(new Date());
                  const dateCapacity = calendarDailyCapacities[dateKey] || null;
                  const totalBooked = calendarAvailabilityByDate[dateKey]?.totalAppointments ?? null;
                  const slotsRemaining = (!isUnavailable && !isPastDate)
                    ? (
                        dateCapacity?.remaining ??
                        (totalBooked !== null
                          ? Math.max(
                              0,
                              (dateCapacity?.maximum ?? MAX_DAILY_VACCINATION_SLOTS) - totalBooked,
                            )
                          : null)
                      )
                    : null;
                  return(
                    <div className="flex flex-col w-full h-full min-h-[4rem]">
                      <div className="text-right p-1 text-sm">{arg.dayNumberText}</div>
                      {holiday &&(
                        <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 truncate px-1 text-right bg-amber-50 dark:bg-amber-900/20 rounded mx-1 mb-1">
                          {holiday.name}
                        </div>)
                       }
                      {!holiday && blockedDate?.is_blocked &&(
                        <div className="text-[10px] font-semibold text-red-700 dark:text-red-300 truncate px-1 text-right bg-red-50 dark:bg-red-900/20 rounded mx-1 mb-1">
                          Blocked
                        </div>)
                       }
                      {!holiday && !blockedDate?.is_blocked && isUnavailable &&(
                        <div className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 truncate px-1 text-right bg-yellow-50 dark:bg-yellow-900/20 rounded mx-1 mb-1">
                          Unavailable
                        </div>)
                       }
                      {isPastDate &&(
                        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 truncate px-1 text-right rounded mx-1 mb-1">
                          Past
                        </div>)
                       }
                      {slotsRemaining !== null &&(
                        <div className={`text-[10px] font-semibold truncate px-1 text-right rounded mx-1 mb-1 ${
                          slotsRemaining === 0
                            ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
                            : slotsRemaining <= 50
                              ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                              : 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20'
                        }`}>
                          {slotsRemaining === 0 ? 'Full' : `${slotsRemaining} slots`}
                        </div>)
                       }
                    </div>)
                   ;
                }}
                selectAllow={(selectInfo) =>
                  isDateAvailableForBooking(selectInfo.start, {
                    blockedDate: blockedDates[toDateKey(selectInfo.start)] || null,
                  }).isAvailable
                }
                headerToolbar={false}
                height="auto"
                aspectRatio={1.8}
                expandRows={true}
                stickyHeaderDates={true}
                dayMaxEvents={3}
                moreLinkText="More"
                allDaySlot={true}
                nowIndicator
                firstDay={CALENDAR_WEEK_START}
                displayEventTime={false}
                eventContent={(eventInfo) =>(
                  <div className="fc-event-custom overflow-hidden">
                    <div className="text-xs truncate">
                      {eventInfo.event.title}
                    </div>
                  </div>)
                 }
              />

              {calendarLoading &&(
                <div className="guardian-appointments-calendar-loading-overlay absolute inset-0 z-10 flex flex-col items-center justify-center rounded-b-xl bg-white/75 dark:bg-gray-900/65 backdrop-blur-[1px]">
                  <span className="loading loading-infinity loading-lg text-primary-600" />
                  <p className="text-sm text-gray-500 mt-2">Synchronizing calendar availability...</p>
                </div>)
               }
            </div>

            {/* Calendar Legend */}
            <div className="guardian-appointments-calendar-legend mt-4 flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm mx-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300 dark:bg-gray-700 dark:border-gray-600"></div>
                <span className="text-gray-600 dark:text-gray-400">Weekend (Unavailable)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-50 border border-amber-300 dark:bg-amber-800 dark:border-amber-700"></div>
                <span className="text-gray-600 dark:text-gray-400">Holiday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Cancelled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Pending</span>
              </div>
              <div className="flex items-center gap-2 ml-auto guardian-appointments-calendar-legend-hint">
                <span className="text-xs text-gray-500">Click on weekdays to book appointment</span>
              </div>
            </div>

            <div className="px-3 pb-3 md:hidden">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleOpenDateDetails}>
                Open selected date details
              </Button>
            </div>
          </section>

          {/* Right Column - Selected Date & Upcoming Appointments & History (KEEP EXISTING CARDS) */}
          <aside
            className={`guardian-appointments-sidebar grid grid-cols-1 gap-4 md:gap-5 md:col-span-2 md:grid-cols-2 lg:col-span-1 lg:grid-cols-1 ${
              mobileViewMode === "calendar" ? "max-md:guardian-appointments-sidebar--mobile-secondary" : ""
            }`}
          >
            {/* Selected Date Card */}
            <section
              className={`guardian-selected-date-card rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:col-span-2 lg:col-span-1 ${
                mobileViewMode !== "calendar" ? "hidden md:block" : "block"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Selected Date</h4>
                {dateDetailsLoading && <span className="loading loading-infinity loading-sm text-primary-600" />}
              </div>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                {selectedDate
                  ? moment(selectedDate).format("dddd, MMMM D, YYYY")
                  : "No date selected"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{selectedDate || ""}</p>

              {selectedDateDetails?.availability?.available === false ?(
                <Alert variant="warning">{selectedDateDetails.availability.message}</Alert>)
                :(
                <Alert variant="info">This date is open for booking and monitoring.</Alert>)
               }

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Appointments</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDateDetails?.summary?.total || 0}
                  </span>
                </p>
              </div>

              <Button className="mt-4 w-full sm:w-auto" variant="secondary" onClick={handleOpenDateDetails}>
                Open Date Detail Panel
              </Button>
            </section>

            {/* Upcoming Appointments Card */}
            <section
              className={`guardian-upcoming-appointments-card rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
                mobileViewMode !== "upcoming" ? "hidden md:block" : "block"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My Upcoming Appointments</h3>
                {appointmentsLoading && <span className="loading loading-infinity loading-sm text-primary-600" />}
              </div>

              {upcomingAppointments.length === 0 ?(
                <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming appointments found.</p>)
                :(
                <div className="space-y-3 max-h-[350px] overflow-y-auto modern-scrollbar pr-1">
                  {upcomingAppointments.map((appointment) =>(
                    <div key={appointment.id} className="guardian-appointment-card rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {(appointment.first_name || "Infant") + " " +( appointment.last_name || "")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.type || "Vaccination"}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatClinicDateLabel(appointment.scheduled_date)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusPillClass(appointment.status)}`}>
                          {appointment.status}
                        </span>

                        {canMutateAppointment(appointment.status) &&(
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditModal(appointment)}
                              loading={rowAction.id === appointment.id && rowAction.action === "edit"}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setCancelTarget(appointment);
                                setCancelReason("");
                                setShowCancelModal(true);
                              }}
                              loading={rowAction.id === appointment.id && rowAction.action === "cancel"}
                            >
                              Cancel
                            </Button>
                          </>)
                         }
                      </div>
                    </div>)
                   )}
                </div>)
               }

              {(appointmentsLoading || postTransactionSyncing) &&(
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="loading loading-infinity loading-xs text-primary-600" />
                  {postTransactionSyncing ? "Finalizing update and syncing schedule..." : "Refreshing appointments..."}
                </div>)
               }
            </section>

            {/* Appointment History Card */}
            <section
              className={`guardian-appointment-history-card rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
                mobileViewMode !== "history" ? "hidden md:block" : "block"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appointment History</h3>
                {appointmentsLoading && <span className="loading loading-infinity loading-sm text-primary-600" />}
              </div>

              {appointmentHistory.length === 0 ?(
                <p className="text-sm text-gray-500 dark:text-gray-400">No appointment history found.</p>)
                :(
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 mobile-scrollbar">
                  {appointmentHistory.map((appointment) =>(
                    <div key={appointment.id} className="guardian-appointment-card rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/40 flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {(appointment.first_name || "Infant") + " " +( appointment.last_name || "")}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{appointment.type || "Vaccination"}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatClinicDateLabel(appointment.scheduled_date)}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusPillClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </div>
                    </div>)
                   )}
                </div>)
               }

              {appointmentHistory.length > 5 &&(
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Showing {Math.min(5, appointmentHistory.length)} of {appointmentHistory.length} past appointments
                </p>)
               }
            </section>
          </aside>
        </div>

        {/* Booking Modal */}
        <Modal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          title={editingAppointment ? "Edit Appointment" : "Book Appointment"}
          size="md"
        >
          <form
            onSubmit={handleSubmitAppointment}
            className="guardian-form guardian-appointments-modal-form guardian-appointments-modal-form--booking space-y-4"
          >
            <Select
              label="Child"
              value={formData.infant_id}
              onChange={(event) => setFormData((previous) =>( { ...previous, infant_id: event.target.value }))}
              disabled={Boolean(editingAppointment)}
              required
            >
              <option value="">Select child</option>
              {children.map((child) =>(
                <option key={child.id} value={child.id}>
                  {child.first_name} {child.last_name}
                </option>)
               )}
            </Select>

            <Select
              label="Vaccine (optional)"
              value={formData.vaccine_id}
              onChange={(event) => setFormData((previous) =>( { ...previous, vaccine_id: event.target.value }))}
            >
              <option value="">Auto-assign based on schedule</option>
              {vaccines.map((vaccine) =>(
                <option key={vaccine.id} value={vaccine.id}>
                  {vaccine.name || vaccine.vaccine_name}
                </option>)
               )}
            </Select>

            {formData.scheduled_date && !isDateAvailableForBooking(formData.scheduled_date, {
              blockedDate: blockedDates[formData.scheduled_date] || null,
            }).isAvailable &&(
              <Alert variant="warning">
                {isDateAvailableForBooking(formData.scheduled_date, {
                  blockedDate: blockedDates[formData.scheduled_date] || null,
                }).reason}
              </Alert>)
             }

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="date"
                label="Date"
                value={formData.scheduled_date}
                min={toDateKey(new Date())}
                shouldDisableDate={(date) =>
                  !isDateAvailableForBooking(date, {
                    blockedDate: blockedDates[toDateKey(date)] || null,
                  }).isAvailable
                }
                onChange={(event) =>
                  setFormData((previous) =>( { ...previous, scheduled_date: event.target.value }))
                }
                required
              />
              <Select
                label="Appointment Time (8AM - 4PM)"
                value={formData.scheduled_time}
                onChange={(event) =>
                  setFormData((previous) =>( { ...previous, scheduled_time: event.target.value }))
                }
                required
                disabled={timeSlotsLoading ||( timeSlotsFeedback && !timeSlotsFeedback.available)}
              >
                <option value="">
                  {timeSlotsLoading ? "Loading time slots..." : "Select time"}
                </option>
                {timeSlots.map((slot) =>(
                  <option key={slot} value={slot}>
                    {formatTimeSlotLabel(slot)}
                  </option>)
                 )}
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 sm:col-span-2">
                Available from 8:00 AM to 4:00 PM (12:00 PM - 1:00 PM lunch break).
              </p>
            </div>

            {timeSlotsLoading ?(
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="loading loading-infinity loading-xs text-primary-600" />
                Loading available time slots...
              </div>)
              :

                                              (timeSlotsFeedback&&!timeSlotsFeedback.available&&(
                <Alert variant="warning">{timeSlotsFeedback.message}</Alert>)
              )
             }

            <Select
              label="Appointment Type"
              value={formData.type}
              onChange={(event) => setFormData((previous) =>( { ...previous, type: event.target.value }))}
              required
            >
              <option value="Vaccination">Vaccination</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Consultation">Consultation</option>
            </Select>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notes
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(event) => setFormData((previous) =>( { ...previous, notes: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                placeholder="Optional notes for the health center"
              />
            </label>

            {availabilityChecking ?(
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="loading loading-infinity loading-xs text-primary-600" />
                Checking booking availability...
              </div>)
              :
                                      (availabilityFeedback&&(
                <Alert variant={availabilityFeedback.available ? "success" : "warning"}>
                  {availabilityFeedback.message}
                </Alert>)
              )
             }

            <div
              className="guardian-form-actions guardian-form-actions--guardian-order guardian-form-actions--booking-modal"
              data-testid="guardian-booking-form-actions"
            >
              <Button
                type="submit"
                actionRole="primary"
                loading={formSubmitting}
                disabled={
                  (availabilityFeedback ? !availabilityFeedback.available : false) ||
                  timeSlotsLoading ||(
                   timeSlotsFeedback ? !timeSlotsFeedback.available : false) ||
                  Boolean(formData.scheduled_date && !isDateAvailableForBooking(formData.scheduled_date, {
                    blockedDate: blockedDates[formData.scheduled_date] || null,
                  }).isAvailable)
                }
                className="guardian-form-actions__primary ui-form-action-btn ui-form-action-btn--primary"
                data-testid="guardian-booking-submit-btn"
              >
                {editingAppointment ? "Save Changes" : "Book Appointment"}
              </Button>
              <Button
                type="button"
                variant="cancel"
                actionRole="cancel"
                onClick={() => setShowBookingModal(false)}
                className="guardian-form-actions__secondary ui-form-action-btn ui-form-action-btn--secondary"
                data-testid="guardian-booking-close-btn"
              >
                Close
              </Button>
            </div>
          </form>
        </Modal>

        {/* Date Details Modal */}
        <Modal
          isOpen={showDateDetailsModal}
          onClose={() => setShowDateDetailsModal(false)}
          title={`Date Details • ${
            selectedDate ? moment(selectedDate).format("dddd, MMMM D, YYYY") : "No date selected"
          }`}
          size="lg"
        >
          {dateDetailsLoading ?(
            <div className="py-10 text-center">
              <span className="loading loading-infinity loading-lg text-primary-600" />
              <p className="text-sm text-gray-500 mt-2">Loading date details...</p>
            </div>)
            :(
            <div className="space-y-4 guardian-modal-body-density--guardian">
              {selectedDateDetails?.availability?.available === false &&(
                <Alert variant="warning">{selectedDateDetails.availability.message}</Alert>)
               }

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Total Appointments</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedDateDetails?.summary?.total || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Holiday</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDateDetails?.holiday?.name || "None"}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Weekend</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedDateDetails?.isWeekend ? "Yes" : "No"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[320px] overflow-y-auto modern-scrollbar pr-1">
                {(selectedDateDetails?.appointments || []).length === 0 ?(
                  <p className="text-sm text-gray-500">No appointments scheduled for this date.</p>)
                  :
                                                      (selectedDateDetails.appointments.map((appointment)=>(
                    <div key={appointment.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {(appointment.first_name || "Infant") + " " +( appointment.last_name || "")}
                        </p>
                        <span
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${getStatusPillClass(appointment.status)}`}
                        >
                          {appointment.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatClinicDateLabel(appointment.scheduled_date)}</p>
                    </div>)
                   ))
                 }
              </div>
            </div>)
           }
        </Modal>

        {/* Cancel Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false);
            setCancelTarget(null);
            setCancelReason("");
          }}
          title="Cancel Appointment"
          size="sm"
        >
            <div className="space-y-3 guardian-modal-body-density--guardian">
            <Alert variant="warning">This will cancel your appointment and immediately notify the admin.</Alert>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reason (optional)
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
                placeholder="Add cancellation reason"
              />
            </label>

            <div
              className="guardian-form-actions guardian-form-actions--guardian-order guardian-form-actions--cancel-modal"
              data-testid="guardian-cancel-form-actions"
            >
              <Button
                type="button"
                variant="danger"
                actionRole="primary"
                loading={rowAction.id === cancelTarget?.id && rowAction.action === "cancel"}
                onClick={handleCancelAppointment}
                className="guardian-form-actions__primary ui-form-action-btn ui-form-action-btn--primary"
                data-testid="guardian-cancel-confirm-btn"
              >
                Confirm Cancel
              </Button>
              <Button
                type="button"
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                className="guardian-form-actions__secondary ui-form-action-btn ui-form-action-btn--secondary"
                data-testid="guardian-cancel-keep-btn"
              >
                Keep Appointment
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </div>)
   ;
}
