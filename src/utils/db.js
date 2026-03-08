import Dexie from "dexie";

export const db = new Dexie("ImmunicareDB");

db.version(1).stores({
  infants: "++id, name, dateOfBirth, guardianId, createdAt",
  vaccinations:
    "++id, infantId, vaccineId, dateAdministered, batchNumber, createdAt",
  appointments: "++id, infantId, date, type, status, notes, createdAt",
  inventory: "++id, vaccineId, batchNumber, quantity, expiryDate, createdAt",
  syncQueue: "++id, type, data, createdAt",
});

// Sync functions
export const saveForOffline = async (table, data) => {
  try {
    await db[table].add(data);
  } catch (error) {
    console.error("Error saving to offline DB:", error);
  }
};

export const getOfflineData = async (table) => {
  try {
    return await db[table].toArray();
  } catch (error) {
    console.error("Error getting offline data:", error);
    return [];
  }
};

export const syncData = async () => {
  // Implement sync logic when online
  const queuedItems = await db.syncQueue.toArray();

  if (queuedItems.length > 0) {
    console.log(`Processing ${queuedItems.length} queued items for sync`);
    // Process queue and sync with server
    // This would integrate with the API client
  }
};

export const clearOfflineData = async (table) => {
  try {
    await db[table].clear();
  } catch (error) {
    console.error("Error clearing offline data:", error);
  }
};
