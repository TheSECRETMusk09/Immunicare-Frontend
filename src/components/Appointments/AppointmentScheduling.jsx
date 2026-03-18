import React, { useState, useEffect } from "react";
import { Card, Button, Modal, Input, Select, Badge, AdminModalActions } from "../UI";
import {
  Calendar as CalendarIcon,
  Plus,
  Edit,
  Trash2,
  Users,
  Clock,
  MapPin,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Calendar } from "react-calendar";
import "react-calendar/dist/Calendar.css";
import apiClient from "../../utils/api";

export const AppointmentScheduling = () => {
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    vaccine: "",
    date: "",
    time: "",
    location: "",
    status: "scheduled",
    notes: "",
    reminderSent: false,
  });
  const [suggestedAppointments, setSuggestedAppointments] = useState([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);

  const [activeTab, setActiveTab] = useState("calendar");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterVaccine, setFilterVaccine] = useState("all");

  useEffect(() => {
    // Load appointments from API
    loadAppointments();
  }, [selectedDate]);

  // Fetch suggested appointments when date changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      // For demo purposes, we'll use a mock infant ID
      // In a real implementation, this would come from context or props
      const mockInfantId = 1;

      if (!mockInfantId) return;

      setSuggestionLoading(true);
      setSuggestionError(null);

      try {
        const response = await apiClient.getAppointmentSuggestions(mockInfantId);
        setSuggestedAppointments(response.data || []);
      } catch (err) {
        setSuggestionError(err.message || 'Failed to load suggested appointments');
        setSuggestedAppointments([]);
      } finally {
        setSuggestionLoading(false);
      }
    };

    fetchSuggestions();
  }, [selectedDate]);

  const loadAppointments = async () => {
    // Mock data for demonstration
    const mockAppointments = [
      {
        id: 1,
        patientId: "INF-001",
        patientName: "Baby Alex Santos",
        vaccine: "Pentavalent (DPT 3)",
        date: "2024-01-15",
        time: "10:00",
        location: "Room 2",
        status: "scheduled",
        notes: "Follow-up appointment",
        reminderSent: false,
        nurse: "J. Dela Cruz",
      },
      {
        id: 2,
        patientId: "INF-002",
        patientName: "Maria Gonzales",
        vaccine: "OPV 3",
        date: "2024-01-15",
        time: "10:30",
        location: "Room 2",
        status: "completed",
        notes: "First dose completed",
        reminderSent: true,
        nurse: "A. Reyes",
      },
      {
        id: 3,
        patientId: "INF-003",
        patientName: "Juan Dela Cruz",
        vaccine: "MMR 1",
        date: "2024-01-16",
        time: "09:00",
        location: "Room 1",
        status: "scheduled",
        notes: "Scheduled by parent",
        reminderSent: true,
        nurse: "J. Dela Cruz",
      },
    ];
    setAppointments(mockAppointments);
  };

  const handleAddAppointment = () => {
    setIsEditing(false);
    setFormData({
      patientId: "",
      patientName: "",
      vaccine: "",
      date: selectedDate.toISOString().split("T")[0],
      time: "",
      location: "Room 2",
      status: "scheduled",
      notes: "",
      reminderSent: false,
    });
    setShowModal(true);
  };

  const handleEditAppointment = (appointment) => {
    setIsEditing(true);
    setSelectedAppointment(appointment);
    setFormData({
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      vaccine: appointment.vaccine,
      date: appointment.date,
      time: appointment.time,
      location: appointment.location,
      status: appointment.status,
      notes: appointment.notes,
      reminderSent: appointment.reminderSent,
    });
    setShowModal(true);
  };

  const handleSaveAppointment = async (event) => {
    event.preventDefault();

    if (isEditing) {
      // Update existing appointment
      setAppointments((prev) =>
        prev.map((app) =>
          app.id === selectedAppointment.id ? { ...app, ...formData } : app,
        ),
      );
    } else {
      // Add new appointment
      const newAppointment = {
        id: Date.now(),
        ...formData,
      };
      setAppointments((prev) => [...prev, newAppointment]);
    }
    setShowModal(false);
  };

  const handleDeleteAppointment = (appointmentId) => {
    setAppointments((prev) => prev.filter((app) => app.id !== appointmentId));
  };

  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return appointments.filter((app) => app.date === dateStr);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "scheduled":
        return "blue";
      case "completed":
        return "green";
      case "cancelled":
        return "red";
      case "no-show":
        return "yellow";
      default:
        return "gray";
    }
  };

  const getVaccineIcon = (vaccine) => {
    if (vaccine.includes("Pentavalent")) return "💉";
    if (vaccine.includes("OPV")) return "🩹";
    if (vaccine.includes("MMR")) return "🛡️";
    if (vaccine.includes("BCG")) return "🦠";
    if (vaccine.includes("Hepatitis")) return "💉";
    return "💉";
  };

   const CalendarView = () => (
     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       {/* Calendar */}
       <Card className="lg:col-span-1">
         <div className="p-4">
           <Calendar
             onChange={setSelectedDate}
             value={selectedDate}
             tileContent={({ date, view }) => {
               const dayAppointments = getAppointmentsForDate(date);
               const daySuggestions = suggestedAppointments.filter(
                 sugg => sugg.date === date.toISOString().split('T')[0]
               );

               if ((dayAppointments.length > 0 || daySuggestions.length > 0) && view === "month") {
                 return (
                   <div className="absolute bottom-1 left-1 right-1">
                     <div className="h-1 bg-blue-500 rounded"></div>
                     {daySuggestions.length > 0 && (
                       <div className="h-1 bg-green-500 rounded" style={{ marginTop: '2px' }}></div>
                     )}
                   </div>
                 );
               }
               return null;
             }}
             className="w-full"
           />
         </div>
       </Card>

       {/* Appointments List */}
       <Card className="lg:col-span-2">
         <div className="flex justify-between items-center mb-4">
           <h3 className="text-lg font-semibold">
             Appointments for {selectedDate.toLocaleDateString()}
           </h3>
           <Button variant="primary" onClick={handleAddAppointment}>
             <Plus className="w-4 h-4 mr-2" />
             Add Appointment
           </Button>
         </div>

         <div className="space-y-3">
           {/* Regular Appointments */}
           {getAppointmentsForDate(selectedDate).map((appointment) => (
             <div
               key={appointment.id}
               className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
             >
               <div className="flex items-center space-x-4">
                 <div className="text-2xl">
                   {getVaccineIcon(appointment.vaccine)}
                 </div>
                 <div>
                   <h4 className="font-semibold text-gray-900">
                     {appointment.patientName}
                   </h4>
                   <p className="text-sm text-gray-600">{appointment.vaccine}</p>
                   <div className="flex items-center space-x-4 text-xs text-gray-500">
                     <span>{appointment.time}</span>
                     <span>•</span>
                     <span>{appointment.location}</span>
                     <span>•</span>
                     <span>Nurse: {appointment.nurse}</span>
                   </div>
                 </div>
               </div>
               <div className="flex items-center space-x-2">
                 <Badge variant={getStatusColor(appointment.status)}>
                   {appointment.status}
                 </Badge>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => handleEditAppointment(appointment)}
                 >
                   <Edit className="w-4 h-4" />
                 </Button>
                 <Button
                   variant="danger"
                   size="sm"
                   onClick={() => handleDeleteAppointment(appointment.id)}
                 >
                   <Trash2 className="w-4 h-4" />
                 </Button>
               </div>
             </div>
           ))}

            {/* Suggested Appointments - Loading/Error State */}
            {suggestionLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading suggestions...</span>
              </div>
            )}
            {suggestionError && !suggestionLoading && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{suggestionError}</p>
              </div>
            )}
            {!suggestionLoading && !suggestionError && suggestedAppointments
              .filter(sugg => sugg.date === selectedDate.toISOString().split('T')[0])
              .map((suggestion, index) => (
                <div
                  key={`suggestion-${index}`}
                  className="flex items-center justify-between p-4 border border-green-200 rounded-lg hover:bg-green-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getVaccineIcon(suggestion.vaccine)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        Suggested for {suggestion.infant_name || 'Child'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {suggestion.vaccine} Dose {suggestion.doseNumber}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{suggestion.time}</span>
                        <span>•</span>
                        <span>Room 2</span>
                        <span>•</span>
                        <span>
                          {suggestion.isOverdue ? 'OVERDUE' : suggestion.daysUntil > 0 ? `In ${Math.ceil(suggestion.daysUntil)} days` : 'Today'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="green">
                      Suggested
                    </Badge>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        // Fill form with suggested appointment data
                        setFormData({
                          ...formData,
                          date: suggestion.date,
                          time: suggestion.time,
                          vaccine: suggestion.vaccine,
                          patientName: suggestion.infant_name || '',
                          patientId: suggestion.infant_id || '',
                        });
                        setShowModal(true);
                      }}
                    >
                      Book This Slot
                    </Button>
                  </div>
                </div>
              ))}

           {(getAppointmentsForDate(selectedDate).length === 0 &&
             suggestedAppointments.filter(sugg => sugg.date === selectedDate.toISOString().split('T')[0]).length === 0) && (
             <div className="text-center py-8 text-gray-500">
               No appointments scheduled for this date
               <div className="mt-2">
                 <Button variant="primary" onClick={handleAddAppointment}>
                   <Plus className="w-4 h-4 mr-2" />
                   Add First Appointment
                 </Button>
               </div>
             </div>
           )}
         </div>
       </Card>
     </div>
   );

  const ListView = () => (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">All Appointments</h3>
        <div className="flex space-x-2">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "scheduled", label: "Scheduled" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "no-show", label: "No Show" },
            ]}
          />
          <Select
            value={filterVaccine}
            onChange={(e) => setFilterVaccine(e.target.value)}
            options={[
              { value: "all", label: "All Vaccines" },
              { value: "pentavalent", label: "Pentavalent" },
              { value: "opv", label: "OPV" },
              { value: "mmr", label: "MMR" },
              { value: "bcg", label: "BCG" },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vaccine
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date & Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {appointments.map((appointment) => (
              <tr key={appointment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {appointment.patientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {appointment.patientId}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">
                      {getVaccineIcon(appointment.vaccine)}
                    </span>
                    <span className="text-sm text-gray-900">
                      {appointment.vaccine}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span>
                      {appointment.date} at {appointment.time}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{appointment.location}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant={getStatusColor(appointment.status)}>
                    {appointment.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditAppointment(appointment)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteAppointment(appointment.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const ReminderManagement = () => (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Reminder Management</h3>
        <Button variant="primary">
          <Clock className="w-4 h-4 mr-2" />
          Send Reminders
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">
                Reminders Sent
              </p>
              <p className="text-2xl font-bold text-green-900">85%</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-900">12%</p>
            </div>
            <Clock className="w-12 h-12 text-yellow-500 opacity-50" />
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-900">3%</p>
            </div>
            <XCircle className="w-12 h-12 text-red-500 opacity-50" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold">Upcoming Reminders</h4>
        {appointments
          .filter((app) => new Date(app.date) > new Date() && !app.reminderSent)
          .slice(0, 5)
          .map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {getVaccineIcon(appointment.vaccine)}
                </div>
                <div>
                  <h4 className="font-medium">{appointment.patientName}</h4>
                  <p className="text-sm text-gray-600">
                    {appointment.vaccine} - {appointment.date}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  Send SMS
                </Button>
                <Button variant="outline" size="sm">
                  Send Email
                </Button>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );

  return (
    <div className="appointment-scheduling space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Appointment Scheduling
          </h1>
          <p className="text-gray-600 mt-1">
            Calendar integration, automated reminders, and conflict resolution
          </p>
        </div>
        <Button variant="primary" onClick={handleAddAppointment}>
          <Plus className="w-5 h-5 mr-2" />
          New Appointment
        </Button>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "calendar"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Calendar View
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "list"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === "reminders"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Reminders
          </button>
        </div>
      </Card>

      {/* Tab Content */}
      {activeTab === "calendar" && <CalendarView />}
      {activeTab === "list" && <ListView />}
      {activeTab === "reminders" && <ReminderManagement />}

      {/* Appointment Modal */}
      {showModal && (
        <Modal
          title={isEditing ? "Edit Appointment" : "Schedule New Appointment"}
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <AdminModalActions>
              <Button
                type="button"
                variant="cancel"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="appointmentSchedulingForm"
                variant="primary"
              >
                {isEditing ? "Update Appointment" : "Schedule Appointment"}
              </Button>
            </AdminModalActions>
          }
        >
          <form
            id="appointmentSchedulingForm"
            className="admin-form"
            onSubmit={handleSaveAppointment}
          >
            <div className="admin-form-row-2">
              <Input
                label="Patient Name"
                value={formData.patientName}
                onChange={(e) =>
                  setFormData({ ...formData, patientName: e.target.value })
                }
                required
              />
              <Input
                label="Patient ID"
                value={formData.patientId}
                onChange={(e) =>
                  setFormData({ ...formData, patientId: e.target.value })
                }
                required
              />
            </div>

            <Select
              label="Vaccine"
              value={formData.vaccine}
              onChange={(e) =>
                setFormData({ ...formData, vaccine: e.target.value })
              }
              options={[
                { value: "BCG (Tuberculosis)", label: "BCG (Tuberculosis)" },
                { value: "Hepatitis B", label: "Hepatitis B" },
                { value: "Pentavalent (DPT 1)", label: "Pentavalent (DPT 1)" },
                { value: "Pentavalent (DPT 2)", label: "Pentavalent (DPT 2)" },
                { value: "Pentavalent (DPT 3)", label: "Pentavalent (DPT 3)" },
                { value: "OPV 1", label: "OPV 1" },
                { value: "OPV 2", label: "OPV 2" },
                { value: "OPV 3", label: "OPV 3" },
                { value: "IPV 1", label: "IPV 1" },
                { value: "IPV 2", label: "IPV 2" },
                { value: "PCV 1", label: "PCV 1" },
                { value: "PCV 2", label: "PCV 2" },
                { value: "PCV 3", label: "PCV 3" },
                { value: "MMR 1", label: "MMR 1" },
                { value: "MMR 2", label: "MMR 2" },
              ]}
              required
            />

            <div className="admin-form-row-2">
              <Input
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
              <Input
                label="Time"
                type="time"
                value={formData.time}
                onChange={(e) =>
                  setFormData({ ...formData, time: e.target.value })
                }
                required
              />
            </div>

            <div className="admin-form-row-2">
              <Select
                label="Location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                options={[
                  { value: "Room 1", label: "Room 1" },
                  { value: "Room 2", label: "Room 2" },
                  { value: "Room 3", label: "Room 3" },
                  { value: "Emergency Room", label: "Emergency Room" },
                ]}
              />
              <Select
                label="Status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                options={[
                  { value: "scheduled", label: "Scheduled" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "no-show", label: "No Show" },
                ]}
              />
            </div>

            <Input
              label="Notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Additional notes or instructions..."
              multiline
              rows={3}
            />
          </form>
        </Modal>
      )}
    </div>
  );
};
