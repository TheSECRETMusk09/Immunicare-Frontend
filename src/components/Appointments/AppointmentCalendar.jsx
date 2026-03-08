import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button, Modal, Input, Select, Alert, Badge } from "../UI";
import apiClient from "../../utils/api";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export const AppointmentCalendar = () => {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [formData, setFormData] = useState({
    patientId: "",
    vaccineId: "",
    date: "",
    time: "",
    notes: "",
    status: "Scheduled",
  });

  // Store the fetch function in ref for use in form submission and delete
  const fetchDataRef = useRef(null);

  const calculateEndTime = (date, time) => {
    // Add 30 minutes to appointment time
    const startDate = new Date(`${date}T${time}`);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    return endDate.toISOString();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch data in parallel
      const [appointmentsData, patientsData, vaccinesData] = await Promise.all([
        apiClient.getAppointments(),
        apiClient.getInfants(),
        apiClient.getVaccines(),
      ]);

      // Transform appointments data for calendar
      const transformedAppointments = appointmentsData.map((appointment) => ({
        id: appointment.id,
        title: `${appointment.patient?.name || "Patient"} - ${
          appointment.vaccine?.name || "Vaccine"
        }`,
        start: `${appointment.date}T${appointment.time}`,
        end: calculateEndTime(appointment.date, appointment.time),
        extendedProps: {
          patientId: appointment.patient_id,
          vaccineId: appointment.vaccine_id,
          status: appointment.status,
          notes: appointment.notes,
        },
      }));

      setAppointments(transformedAppointments);
      setPatients(patientsData);
      setVaccines(vaccinesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Store the fetch function in ref for use elsewhere
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateClick = (arg) => {
    // Open modal for new appointment
    const date = arg.dateStr;
    const time = arg.allDay ? "09:00" : arg.date.toTimeString().substring(0, 5);

    setCurrentAppointment(null);
    setFormData({
      patientId: "",
      vaccineId: "",
      date: date,
      time: time,
      notes: "",
      status: "Scheduled",
    });
    setIsModalOpen(true);
  };

  const handleEventClick = (arg) => {
    // Open modal for existing appointment
    const appointment = arg.event;
    const extendedProps = appointment.extendedProps;

    setCurrentAppointment({
      id: appointment.id,
      ...extendedProps,
    });

    setFormData({
      patientId: extendedProps.patientId,
      vaccineId: extendedProps.vaccineId,
      date: new Date(appointment.start).toISOString().substr(0, 10),
      time: new Date(appointment.start).toTimeString().substring(0, 5),
      notes: extendedProps.notes || "",
      status: extendedProps.status || "Scheduled",
    });

    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    try {
      const appointmentData = {
        patient_id: formData.patientId,
        vaccine_id: formData.vaccineId,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        status: formData.status,
      };

      if (currentAppointment) {
        // Update existing appointment
        await apiClient.updateAppointment(
          currentAppointment.id,
          appointmentData,
        );
      } else {
        // Create new appointment
        await apiClient.createAppointment(appointmentData);
      }

      setIsModalOpen(false);
      if (fetchDataRef.current) {
        fetchDataRef.current(); // Refresh the calendar
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!currentAppointment) return;

    try {
      await apiClient.deleteAppointment(currentAppointment.id);
      setIsModalOpen(false);
      if (fetchDataRef.current) {
        fetchDataRef.current(); // Refresh the calendar
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "#22c55e";
      case "Cancelled":
        return "#ef4444";
      case "Missed":
        return "#f59e0b";
      default: // Scheduled
        return "#6366f1";
    }
  };

  // Calendar event render function - Enhanced for accessibility
  const renderEventContent = (arg) => {
    const statusColor = getStatusColor(arg.event.extendedProps.status);
    // Ensure high contrast text - white text for better readability
    const textColor = "#ffffff";
    return (
      <div className="fc-event-main-frame" style={{ padding: "2px 4px" }}>
        <div
          className="fc-event-time"
          style={{ fontWeight: 500, fontSize: "0.75rem", color: textColor }}
        >
          {arg.timeText}
        </div>
        <div
          className="fc-event-title"
          style={{ fontSize: "0.8rem", fontWeight: 500, color: textColor }}
        >
          {arg.event.title}
        </div>
        <Badge
          variant="secondary"
          style={{
            backgroundColor: statusColor,
            color: textColor,
            fontSize: "0.65rem",
            padding: "1px 6px",
            borderRadius: "4px",
            marginTop: "2px",
            display: "inline-block",
          }}
        >
          {arg.event.extendedProps.status}
        </Badge>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className="appointment-calendar"
        style={{ textAlign: "center", padding: "40px" }}
      >
        <div style={{ color: "var(--theme-text-secondary)" }}>
          Loading appointments...
        </div>
      </div>
    );
  }

  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="appointment-calendar">
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          marginBottom: "1.5rem",
          color: "var(--theme-text-primary)",
        }}
      >
        Appointment Scheduling
      </h1>

      <div style={{ marginBottom: "1rem" }}>
        <Button
          onClick={() => {
            // Open modal for new appointment with current date/time
            const now = new Date();
            setCurrentAppointment(null);
            setFormData({
              patientId: "",
              vaccineId: "",
              date: now.toISOString().substr(0, 10),
              time: now.toTimeString().substring(0, 5),
              notes: "",
              status: "Scheduled",
            });
            setIsModalOpen(true);
          }}
        >
          + Schedule New Appointment
        </Button>
      </div>

      <div className="calendar-container" style={{ marginTop: "1rem" }}>
        <style>{`
          .fc .fc-toolbar-title {
            font-size: 1.25rem;
            font-weight: 600;
          }
          .fc .fc-button {
            background-color: #3b82f6 !important;
            border-color: #3b82f6 !important;
            font-weight: 500;
            padding: 0.4rem 0.8rem;
            font-size: 0.875rem;
          }
          .fc .fc-button:hover {
            background-color: #2563eb !important;
            border-color: #2563eb !important;
          }
          .fc .fc-button-primary:not(:disabled).fc-button-active,
          .fc .fc-button-primary:not(:disabled):active {
            background-color: #1d4ed8 !important;
            border-color: #1d4ed8 !important;
          }
          .fc .fc-toolbar-chunk {
            display: flex;
            gap: 0.25rem;
          }
          .fc .fc-toolbar {
            flex-wrap: nowrap;
          }
          /* Calendar text accessibility - Light mode */
          .fc {
            --fc-border-color: #e5e7eb;
            --fc-page-bg-color: #ffffff;
            --fc-neutral-bg-color: #f3f4f6;
          }
          .fc .fc-daygrid-day-number {
            color: #1f2937;
            font-weight: 500;
          }
          .fc .fc-col-header-cell-cushion {
            color: #374151;
            font-weight: 600;
          }
          .fc .fc-timegrid-slot-label-cushion,
          .fc .fc-timegrid-axis-cushion {
            color: #4b5563;
          }
          /* Calendar text accessibility - Dark mode */
          .dark .fc, [data-theme="dark"] .fc {
            --fc-border-color: #374151;
            --fc-page-bg-color: #1f2937;
            --fc-neutral-bg-color: #374151;
          }
          .dark .fc .fc-daygrid-day-number,
          [data-theme="dark"] .fc .fc-daygrid-day-number {
            color: #f3f4f6;
            font-weight: 500;
          }
          .dark .fc .fc-col-header-cell-cushion,
          [data-theme="dark"] .fc .fc-col-header-cell-cushion {
            color: #e5e7eb;
            font-weight: 600;
          }
          .dark .fc .fc-timegrid-slot-label-cushion,
          .dark .fc .fc-timegrid-axis-cushion,
          [data-theme="dark"] .fc .fc-timegrid-slot-label-cushion,
          [data-theme="dark"] .fc .fc-timegrid-axis-cushion {
            color: #9ca3af;
          }
          .dark .fc .fc-daygrid-day-top,
          [data-theme="dark"] .fc .fc-daygrid-day-top {
            color: #d1d5db;
          }
          .dark .fc .fc-more-link,
          [data-theme="dark"] .fc .fc-more-link {
            color: #818cf8;
          }
          /* Today highlight */
          .fc .fc-daygrid-day.fc-day-today {
            background-color: rgba(99, 102, 241, 0.1);
          }
          .dark .fc .fc-daygrid-day.fc-day-today,
          [data-theme="dark"] .fc .fc-daygrid-day.fc-day-today {
            background-color: rgba(129, 140, 248, 0.2);
          }
          /* Mobile responsive */
          @media (max-width: 768px) {
            .fc .fc-toolbar {
              flex-direction: column;
              gap: 0.5rem;
            }
            .fc .fc-daygrid-day {
              min-height: 40px;
            }
          }
        `}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Today",
            month: "Month",
            week: "Week",
            day: "Day",
          }}
          events={appointments}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          height="auto"
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          // Simplified toolbar - single layer with blue buttons
          moreLinkClick="popover"
          moreLinkClassNames="fc-more-link"
          // Event display options
          eventDisplay="block"
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            meridiem: "short",
          }}
          // Slot settings
          slotMinTime="07:00:00"
          slotMaxTime="19:00:00"
          allDaySlot={false}
          // Theme settings
          nowIndicator={true}
          eventOverlap={true}
          selectOverlap={true}
        />
      </div>

      {/* Appointment Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          currentAppointment ? "Edit Appointment" : "Schedule New Appointment"
        }
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Patient"
              name="patientId"
              value={formData.patientId}
              onChange={handleFormChange}
              required
            >
              <option value="">Select Patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} ({calculateAge(patient.dob)})
                </option>
              ))}
            </Select>

            <Select
              label="Vaccine"
              name="vaccineId"
              value={formData.vaccineId}
              onChange={handleFormChange}
              required
            >
              <option value="">Select Vaccine</option>
              {vaccines.map((vaccine) => (
                <option key={vaccine.id} value={vaccine.id}>
                  {vaccine.name}
                </option>
              ))}
            </Select>

            <Input
              label="Date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Time"
              name="time"
              type="time"
              value={formData.time}
              onChange={handleFormChange}
              required
            />

            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              required
            >
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Missed">Missed</option>
            </Select>

            <div className="md:col-span-2">
              <Input
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                multiline
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            {currentAppointment && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteAppointment}
              >
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="cancel"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {currentAppointment
                ? "Update Appointment"
                : "Schedule Appointment"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  // Helper function to calculate age
  function calculateAge(dob) {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    if (age < 1) {
      const months =
        today.getMonth() -
        birthDate.getMonth() +
        12 * (today.getFullYear() - birthDate.getFullYear());
      return `${months} months`;
    }

    return `${age} years`;
  }
};
