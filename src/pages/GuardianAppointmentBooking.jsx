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
import { useNavigate, useSearchParams } from "react-router-dom";
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

// Get minimum booking date (today)
const getMinDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const formatTimeSlotLabel = (value) => {
  if (!value) return "";
  const parsed = new Date(`2000-01-01T${value}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Philippine holiday check
const isPhilippineHoliday = (dateStr) => {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Regular holidays
  const regularHolidays = [
    { month: 1, day: 1, name: "New Year's Day" },
    { month: 4, day: 9, name: "Araw ng Kagitingan" },
    { month: 5, day: 1, name: "Labor Day" },
    { month: 6, day: 12, name: "Independence Day" },
    { month: 8, day: 21, name: "Ninoy Aquino Day" },
    { month: 8, day: 31, name: "National Heroes Day" },
    { month: 11, day: 1, name: "All Saints Day" },
    { month: 11, day: 30, name: "Bonifacio Day" },
    { month: 12, day: 8, name: "Feast of the Immaculate Conception" },
    { month: 12, day: 24, name: "Christmas Eve" },
    { month: 12, day: 25, name: "Christmas Day" },
    { month: 12, day: 30, name: "Rizal Day" },
    { month: 12, day: 31, name: "New Year's Eve" },
  ];

  for (const holiday of regularHolidays) {
    if (holiday.month === month && holiday.day === day) {
      return { name: holiday.name, type: "regular" };
    }
  }

  return null;
};

// Validate date selection
const validateDateSelection = (dateStr) => {
  if (!dateStr) return { valid: false, message: "Please select a date" };

  const selectedDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return {
      valid: false,
      message: "Cannot schedule appointments in the past",
    };
  }

  const day = selectedDate.getDay();
  if (day === 6)
    return { valid: false, message: "Saturdays are not available" };
  if (day === 0) return { valid: false, message: "Sundays are not available" };

  const holiday = isPhilippineHoliday(dateStr);
  if (holiday) {
    return { valid: false, message: `${holiday.name} - Not available` };
  }

  return { valid: true, message: "Date is available" };
};

export default function GuardianAppointmentBooking() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("childId");

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

  // Readiness state for automation
  const [childReadiness, setChildReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [suggestedAppointments, setSuggestedAppointments] = useState([]);

  const [formData, setFormData] = useState({
    infant_id: childId || "",
    scheduled_date: "",
    scheduled_time: "",
    type: "Vaccination",
    notes: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Fetch children for this guardian
  const fetchChildren = useCallback(async () => {
    if (!guardianId) return;

    try {
      const data = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = Array.isArray(data) ? data : data?.data || [];
      setChildren(childrenData);

      // Pre-select child if passed in URL
      if (childId) {
        const preselected = childrenData.find(
          (c) => c.id === parseInt(childId),
        );
        if (preselected) {
          setSelectedChild(preselected);
        }
      }
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
    if (!guardianId || !formData.scheduled_date) {
      setTimeSlots([]);
      setTimeSlotsFeedback(null);
      return;
    }

    setTimeSlotsLoading(true);
    setTimeSlotsFeedback(null);

    try {
      const result = await apiClient.getAppointmentTimeSlots({
        scheduled_date: formData.scheduled_date,
      });

      const slots = Array.isArray(result?.slots) ? result.slots : [];
      setTimeSlots(slots);
      setTimeSlotsFeedback(result || null);

      setFormData((previous) => {
        if (!previous.scheduled_time) return previous;
        if (slots.includes(previous.scheduled_time)) return previous;
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
  }, [guardianId, formData.scheduled_date]);

  useEffect(() => {
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  // Fetch child readiness when a child is selected
  const fetchChildReadiness = useCallback(async (infantId) => {
    if (!infantId) return;

    setReadinessLoading(true);
    try {
      const result = await apiClient.getVaccinationReadiness(infantId);
      if (result?.success && result?.data) {
        setChildReadiness(result.data);
      } else {
        setChildReadiness(null);
      }
    } catch (err) {
      console.error("Error fetching readiness:", err);
      setChildReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  // Fetch suggested appointments based on readiness
  const fetchSuggestedAppointments = useCallback(async (infantId) => {
    if (!infantId) return;

    try {
      // Use the appointment suggestion endpoint
      const result = await apiClient.getAppointmentSuggestions(infantId);
      if (result?.success && Array.isArray(result?.data)) {
        setSuggestedAppointments(result.data);
      } else {
        setSuggestedAppointments([]);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setSuggestedAppointments([]);
    }
  }, []);

  // Handle child selection
  const handleChildSelect = (infantId) => {
    const child = children.find((c) => c.id === parseInt(infantId));
    setSelectedChild(child);
    setFormData((prev) => ({ ...prev, infant_id: infantId }));
    // Clear error when user selects a child
    if (errors.infant_id) {
      setErrors((prev) => ({ ...prev, infant_id: null }));
    }
    // Clear previous readiness and suggestions
    setChildReadiness(null);
    setSuggestedAppointments([]);
    // Fetch readiness and suggestions for the selected child
    fetchChildReadiness(infantId);
    fetchSuggestedAppointments(infantId);
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
        const dateValidation = validateDateSelection(formData.scheduled_date);
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

    if (timeSlots.length > 0 && !timeSlots.includes(formData.scheduled_time)) {
      setError("Selected time is no longer available. Please choose another slot.");
      return;
    }

    setError(null);
    setErrors({});
    setSubmitting(true);

    try {
      const scheduledDateTime = `${formData.scheduled_date}T${formData.scheduled_time}:00`;

      const appointmentData = {
        infant_id: parseInt(formData.infant_id),
        scheduled_date: scheduledDateTime,
        type: formData.type,
        notes: formData.notes,
        // Control number is resolved from selected infant on backend
        control_number: selectedChild?.control_number || null,
      };

      const newAppointment = await apiClient.createAppointment(appointmentData);
      setCreatedAppointment(newAppointment);
      setSuccess(true);

      // Send SMS confirmation (backend should handle this)
    } catch (err) {
      console.error("Error creating appointment:", err);
      setError(err.message || "Failed to create appointment");
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
              {/* Child Info */}
              {selectedChild && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Baby className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Patient Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
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
                        {new Date(selectedChild.dob).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Sex</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedChild.sex === "M"
                          ? "Male"
                          : selectedChild.sex === "F"
                            ? "Female"
                            : "N/A"}
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
                      {new Date(
                        createdAppointment.scheduled_date,
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {new Date(
                        createdAppointment.scheduled_date,
                      ).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
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
              <DocumentChecklist />

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
          className="guardian-appointment-booking-header"
        />

        {/* Error Alert */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="guardian-form space-y-6">
          {/* Main Content Grid */}
          <div className="guardian-cards-grid grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
            {/* Left Column - Form */}
            <div className="space-y-6">
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
                              DOB: {new Date(child.dob).toLocaleDateString()}
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
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            scheduled_date: e.target.value,
                            scheduled_time: "",
                          }))
                        }
                        onBlur={() => handleBlur("scheduled_date")}
                        error={touched.scheduled_date ? errors.scheduled_date : undefined}
                        className="w-full guardian-input"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Weekdays only (Mon-Fri). Holidays not available.
                      </p>
                    </div>

                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Appointment Time (8AM - 4PM) <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={formData.scheduled_time}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            scheduled_time: e.target.value,
                          }))
                        }
                        onBlur={() => handleBlur("scheduled_time")}
                        error={touched.scheduled_time ? errors.scheduled_time : undefined}
                        disabled={
                          !formData.scheduled_date ||
                          timeSlotsLoading ||
                          (timeSlotsFeedback && !timeSlotsFeedback.available)
                        }
                        className="w-full guardian-input"
                      >
                        <option value="">
                          {!formData.scheduled_date
                            ? "Select date first"
                            : timeSlotsLoading
                              ? "Loading time slots..."
                              : "Select time"}
                        </option>
                        {timeSlots.map((slot) => (
                          <option key={slot} value={slot}>
                            {formatTimeSlotLabel(slot)}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Available from 8:00 AM to 4:00 PM (12:00 PM - 1:00 PM lunch break).
                      </p>
                      {!timeSlotsLoading && timeSlotsFeedback && !timeSlotsFeedback.available && (
                        <Alert variant="warning" className="mt-2">
                          {timeSlotsFeedback.message}
                        </Alert>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Appointment Type
                    </label>
                    <Select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          type: e.target.value,
                        }))
                      }
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
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
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">
                        Name
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedChild.first_name} {selectedChild.last_name}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">
                        Date of Birth
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(selectedChild.dob).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">
                        Sex
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedChild.sex === "M"
                          ? "Male"
                          : selectedChild.sex === "F"
                            ? "Female"
                            : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">
                        Infant Control Number
                      </span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {selectedChild.control_number || "Auto-assigned"}
                      </span>
                    </div>
                    {selectedChild.health_center && (
                      <div className="flex justify-between gap-3">
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
                          {new Date(formData.scheduled_date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
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
                          {new Date(
                            `2000-01-01T${formData.scheduled_time}`,
                          ).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
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
              <DocumentChecklist />
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
                  : childReadiness.blockedVaccines && childReadiness.blockedVaccines.length > 0
                    ? `Booking is blocked: ${childReadiness.blockedVaccines.map(v => v.reason).join(', ')}`
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
                        const date = new Date(slot.date || slot.suggestedDate);
                        setFormData(prev => ({
                          ...prev,
                          scheduled_date: date.toISOString().split('T')[0],
                          scheduled_time: slot.time || slot.suggestedTime || ''
                        }));
                      }}
                      className="w-full text-left p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
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
                !formData.scheduled_date ||
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
