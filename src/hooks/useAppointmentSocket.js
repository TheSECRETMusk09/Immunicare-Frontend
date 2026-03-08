import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * Custom hook to handle real-time synchronization for Appointments
 *
 * @param {Object} params
 * @param {Function} [params.setAppointments] - State setter for appointments list
 */
const useAppointmentSocket = ({ setAppointments }) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !setAppointments) return;

    const handleAppointmentCreated = (newAppointment) => {
      setAppointments((prev) => [newAppointment, ...prev]);
    };

    const handleAppointmentUpdated = (updatedAppointment) => {
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === updatedAppointment.id ? updatedAppointment : apt))
      );
    };

    const handleAppointmentDeleted = ({ id }) => {
      setAppointments((prev) => prev.filter((apt) => apt.id !== parseInt(id, 10)));
    };

    socket.on('appointment_created', handleAppointmentCreated);
    socket.on('appointment_updated', handleAppointmentUpdated);
    socket.on('appointment_deleted', handleAppointmentDeleted);

    return () => {
      socket.off('appointment_created', handleAppointmentCreated);
      socket.off('appointment_updated', handleAppointmentUpdated);
      socket.off('appointment_deleted', handleAppointmentDeleted);
    };
  }, [socket, setAppointments]);
};

export default useAppointmentSocket;
