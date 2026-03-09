import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  Plus,
} from "lucide-react";
import { Button, Input, Select } from "./UI";

export default function AppointmentBooking({ infantId, onAppointmentBooked }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [appointmentType, setAppointmentType] = useState("routine_checkup");
  const [reason, setReason] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate available time slots
  const generateTimeSlots = (date) => {
    const slots = [];
    const startHour = 8; // 8 AM
    const endHour = 17; // 5 PM

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        // Every 30 minutes
        const time = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        slots.push(time);
      }
    }

    return slots;
  };

  useEffect(() => {
    setAvailableSlots(generateTimeSlots(selectedDate));
  }, [selectedDate]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedTime("");
  };

  const handleBooking = async (e) => {
    e.preventDefault();

    if (!selectedTime) {
      setError("Please select a time slot");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Format the appointment date and time
      const [hours, minutes] = selectedTime.split(":");
      const appointmentDateTime = new Date(selectedDate);
      appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

      const appointmentData = {
        infant_id: infantId,
        scheduled_date: appointmentDateTime.toISOString(),
        type: appointmentType,
        notes: reason,
        status: "scheduled",
      };

      // Here you would call your API to book the appointment
      // await apiClient.createAppointment(appointmentData);

      // For now, simulate success
      setTimeout(() => {
        setLoading(false);
        onAppointmentBooked && onAppointmentBooked(appointmentData);
      }, 1000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const appointmentTypes = [
    { value: "routine_checkup", label: "Routine Checkup" },
    { value: "vaccination", label: "Vaccination" },
    { value: "follow_up", label: "Follow-up Visit" },
    { value: "sick_visit", label: "Sick Visit" },
    { value: "growth_monitoring", label: "Growth Monitoring" },
    { value: "developmental_check", label: "Developmental Check" },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <CalendarIcon className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Book Appointment
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleBooking} className="space-y-6">
        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Date
          </label>
          <div className="flex items-center space-x-4">
            <Input
              type="date"
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(e) => handleDateChange(new Date(e.target.value))}
              min={new Date().toISOString().split("T")[0]}
              className="flex-1"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Time
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
            {availableSlots.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => setSelectedTime(time)}
                className={`p-2 text-xs sm:text-sm border rounded-md flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2 ${
                  selectedTime === time
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{time}</span>
              </button>
            ))}
          </div>
          {selectedTime && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Selected: {selectedTime} on {selectedDate.toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Appointment Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Appointment Type
          </label>
          <Select
            value={appointmentType}
            onChange={(e) => setAppointmentType(e.target.value)}
            className="w-full"
          >
            {appointmentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Reason/Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reason for Visit (Optional)
          </label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Routine vaccination, Growth check, etc."
            className="w-full"
          />
        </div>

        {/* Clinic Information */}
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Clinic Information
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>Healthcare Professional will be assigned</span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>Local Health Center</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Duration: 30 minutes</span>
            </div>
          </div>
        </div>

        {/* Booking Actions */}
        <div className="form-actions-standardized">
          <Button
            type="button"
            variant="cancel"
            actionRole="cancel"
            onClick={() => window.history.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            actionRole="primary"
            disabled={!selectedTime || loading}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            {loading ? "Booking..." : "Book Appointment"}
          </Button>
        </div>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
          Please arrive 10 minutes before your scheduled time
        </div>
      </form>

      {/* Appointment Summary */}
      {selectedTime && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            Appointment Summary
          </h4>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <div>Date: {selectedDate.toLocaleDateString()}</div>
            <div>Time: {selectedTime}</div>
            <div>
              Type:{" "}
              {appointmentTypes.find((t) => t.value === appointmentType)?.label}
            </div>
            {reason && <div>Reason: {reason}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
