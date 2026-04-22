import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import {
  normalizeInfant,
} from '../utils/adminDataAdapters';

/**
 * Custom hook to handle real-time synchronization for Infant Management
 * Subscribes to socket events for infants to update lists instantly
 *
 * @param {Object} params
 * @param {Function} [params.setInfants] - State setter for infants list
 * @param {Function} [params.onChange] - Optional callback for mutation-refetch sync
 */
const useInfantManagementSocket = ({ setInfants, onChange }) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const notifyChange = (event, payload) => {
      if (typeof onChange === "function") {
        onChange({ event, payload });
      }
    };

    const handleInfantCreated = (newInfant) => {
      const normalizedInfant = normalizeInfant(newInfant);

      if (setInfants) {
        setInfants((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          if (current.some((infant) => infant.id === normalizedInfant.id)) {
            return current.map((infant) =>
              infant.id === normalizedInfant.id ? normalizedInfant : infant,
            );
          }

          return [normalizedInfant, ...current];
        });
      }

      notifyChange("infant_created", normalizedInfant);
    };

    const handleInfantUpdated = (updatedInfant) => {
      const normalizedInfant = normalizeInfant(updatedInfant);

      if (setInfants) {
        setInfants((prev) =>
          (Array.isArray(prev) ? prev : []).map((infant) =>
            infant.id === normalizedInfant.id ? normalizedInfant : infant,
          ),
        );
      }

      notifyChange("infant_updated", normalizedInfant);
    };

    const handleInfantDeleted = ({ id }) => {
      const parsedId = parseInt(id, 10);

      if (setInfants) {
        setInfants((prev) =>
          (Array.isArray(prev) ? prev : []).filter((infant) => infant.id !== parsedId),
        );
      }

      notifyChange("infant_deleted", { id: parsedId });
    };

    const handleVaccinationChanged = (payload) => {
      notifyChange("vaccination_changed", payload);
    };

    socket.on('infant_created', handleInfantCreated);
    socket.on('infant_updated', handleInfantUpdated);
    socket.on('infant_deleted', handleInfantDeleted);
    socket.on('vaccination_created', handleVaccinationChanged);
    socket.on('vaccination_updated', handleVaccinationChanged);
    socket.on('vaccination_deleted', handleVaccinationChanged);
    socket.on('infant_vaccine_readiness_updated', handleVaccinationChanged);
    socket.on('infant_vaccine_readiness_batch_updated', handleVaccinationChanged);

    return () => {
      socket.off('infant_created', handleInfantCreated);
      socket.off('infant_updated', handleInfantUpdated);
      socket.off('infant_deleted', handleInfantDeleted);
      socket.off('vaccination_created', handleVaccinationChanged);
      socket.off('vaccination_updated', handleVaccinationChanged);
      socket.off('vaccination_deleted', handleVaccinationChanged);
      socket.off('infant_vaccine_readiness_updated', handleVaccinationChanged);
      socket.off('infant_vaccine_readiness_batch_updated', handleVaccinationChanged);
    };
  }, [socket, setInfants, onChange]);
};

export default useInfantManagementSocket;
