import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  AdminModalActions,
  Button,
  Modal,
  PageHeader,
  PageContainer,
  Badge,
  Alert,
  EmptyState,
  SkeletonTable,
  Input,
  Select,
} from "../components/UI";
import SearchableInfantSelect from "../components/SearchableInfantSelect";
import { useAppointments } from "../hooks/useDashboard";
import apiClient from "../utils/api";
import {
  combineClinicDateTime,
  formatClinicDateLabel,
  formatClinicDateTime,
  formatClinicTime,
  formatTimeSlotLabel,
  getClinicDateTimeParts,
  normalizeAppointmentDateTimeForDisplay,
  toClinicDateKey,
} from "../utils/dateUtils";
import {
  isDateAvailableForBooking,
  isPhilippineHoliday,
  getMinBookingDate,
  isWeekend,
} from "../utils/holidays";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Search, ArrowUp, ArrowDown } from "lucide-react";
import PortalDatePicker from "../components/UI/PortalDatePicker";
import { useAuth } from "../contexts/AuthContext";
import { normalizeInfantsResponse } from "../utils/adminDataAdapters";
import {
  hasFieldErrors,
  sanitizeText,
  validateLength,
  validateRequired,
} from "../utils/adminFormValidation";

// Control number display formatter - consistent with InfantManagement and InfantPersonalRecord
const formatControlNumberDisplay = (controlNumber, dateValue) => {
  const base = String(controlNumber || "").trim();
  if (!base) return "Pending";

  const parsedDate = dateValue ? new Date(dateValue) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return base;
  }

  return `${base}-${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;
};

const mergeInfantLookupResults = (...collections) => {
  const merged = [];
  const seenIds = new Set();

  collections.flat().forEach((infant) => {
    const infantId = Number.parseInt(infant?.id, 10);
    if (!Number.isFinite(infantId) || seenIds.has(infantId)) {
      return;
    }

    seenIds.add(infantId);
    merged.push(infant);
  });

  return merged;
};

// Calendar utility functions (matching GuardianAppointmentsPage)
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMonthKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const formatCalendarDateLabel = (dateKey) => {
  return formatClinicDateLabel(dateKey);
};

const buildCalendarGrid = (monthDate) => {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startOfMonth.getDay());

  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const cursor = new Date(gridStart);
    cursor.setDate(gridStart.getDate() + index);
    cells.push({
      date: cursor,
      dateKey: toClinicDateKey(cursor),
      isCurrentMonth: cursor.getMonth() === monthDate.getMonth(),
      isToday: toClinicDateKey(cursor) === toClinicDateKey(new Date()),
    });
  }

  return cells;
};

// Get minimum booking date (today)
const getMinDate = () => getMinBookingDate();

// Validate date selection - returns { valid: boolean, message: string }
const validateDateSelection = (dateStr, { blockedDate = null, allowPast = false } = {}) => {
  if (!dateStr) return { valid: false, message: "Please select a date" };

  const availability = isDateAvailableForBooking(dateStr, {
    allowPast,
    blockedDate,
  });

  if (!availability.isAvailable) {
    return {
      valid: false,
      message: availability.reason,
      code: availability.code,
      holiday: availability.holiday || null,
      blockedDate: availability.blockedDate || null,
    };
  }

  return { valid: true, message: "Date is available" };
};

const normalizeAppointmentStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (!normalized) {
    return "pending";
  }

  if (normalized === "completed") {
    return "attended";
  }

  if (normalized === "confirmed" || normalized === "rescheduled") {
    return "scheduled";
  }

  return normalized;
};

const normalizeAppointmentRecord = (appointment) => {
  if (!appointment || typeof appointment !== "object") {
    return appointment;
  }

  const normalizedStatus = normalizeAppointmentStatus(appointment.status);
  const normalizedScheduledDate = normalizeAppointmentDateTimeForDisplay(
    appointment.scheduled_date,
  );
  return {
    ...appointment,
    raw_status: appointment.status,
    status: normalizedStatus,
    scheduled_date: normalizedScheduledDate
      ? normalizedScheduledDate.toISOString()
      : appointment.scheduled_date,
  };
};

const getAppointmentIdentityKey = (appointment) => {
  const appointmentId = Number.parseInt(appointment?.id, 10);
  if (Number.isFinite(appointmentId)) {
    return `id:${appointmentId}`;
  }

  return [
    "fallback",
    appointment?.infant_id ?? appointment?.patient_id ?? "na",
    appointment?.scheduled_date ?? "na",
    appointment?.type ?? "na",
    appointment?.status ?? "na",
  ].join(":");
};

const normalizeAppointmentCollection = (records) =>
  Array.isArray(records)
    ? records.reduce((normalizedRecords, record) => {
        const normalizedRecord = normalizeAppointmentRecord(record);
        if (!normalizedRecord) {
          return normalizedRecords;
        }

        const identityKey = getAppointmentIdentityKey(normalizedRecord);
        if (normalizedRecords.seen.has(identityKey)) {
          return normalizedRecords;
        }

        normalizedRecords.seen.add(identityKey);
        normalizedRecords.rows.push(normalizedRecord);
        return normalizedRecords;
      }, { rows: [], seen: new Set() }).rows
    : [];

const buildAppointmentSummary = (appointments) =>
  normalizeAppointmentCollection(appointments).reduce(
    (summary, appointment) => {
      const normalizedStatus = appointment?.status || "unknown";
      summary.total += 1;
      summary.byStatus[normalizedStatus] =
        (summary.byStatus[normalizedStatus] || 0) + 1;
      return summary;
    },
    { total: 0, byStatus: {} },
  );

const normalizeAppointmentDateDetails = (details) => {
  if (!details || typeof details !== "object") {
    return null;
  }

  const normalizedAppointments = normalizeAppointmentCollection(
    details.appointments,
  );
  const isUnavailable =
    details?.availability?.available === false ||
    Boolean(details?.holiday) ||
    Boolean(details?.isWeekend);
  const visibleAppointments = isUnavailable ? [] : normalizedAppointments;

  return {
    ...details,
    appointments: visibleAppointments,
    summary: buildAppointmentSummary(visibleAppointments),
  };
};

const formatAppointmentStatusLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  if (!normalized) {
    return "Pending";
  }

  if (normalized === "completed") {
    return "Attended";
  }

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getAppointmentDisplayStatus = (appointment) =>
  formatAppointmentStatusLabel(appointment?.raw_status || appointment?.status);

const getAppointmentStatusVariant = (status) => {
  switch (normalizeAppointmentStatus(status)) {
    case "scheduled":
      return "info";
    case "attended":
      return "success";
    case "cancelled":
      return "danger";
    case "pending":
    default:
      return "warning";
  }
};

const canApproveAppointment = (status) =>
  normalizeAppointmentStatus(status) === "pending";

const canCompleteAppointment = (status) =>
  normalizeAppointmentStatus(status) === "scheduled";

const canEditAppointment = (status) =>
  ["pending", "scheduled", "attended"].includes(
    normalizeAppointmentStatus(status),
  );

const canCancelAppointment = (status) =>
  ["pending", "scheduled"].includes(normalizeAppointmentStatus(status));

export default function Appointments() {
  const { isAdmin } = useAuth();
  const [view, setView] = useState("list");
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Custom calendar state (matching GuardianAppointmentsPage)
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [blockedDates, setBlockedDates] = useState({});
  const [calendarAvailabilityByDate, setCalendarAvailabilityByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(toClinicDateKey(new Date()));
  const [showDateDetailsModal, setShowDateDetailsModal] = useState(false);

  // Calendar grid memoized
  const calendarCells = useMemo(() => buildCalendarGrid(monthCursor), [monthCursor]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rowAction, setRowAction] = useState({ id: null, action: null });
  const [statusFilter, setStatusFilter] = useState('all');
  const latestMonthKeyRef = useRef("");
  const [bookingInfantSearchQuery, setBookingInfantSearchQuery] = useState("");
  const [bookingInfantOptions, setBookingInfantOptions] = useState([]);
  const [bookingInfantCache, setBookingInfantCache] = useState([]);
  const [bookingInfantLoading, setBookingInfantLoading] = useState(false);
  const [bookingInfantError, setBookingInfantError] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Date filtering state
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");

  // Sorting state
  const [sortField] = useState("scheduled_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const explicitDateRangeFilters = useMemo(
    () => ({
      ...(dateFilterStart ? { start_date: dateFilterStart } : {}),
      ...(dateFilterEnd ? { end_date: dateFilterEnd } : {}),
    }),
    [dateFilterStart, dateFilterEnd],
  );

  const listQueryParams = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      ...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...explicitDateRangeFilters,
      sort_field: sortField,
      sort_direction: sortDirection,
    }),
    [
      currentPage,
      itemsPerPage,
      debouncedSearchQuery,
      statusFilter,
      explicitDateRangeFilters,
      sortField,
      sortDirection,
    ],
  );
  const {
    appointments: listAppointments,
    pagination: listPagination,
    loading,
    error: hookError,
    refreshAppointments: refreshAppointmentsFromSource,
  } = useAppointments({
    fetchAll: false,
    enabled: view === "list",
    params: listQueryParams,
  });
  const [createFormData, setCreateFormData] = useState({
    infant_id: "",
    scheduled_date: "",
    scheduled_time: "",
    type: "",
    notes: "",
  });
  const infantLookupScope = useMemo(
    () => (isAdmin ? { scope: "system" } : {}),
    [isAdmin],
  );
  const selectedBookingInfant = useMemo(
    () =>
      bookingInfantCache.find(
        (infant) => Number.parseInt(infant?.id, 10) === Number.parseInt(createFormData.infant_id, 10),
      ) || null,
    [bookingInfantCache, createFormData.infant_id],
  );
  const infants = useMemo(
    () =>
      mergeInfantLookupResults(
        selectedBookingInfant ? [selectedBookingInfant] : [],
        bookingInfantOptions,
      ),
    [bookingInfantOptions, selectedBookingInfant],
  );
  const infantPickerLoading = bookingInfantLoading;
  const infantPickerEmptyMessage = bookingInfantSearchQuery.trim()
    ? "No matching infant found"
    : "No infants available";

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!showBookingModal) {
      setBookingInfantSearchQuery("");
      setBookingInfantOptions(
        selectedBookingInfant ? [selectedBookingInfant] : [],
      );
      setBookingInfantLoading(false);
      setBookingInfantError("");
      return undefined;
    }

    const normalizedSearch = bookingInfantSearchQuery.trim();
    let isCancelled = false;
    setBookingInfantLoading(true);
    setBookingInfantError("");

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await apiClient.getInfants({
          limit: normalizedSearch ? 25 : 50,
          page: 1,
          ...infantLookupScope,
          ...(normalizedSearch ? { search: normalizedSearch } : {}),
        });
        const remoteInfants = normalizeInfantsResponse(response);

        if (!isCancelled) {
          setBookingInfantOptions(
            mergeInfantLookupResults(
              selectedBookingInfant ? [selectedBookingInfant] : [],
              remoteInfants,
            ),
          );
          setBookingInfantCache((previous) =>
            mergeInfantLookupResults(
              previous,
              selectedBookingInfant ? [selectedBookingInfant] : [],
              remoteInfants,
            ),
          );
        }
      } catch (loadError) {
        if (!isCancelled) {
          console.error("Failed to load infants for appointment booking:", loadError);
          setBookingInfantOptions(
            selectedBookingInfant ? [selectedBookingInfant] : [],
          );
          setBookingInfantError(
            loadError?.message || "Unable to load infants right now.",
          );
        }
      } finally {
        if (!isCancelled) {
          setBookingInfantLoading(false);
        }
      }
    }, normalizedSearch ? 250 : 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    bookingInfantSearchQuery,
    infantLookupScope,
    selectedBookingInfant,
    showBookingModal,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, dateFilterStart, dateFilterEnd, sortField, sortDirection]);

  const filteredAppointments = listAppointments;
  const paginatedAppointments = listAppointments;
  const totalPages = Math.max(1, Number(listPagination?.totalPages || 0) || 1);
  const totalAppointments =
    Number(listPagination?.total || listAppointments.length || 0) || 0;
  const listPage = Number(listPagination?.page || currentPage) || currentPage;
  const visibleAppointmentStart =
    totalAppointments > 0 ? (listPage - 1) * itemsPerPage + 1 : 0;
  const visibleAppointmentEnd =
    totalAppointments > 0
      ? Math.min(
          listPage * itemsPerPage,
          totalAppointments,
        )
      : 0;
  const [createFormError, setCreateFormError] = useState("");
  const [editFormErrors, setEditFormErrors] = useState({});
  const [cancelModalError, setCancelModalError] = useState("");

  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [timeSlotsFeedback, setTimeSlotsFeedback] = useState(null);

  const [bookingDateDetails, setBookingDateDetails] = useState(null);
  const [bookingAvailabilityStatus, setBookingAvailabilityStatus] = useState(null);
  const [bookingAvailabilityMessage, setBookingAvailabilityMessage] = useState("");
  const bookingAvailabilityTimerRef = useRef(null);

  const [formErrors, setFormErrors] = useState({});

  const [editFormData, setEditFormData] = useState({
    id: "",
    infant_id: "",
    scheduled_date: "",
    scheduled_time: "",
    type: "",
    notes: "",
  });

  const resolveDateAvailability = useCallback(
    (dateValue, { allowPast = true } = {}) => {
      const dateKey = toClinicDateKey(dateValue);
      if (!dateKey) {
        return {
          isAvailable: false,
          code: "INVALID_DATE",
          reason: "Invalid date provided",
        };
      }

      return isDateAvailableForBooking(dateKey, {
        allowPast,
        blockedDate: blockedDates[dateKey] || null,
      });
    },
    [blockedDates],
  );

  const shouldDisableDate = useCallback(
    (date) => !resolveDateAvailability(date, { allowPast: false }).isAvailable,
    [resolveDateAvailability],
  );

  const fetchTimeSlots = useCallback(async (date, excludeId = undefined, signal) => {
    if (!showBookingModal && !showEditModal) {
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      return;
    }

    if (!date) {
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      return;
    }

    const dateAvailability = resolveDateAvailability(date, { allowPast: false });
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
        scheduled_date: date,
        exclude_appointment_id: excludeId,
      }, { signal });

      const slots = Array.isArray(result?.slots) ? result.slots : [];
      setTimeSlots(slots);
      setTimeSlotsFeedback(result || null);
    } catch (slotError) {
      if (slotError.name === 'CanceledError' || slotError.code === 'ERR_CANCELED') return;
      setTimeSlots([]);
      setTimeSlotsFeedback({
        available: false,
        message: slotError?.message || "Failed to load time slots.",
      });
    } finally {
      setTimeSlotsLoading(false);
    }
  }, [resolveDateAvailability, showBookingModal, showEditModal]);

  const updateBookingAvailabilityStatus = useCallback(
    ({
      scheduledDate,
      scheduledTime,
      slotsLoading,
      slots,
      slotsFeedback,
      dateDetails,
    }) => {
      const normalizedDate = String(scheduledDate || "").trim();
      const normalizedTime = String(scheduledTime || "").trim();

      if (!normalizedDate || !normalizedTime) {
        setBookingAvailabilityStatus(null);
        setBookingAvailabilityMessage("");
        return;
      }

      if (slotsLoading) {
        setBookingAvailabilityStatus("checking");
        setBookingAvailabilityMessage("Checking availability...");
        return;
      }

      const dateValidation = validateDateSelection(normalizedDate, {
        blockedDate: blockedDates[normalizedDate] || null,
      });
      if (!dateValidation.valid) {
        setBookingAvailabilityStatus("unavailable");
        setBookingAvailabilityMessage(dateValidation.message);
        return;
      }

      const resolvedAvailability = dateDetails?.availability || null;
      const resolvedIsAvailable =
        typeof resolvedAvailability?.available === "boolean"
          ? resolvedAvailability.available
          : typeof resolvedAvailability?.isAvailable === "boolean"
            ? resolvedAvailability.isAvailable
            : null;

      if (resolvedIsAvailable === false) {
        setBookingAvailabilityStatus("unavailable");
        setBookingAvailabilityMessage(
          resolvedAvailability?.reason || "Selected date is unavailable.",
        );
        return;
      }

      if (slotsFeedback && slotsFeedback.available === false) {
        setBookingAvailabilityStatus("unavailable");
        setBookingAvailabilityMessage(
          slotsFeedback.message || "No available time slots for the selected date.",
        );
        return;
      }

      if (Array.isArray(slots) && slots.length > 0 && !slots.includes(normalizedTime)) {
        setBookingAvailabilityStatus("unavailable");
        setBookingAvailabilityMessage(
          "Selected time is no longer available. Please choose another slot.",
        );
        return;
      }

      setBookingAvailabilityStatus("available");
      setBookingAvailabilityMessage("Available");
    },
    [blockedDates],
  );

  // Debounced booking availability fetches (prevents duplicate banners / racing effects)
  useEffect(() => {
    if (!showBookingModal) {
      if (bookingAvailabilityTimerRef.current) {
        window.clearTimeout(bookingAvailabilityTimerRef.current);
      }
      setBookingAvailabilityStatus(null);
      setBookingAvailabilityMessage("");
      return undefined;
    }

    const scheduledDate = String(createFormData.scheduled_date || "").trim();
    if (!scheduledDate) {
      setBookingDateDetails(null);
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      updateBookingAvailabilityStatus({
        scheduledDate: "",
        scheduledTime: createFormData.scheduled_time,
        slotsLoading: false,
        slots: [],
        slotsFeedback: null,
        dateDetails: null,
      });
      return undefined;
    }

    const abortController = new AbortController();

    if (bookingAvailabilityTimerRef.current) {
      window.clearTimeout(bookingAvailabilityTimerRef.current);
    }

    bookingAvailabilityTimerRef.current = window.setTimeout(async () => {
      try {
        await fetchTimeSlots(scheduledDate, undefined, abortController.signal);
      } catch (_error) {
        // fetchTimeSlots handles its own state updates
      }

      try {
        const details = await apiClient.getAppointmentDateDetails(
          scheduledDate,
          {},
          { signal: abortController.signal },
        );
        setBookingDateDetails(normalizeAppointmentDateDetails(details));
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        setBookingDateDetails(null);
      }
    }, 300);

    return () => {
      abortController.abort();
      if (bookingAvailabilityTimerRef.current) {
        window.clearTimeout(bookingAvailabilityTimerRef.current);
      }
    };
  }, [
    showBookingModal,
    createFormData.scheduled_date,
    createFormData.scheduled_time,
    fetchTimeSlots,
    updateBookingAvailabilityStatus,
  ]);

  // Keep the consolidated availability status in sync with local inputs + fetched slot feedback.
  useEffect(() => {
    if (!showBookingModal) return;
    updateBookingAvailabilityStatus({
      scheduledDate: createFormData.scheduled_date,
      scheduledTime: createFormData.scheduled_time,
      slotsLoading: timeSlotsLoading,
      slots: timeSlots,
      slotsFeedback: timeSlotsFeedback,
      dateDetails: bookingDateDetails,
    });
  }, [
    showBookingModal,
    createFormData.scheduled_date,
    createFormData.scheduled_time,
    timeSlotsLoading,
    timeSlots,
    timeSlotsFeedback,
    bookingDateDetails,
    updateBookingAvailabilityStatus,
  ]);

  useEffect(() => {
    const abortController = new AbortController();
    if (showEditModal && editFormData.scheduled_date) {
      fetchTimeSlots(editFormData.scheduled_date, editFormData.id, abortController.signal);
    }
    return () => abortController.abort();
  }, [showEditModal, editFormData.scheduled_date, editFormData.id, fetchTimeSlots]);

  const getSelectedInfantControlNumber = useCallback(
    (infantId) => {
      const selectedInfant = bookingInfantCache.find(
        (infant) => Number.parseInt(infant?.id, 10) === Number.parseInt(infantId, 10),
      );
      return selectedInfant?.control_number || "";
    },
    [bookingInfantCache],
  );

  // Keep track of the latest month key to prevent race conditions during rapid navigation
  useEffect(() => {
    latestMonthKeyRef.current = toMonthKey(monthCursor);
  }, [monthCursor]);

  // Phase 3: Combine Calendar API Calls to prevent duplicate fetching and network waterfalls
  const fetchCalendarData = useCallback(async (signal) => {
    setCalendarLoading(true);
    const monthKey = toMonthKey(monthCursor);

    try {
      const calendarResult = await apiClient.getAppointmentCalendarAvailability(
        { month: monthKey },
        { signal },
      );

      // Drop stale responses if the user rapidly changed the month
      if (latestMonthKeyRef.current !== monthKey) return;

      const calendarDates = Array.isArray(calendarResult?.dates)
        ? calendarResult.dates
        : [];
      const availabilityByDate = calendarDates.reduce((accumulator, entry) => {
        if (entry?.date) {
          accumulator[entry.date] = entry;
        }
        return accumulator;
      }, {});

      setCalendarAvailabilityByDate(availabilityByDate);
      setBlockedDates(calendarResult?.blockedDates || {});
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (latestMonthKeyRef.current === monthKey) {
        setCalendarAvailabilityByDate({});
        setBlockedDates({});
      }
    } finally {
      if (latestMonthKeyRef.current === monthKey) setCalendarLoading(false);
    }
  }, [monthCursor]);

  const fetchCalendarAppointments = useCallback(
    async () => {
      const monthStart = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        1,
      );
      const monthEnd = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        0,
      );

      try {
        let page = 1;
        let hasNext = true;
        const scopedAppointments = [];

        while (hasNext) {
          const response = await apiClient.getAppointments({
            start_date: toClinicDateKey(monthStart),
            end_date: toClinicDateKey(monthEnd),
            sort_field: "scheduled_date",
            sort_direction: "asc",
            page,
            limit: 200,
          });

          const pageRows = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response)
              ? response
              : [];
          const pagination = response?.metadata || response?.pagination || null;

          scopedAppointments.push(...pageRows);
          hasNext = Boolean(pagination?.hasNext);
          page += 1;
        }

        if (latestMonthKeyRef.current === toMonthKey(monthCursor)) {
          setAppointments(normalizeAppointmentCollection(scopedAppointments));
        }
      } catch (calendarError) {
        console.error("Failed to fetch calendar appointments:", calendarError);
        if (latestMonthKeyRef.current === toMonthKey(monthCursor)) {
          setAppointments([]);
        }
      }
    },
    [monthCursor],
  );

  // Toggle blocked date handler
  const handleToggleBlockedDate = async (dateKey) => {
    try {
      const result = await apiClient.toggleBlockedDate({
        date: dateKey,
        reason: '',
      });

      // Refresh blocked dates after toggle
      await fetchCalendarData();

      return result;
    } catch (err) {
      console.error('Failed to toggle blocked date:', err);
      throw err;
    }
  };

  // Fetch calendar availability when month changes
  useEffect(() => {
    if (view !== "calendar") {
      return undefined;
    }

    const abortController = new AbortController();
    fetchCalendarData(abortController.signal);
    return () => abortController.abort();
  }, [fetchCalendarData, view]);

  useEffect(() => {
    if (view !== "calendar") {
      return undefined;
    }

    void fetchCalendarAppointments();
    return undefined;
  }, [fetchCalendarAppointments, view]);

  // bookingDateDetails is now fetched inside the debounced booking availability effect above.

  // Handle date cell click
  const handleDateCellClick = (dateKey) => {
    if (!dateKey) {
      return;
    }

    setSelectedDate(dateKey);
    setSelectedSlot(dateKey);
    setShowDateDetailsModal(true);
  };

  // Get appointments for a specific date
  const getAppointmentsForDate = useCallback((dateKey) => {
    const normalizedDateKey = toClinicDateKey(dateKey);
    if (!normalizedDateKey) {
      return [];
    }

    const availability = resolveDateAvailability(normalizedDateKey, { allowPast: true });
    if (!availability.isAvailable) {
      return [];
    }

    return appointments
      .filter((apt) => {
        if (!apt.scheduled_date) return false;
        const aptDateKey = toClinicDateKey(apt.scheduled_date);
        return aptDateKey === normalizedDateKey;
      })
      .sort((left, right) => {
        const leftDate = normalizeAppointmentDateTimeForDisplay(left.scheduled_date);
        const rightDate = normalizeAppointmentDateTimeForDisplay(right.scheduled_date);
        return (leftDate?.getTime() || 0) - (rightDate?.getTime() || 0);
      });
  }, [appointments, resolveDateAvailability]);

  const selectedDateLabel = useMemo(
    () => formatCalendarDateLabel(selectedDate),
    [selectedDate],
  );

  const selectedDateDetails = useMemo(() => {
    if (!selectedDate) {
      return null;
    }

    const normalizedDateKey = toClinicDateKey(selectedDate);
    if (!normalizedDateKey) {
      return null;
    }

    const dayAvailability = calendarAvailabilityByDate[normalizedDateKey] || null;
    const dayAppointments = getAppointmentsForDate(normalizedDateKey);
    const resolvedAvailability = resolveDateAvailability(normalizedDateKey, {
      allowPast: true,
    });
    const holiday = dayAvailability?.holiday ||
      (dayAvailability?.isHoliday
        ? {
            name: dayAvailability.holidayName || "Holiday",
            type: dayAvailability.holidayType || "regular",
          }
        : isPhilippineHoliday(normalizedDateKey));
    const isWeekendDay = dayAvailability?.isWeekend ?? isWeekend(normalizedDateKey);
    const isBlocked = dayAvailability?.isAdminBlocked ?? blockedDates[normalizedDateKey]?.is_blocked ?? false;

    return {
      ...dayAvailability,
      dateKey: normalizedDateKey,
      availability: {
        ...(dayAvailability?.availability || {}),
        ...resolvedAvailability,
        available: !isBlocked && resolvedAvailability.isAvailable,
      },
      holiday,
      isWeekend: isWeekendDay,
      blocked: isBlocked,
      appointments: dayAppointments,
      summary: buildAppointmentSummary(dayAppointments),
    };
  }, [
    blockedDates,
    calendarAvailabilityByDate,
    getAppointmentsForDate,
    resolveDateAvailability,
    selectedDate,
  ]);

  // Refresh appointments from API
  const refreshAppointments = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (view === "calendar") {
        await Promise.all([
          fetchCalendarAppointments(),
          fetchCalendarData(),
        ]);
      } else if (typeof refreshAppointmentsFromSource === "function") {
        await refreshAppointmentsFromSource({ silent: true });
      }
      setError(null);
    } catch (err) {
      console.error('Failed to refresh appointments:', err);
      setError(err.response?.data?.error || err.message || "Failed to refresh appointments");
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCalendarAppointments, fetchCalendarData, refreshAppointmentsFromSource, view]);

  const columns = [
    {
      key: "first_name",
      label: "Infant",
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {row.first_name} {row.last_name}
        </div>
      ),
    },
    {
      key: "guardian_name",
      label: "Guardian",
    },
    {
      key: "scheduled_date",
      label: "Date & Time",
      type: "datetime",
    },
    {
      key: "type",
      label: "Type",
      render: (val) => val || "General Checkup",
    },
    {
      key: "status",
      label: "Status",
      render: (val, row) => {
        return (
          <Badge
            variant={getAppointmentStatusVariant(val)}
            className="capitalize"
          >
            {getAppointmentDisplayStatus(row)}
          </Badge>
        );
      },
    },
    {
      key: "control_number",
      label: "Control Number",
      render: (val, row) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
          {formatControlNumberDisplay(val, row.scheduled_date)}
        </span>
      ),
    },
  ];

  const tableActions = (row) => (
    <div className="flex items-center gap-1.5">
      <Button
        variant="primary"
        size="sm"
        onClick={() => handleViewAppointment(row)}
        className="gap-1.5"
      >
        View
      </Button>
      {canApproveAppointment(row.status) && (
        <Button
          variant="success"
          size="sm"
          onClick={() => void handleApproveAppointment(row)}
          className="gap-1.5"
          loading={rowAction.id === row.id && rowAction.action === "approve"}
        >
          Approve
        </Button>
      )}
      {canCompleteAppointment(row.status) && (
        <Button
          variant="success"
          size="sm"
          onClick={() => void handleCompleteAppointment(row)}
          className="gap-1.5"
          loading={rowAction.id === row.id && rowAction.action === "complete"}
        >
          Complete
        </Button>
      )}
      {canEditAppointment(row.status) && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleEditAppointment(row)}
          className="gap-1.5"
        >
          Edit
        </Button>
      )}
      {canCancelAppointment(row.status) && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => handleCancelAppointmentClick(row)}
          className="gap-1.5"
        >
          Cancel
        </Button>
      )}
    </div>
  );

  // Handle Cancel Appointment Click
  const handleCancelAppointmentClick = (appointment) => {
    setSelectedAppointment(appointment);
    setCancelReason("");
    setCancelModalError("");
    setShowCancelModal(true);
  };

  const handleApproveAppointment = async (appointment) => {
    try {
      setRowAction({ id: appointment.id, action: "approve" });
      setError(null);
      await apiClient.updateAppointment(appointment.id, { status: "scheduled" });
      await refreshAppointments();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to approve appointment");
      console.error("Error approving appointment:", err);
    } finally {
      setRowAction({ id: null, action: null });
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    try {
      setRowAction({ id: appointment.id, action: "complete" });
      setError(null);
      await apiClient.completeAppointment(appointment.id, "Completed by admin");
      await refreshAppointments();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to complete appointment");
      console.error("Error completing appointment:", err);
    } finally {
      setRowAction({ id: null, action: null });
    }
  };

  // Handle Confirm Cancel Appointment
  const handleConfirmCancelAppointment = async (event) => {
    event.preventDefault();
    if (!selectedAppointment) return;

    setCancelModalError("");

    const normalizedCancelReason = sanitizeText(cancelReason, {
      preserveNewLines: true,
    });
    const cancelReasonLengthError = validateLength(normalizedCancelReason, {
      min: 0,
      max: 500,
      label: "Cancellation reason",
    });
    if (cancelReasonLengthError) {
      setCancelModalError("Cancellation reason must not exceed 500 characters.");
      return;
    }

    // Prevent cancellation if already completed
    if (!canCancelAppointment(selectedAppointment.status)) {
      setCancelModalError(
        "Cannot cancel an appointment that has already been attended",
      );
      return;
    }

    // Prevent cancellation if already cancelled
    if (selectedAppointment.status === "cancelled") {
      setCancelModalError("This appointment is already cancelled");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await apiClient.cancelAppointment(
        selectedAppointment.id,
        normalizedCancelReason,
      );

      // Refresh from API to ensure data consistency
      await refreshAppointments();

      setShowCancelModal(false);
      setCancelReason("");
      setSelectedAppointment(null);
      setCancelModalError("");
    } catch (err) {
      setCancelModalError(err.response?.data?.error || err.message || "Failed to cancel appointment");
      console.error("Error cancelling appointment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle View Appointment
  const handleViewAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setShowViewModal(true);
  };

  // Handle Edit Appointment
  const handleEditAppointment = (appointment) => {
    setSelectedAppointment(appointment);

    // Parse the scheduled_date to get date and time separately
    let dateStr = "";
    let timeStr = "";
    if (appointment.scheduled_date) {
      const dateTime = getClinicDateTimeParts(appointment.scheduled_date);
      dateStr = dateTime?.dateKey || "";
      timeStr = dateTime?.time || "";
    }

    setEditFormData({
      id: appointment.id,
      infant_id: appointment.infant_id || "",
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      type: appointment.type || "",
      notes: appointment.notes || "",
    });
    setShowEditModal(true);
  };

  // Handle Create Appointment
  const handleCreateAppointment = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }
    setCreateFormError("");

    // Validate all required fields
    const newErrors = {};
    const infantRequired = validateRequired(
      createFormData.infant_id,
      "Please select an infant",
    );
    if (infantRequired) {
      newErrors.infant_id = infantRequired;
    }

    const dateRequired = validateRequired(
      createFormData.scheduled_date,
      "Please select a date",
    );
    if (dateRequired) {
      newErrors.scheduled_date = dateRequired;
    }

    const timeRequired = validateRequired(
      createFormData.scheduled_time,
      "Please select a time",
    );
    if (timeRequired) {
      newErrors.scheduled_time = timeRequired;
    }
    const normalizedType = sanitizeText(createFormData.type, { maxLength: 100 });
    const typeLengthError = validateLength(normalizedType, {
      min: 0,
      max: 100,
      label: "Appointment type",
    });
    if (typeLengthError) {
      newErrors.type = "Appointment type must not exceed 100 characters.";
    }

    const normalizedNotes = sanitizeText(createFormData.notes, {
      maxLength: 500,
      preserveNewLines: true,
    });
    const notesLengthError = validateLength(normalizedNotes, {
      min: 0,
      max: 500,
      label: "Additional notes",
    });
    if (notesLengthError) {
      newErrors.notes = "Additional notes must not exceed 500 characters.";
    }

    if (hasFieldErrors(newErrors)) {
      setFormErrors(newErrors);
      return;
    }

    if (timeSlotsFeedback && !timeSlotsFeedback.available) {
      setCreateFormError(timeSlotsFeedback.message || "No available time slots for the selected date.");
      return;
    }

    if (timeSlots.length > 0 && !timeSlots.includes(createFormData.scheduled_time)) {
      setCreateFormError("Selected time is no longer available. Please choose another slot.");
      return;
    }

    const selectedDateDetails = bookingDateDetails;
    if (selectedDateDetails?.availability && !selectedDateDetails.availability.available) {
      setCreateFormError(selectedDateDetails.availability.reason);
      return;
    }

    // Validate date selection with the shared booking rules
    const dateValidation = validateDateSelection(createFormData.scheduled_date, {
      blockedDate: blockedDates[createFormData.scheduled_date] || null,
    });
    if (!dateValidation.valid) {
      setCreateFormError(dateValidation.message);
      return;
    }

    // Find the selected infant
    const selectedInfant = bookingInfantCache.find(
      (infant) =>
        Number.parseInt(infant?.id, 10) ===
        Number.parseInt(createFormData.infant_id, 10),
    );
    if (!selectedInfant) {
      setCreateFormError("Infant not found");
      return;
    }

    if (timeSlotsFeedback && !timeSlotsFeedback.available) {
      setError(timeSlotsFeedback.message || "No available time slots for the selected date.");
      return;
    }

    if (timeSlots.length > 0 && !timeSlots.includes(createFormData.scheduled_time)) {
      setError("Selected time is no longer available. Please choose another slot.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setCreateFormError("");

      // Combine date and time
      const scheduledDateTime = combineClinicDateTime(
        createFormData.scheduled_date,
        createFormData.scheduled_time,
      );

      const appointmentData = {
        infant_id: parseInt(createFormData.infant_id),
        scheduled_date: scheduledDateTime,
        type: normalizedType || "General Checkup",
        notes: normalizedNotes,
      };

      await apiClient.createAppointment(appointmentData);
      // Refresh from API to ensure data consistency
      await refreshAppointments();
      setSelectedDate(createFormData.scheduled_date);
      setShowBookingModal(false);
      setCreateFormData({
        infant_id: "",
        scheduled_date: "",
        scheduled_time: "",
        type: "",
        notes: "",
      });
      setFormErrors({});
    } catch (err) {
      if (err?.status === 409 || err?.code === "DUPLICATE_APPOINTMENT") {
        setCreateFormError(
          err.message ||
            "This child already has an active appointment on the selected date.",
        );
      }
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setFormErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      setCreateFormError(err.response?.data?.error || err.message || "Failed to create appointment");
      console.error("Error creating appointment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Appointment
  const handleUpdateAppointment = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!editFormData.scheduled_date) {
      nextErrors.scheduled_date = "Please select a date.";
    }
    if (!editFormData.scheduled_time) {
      nextErrors.scheduled_time = "Please select a time.";
    }
    const normalizedEditType = sanitizeText(editFormData.type, { maxLength: 100 });
    const editTypeLengthError = validateLength(normalizedEditType, {
      min: 0,
      max: 100,
      label: "Appointment type",
    });
    if (editTypeLengthError) {
      nextErrors.type = "Appointment type must not exceed 100 characters.";
    }

    const normalizedEditNotes = sanitizeText(editFormData.notes, {
      maxLength: 500,
      preserveNewLines: true,
    });
    const editNotesLengthError = validateLength(normalizedEditNotes, {
      min: 0,
      max: 500,
      label: "Additional notes",
    });
    if (editNotesLengthError) {
      nextErrors.notes = "Additional notes must not exceed 500 characters.";
    }

    if (hasFieldErrors(nextErrors)) {
      setEditFormErrors(nextErrors);
      return;
    }

    // Validate date is not weekend or holiday
    const dateValidation = validateDateSelection(editFormData.scheduled_date, {
      blockedDate: blockedDates[editFormData.scheduled_date] || null,
    });
    if (!dateValidation.valid) {
      setEditFormErrors({
        scheduled_date: dateValidation.message,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setEditFormErrors({});

      // Combine date and time
      const scheduledDateTime = combineClinicDateTime(
        editFormData.scheduled_date,
        editFormData.scheduled_time,
      );

      const appointmentData = {
        scheduled_date: scheduledDateTime,
        type: normalizedEditType,
        notes: normalizedEditNotes,
      };

      await apiClient.updateAppointment(
        editFormData.id,
        appointmentData,
      );
      // Refresh from API to ensure data consistency
      await refreshAppointments();
      setSelectedDate(editFormData.scheduled_date);
      setShowEditModal(false);
      setSelectedAppointment(null);
    } catch (err) {
      if (err?.status === 409 || err?.code === "DUPLICATE_APPOINTMENT") {
        setEditFormErrors((prev) => ({
          ...prev,
          scheduled_date:
            err.message ||
            "This child already has an active appointment on the selected date.",
        }));
      }
      const backendFields = err?.response?.data?.fields || {};
      if (Object.keys(backendFields).length > 0) {
        setEditFormErrors((prev) => ({
          ...prev,
          ...backendFields,
        }));
      }
      setError(err.response?.data?.error || err.message || "Failed to update appointment");
      console.error("Error updating appointment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading skeleton only when the hook is actively loading
  const isLoading = loading && !isRefreshing;

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-8" />
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <SkeletonTable rows={10} columns={5} />
      </div>
    );
  }

  // Show error state only when there's a hook error AND no appointments have been loaded
  const hasError =
    view === "list" &&
    hookError &&
    filteredAppointments.length === 0 &&
    !isRefreshing;

  if (hasError) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading appointments">
          {hookError}
          <div className="mt-4">
            <Button onClick={() => window.location.reload()} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-testid="admin-appointments-page">
      {/* Page Header - Fixed/Sticky at top */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Appointments Management"
          subtitle="Schedule, manage, and track vaccination appointments"
          icon={<CalendarDays className="w-8 h-8 text-white" />}
          actions={
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1" role="group" aria-label="View toggle">
                <button
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  aria-label="List view"
                  className={`px-3 py-1 rounded text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    view === "list"
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  📋 List
                </button>
                <button
                  onClick={() => setView("calendar")}
                  aria-pressed={view === "calendar"}
                  aria-label="Calendar view"
                  className={`px-3 py-1 rounded text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    view === "calendar"
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  }`}
                >
                  📅 Calendar
                </button>
              </div>
              <Button
                variant="secondary"
                onClick={() => refreshAppointments()}
                disabled={isRefreshing}
                className="gap-2"
              >
                {isRefreshing ? '⟳' : '↻'} Refresh
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowBookingModal(true)}
                className="gap-2"
              >
                Schedule New Appointment
              </Button>
            </div>
          }
        />
      </div>

      {view === "calendar" ? (
        <div
          className="flex-1 min-h-0 overflow-y-auto modern-scrollbar overflow-x-hidden p-4 pt-3 sm:px-6 sm:pb-6"
          data-testid="admin-appointments-calendar-scroll-region"
        >
        <PageContainer title="Calendar View" className="overflow-visible">
          <div className="space-y-4 pb-4">
          {/* Calendar Header with Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Month Navigation */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1),
                  )
                }
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>

              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1),
                  )
                }
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Today Button */}
            <div className="flex items-center justify-center gap-2 py-3 border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setMonthCursor(today);
                  setSelectedDate(toClinicDateKey(today));
                }}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50 transition-colors"
                aria-label="Go to today"
              >
                Today
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBookingModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                New Appointment
              </Button>
            </div>

            {/* Calendar Grid */}
            {calendarLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading calendar...</p>
              </div>
            ) : (
              <>
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 px-2 sm:px-4 pt-3 sm:pt-4 text-[10px] sm:text-xs font-semibold text-gray-500">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="text-center uppercase tracking-wide py-1">
                      {label}
                    </div>
                  ))}
                </div>

                {/* Calendar Cells */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 p-2 sm:p-4 min-h-[360px] sm:min-h-[420px]">
                  {calendarCells.map((cell) => {
                    const availability = calendarAvailabilityByDate[cell.dateKey] || null;
                    const isBlocked =
                      availability?.isAdminBlocked ??
                      blockedDates[cell.dateKey]?.is_blocked ??
                      false;
                    const isCurrentMonth = cell.isCurrentMonth;
                    const dayAppointments = getAppointmentsForDate(cell.dateKey);
                    const hasAppointments = dayAppointments.length > 0;
                    const isWeekendDay = availability?.isWeekend ?? isWeekend(cell.date);
                    const holiday =
                      availability?.isHoliday
                        ? {
                            name: availability.holidayName || "Holiday",
                            type: "regular",
                          }
                        : isPhilippineHoliday(cell.date);
                    const dateAvailability = resolveDateAvailability(cell.dateKey, {
                      allowPast: true,
                    });
                    const isUnavailableDay =
                      availability?.blocked === true || !dateAvailability.isAvailable;
                    const showAppointmentsInCell = hasAppointments && !isUnavailableDay;

                    // Determine cell styling
                    let cellClass = "relative flex flex-col justify-start items-stretch min-h-[60px] sm:min-h-[70px] p-1.5 sm:p-2 rounded-lg border transition-all ";

                    if (!isCurrentMonth) {
                      // Non-current month days - faded
                      cellClass += "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30 opacity-50 ";
                    } else if (isBlocked) {
                      // Admin blocked date
                      cellClass += "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20 ";
                    } else if (holiday) {
                      // Holiday
                      cellClass += "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 ";
                    } else if (isWeekendDay) {
                      // Weekend - Saturday or Sunday
                      cellClass += "border-gray-300 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 ";
                    } else if (isUnavailableDay) {
                      // Unavailable for other operational reasons
                      cellClass += "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 ";
                    } else {
                      // Regular weekday
                      cellClass += "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:shadow-md ";
                    }

                    if (cell.dateKey === selectedDate) {
                      cellClass += "ring-2 ring-primary-500 ";
                    }

                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => {
                          if (isCurrentMonth) {
                            handleDateCellClick(cell.dateKey);
                          }
                        }}
                        disabled={!isCurrentMonth}
                        className={`${cellClass} ${isCurrentMonth ? "cursor-pointer" : ""}`}
                        aria-label={`${!isCurrentMonth
                          ? "Date from other month"
                          : isUnavailableDay
                            ? "Open unavailable date details for"
                            : "Open date details for"} ${cell.dateKey}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-semibold ${
                              cell.isToday
                                ? "text-primary-600 bg-primary-100 dark:bg-primary-900/30 rounded-full w-6 h-6 flex items-center justify-center"
                                : isCurrentMonth
                                  ? isBlocked
                                    ? "text-red-600 dark:text-red-400"
                                    : isWeekendDay
                                      ? "text-gray-500 dark:text-gray-400"
                                      : "text-gray-800 dark:text-gray-100"
                                  : "text-gray-400 dark:text-gray-600"
                            }`}
                          >
                            {cell.date.getDate()}
                          </span>
                          {isCurrentMonth && (
                            <div className="flex items-center gap-1">
                              {isBlocked && (
                                <span className="w-2 h-2 rounded-full bg-red-500" title="Blocked by Admin" />
                              )}
                              {showAppointmentsInCell && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-600 text-white">
                                  {dayAppointments.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-1 space-y-0.5">
                          {isCurrentMonth && isBlocked && (
                            <p className="text-[9px] sm:text-[10px] font-semibold text-red-600 dark:text-red-400 truncate">
                              Blocked
                            </p>
                          )}
                          {isCurrentMonth && holiday && (
                            <p className="text-[9px] sm:text-[10px] font-semibold text-amber-700 dark:text-amber-300 truncate">
                              {holiday.name}
                            </p>
                          )}
                          {isCurrentMonth && isWeekendDay && !holiday && !isBlocked && (
                            <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                              Weekend
                            </p>
                          )}
                          {isCurrentMonth && isUnavailableDay && !isBlocked && !holiday && !isWeekendDay && (
                            <p className="text-[9px] sm:text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 truncate">
                              Unavailable
                            </p>
                          )}
                          {isCurrentMonth && showAppointmentsInCell && (
                            <div className="space-y-0.5">
                              {dayAppointments.slice(0, 2).map((apt, idx) => (
                                <p key={idx} className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 truncate">
                                  {apt.first_name} {apt.last_name?.charAt(0)}.
                                </p>
                              ))}
                              {dayAppointments.length > 2 && (
                                <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-500">
                                  +{dayAppointments.length - 2} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Calendar Legend */}
          <div className="mt-4 flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-50 border border-red-300 dark:bg-red-900/20 dark:border-red-800"></div>
              <span className="text-gray-600 dark:text-gray-400">Blocked by Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:border-gray-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Weekend (Sat/Sun)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-50 border border-amber-300 dark:bg-amber-900/20 dark:border-amber-800"></div>
              <span className="text-gray-600 dark:text-gray-400">Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700"></div>
              <span className="text-gray-600 dark:text-gray-400">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Has Appointments</span>
            </div>
          </div>

          {/* Selected Date Details */}
          {selectedDate && (
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Appointments for {selectedDateLabel}
              </h4>
              {(() => {
                if (selectedDateDetails?.availability?.available === false) {
                  return (
                    <Alert variant="warning">
                      This date is unavailable for booking. Appointment entries are hidden.
                    </Alert>
                  );
                }
                if ((selectedDateDetails?.appointments || []).length === 0) {
                  return (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No appointments scheduled for this date.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {(selectedDateDetails?.appointments || []).map((apt, idx) => (
                      <div
                        key={`apt-${apt.id}-${idx}`}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {apt.first_name} {apt.last_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatClinicTime(apt.scheduled_date)} - {apt.type || "General Checkup"}
                          </p>
                        </div>
                        <Badge
                          variant={getAppointmentStatusVariant(apt.status)}
                        >
                          {getAppointmentDisplayStatus(apt)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          </div>
        </PageContainer>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden p-4 pt-3 sm:px-6 sm:pb-6">
          {/* Filter Controls */}
          <div className="flex-shrink-0 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* 1. Search Input */}
              <div className="relative flex-shrink-0 w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 2. Status Dropdown */}
              <div className="flex-shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[120px]"
                >
                  <option value="all">All Status</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="pending">Pending</option>
                  <option value="attended">Attended</option>
                  <option value="no_show">No Show</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* 3. Date Range Start */}
              <div className="flex-shrink-0">
                <PortalDatePicker
                  value={dateFilterStart}
                  onChange={(e) => setDateFilterStart(e.target.value)}
                  aria-label="Start date"
                  placeholder="Start date"
                />
              </div>

              {/* 4. Separator Text */}
              <span className="text-gray-500 dark:text-gray-400 text-sm flex-shrink-0">to</span>

              {/* 5. Date Range End */}
              <div className="flex-shrink-0">
                <PortalDatePicker
                  value={dateFilterEnd}
                  onChange={(e) => setDateFilterEnd(e.target.value)}
                  aria-label="End date"
                  placeholder="End date"
                />
              </div>

              {/* 6. Sort Direction Toggle */}
              <button
                onClick={() => {
                  setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                }}
                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 flex-shrink-0"
                aria-label={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>

              {/* 7. Clear Filters Button (optional, when filters are active) */}
              {(searchQuery || statusFilter !== 'all' || dateFilterStart || dateFilterEnd) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setDateFilterStart("");
                    setDateFilterEnd("");
                  }}
                  className="px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex-shrink-0"
                >
                  Clear
                </button>
              )}

              {/* Results Count - Spacer */}
              <div className="flex-1 min-w-[100px]">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {visibleAppointmentEnd} of {totalAppointments}
                </span>
              </div>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <EmptyState
              title="No appointments found"
              description="No appointments match your search criteria. Try adjusting your filters or schedule a new appointment."
              icon="📅"
              actionLabel="Schedule New Appointment"
              onAction={() => setShowBookingModal(true)}
              className="py-20 flex-1"
            />
          ) : (
            <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex-1 overflow-auto auto-hide-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                        >
                          {col.label}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedAppointments.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        {columns.map((col, colIndex) => (
                          <td key={col.key || colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {col.render
                              ? col.render(row[col.key], row)
                              : col.type === "datetime" && row[col.key]
                                ? formatClinicDateTime(row[col.key])
                                : row[col.key]}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {tableActions(row)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800">
                  <div className="text-sm text-gray-500">
                    Showing {visibleAppointmentStart} to {visibleAppointmentEnd} of{" "}
                    {totalAppointments} appointments
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={!listPagination?.hasPrev || listPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {listPage} of {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={!listPagination?.hasNext || listPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Date Details Modal */}
      <Modal
        isOpen={showDateDetailsModal}
        onClose={() => {
          setShowDateDetailsModal(false);
        }}
        title={`Date Details • ${selectedDateLabel}`}
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setShowDateDetailsModal(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowDateDetailsModal(false);
                setShowBookingModal(true);
                if (selectedDate) {
                  setCreateFormData((prev) => ({
                    ...prev,
                    scheduled_date: selectedDate,
                  }));
                }
              }}
              disabled={
                !selectedDate ||
                selectedDateDetails?.availability?.available === false
              }
            >
              Book Appointment
            </Button>
          </AdminModalActions>
        }
      >
        <div className="space-y-4">
          {/* Availability Info */}
          {selectedDate && (() => {
            const holiday = selectedDateDetails?.holiday || isPhilippineHoliday(selectedDate);
            const selectedDateAvailability = selectedDateDetails?.availability || resolveDateAvailability(selectedDate, {
              allowPast: true,
            });
            const isBlocked = selectedDateDetails?.blocked || blockedDates[selectedDate]?.is_blocked;

            if (isBlocked) {
              return (
                <Alert variant="danger">
                  <strong>Blocked by Administrator</strong> - This date has been blocked and appointments cannot be scheduled. Click on the date in the calendar to unblock it.
                </Alert>
              );
            }
            if (!selectedDateAvailability.isAvailable && holiday) {
              return (
                <Alert variant="warning">
                  <strong>{holiday.name}</strong> - This is a Philippine {holiday.type || 'regular'} holiday. Appointments cannot be scheduled on holidays.
                </Alert>
              );
            }
            if (!selectedDateAvailability.isAvailable && selectedDateAvailability.code === "WEEKEND_RESTRICTED") {
              return (
                <Alert variant="warning">
                  This date falls on a weekend (Saturday or Sunday). Appointments are only available on weekdays (Monday-Friday).
                </Alert>
              );
            }
            if (!selectedDateAvailability.isAvailable) {
              return (
                <Alert variant="warning">
                  {selectedDateAvailability.reason || "This date is unavailable for booking."}
                </Alert>
              );
            }
            return (
              <Alert variant="info">
                This date is available for booking appointments.
              </Alert>
            );
          })()}

          {/* Appointment Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Total Appointments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedDateDetails?.summary?.total ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Holiday</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedDateDetails?.holiday?.name || "None"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {(() => {
                  const selectedDateAvailability = selectedDateDetails?.availability || resolveDateAvailability(selectedDate, {
                    allowPast: true,
                  });

                  if (selectedDateDetails?.blocked || blockedDates[selectedDate]?.is_blocked) {
                    return "Blocked by Admin";
                  }

                  if (!selectedDateAvailability.isAvailable && selectedDateDetails?.holiday) {
                    return "Holiday";
                  }

                  if (!selectedDateAvailability.isAvailable && (selectedDateDetails?.isWeekend ?? (selectedDate && isWeekend(selectedDate)))) {
                    return "Weekend (Sat/Sun)";
                  }

                  if (!selectedDateAvailability.isAvailable) {
                    return "Unavailable";
                  }

                  return "Available";
                })()}
              </p>
            </div>
          </div>

          {/* Appointments List */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto modern-scrollbar pr-1">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Appointments for this date:
            </h4>
            {selectedDateDetails?.availability?.available === false ? (
              <Alert variant="warning">
                Appointment entries are hidden for unavailable dates.
              </Alert>
            ) : ((selectedDateDetails?.appointments || []).length === 0 ? (
              <p className="text-sm text-gray-500">No appointments scheduled for this date.</p>
            ) : (
              (selectedDateDetails?.appointments || []).map((appointment, index) => (
                <div
                  key={`appointment-${appointment.id}-${index}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {(appointment.first_name || "Infant") + " " + (appointment.last_name || "")}
                    </p>
                    <Badge
                      variant={getAppointmentStatusVariant(appointment.status)}
                      className="text-[11px]"
                    >
                      {getAppointmentDisplayStatus(appointment)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatClinicTime(appointment.scheduled_date)} - {appointment.type || "General Checkup"}
                  </p>
                </div>
              ))
            ))}
          </div>
        </div>
      </Modal>

      {/* Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setSelectedSlot(null);
          setBookingDateDetails(null);
          setBookingAvailabilityStatus(null);
          setBookingAvailabilityMessage("");
          setCreateFormError("");
          setCreateFormData({
            infant_id: "",
            scheduled_date: "",
            scheduled_time: "",
            type: "",
            notes: "",
          });
          setFormErrors({});
        }}
        title="Schedule New Appointment"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowBookingModal(false);
                setSelectedSlot(null);
                setBookingDateDetails(null);
                setBookingAvailabilityStatus(null);
                setBookingAvailabilityMessage("");
                setCreateFormError("");
                setCreateFormData({
                  infant_id: "",
                  scheduled_date: "",
                  scheduled_time: "",
                  type: "",
                  notes: "",
                });
                setFormErrors({});
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(event) => handleCreateAppointment(event)}
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                !createFormData.infant_id ||
                !createFormData.scheduled_date ||
                !createFormData.scheduled_time ||
                timeSlotsLoading ||
                bookingAvailabilityStatus === "unavailable"
              }
            >
              {isSubmitting ? "Scheduling..." : "Schedule Appointment"}
            </Button>
          </AdminModalActions>
        }
      >
        <div className="admin-form">
          {selectedSlot && (
            <div className="admin-info-card admin-info-card-info">
              <div className="admin-info-card-content">
                <p className="admin-info-card-text flex items-center gap-2">
                  <span>📅</span> Selected Date:{" "}
                  {selectedDateLabel}
                </p>
              </div>
            </div>
          )}

          {/* Patient Selection */}
          <SearchableInfantSelect
            id="appointment-infant-select"
            infants={infants}
            value={createFormData.infant_id}
            onChange={(e) => {
              const infantId = e.target.value;
              const nextSelectedInfant = infants.find(
                (infant) => Number.parseInt(infant?.id, 10) === Number.parseInt(infantId, 10),
              );

              if (nextSelectedInfant) {
                setBookingInfantCache((previous) =>
                  mergeInfantLookupResults(previous, [nextSelectedInfant]),
                );
              }

              setCreateFormData((prev) => ({
                ...prev,
                infant_id: infantId,
              }));
              setFormErrors((prev) => ({ ...prev, infant_id: undefined }));
            }}
            label="Select Infant"
            required
            placeholder="Search by name, control number, or date of birth..."
            disabled={isSubmitting}
            error={
              formErrors.infant_id ||
              (bookingInfantError
                ? "Unable to load infants right now. Please try again."
                : "")
            }
            loading={infantPickerLoading}
            emptyMessage={infantPickerEmptyMessage}
            searchQuery={bookingInfantSearchQuery}
            onSearchQueryChange={setBookingInfantSearchQuery}
            selectedInfant={selectedBookingInfant}
          />

          {/* Auto-resolved Control Number */}
          <div className="admin-field-group">
            <label className="admin-field-label">Infant Control Number</label>
            <Input
              type="text"
              value={getSelectedInfantControlNumber(createFormData.infant_id) || "Auto-populated from infant profile"}
              disabled
              readOnly
              placeholder="Auto-populated from infant profile"
            />
            <p className="text-xs text-gray-500 mt-1">
              This value is automatically loaded from the selected infant record and cannot be edited.
            </p>
          </div>

          {/* Schedule Details */}
          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <label className="admin-field-label required">
                Appointment Date
              </label>
              <Input
                type="date"
                value={createFormData.scheduled_date}
                min={getMinDate()}
                shouldDisableDate={shouldDisableDate}
                onChange={(e) => {
                  setCreateFormData({
                    ...createFormData,
                    scheduled_date: e.target.value,
                  });
                  setFormErrors((prev) => ({
                    ...prev,
                    scheduled_date: undefined,
                  }));
                }}
                error={formErrors.scheduled_date}
                disabled={isSubmitting}
                aria-required="true"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select a weekday (Mon-Fri). Weekends and Philippine holidays are
                not available.
              </p>
            </div>
            <div className="admin-field-group">
              <label className="admin-field-label required">
                Appointment Time (8AM - 4PM)
              </label>
              <Select
                value={createFormData.scheduled_time}
                onChange={(e) => {
                  setCreateFormData({
                    ...createFormData,
                    scheduled_time: e.target.value,
                  });
                  setFormErrors((prev) => ({
                    ...prev,
                    scheduled_time: undefined,
                  }));
                }}
                error={formErrors.scheduled_time}
                disabled={isSubmitting || timeSlotsLoading || (timeSlotsFeedback && !timeSlotsFeedback.available)}
                aria-required="true"
              >
                <option value="">
                  {timeSlotsLoading ? "Loading time slots..." : "Select time"}
                </option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTimeSlotLabel(slot)}
                  </option>
                ))}
              </Select>
              {timeSlotsFeedback && !timeSlotsFeedback.available && !timeSlotsLoading && (
                <p className="text-xs text-red-500 mt-1">{timeSlotsFeedback.message}</p>
              )}
            </div>
          </div>

          {bookingAvailabilityStatus ? (
            <Alert
              variant={
                bookingAvailabilityStatus === "available"
                  ? "success"
                  : bookingAvailabilityStatus === "checking"
                    ? "warning"
                    : "error"
              }
              className="mb-4"
            >
              {bookingAvailabilityMessage}
            </Alert>
          ) : null}

          <div className="admin-field-group">
            <label className="admin-field-label">Appointment Type</label>
            <Select
              value={createFormData.type}
              onChange={(e) => {
                setCreateFormData({
                  ...createFormData,
                  type: e.target.value,
                });
                setFormErrors((prev) => ({ ...prev, type: undefined }));
              }}
              disabled={isSubmitting}
              error={formErrors.type}
            >
              <option value="">Select type...</option>
              <option value="Vaccination">Vaccination</option>
              <option value="Checkup">General Checkup</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Consultation">Consultation</option>
            </Select>
          </div>

          {/* Notes */}
          <div className="admin-field-group">
            <label className="admin-field-label">Additional Notes</label>
            <textarea
              value={createFormData.notes}
              onChange={(e) => {
                setCreateFormData({
                  ...createFormData,
                  notes: e.target.value,
                });
                setFormErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              disabled={isSubmitting}
              rows={3}
              className={`admin-textarea ${formErrors.notes ? "admin-textarea-error" : ""}`}
              placeholder="Additional notes..."
              maxLength={500}
            />
            {formErrors.notes && (
              <span className="admin-field-error">{formErrors.notes}</span>
            )}
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          {createFormError && (
            <Alert variant="error" className="mb-4">
              {createFormError}
            </Alert>
          )}
        </div>
      </Modal>

      {/* View Appointment Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedAppointment(null);
        }}
        title="Appointment Details"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowViewModal(false);
                setSelectedAppointment(null);
              }}
            >
              Close
            </Button>
          </AdminModalActions>
        }
      >
        {selectedAppointment && (
          <div className="space-y-4">
            <div className="admin-form-row-2">
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">
                  Infant Name
                </label>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedAppointment.first_name}{" "}
                  {selectedAppointment.last_name}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">
                  Guardian
                </label>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedAppointment.guardian_name || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">
                  Date & Time
                </label>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedAppointment.scheduled_date
                    ? formatClinicDateTime(selectedAppointment.scheduled_date)
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">
                  Type
                </label>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedAppointment.type || "General Checkup"}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">
                  Status
                </label>
                <Badge
                  variant={getAppointmentStatusVariant(
                    selectedAppointment.status,
                  )}
                  className="capitalize mt-1"
                >
                  {getAppointmentDisplayStatus(selectedAppointment)}
                </Badge>
              </div>
            </div>

          </div>
        )}
      </Modal>

      {/* Edit Appointment Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAppointment(null);
          setEditFormErrors({});
        }}
        title="Edit Appointment"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setSelectedAppointment(null);
                setEditFormErrors({});
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="appointmentEditForm"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update Appointment"}
            </Button>
        </AdminModalActions>
      }
      >
        <form id="appointmentEditForm" className="admin-form" onSubmit={handleUpdateAppointment}>
          {editFormData.scheduled_date && resolveDateAvailability(editFormData.scheduled_date, { allowPast: false }) && !resolveDateAvailability(editFormData.scheduled_date, { allowPast: false }).isAvailable && (
            <Alert variant="warning" className="mb-3">
              {resolveDateAvailability(editFormData.scheduled_date, { allowPast: false }).reason}
            </Alert>
          )}

          {/* Patient Info Card */}
          <div className="admin-form-card admin-form-card-info">
            <div className="admin-form-card-header">
              <h4 className="admin-form-card-title">
                <span>👶</span> Patient Information
              </h4>
            </div>
            <div className="admin-form-row-2">
              <div className="admin-user-info">
                <div className="admin-user-info-details">
                  <p className="admin-user-info-label">Infant</p>
                  <p className="admin-user-info-name">
                    {selectedAppointment?.first_name}{" "}
                    {selectedAppointment?.last_name}
                  </p>
                </div>
              </div>
              <div className="admin-user-info">
                <div className="admin-user-info-details">
                  <p className="admin-user-info-label">Guardian</p>
                  <p className="admin-user-info-name">
                    {selectedAppointment?.guardian_name || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Details */}
          <div className="admin-form-row-2">
            <div className="admin-field-group">
              <label className="admin-field-label required">
                Appointment Date
              </label>
              <Input
                type="date"
                value={editFormData.scheduled_date}
                min={getMinDate()}
                shouldDisableDate={shouldDisableDate}
                onChange={(e) => {
                  setEditFormData({
                    ...editFormData,
                    scheduled_date: e.target.value,
                  });
                  setEditFormErrors((prev) => ({
                    ...prev,
                    scheduled_date: undefined,
                  }));
                }}
                disabled={isSubmitting}
                error={editFormErrors.scheduled_date}
                aria-required="true"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select a weekday (Mon-Fri). Weekends and Philippine holidays are
                not available.
              </p>
            </div>
            <div className="admin-field-group">
              <label className="admin-field-label required">
                Appointment Time (8AM - 4PM)
              </label>
              <Select
                value={editFormData.scheduled_time}
                onChange={(e) => {
                  setEditFormData({
                    ...editFormData,
                    scheduled_time: e.target.value,
                  });
                  setEditFormErrors((prev) => ({
                    ...prev,
                    scheduled_time: undefined,
                  }));
                }}
                disabled={isSubmitting || timeSlotsLoading || (timeSlotsFeedback && !timeSlotsFeedback.available)}
                error={editFormErrors.scheduled_time}
                aria-required="true"
              >
                <option value="">
                  {timeSlotsLoading ? "Loading time slots..." : "Select time"}
                </option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {formatTimeSlotLabel(slot)}
                  </option>
                ))}
              </Select>
              {timeSlotsFeedback && !timeSlotsFeedback.available && !timeSlotsLoading && (
                <p className="text-xs text-red-500 mt-1">{timeSlotsFeedback.message}</p>
              )}
            </div>
          </div>

          <div className="admin-field-group">
            <label className="admin-field-label">Appointment Type</label>
            <Select
              value={editFormData.type}
              onChange={(e) => {
                setEditFormData({ ...editFormData, type: e.target.value });
                setEditFormErrors((prev) => ({ ...prev, type: undefined }));
              }}
              disabled={isSubmitting}
              error={editFormErrors.type}
            >
              <option value="">Select type...</option>
              <option value="Vaccination">Vaccination</option>
              <option value="Checkup">General Checkup</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Consultation">Consultation</option>
            </Select>
          </div>

          {/* Notes */}
          <div className="admin-field-group">
            <label className="admin-field-label">Additional Notes</label>
            <textarea
              value={editFormData.notes}
              onChange={(e) => {
                setEditFormData({ ...editFormData, notes: e.target.value });
                setEditFormErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              disabled={isSubmitting}
              rows={3}
              className={`admin-textarea ${editFormErrors.notes ? "admin-textarea-error" : ""}`}
              placeholder="Additional notes..."
              maxLength={500}
            />
            {editFormErrors.notes && (
              <span className="admin-field-error">{editFormErrors.notes}</span>
            )}
          </div>

          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}
        </form>
      </Modal>

      {/* Cancel Appointment Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason("");
          setSelectedAppointment(null);
          setCancelModalError("");
        }}
        title="Cancel Appointment"
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => {
                setShowCancelModal(false);
                setCancelReason("");
                setSelectedAppointment(null);
                setCancelModalError("");
              }}
              disabled={isSubmitting}
            >
              No, Keep Appointment
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="appointmentCancelForm"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Cancelling..." : "Yes, Cancel Appointment"}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="appointmentCancelForm" className="admin-form" onSubmit={handleConfirmCancelAppointment}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-danger-100 dark:bg-danger-900/30 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Are you sure you want to cancel this appointment?
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            This action cannot be undone. Please provide a reason for
            cancellation.
          </p>
        </div>

        {selectedAppointment && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
            <div className="admin-form-row-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Infant:
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedAppointment.first_name}{" "}
                  {selectedAppointment.last_name}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Date & Time:
                </span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedAppointment.scheduled_date
                    ? formatClinicDateTime(selectedAppointment.scheduled_date)
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="admin-field-group">
          <label className="admin-field-label">Cancellation Reason</label>
            <textarea
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelModalError("");
              }}
              disabled={isSubmitting}
              rows={3}
              className="admin-textarea"
              placeholder="Please provide a reason for cancellation (optional)"
              maxLength={500}
            />
        </div>

        {cancelModalError && (
          <Alert variant="error" className="mt-2">
            {cancelModalError}
          </Alert>
        )}
        </form>
      </Modal>
      {/* Screen reader announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {view === "calendar"
          ? `Calendar view: ${monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
          : `List view showing ${visibleAppointmentEnd} of ${totalAppointments} appointments`
        }
      </div>
    </div>
  );
}
