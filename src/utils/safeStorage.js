/**
 * Safe Storage Utility
 *
 * Provides safe access to localStorage and sessionStorage, handling SecurityError
 * exceptions that can occur in:
 * - Safari Private Browsing mode
 * - When cookies/storage are blocked by browser settings
 * - In certain iframe configurations with different origins
 * - When "Block all cookies" is enabled in browser settings
 */

// Check if storage is accessible
const isStorageAvailable = (storageType) => {
  try {
    const storage = window[storageType];
    if (!storage) return false;

    // Test actual read/write capability
    const testKey = `__storage_test_${Date.now()}`;
    storage.setItem(testKey, "test");
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// In-memory fallback storage for when browser storage is not available
class MemoryStorage {
  constructor() {
    this._storage = new Map();
  }

  getItem(key) {
    return this._storage.get(key) || null;
  }

  setItem(key, value) {
    this._storage.set(key, value);
  }

  removeItem(key) {
    this._storage.delete(key);
  }

  clear() {
    this._storage.clear();
  }

  get length() {
    return this._storage.size;
  }

  key(index) {
    const keys = Array.from(this._storage.keys());
    return keys[index] || null;
  }
}

// Create safe storage wrappers
const createSafeStorage = (storageType) => {
  const isAvailable = isStorageAvailable(storageType);
  const storage = isAvailable ? window[storageType] : new MemoryStorage();

  return {
    isAvailable,

    getItem: (key) => {
      try {
        return storage.getItem(key);
      } catch (e) {
        console.warn(`Storage access blocked for key "${key}":`, e.message);
        return null;
      }
    },

    setItem: (key, value) => {
      try {
        storage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn(`Storage write blocked for key "${key}":`, e.message);
        return false;
      }
    },

    removeItem: (key) => {
      try {
        storage.removeItem(key);
        return true;
      } catch (e) {
        console.warn(`Storage remove blocked for key "${key}":`, e.message);
        return false;
      }
    },

    clear: () => {
      try {
        storage.clear();
        return true;
      } catch (e) {
        console.warn("Storage clear blocked:", e.message);
        return false;
      }
    },
  };
};

// Export safe storage instances
export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");

// Helper to get the best available storage (prefers localStorage if available)
export const getBestAvailableStorage = () => {
  if (safeLocalStorage.isAvailable) {
    return safeLocalStorage;
  }
  if (safeSessionStorage.isAvailable) {
    return safeSessionStorage;
  }
  // Return localStorage wrapper (will use memory fallback)
  return safeLocalStorage;
};

// Helper to check if any persistent storage is available
export const hasPersistentStorage = () => {
  return safeLocalStorage.isAvailable || safeSessionStorage.isAvailable;
};

export default {
  safeLocalStorage,
  safeSessionStorage,
  getBestAvailableStorage,
  hasPersistentStorage,
};
