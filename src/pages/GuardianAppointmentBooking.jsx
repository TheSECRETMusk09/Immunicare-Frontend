/**
 * Guardian Appointment Booking Page
 * Specialized appointment booking form for guardians
 * Displays infant details, appointment date/time, and required documents checklist
 *
 * Features:
 * - Auto-generates/assigns control number when booking
 * - Shows infant complete details centered on screen
 * - Displays exact appointment date and time
 * - Shows required documents checklist to prevent forgetting paperwork
 */

import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import { Button, Input, Select, Alert } from "../components/UI";
import DocumentChecklist from "../components/Guardian/DocumentChecklist";
import {
  Calendar,
  Clock,
  Baby,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Home,
  Syringe,
} from "lucide-react";
import {
  GUARDIAN_INFANT_REGISTERED_EVENT,
  triggerGuardianAddChildModal,
} from "../components/QuickActionFAB";
import { trackEvent } from "../utils/telemetry";
import { isDateAvailableForBooking, getMinBookingDate } from "../utils/holidays";
import {
  combineClinicDateTime,
  formatClinicDateLabel,
  formatClinicTime,
  formatTimeSlotLabel,
  formatInfantDobShort,
} from "../utils/dateUtils";
import { normalizeArrayPayload } from "../utils/apiUtils";

// Get minimum booking date (today)
const getMinDate = () => {
  return getMinBookingDate();
};

// Validate date selection
const validateDateSelection = (dateStr, blockedDates = {}) => {
  if (!dateStr) return { valid: false, message: "Please select a date" };

  const availability = isDateAvailableForBooking(dateStr, { blockedDates });
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

const resolveRecommendedVaccine = (readinessData) =>
  readinessData?.overdueVaccines?.[0] || readinessData?.dueVaccines?.[0] || null;

const normalizeAppointmentSuggestions = (response) => {
  const payload = response?.data || response;

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.suggestions)) {
    return payload.suggestions;
  }

  return [];
};

const getBlockedBookingMessage = (readinessData) => {
  const uniqueReasons = [
    ...new Set(
      (Array.isArray(readinessData?.blockedVaccines) ? readinessData.blockedVaccines : [])
        .map((vaccine) => String(vaccine?.reason || "").trim())
        .filter(Boolean),
    ),
  ];

  if (uniqueReasons.length === 0) {
    return null;
  }

  return `Booking is blocked: ${uniqueReasons.join(", ")}`;
};

const normalizeDatePrefill = (value) => {
  if (!value) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return String(value);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const resolveSuggestedDateValue = (slot) => {
  if (!slot || typeof slot !== "object") {
    return "";
  }

  return normalizeDatePrefill(slot.date || slot.suggestedDate || "");
};

const resolvePatientSexLabel = (patient) => {
  const normalizedSex = String(patient?.sex || patient?.gender || "")
    .trim()
    .toLowerCase();

  if (["m", "male"].includes(normalizedSex)) {
    return "Male";
  }

  if (["f", "female"].includes(normalizedSex)) {
    return "Female";
  }

  return "N/A";
};

const normalizeTimeForSubmit = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const meridiemMatch = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (meridiemMatch) {
    let hours = Number.parseInt(meridiemMatch[1], 10);
    const minutes = Number.parseInt(meridiemMatch[2], 10);
    const meridiem = meridiemMatch[3].toUpperCase();

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 1 || hours > 12 || minutes > 59) {
      return "";
    }

    if (meridiem === "PM" && hours !== 12) {
      hours += 12;
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return "";
  }

  const hours = Number.parseInt(timeMatch[1], 10);
  const minutes = Number.parseInt(timeMatch[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return "";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getBookingErrorMessage = (error) => {
  const status = error?.status || error?.response?.status;
  const message = String(error?.message || "").toLowerCase();
  const serverError = String(error?.response?.data?.error || error?.data?.error || "").toLowerCase();
  const serverErrorMessage =
    error?.response?.data?.error ||
    error?.data?.error ||
    null;
  const serverFieldErrors =
    error?.response?.data?.fields ||
    error?.data?.fields ||
    error?.response?.data?.details ||
    error?.data?.details ||
    null;

  if (status === 400) {
    if (serverError.includes("stock") || serverError.includes("vaccine") || message.includes("stock") || message.includes("vaccine")) {
      return "Your appointment has been submitted but vaccine availability could not be confirmed. The health center will contact you to confirm.";
    }

    if (serverErrorMessage) {
      return serverErrorMessage;
    }

    if (serverFieldErrors && typeof serverFieldErrors === "object") {
      const firstFieldError = Object.values(serverFieldErrors).find((value) => typeof value === "string" && value.trim());
      if (firstFieldError) {
        return firstFieldError;
      }
    }

    return "We couldn't complete your booking. Please check your appointment details and try again.";
  }

  if (status === 403) {
    return "You don't have permission to perform this action. Please contact the health center.";
  }

  if (!error?.response || message.includes("unable to connect") || message.includes("network")) {
    return "Unable to connect to the server. Please check your connection and try again.";
  }

  return error?.response?.data?.error || error?.data?.error || error?.message || "Failed to create appointment";
};

export default function GuardianAppointmentBooking() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("childId") || location.state?.childId || "";
  const prefilledDate = normalizeDatePrefill(
    searchParams.get("date") || location.state?.selectedDate || "",
  );
  const todayDateStr = new Date().toISOString().split('T')[0];

  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [timeSlotsFeedback, setTimeSlotsFeedback] = useState(null);
  const [dateCapacity, setDateCapacity] = useState(null);
  const [blockedDates, setBlockedDates] = useState({});

  // Readiness state for automation
  const [childReadiness, setChildReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [suggestedAppointments, setSuggestedAppointments] = useState([]);
  const [recommendedVaccine, setRecommendedVaccine] = useState(null);

  const [formData, setFormData] = useState({
    infant_id: childId || "",
    vaccine_id: "",
    scheduled_date: prefilledDate && prefilledDate >= todayDateStr ? prefilledDate : todayDateStr,
    scheduled_time: "",
    type: "Vaccination",
    notes: "",
  });
  const [appointmentDocuments, setAppointmentDocuments] = useState({});

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const blockedBookingMessage = getBlockedBookingMessage(childReadiness);
  const bookingClinicId = selectedChild?.clinic_id || selectedChild?.facility_id || null;
  const bookingMonthKey = formData.scheduled_date ? String(formData.scheduled_date).slice(0, 7) : "";
  const clearBookingError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch children for this guardian
  const fetchChildren = useCallback(async () => {
    if (!guardianId) return;

    try {
      const data = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = normalizeArrayPayload(data, ["infants", "children", "patients"]);
      setChildren(childrenData);
      setSelectedChild((currentSelectedChild) => {
        const normalizedChildId = childId ? parseInt(childId, 10) : null;
        const currentSelectedId = currentSelectedChild?.id
          ? Number.parseInt(currentSelectedChild.id, 10)
          : null;
        const lookupId = normalizedChildId || currentSelectedId;

        if (!lookupId) {
          return currentSelectedChild;
        }

        return (
          childrenData.find((child) => Number.parseInt(child.id, 10) === lookupId) ||
          currentSelectedChild
        );
      });
    } catch (err) {
      console.error("Error fetching children:", err);
      setError("Failed to load children data");
    } finally {
      setLoading(false);
    }
  }, [guardianId, childId]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    const handleInfantRegistered = async () => {
      await fetchChildren();
    };

    window.addEventListener(
      GUARDIAN_INFANT_REGISTERED_EVENT,
      handleInfantRegistered,
    );

    return () => {
      window.removeEventListener(
        GUARDIAN_INFANT_REGISTERED_EVENT,
        handleInfantRegistered,
      );
    };
  }, [fetchChildren]);

  const fetchTimeSlots = useCallback(async () => {
    if (!guardianId || !formData.scheduled_date || !formData.vaccine_id) {
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      return;
    }

    const dateAvailability = isDateAvailableForBooking(formData.scheduled_date, {
      blockedDates,
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
      setFormData((previous) => ({ ...previous, scheduled_time: "" }));
      return;
    }

    setTimeSlotsLoading(true);
    setTimeSlotsFeedback(null);

    try {
      const result = await apiClient.getAppointmentTimeSlots({
        scheduled_date: formData.scheduled_date,
        vaccine_id: formData.vaccine_id,
        clinic_id: selectedChild?.clinic_id || selectedChild?.facility_id || undefined,
      });

      const slots = Array.isArray(result?.slots) ? result.slots : [];
      setTimeSlots(slots);
      setTimeSlotsFeedback(result || null);

      setFormData((previous) => {
        if (!previous.scheduled_time) return previous;
        const previousTime = normalizeTimeForSubmit(previous.scheduled_time);
        const normalizedSlots = slots.map((slot) => normalizeTimeForSubmit(slot)).filter(Boolean);
        if (previousTime && normalizedSlots.includes(previousTime)) return previous;
        return { ...previous, scheduled_time: "" };
      });
    } catch (slotError) {
      setTimeSlots([]);
      setTimeSlotsFeedback({
        available: false,
        message: slotError?.message || "Failed to load time slots.",
      });
      setFormData((previous) => ({ ...previous, scheduled_time: "" }));
    } finally {
      setTimeSlotsLoading(false);
    }
  }, [
    guardianId,
    formData.scheduled_date,
    formData.vaccine_id,
    selectedChild?.clinic_id,
    selectedChild?.facility_id,
    blockedDates,
  ]);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  useEffect(() => {
    setDateCapacity(null);
    if (!formData.scheduled_date) return;
    apiClient
      .getAppointmentDailyCapacity({ date: formData.scheduled_date })
      .then((result) => setDateCapacity(result || null))
      .catch(() => setDateCapacity(null));
  }, [formData.scheduled_date]);

  // Fetch child readiness when a child is selected
  const fetchChildReadiness = useCallback(async (infantId, scheduledDate = null) => {
    if (!infantId) return;

    setReadinessLoading(true);
    try {
      const result = await apiClient.getVaccinationReadiness(infantId, {
        scheduled_date: scheduledDate || undefined,
      });
      if (result?.success && result?.data) {
        const readinessData = result.data;
        const nextRecommendedVaccine = resolveRecommendedVaccine(readinessData);

        setChildReadiness(readinessData);
        setRecommendedVaccine(nextRecommendedVaccine);
        setFormData((prev) => {
          const recommendedVaccineId = nextRecommendedVaccine?.vaccineId
            ? String(nextRecommendedVaccine.vaccineId)
            : "";
          const nextVaccineId = prev.vaccine_id || recommendedVaccineId;
          const today = new Date().toISOString().split('T')[0];
          const clampToToday = (d) => (d && d >= today ? d : today);
          const nextScheduledDate =
            prev.scheduled_date ||
            clampToToday(normalizeDatePrefill(readinessData?.nextAppointmentPrediction?.date)) ||
            clampToToday(normalizeDatePrefill(nextRecommendedVaccine?.earliestDate)) ||
            today;

          return {
            ...prev,
            vaccine_id: nextVaccineId,
            scheduled_date: nextScheduledDate,
            scheduled_time: nextScheduledDate !== prev.scheduled_date ? "" : prev.scheduled_time,
            type: "Vaccination",
          };
        });
      } else {
        setChildReadiness(null);
        setRecommendedVaccine(null);
      }
    } catch (err) {
      console.error("Error fetching readiness:", err);
      setChildReadiness(null);
      setRecommendedVaccine(null);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  // Fetch suggested appointments based on readiness
  const fetchSuggestedAppointments = useCallback(async (infantId, clinicId = null) => {
    if (!infantId) return;

    try {
      const result = await apiClient.getAppointmentSuggestions({
        infantId,
        guardianId,
        clinicId,
      });
      setSuggestedAppointments(normalizeAppointmentSuggestions(result));
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestedAppointments([]);
    }
  }, [guardianId]);

  useEffect(() => {
    if (!selectedChild?.id) {
      return;
    }

    fetchChildReadiness(selectedChild.id, formData.scheduled_date || null);
  }, [
    fetchChildReadiness,
    formData.scheduled_date,
    selectedChild?.id,
  ]);

  useEffect(() => {
    if (!selectedChild?.id) {
      return;
    }

    fetchSuggestedAppointments(
      selectedChild.id,
      selectedChild?.clinic_id || selectedChild?.facility_id || null,
    );
  }, [
    fetchSuggestedAppointments,
    selectedChild?.clinic_id,
    selectedChild?.facility_id,
    selectedChild?.id,
  ]);

  useEffect(() => {
    if (!bookingMonthKey || !bookingClinicId) {
      setBlockedDates({});
      return;
    }

    const abortController = new AbortController();
    let active = true;

    const fetchBlockedDates = async () => {
      try {
        const result = await apiClient.getBlockedDates(
          {
            month: bookingMonthKey,
            clinic_id: bookingClinicId,
          },
          { signal: abortController.signal },
        );

        if (!active) {
          return;
        }

        setBlockedDates(result?.blockedDates || {});
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
          return;
        }

        console.warn("Blocked dates unavailable; continuing with empty blocked-date list:", err);
        if (active) {
          setBlockedDates({});
        }
      }
    };

    fetchBlockedDates();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [bookingClinicId, bookingMonthKey]);

  // Handle child selection
  const handleChildSelect = (infantId) => {
    const child = children.find((c) => c.id === parseInt(infantId));
    clearBookingError();
    setSelectedChild(child);
    setFormData((prev) => ({
      ...prev,
      infant_id: infantId,
      vaccine_id: "",
      scheduled_date: prev.scheduled_date || prefilledDate || "",
      scheduled_time: "",
      type: "Vaccination",
    }));
    // Clear error when user selects a child
    if (errors.infant_id) {
      setErrors((prev) => ({ ...prev, infant_id: null }));
    }
    // Clear previous readiness and suggestions
    setChildReadiness(null);
    setSuggestedAppointments([]);
    setRecommendedVaccine(null);
  };

  // Handle form field blur for real-time validation
  const handleBlur = (fieldName) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    validateField(fieldName);
  };

  // Validate individual field
  const validateField = (fieldName) => {
    let error = null;
    if (fieldName === "infant_id") {
      if (!formData.infant_id) error = "Please select a child";
    } else if (fieldName === "scheduled_date") {
      if (!formData.scheduled_date) error = "Please select a date";
      else {
        const dateValidation = validateDateSelection(formData.scheduled_date, blockedDates);
        if (!dateValidation.valid) error = dateValidation.message;
      }
    } else if (fieldName === "scheduled_time") {
      if (!formData.scheduled_time) error = "Please select a time";
    }
    if (error) {
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
    } else {
      setErrors((prev) => ({ ...prev, [fieldName]: null }));
    }
    return error;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate all required fields
    let hasErrors = false;
    const fieldsToValidate = ["infant_id", "scheduled_date", "scheduled_time"];
    const newErrors = {};

    fieldsToValidate.forEach((field) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field);
      if (error) {
        newErrors[field] = error;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    if (timeSlotsFeedback && !timeSlotsFeedback.available) {
      setError(timeSlotsFeedback.message || "No available time slots for the selected date.");
      return;
    }

    const normalizedScheduledTime = normalizeTimeForSubmit(formData.scheduled_time);
    const normalizedAvailableSlots = timeSlots
      .map((slot) => normalizeTimeForSubmit(slot))
      .filter(Boolean);

    if (!normalizedScheduledTime) {
      setError("Please select a valid appointment time.");
      return;
    }

    if (timeSlots.length > 0 && !normalizedAvailableSlots.includes(normalizedScheduledTime)) {
      setError("Selected time is no longer available. Please choose another slot.");
      return;
    }

    if (!formData.vaccine_id) {
      setError("No due vaccine is currently selected for this child.");
      return;
    }

    setError(null);
    setErrors({});
    setSubmitting(true);

    try {
      const hasPendingDocumentUploads = Object.values(appointmentDocuments).some(
        (fileData) => fileData?.persisting,
      );
      if (hasPendingDocumentUploads) {
        setError("Please wait for document uploads to finish before booking the appointment.");
        return;
      }

      const scheduledDateTime = combineClinicDateTime(formData.scheduled_date, normalizedScheduledTime);
      if (!scheduledDateTime) {
        setError("Please select a valid appointment date and time.");
        setSubmitting(false);
        return;
      }

      const parsedInfantId = Number.parseInt(formData.infant_id, 10);
      if (!Number.isInteger(parsedInfantId) || parsedInfantId <= 0) {
        setErrors((prev) => ({
          ...prev,
          infant_id: "Please select a valid child.",
        }));
        setError("Please select a valid child before booking.");
        return;
      }

      const parsedVaccineId = Number.parseInt(formData.vaccine_id, 10);
      if (!Number.isInteger(parsedVaccineId) || parsedVaccineId <= 0) {
        setErrors((prev) => ({
          ...prev,
          vaccine_id: "Please select a valid vaccine.",
        }));
        setError("Please select a valid due vaccine before booking.");
        return;
      }

      const parsedClinicId = bookingClinicId ? Number.parseInt(bookingClinicId, 10) : null;
      if (bookingClinicId && (!Number.isInteger(parsedClinicId) || parsedClinicId <= 0)) {
        setError("Unable to resolve clinic information for this child. Please refresh and try again.");
        return;
      }

      const appointmentData = {
        infant_id: parsedInfantId,
        vaccine_id: parsedVaccineId,
        scheduled_date: scheduledDateTime,
        type: formData.type,
        notes: formData.notes,
        clinic_id: parsedClinicId || undefined,
        // Control number is resolved from selected infant on backend
        control_number: selectedChild?.control_number || null,
      };

      console.debug("[GuardianAppointmentBooking] createAppointment payload:", appointmentData);

      // Appointment documents are uploaded immediately by DocumentChecklist, so
      // appointment creation stays JSON-only for consistent backend parsing.
      const newAppointment = await apiClient.createAppointment(appointmentData);
      const createdAppointmentPayload = newAppointment?.data || newAppointment;
      setCreatedAppointment(createdAppointmentPayload);
      setSuccess(true);

      trackEvent("appointment_booked", {
        appointmentType: formData.type,
        hasControlNumber: !!selectedChild?.control_number
      });

      // Dispatch synchronization event to update charts and components
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("appointment-update", {
            detail: { infant_id: appointmentData.infant_id },
          })
        );
      }

      // Send SMS confirmation (backend should handle this)
    } catch (err) {
      console.error("Error creating appointment:", err);
      const validationFields = err?.data?.fields || err?.response?.data?.fields || err?.data?.details || err?.response?.data?.details;
      if (validationFields && typeof validationFields === "object") {
        setErrors((prev) => ({
          ...prev,
          ...validationFields,
        }));
      }
      setError(getBookingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Success state - show confirmation
  if (success && createdAppointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto">
          {/* Success Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                Appointment Booked!
              </h2>
              <p className="text-emerald-100 mt-2">
                Your appointment has been scheduled successfully
              </p>
            </div>

            {/* Appointment Details */}
            <div className="p-6 space-y-6">
              {(createdAppointment.stock_warning || createdAppointment.stockWarning) && (
                <Alert variant="warning">
                  {createdAppointment.stock_warning || createdAppointment.stockWarning}
                </Alert>
              )}

              {/* Child Info */}
              {selectedChild && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Baby className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Patient Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Name</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedChild.first_name} {selectedChild.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Infant Control Number
                      </p>
                      <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {selectedChild.control_number ||
                          createdAppointment.control_number ||
                          "Auto-assigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Date of Birth
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatInfantDobShort(selectedChild.dob)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Sex</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {resolvePatientSexLabel(selectedChild)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Appointment Date & Time */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300">
                    Appointment Schedule
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatClinicDateLabel(createdAppointment.scheduled_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatClinicTime(createdAppointment.scheduled_date)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                    <Syringe className="w-4 h-4" />
                    {createdAppointment.type || "Vaccination"}
                  </span>
                </div>
              </div>

              {/* Document Checklist */}
              <DocumentChecklist
                onFilesChange={setAppointmentDocuments}
                infantId={formData.infant_id || null}
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={() => navigate("/guardian/dashboard")}
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/guardian/appointments")}
                  className="flex-1"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View Appointments
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main booking form
  return (
    <div className="guardian-page-wrapper min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 guardian-module-mobile-header-spacing">
      <div className="guardian-page-content guardian-appointment-booking-mobile-ui">
      {/* Back Button */}
      <div className="mb-3 sm:mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors break-words"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
      </div>

      <div>
        <GuardianModuleHeader
          title="Book Appointment"
          subtitle="Schedule a vaccination appointment for your child"
          icon={<Calendar className="w-8 h-8 text-white" />}
          className="guardian-appointment-booking-header mb-4 lg:mb-3"
        />

        {/* Error Alert */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="guardian-form space-y-6 lg:space-y-4">
          {/* Main Content Grid */}
          <div className="guardian-cards-grid grid grid-cols-1 min-[768px]:grid-cols-2 gap-4 sm:gap-5 lg:gap-5">
            {/* Left Column - Form */}
            <div className="space-y-6 lg:space-y-4">
              {/* Child Selection Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 break-words">
                  <Baby className="w-5 h-5 text-emerald-500" />
                  Select Child
                </h3>

                {children.length === 0 ? (
                  <div className="text-center py-8">
                    <Baby className="w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No children registered
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        navigate('/guardian/children');
                        setTimeout(() => {
                          triggerGuardianAddChildModal();
                        }, 0);
                      }}
                      size="sm"
                    >
                      Add Child
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => handleChildSelect(child.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          selectedChild?.id === child.id
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-emerald-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
                            <Baby className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {child.first_name} {child.last_name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
                              DOB: {formatInfantDobShort(child.dob)}
                              {child.control_number && (
                                <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                  • Infant Control Number: {child.control_number}
                                </span>
                              )}
                            </p>
                          </div>
                          {selectedChild?.id === child.id && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Readiness Status Display */}
                {selectedChild && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {readinessLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 mr-2"></div>
                        <span className="text-gray-500 dark:text-gray-400">Checking eligibility...</span>
                      </div>
                    ) : childReadiness ? (
                      <div className="space-y-3">
                        {/* Readiness Badge */}
                        <div className={`flex items-center justify-between p-3 rounded-lg ${
                          childReadiness.readinessStatus === 'READY'
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : childReadiness.readinessStatus === 'OVERDUE'
                              ? 'bg-red-50 dark:bg-red-900/20'
                              : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                                : 'bg-blue-50 dark:bg-blue-900/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            {childReadiness.readinessStatus === 'READY' ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : childReadiness.readinessStatus === 'OVERDUE' ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <Calendar className="w-5 h-5 text-blue-600" />
                            )}
                            <span className={`font-medium ${
                              childReadiness.readinessStatus === 'READY'
                                ? 'text-green-700 dark:text-green-400'
                                : childReadiness.readinessStatus === 'OVERDUE'
                                  ? 'text-red-700 dark:text-red-400'
                                  : childReadiness.readinessStatus === 'PENDING_CONFIRMATION'
                                    ? 'text-yellow-700 dark:text-yellow-400'
                                    : 'text-blue-700 dark:text-blue-400'
                            }`}>
                              Status: {childReadiness.readinessStatus === 'READY' ? 'Ready for Vaccination' :
                                       childReadiness.readinessStatus === 'OVERDUE' ? 'Overdue' :
                                       childReadiness.readinessStatus === 'PENDING_CONFIRMATION' ? 'Pending' : 'Upcoming'}
                            </span>
                          </div>
                        </div>

                        {/* Due Vaccines */}
                        {childReadiness.dueVaccines && childReadiness.dueVaccines.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                              Due Vaccines:
                            </p>
                            <div className="space-y-1">
                              {childReadiness.dueVaccines.map((vaccine, idx) => (
                                <div key={idx} className="text-sm text-amber-700 dark:text-amber-400 flex justify-between">
                                  <span>{vaccine.label}</span>
                                  <span>{vaccine.earliestDate ? `Eligible: ${new Date(vaccine.earliestDate).toLocaleDateString()}` : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Overdue Vaccines */}
                        {childReadiness.overdueVaccines && childReadiness.overdueVaccines.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                              Overdue Vaccines:
                            </p>
                            <div className="space-y-1">
                              {childReadiness.overdueVaccines.map((vaccine, idx) => (
                                <div key={idx} className="text-sm text-red-700 dark:text-red-400">
                                  {vaccine.label}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Next Appointment Prediction */}
                        {childReadiness.nextAppointmentPrediction && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                              Recommended Appointment:
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                              {childReadiness.nextAppointmentPrediction.date
                                ? new Date(childReadiness.nextAppointmentPrediction.date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })
                                : 'No prediction available'}
                            </p>
                            {childReadiness.nextAppointmentPrediction.reason && (
                              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                                {childReadiness.nextAppointmentPrediction.reason}
                              </p>
                            )}
                          </div>
                        )}

                        {recommendedVaccine && (
                          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                              Recommended Vaccine:
                            </p>
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">
                              {recommendedVaccine.label}
                            </p>
                            {recommendedVaccine.earliestDate && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                                Earliest eligible date: {new Date(recommendedVaccine.earliestDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                        Unable to load eligibility status
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule Details Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 break-words">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Appointment Schedule
                </h3>

                <div className="space-y-4">
                  <div className="guardian-form-row guardian-form-row-booking-mobile">
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Appointment Date <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="date"
                        value={formData.scheduled_date}
                        min={getMinDate()}
                        shouldDisableDate={(date) =>
                          !isDateAvailableForBooking(date, { blockedDates }).isAvailable
                        }
                        onChange={(e) => {
                          clearBookingError();
                          setFormData((prev) => ({
                            ...prev,
                            scheduled_date: e.target.value,
                            scheduled_time: "",
                          }));
                        }}
                        onBlur={() => handleBlur("scheduled_date")}
                        error={touched.scheduled_date ? errors.scheduled_date : undefined}
                        className="w-full guardian-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Weekdays only (Mon-Fri). Holidays and blocked dates are not available.
                      </p>
                    </div>

                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Appointment Time (8AM - 4PM) <span className="text-red-500">*</span>
                      </label>
                      {!timeSlotsLoading && timeSlotsFeedback && !timeSlotsFeedback.available && (
                        <Alert variant="warning" className="mt-2">
                          {timeSlotsFeedback.message}
                        </Alert>
                      )}
                      {dateCapacity && (
                        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Daily Slot Availability
                            </span>
                            <span className={`text-[11px] font-bold ${
                              dateCapacity.remaining === 0
                                ? 'text-red-600 dark:text-red-400'
                                : dateCapacity.remaining <= 50
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-green-600 dark:text-green-400'
                            }`}>
                              {dateCapacity.remaining} available
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, (dateCapacity.current / dateCapacity.maximum) * 100)}%`,
                                backgroundColor:
                                  dateCapacity.remaining === 0
                                    ? '#ef4444'
                                    : dateCapacity.remaining <= 50
                                      ? '#f59e0b'
                                      : '#22c55e',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Appointment Type
                    </label>
                    <Select
                      value={formData.type}
                      onChange={(e) => {
                        clearBookingError();
                        setFormData((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }));
                      }}
                      className="w-full guardian-input"
                    >
                      <option value="Vaccination">Vaccination</option>
                      <option value="Checkup">General Checkup</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Consultation">Consultation</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => {
                        clearBookingError();
                        setFormData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }));
                      }}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent guardian-input"
                      placeholder="Any special notes or concerns..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary & Checklist */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {/* Selected Child Details */}
              {selectedChild && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2 break-words">
                      <Baby className="w-5 h-5" />
                      Patient Details
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Name
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedChild.first_name} {selectedChild.last_name}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Date of Birth
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatInfantDobShort(selectedChild.dob)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sex
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {resolvePatientSexLabel(selectedChild)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Infant Control Number
                      </span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {selectedChild.control_number || "Auto-assigned"}
                      </span>
                    </div>
                    {selectedChild.health_center && (
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Health Center
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedChild.health_center}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Appointment Summary Preview */}
              {formData.scheduled_date && formData.scheduled_time && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3">
                    <h3 className="font-bold text-white flex items-center gap-2 break-words">
                      <Clock className="w-5 h-5" />
                      Appointment Summary
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Date
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatClinicDateLabel(formData.scheduled_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Time
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatTimeSlotLabel(formData.scheduled_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Syringe className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Type
                        </p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formData.type}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Checklist */}
              <DocumentChecklist
                onFilesChange={setAppointmentDocuments}
                infantId={formData.infant_id || null}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div
            className="guardian-form-actions guardian-form-actions--guardian-order guardian-form-actions--booking-page pt-4"
            data-testid="guardian-booking-page-form-actions"
          >
            {selectedChild && childReadiness && childReadiness.readinessStatus !== 'READY' && (
              <Alert variant="warning" className="mb-4">
                <AlertCircle className="w-5 h-5 mr-2" />
                {childReadiness.readinessStatus === 'OVERDUE'
                  ? 'This child has overdue vaccines. Please schedule an appointment as soon as possible.'
                  : blockedBookingMessage
                    ? blockedBookingMessage
                    : 'This child is not yet eligible for vaccination. Please check the recommended appointment date.'}
              </Alert>
            )}

            {/* Suggested Appointments */}
            {suggestedAppointments.length > 0 && selectedChild && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  Recommended Slots
                </h4>
                <div className="space-y-2">
                  {suggestedAppointments.slice(0, 3).map((slot, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        clearBookingError();
                        const suggestedDate = resolveSuggestedDateValue(slot);
                        const suggestedTime = normalizeTimeForSubmit(slot.time || slot.suggestedTime || "");
                        setFormData(prev => ({
                          ...prev,
                          vaccine_id: slot.vaccineId ? String(slot.vaccineId) : prev.vaccine_id,
                          scheduled_date: suggestedDate || prev.scheduled_date,
                          scheduled_time: suggestedTime || ""
                        }));
                      }}
                      className="w-full text-left p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-emerald-700 dark:text-emerald-400">
                            {slot.vaccine || "Suggested vaccine"}
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {slot.date
                              ? new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                              : slot.suggestedDate
                                ? new Date(slot.suggestedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                                : 'Available'}
                          </p>
                          {slot.reason && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{slot.reason}</p>
                          )}
                        </div>
                        {slot.time && (
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            {slot.time}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              actionRole="primary"
              loading={submitting}
              disabled={
                !selectedChild ||
                !formData.vaccine_id ||
                !formData.scheduled_date ||
                !isDateAvailableForBooking(formData.scheduled_date, { blockedDates }).isAvailable ||
                !formData.scheduled_time ||
                (childReadiness && childReadiness.readinessStatus === 'PENDING_CONFIRMATION')
              }
              className="guardian-btn guardian-form-actions__primary ui-form-action-btn ui-form-action-btn--primary"
              data-testid="guardian-booking-page-submit-btn"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Appointment
            </Button>
            <Button
              type="button"
              variant="secondary"
              actionRole="cancel"
              onClick={() => navigate(-1)}
              className="guardian-btn guardian-form-actions__secondary ui-form-action-btn ui-form-action-btn--secondary"
              data-testid="guardian-booking-page-cancel-btn"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
