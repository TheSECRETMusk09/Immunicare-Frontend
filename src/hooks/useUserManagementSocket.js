import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

/**
 * Custom hook to handle real-time synchronization for User Management
 * Subscribes to socket events for guardians and system users to update lists instantly
 *
 * @param {Object} params
 * @param {Function} [params.setGuardians] - State setter for guardians list
 * @param {Function} [params.setSystemUsers] - State setter for system users list
 * @param {Function} [params.onGuardianCreated] - Callback for guardian created event
 * @param {Function} [params.onGuardianUpdated] - Callback for guardian updated event
 * @param {Function} [params.onGuardianDeleted] - Callback for guardian deleted event
 * @param {Function} [params.onSystemUserCreated] - Callback for system user created event
 * @param {Function} [params.onSystemUserUpdated] - Callback for system user updated event
 * @param {Function} [params.onSystemUserDeleted] - Callback for system user deleted event
 */
const useUserManagementSocket = ({
  setGuardians,
  setSystemUsers,
  onGuardianCreated,
  onGuardianUpdated,
  onGuardianDeleted,
  onSystemUserCreated,
  onSystemUserUpdated,
  onSystemUserDeleted,
}) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Guardian Events
    const handleGuardianCreated = (newGuardian) => {
      if (onGuardianCreated) {
        onGuardianCreated(newGuardian);
      }

      if (setGuardians) {
        setGuardians((prev) => [newGuardian, ...prev]);
      }
    };

    const handleGuardianUpdated = (updatedGuardian) => {
      if (onGuardianUpdated) {
        onGuardianUpdated(updatedGuardian);
      }

      if (setGuardians) {
        setGuardians((prev) =>
          prev.map((g) => (g.id === updatedGuardian.id ? updatedGuardian : g))
        );
      }
    };

    const handleGuardianDeleted = ({ id }) => {
      if (onGuardianDeleted) {
        onGuardianDeleted({ id });
      }

      if (setGuardians) {
        setGuardians((prev) => prev.filter((g) => g.id !== parseInt(id, 10)));
      }
    };

    // System User Events
    const handleSystemUserCreated = (newUser) => {
      if (onSystemUserCreated) {
        onSystemUserCreated(newUser);
      }

      if (setSystemUsers) {
        setSystemUsers((prev) => [newUser, ...prev]);
      }
    };

    const handleSystemUserUpdated = (updatedUser) => {
      if (onSystemUserUpdated) {
        onSystemUserUpdated(updatedUser);
      }

      if (setSystemUsers) {
        setSystemUsers((prev) =>
          prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
        );
      }
    };

    const handleSystemUserDeleted = ({ id }) => {
      if (onSystemUserDeleted) {
        onSystemUserDeleted({ id });
      }

      if (setSystemUsers) {
        setSystemUsers((prev) => prev.filter((u) => u.id !== parseInt(id, 10)));
      }
    };

    // Subscribe to events
    socket.on('guardian_created', handleGuardianCreated);
    socket.on('guardian_updated', handleGuardianUpdated);
    socket.on('guardian_deleted', handleGuardianDeleted);
    socket.on('system_user_created', handleSystemUserCreated);
    socket.on('system_user_updated', handleSystemUserUpdated);
    socket.on('system_user_deleted', handleSystemUserDeleted);

    // Cleanup listeners
    return () => {
      socket.off('guardian_created', handleGuardianCreated);
      socket.off('guardian_updated', handleGuardianUpdated);
      socket.off('guardian_deleted', handleGuardianDeleted);
      socket.off('system_user_created', handleSystemUserCreated);
      socket.off('system_user_updated', handleSystemUserUpdated);
      socket.off('system_user_deleted', handleSystemUserDeleted);
    };
  }, [
    socket,
    setGuardians,
    setSystemUsers,
    onGuardianCreated,
    onGuardianUpdated,
    onGuardianDeleted,
    onSystemUserCreated,
    onSystemUserUpdated,
    onSystemUserDeleted,
  ]);
};

export default useUserManagementSocket;
