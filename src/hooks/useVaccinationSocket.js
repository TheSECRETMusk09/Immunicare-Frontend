import { useEffect } from "react";
import { useSocket } from '../contexts/SocketContext';
import { normalizeVaccinationRecord } from "../utils/adminDataAdapters";

/**
 * Custom hook to handle real-time synchronization for Vaccination Records
 *
 * @param {Object} params
 * @param {Function} [params.setVaccinations] - State setter for vaccination records list
 * @param {Function} [params.onChange] - Callback fired on create/update/delete events (for refetch)
 */
const useVaccinationSocket = ({ setVaccinations, onChange }) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const notifyChange = (event, payload) => {
      if (typeof onChange === "function") {
        onChange({ event, payload });
      }
    };

    const handleVaccinationCreated = (newRecord) => {
      const normalizedRecord = normalizeVaccinationRecord(newRecord || {});

      if (setVaccinations) {
        setVaccinations((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          const existingIndex = current.findIndex(
            (record) => record.id === normalizedRecord.id,
          );

          if (existingIndex >= 0) {
            return current.map((record, index) =>
              index === existingIndex ? normalizedRecord : record,
            );
          }

          return [normalizedRecord, ...current];
        });
      }

      notifyChange("vaccination_created", normalizedRecord);
    };

    const handleVaccinationUpdated = (updatedRecord) => {
      const normalizedRecord = normalizeVaccinationRecord(updatedRecord || {});

      if (setVaccinations) {
        setVaccinations((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          return current.map((record) =>
            record.id === normalizedRecord.id ? normalizedRecord : record,
          );
        });
      }

      notifyChange("vaccination_updated", normalizedRecord);
    };

    const handleVaccinationDeleted = ({ id }) => {
      const parsedId = parseInt(id, 10);

      if (setVaccinations) {
        setVaccinations((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          return current.filter((record) => record.id !== parsedId);
        });
      }

      notifyChange("vaccination_deleted", { id: parsedId });
    };

    socket.on('vaccination_created', handleVaccinationCreated);
    socket.on('vaccination_updated', handleVaccinationUpdated);
    socket.on('vaccination_deleted', handleVaccinationDeleted);

    return () => {
      socket.off('vaccination_created', handleVaccinationCreated);
      socket.off('vaccination_updated', handleVaccinationUpdated);
      socket.off('vaccination_deleted', handleVaccinationDeleted);
    };
  }, [socket, setVaccinations, onChange]);
};

export default useVaccinationSocket;
