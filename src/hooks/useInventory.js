import { useState, useEffect, useCallback } from "react";
import apiClient from "../utils/api";

const unwrapData = (payload) => payload?.data ?? payload ?? [];

const normalizeBatch = (batch) => ({
  id: batch?.id,
  vaccineId: batch?.vaccine_id,
  name: batch?.vaccine_name || batch?.name || "",
  manufacturer: batch?.manufacturer || "",
  batchNumber: batch?.lot_no || batch?.lot_batch_number || "N/A",
  quantity: Number(batch?.qty_current ?? batch?.qty_received ?? 0),
  minLevel: 10,
  reorderLevel: 20,
  expiryDate: batch?.expiry_date ? String(batch.expiry_date).split("T")[0] : "",
  storageLocation: batch?.clinic_name || batch?.facility_name || "Health Center Storage",
  costPerUnit: Number(batch?.cost_per_unit ?? 0),
  supplier: batch?.supplier_name || "",
  temperature: batch?.temperature || "",
  raw: batch,
});

const findVaccineIdByName = async (vaccineName) => {
  const vaccines = unwrapData(await apiClient.getVaccines());
  const normalizedTarget = String(vaccineName || "").trim().toLowerCase();
  const match = vaccines.find((vaccine) =>
    String(vaccine?.name || "").trim().toLowerCase() === normalizedTarget,
  );

  if (!match?.id) {
    throw new Error(`No vaccine definition found for "${vaccineName}"`);
  }

  return match.id;
};

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [batchesResponse, lowStockResponse, expiringResponse] = await Promise.all([
        apiClient.getInventoryVaccineBatches(),
        apiClient.getLowStockItems(),
        apiClient.getExpiringItems(),
      ]);

      setInventory(unwrapData(batchesResponse).map(normalizeBatch));
      setLowStockAlerts(unwrapData(lowStockResponse).map(normalizeBatch));
      setExpiryAlerts(unwrapData(expiringResponse).map(normalizeBatch));
    } catch (err) {
      setError(err.message || "Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  const addStock = useCallback(
    async (itemData) => {
      try {
        setError(null);
        const vaccineId = await findVaccineIdByName(itemData.vaccineName);
        await apiClient.createInventoryVaccineBatch({
          vaccine_id: vaccineId,
          lot_no: itemData.batchNumber,
          expiry_date: itemData.expiryDate,
          qty_received: Number.parseInt(itemData.quantity || "0", 10) || 0,
        });
        await fetchInventory();
      } catch (err) {
        setError(err.message || "Failed to add inventory item");
        throw err;
      }
    },
    [fetchInventory],
  );

  const updateStock = useCallback(
    async (id, itemData) => {
      try {
        setError(null);
        await apiClient.updateInventoryVaccineBatch(id, {
          lot_no: itemData.batchNumber,
          expiry_date: itemData.expiryDate,
          qty_current: Number.parseInt(itemData.quantity || "0", 10) || 0,
        });
        await fetchInventory();
      } catch (err) {
        setError(err.message || "Failed to update inventory item");
        throw err;
      }
    },
    [fetchInventory],
  );

  const deleteStock = useCallback(async (_id) => {
    const deletionError =
      "Deleting vaccine batches is not supported by the active inventory API.";
    setError(deletionError);
    throw new Error(deletionError);
  }, []);

  const transferStock = useCallback(async (_id, _transferData) => {
    const transferError =
      "Stock transfer from this legacy inventory view is not supported by the active inventory API.";
    setError(transferError);
    throw new Error(transferError);
  }, []);

  const getInventoryReport = useCallback(async () => {
    try {
      setError(null);
      return await apiClient.getInventoryStats();
    } catch (err) {
      setError(err.message || "Failed to fetch inventory report");
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return {
    inventory,
    lowStockAlerts,
    expiryAlerts,
    loading,
    error,
    addStock,
    updateStock,
    deleteStock,
    transferStock,
    getInventoryReport,
    refreshInventory: fetchInventory,
  };
};
