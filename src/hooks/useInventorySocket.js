import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import {
  normalizeVaccineInventoryRecord,
  normalizeVaccineInventoryTransaction,
  normalizeVaccineStockAlert,
} from '../utils/adminDataAdapters';

/**
 * Custom hook to handle real-time synchronization for Inventory Management
 *
 * @param {Object} params
 * @param {Function} [params.setItems] - State setter for inventory items
 * @param {Function} [params.setBatches] - State setter for vaccine batches
 * @param {Function} [params.setSuppliers] - State setter for suppliers
 * @param {Function} [params.setTransactions] - State setter for transactions
 * @param {Function} [params.setVaccineInventory] - State setter for vaccine inventory records
 * @param {Function} [params.setVaccineTransactions] - State setter for vaccine inventory transactions
 * @param {Function} [params.setStockAlerts] - State setter for stock alerts
 * @param {Function} [params.onChange] - Callback fired on inventory events (for refetch)
 */
const useInventorySocket = ({
  setItems,
  setBatches,
  setSuppliers,
  setTransactions,
  setVaccineInventory,
  setVaccineTransactions,
  setStockAlerts,
  onChange,
}) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const notifyChange = (event, payload) => {
      if (typeof onChange === 'function') {
        onChange({ event, payload });
      }
    };

    // Items
    const handleItemCreated = (item) => {
      setItems?.((prev) => [item, ...(Array.isArray(prev) ? prev : [])]);
      notifyChange('inventory_item_created', item);
    };
    const handleItemUpdated = (item) => {
      setItems?.((prev) =>
        (Array.isArray(prev) ? prev : []).map((i) => (i.id === item.id ? item : i)),
      );
      notifyChange('inventory_item_updated', item);
    };
    const handleItemDeleted = ({ id }) => {
      const parsedId = parseInt(id, 10);
      setItems?.((prev) =>
        (Array.isArray(prev) ? prev : []).filter((i) => i.id !== parsedId),
      );
      notifyChange('inventory_item_deleted', { id: parsedId });
    };

    // Batches
    const handleBatchCreated = (batch) => {
      setBatches?.((prev) => [batch, ...(Array.isArray(prev) ? prev : [])]);
      notifyChange('vaccine_batch_created', batch);
    };
    const handleBatchUpdated = (batch) => {
      setBatches?.((prev) =>
        (Array.isArray(prev) ? prev : []).map((b) => (b.id === batch.id ? batch : b)),
      );
      notifyChange('vaccine_batch_updated', batch);
    };

    // Suppliers
    const handleSupplierCreated = (supplier) => {
      setSuppliers?.((prev) => [supplier, ...(Array.isArray(prev) ? prev : [])]);
      notifyChange('supplier_created', supplier);
    };
    const handleSupplierUpdated = (supplier) => {
      setSuppliers?.((prev) =>
        (Array.isArray(prev) ? prev : []).map((s) =>
          s.id === supplier.id ? supplier : s,
        ),
      );
      notifyChange('supplier_updated', supplier);
    };
    const handleSupplierDeleted = ({ id }) => {
      const parsedId = parseInt(id, 10);
      setSuppliers?.((prev) =>
        (Array.isArray(prev) ? prev : []).filter((s) => s.id !== parsedId),
      );
      notifyChange('supplier_deleted', { id: parsedId });
    };

    // Transactions
    const handleTransactionCreated = (transaction) => {
      setTransactions?.((prev) => [transaction, ...(Array.isArray(prev) ? prev : [])]);
      notifyChange('inventory_transaction_created', transaction);
    };

    // Vaccine Inventory
    const handleVaccineInventoryCreated = (record) => {
      const normalizedRecord = normalizeVaccineInventoryRecord(record || {});

      setVaccineInventory?.((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        const index = current.findIndex((row) => row.id === normalizedRecord.id);

        if (index >= 0) {
          return current.map((row, rowIndex) =>
            rowIndex === index ? normalizedRecord : row,
          );
        }

        return [normalizedRecord, ...current];
      });

      notifyChange('vaccine_inventory_created', normalizedRecord);
    };
    const handleVaccineInventoryUpdated = (record) => {
      const normalizedRecord = normalizeVaccineInventoryRecord(record || {});

      setVaccineInventory?.((prev) =>
        (Array.isArray(prev) ? prev : []).map((r) =>
          r.id === normalizedRecord.id ? normalizedRecord : r,
        ),
      );

      notifyChange('vaccine_inventory_updated', normalizedRecord);
    };

    // Vaccine Transactions
    const handleVaccineTransactionCreated = (transaction) => {
      const normalizedTransaction = normalizeVaccineInventoryTransaction(
        transaction || {},
      );

      setVaccineTransactions?.((prev) => [
        normalizedTransaction,
        ...(Array.isArray(prev) ? prev : []),
      ]);

      notifyChange('vaccine_inventory_transaction_created', normalizedTransaction);
    };

    // Stock Alerts
    // For alerts, we might want to update the list or remove resolved ones depending on the view
    const handleStockAlertUpdated = (alert) => {
      const normalizedAlert = normalizeVaccineStockAlert(alert || {});

      setStockAlerts?.((prev) => {
        const current = Array.isArray(prev) ? prev : [];
        const index = current.findIndex((a) => a.id === normalizedAlert.id);

        if (index >= 0) {
          return current.map((a, rowIndex) =>
            rowIndex === index ? normalizedAlert : a,
          );
        }

        return [normalizedAlert, ...current];
      });

      notifyChange('vaccine_stock_alert_updated', normalizedAlert);
    };

    // Listeners
    socket.on('inventory_item_created', handleItemCreated);
    socket.on('inventory_item_updated', handleItemUpdated);
    socket.on('inventory_item_deleted', handleItemDeleted);

    socket.on('vaccine_batch_created', handleBatchCreated);
    socket.on('vaccine_batch_updated', handleBatchUpdated);

    socket.on('supplier_created', handleSupplierCreated);
    socket.on('supplier_updated', handleSupplierUpdated);
    socket.on('supplier_deleted', handleSupplierDeleted);

    socket.on('inventory_transaction_created', handleTransactionCreated);

    socket.on('vaccine_inventory_created', handleVaccineInventoryCreated);
    socket.on('vaccine_inventory_updated', handleVaccineInventoryUpdated);
    socket.on('vaccine_inventory_transaction_created', handleVaccineTransactionCreated);
    socket.on('vaccine_stock_alert_updated', handleStockAlertUpdated);

    return () => {
      socket.off('inventory_item_created', handleItemCreated);
      socket.off('inventory_item_updated', handleItemUpdated);
      socket.off('inventory_item_deleted', handleItemDeleted);

      socket.off('vaccine_batch_created', handleBatchCreated);
      socket.off('vaccine_batch_updated', handleBatchUpdated);

      socket.off('supplier_created', handleSupplierCreated);
      socket.off('supplier_updated', handleSupplierUpdated);
      socket.off('supplier_deleted', handleSupplierDeleted);

      socket.off('inventory_transaction_created', handleTransactionCreated);

      socket.off('vaccine_inventory_created', handleVaccineInventoryCreated);
      socket.off('vaccine_inventory_updated', handleVaccineInventoryUpdated);
      socket.off('vaccine_inventory_transaction_created', handleVaccineTransactionCreated);
      socket.off('vaccine_stock_alert_updated', handleStockAlertUpdated);
    };
  }, [
    socket,
    setItems,
    setBatches,
    setSuppliers,
    setTransactions,
    setVaccineInventory,
    setVaccineTransactions,
    setStockAlerts,
    onChange,
  ]);
};

export default useInventorySocket;
