import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, Button, Alert, DataTable } from "../UI";
import apiClient from "../../utils/api";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import moment from "moment";

export const AppointmentManagement = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [calendarView, setCalendarView] = useState("dayGridMonth");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateRange, setDateRange] = useState({
    start: moment().startOf("month").toDate(),
    end: moment().endOf("month").toDate(),
  });
  const calendarRef = useRef(null);
  const navigate = useNavigate();

  // Fetch appointments with date range
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAppointments({
        startDate: moment(dateRange.start).format("YYYY-MM-DD"),
        endDate: moment(dateRange.end).format("YYYY-MM-DD"),
      });
      const appointmentsData = response.data || [];

      // Transform data for the table
      const transformedAppointments = appointmentsData.map((appointment) => ({
        id: appointment.id,
        patientName:
          appointment.patient?.name ||
          `${appointment.infant?.first_name} ${appointment.infant?.last_name}` ||
          "Unknown",
        vaccine:
          appointment.vaccine?.name || appointment.appointment_type || "N/A",
        date: appointment.scheduled_date
          ? new Date(appointment.scheduled_date).toLocaleDateString()
          : "N/A",
        time: appointment.scheduled_time || "N/A",
        status: appointment.status || "pending",
        scheduled_date: appointment.scheduled_date,
        scheduled_time: appointment.scheduled_time,
        ...appointment,
      }));

      setAppointments(transformedAppointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleStatusChange = async (appointmentId, newStatus) => {
    try {
      await apiClient.updateAppointment(appointmentId, {
        status: newStatus,
      });
      fetchAppointments();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getEventColor = (status) => {
    switch (status) {
      case "completed":
        return "#10b981"; // green
      case "pending":
        return "#f59e0b"; // amber
      case "cancelled":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  };

  const transformAppointmentsForCalendar = (appointments) => {
    return appointments
      .map((appointment) => ({
        id: appointment.id,
        title: `${appointment.patientName} - ${appointment.vaccine}`,
        start: appointment.scheduled_date
          ? `${appointment.scheduled_date}T${appointment.scheduled_time || "09:00"}`
          : null,
        end: appointment.scheduled_date
          ? `${appointment.scheduled_date}T${appointment.scheduled_time ? new Date(appointment.scheduled_date + " " + appointment.scheduled_time).setMinutes(new Date(appointment.scheduled_date + " " + appointment.scheduled_time).getMinutes() + 30) : "10:00"}`
          : null,
        backgroundColor: getEventColor(appointment.status),
        borderColor: getEventColor(appointment.status),
        textColor: "#ffffff",
        extendedProps: {
          appointment: appointment,
        },
      }))
      .filter((event) => event.start);
  };

  // Handle calendar date change
  const handleDatesSet = (dateInfo) => {
    setDateRange({
      start: dateInfo.start,
      end: dateInfo.end,
    });
    setCurrentDate(dateInfo.start);
  };

  // Handle view change
  const handleViewChange = (viewName) => {
    setCalendarView(viewName);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(viewName);
    }
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
      setCurrentDate(new Date());
    }
  };

  const handleEventClick = (info) => {
    navigate(`/appointments/${info.event.extendedProps.appointment.id}`);
  };

  const handleDateClick = (info) => {
    navigate("/appointments/new", { state: { selectedDate: info.dateStr } });
  };

  const filteredAppointments =
    filterStatus === "all"
      ? appointments
      : appointments.filter(
          (appointment) => appointment.status === filterStatus,
        );

  const appointmentColumns = [
    { Header: "Patient", accessor: "patientName" },
    { Header: "Vaccine", accessor: "vaccine" },
    { Header: "Date", accessor: "date" },
    { Header: "Time", accessor: "time" },
    {
      Header: "Status",
      accessor: "status",
      Cell: ({ value, row }) => (
        <select
          value={value}
          onChange={(e) => handleStatusChange(row.original.id, e.target.value)}
          className={`border rounded px-2 py-1 text-sm ${getStatusColor(
            value,
          )}`}
        >
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      ),
    },
    {
      Header: "Actions",
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/appointments/${row.original.id}`)}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div>Loading appointments...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="appointment-management">
      <h1 className="text-2xl font-bold mb-6">Appointment Management</h1>

      {/* Filter Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Button
            variant={filterStatus === "all" ? "primary" : "secondary"}
            onClick={() => setFilterStatus("all")}
          >
            All ({appointments.length})
          </Button>
          <Button
            variant={filterStatus === "pending" ? "primary" : "secondary"}
            onClick={() => setFilterStatus("pending")}
          >
            Pending ({appointments.filter((a) => a.status === "pending").length}
            )
          </Button>
          <Button
            variant={filterStatus === "completed" ? "primary" : "secondary"}
            onClick={() => setFilterStatus("completed")}
          >
            Completed (
            {appointments.filter((a) => a.status === "completed").length})
          </Button>
          <Button
            variant={filterStatus === "cancelled" ? "primary" : "secondary"}
            onClick={() => setFilterStatus("cancelled")}
          >
            Cancelled (
            {appointments.filter((a) => a.status === "cancelled").length})
          </Button>
        </div>

        <Button onClick={() => navigate("/appointments/new")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          New Appointment
        </Button>
      </div>

      {/* Appointments Table */}
      <Card title="Appointment Schedule">
        <DataTable
          columns={appointmentColumns}
          data={filteredAppointments}
          pagination
        />
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card title="Total Appointments">
          <div className="text-3xl font-bold">{appointments.length}</div>
          <div className="text-sm text-gray-500">This month</div>
        </Card>

        <Card title="Completion Rate">
          <div className="text-3xl font-bold">
            {appointments.length > 0
              ? Math.round(
                  (appointments.filter((a) => a.status === "completed").length /
                    appointments.length) *
                    100,
                )
              : 0}
            %
          </div>
          <div className="text-sm text-gray-500">Success rate</div>
        </Card>

        <Card title="Pending Appointments">
          <div className="text-3xl font-bold">
            {appointments.filter((a) => a.status === "pending").length}
          </div>
          <div className="text-sm text-gray-500">Need attention</div>
        </Card>
      </div>

      {/* Calendar View - Responsive */}
      <Card title="Calendar View" className="mt-6">
        {/* Calendar Navigation Controls */}
        <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
          <div className="flex gap-2">
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
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {moment(currentDate).format("MMMM YYYY")}
          </div>
          <div className="flex gap-2">
            <Button
              variant={
                calendarView === "dayGridMonth" ? "primary" : "secondary"
              }
              size="sm"
              onClick={() => handleViewChange("dayGridMonth")}
            >
              Month
            </Button>
            <Button
              variant={
                calendarView === "timeGridWeek" ? "primary" : "secondary"
              }
              size="sm"
              onClick={() => handleViewChange("timeGridWeek")}
            >
              Week
            </Button>
            <Button
              variant={calendarView === "timeGridDay" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleViewChange("timeGridDay")}
            >
              Day
            </Button>
          </div>
        </div>

        {/* FullCalendar without built-in header */}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          viewDidMount={(info) => {
            setCalendarView(info.view.type);
            setCurrentDate(info.view.activeStart);
          }}
          datesSet={handleDatesSet}
          dateClick={(info) => handleDateClick(info)}
          eventClick={(info) => handleEventClick(info)}
          events={transformAppointmentsForCalendar(appointments)}
          headerToolbar={false} // Disable built-in header, use custom controls
          height="auto"
          minHeight="400px"
          aspectRatio={1.8}
          expandRows={true}
          stickyHeaderDates={true}
          dayMaxEvents={3}
          moreLinkText="More"
          allDaySlot={true}
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }}
          eventContent={(eventInfo) => (
            <div className="fc-event-custom overflow-hidden">
              <div className="text-xs truncate">
                {eventInfo.timeText} {eventInfo.event.title}
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
};
