import { useState, useEffect } from "react";

const API_BASE_URL = "http://localhost:5000/api/inventory";

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInventory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/all`);
      if (!response.ok) {
        throw new Error("Failed to fetch inventory");
      }
      const data = await response.json();
      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addInventoryItem = async (itemData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
      });
      if (!response.ok) {
        throw new Error("Failed to add inventory item");
      }
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateInventoryItem = async (id, itemData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
      });
      if (!response.ok) {
        throw new Error("Failed to update inventory item");
      }
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteInventoryItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete inventory item");
      }
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const searchInventory = async (query) => {
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${query}`);
      if (!response.ok) {
        throw new Error("Failed to search inventory");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const getInventoryItemById = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch inventory item details");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const getLowStockItems = async (threshold = 10) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/low-stock?threshold=${threshold}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch low stock items");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const updateStockLevel = async (id, quantityChange) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stock/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quantityChange }),
      });
      if (!response.ok) {
        throw new Error("Failed to update stock level");
      }
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  const getInventoryByCategory = async (category) => {
    try {
      const response = await fetch(`${API_BASE_URL}/category/${category}`);
      if (!response.ok) {
        throw new Error("Failed to fetch inventory by category");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  return {
    inventory,
    loading,
    error,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    searchInventory,
    getInventoryItemById,
    getLowStockItems,
    updateStockLevel,
    getInventoryByCategory,
  };
};
