/**
 * Inventory Service
 * Handles all inventory-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const inventoryService = {
  /**
   * Get all inventory items
   * @returns {Promise<Object>}
   */
  async getAllItems() {
    return handleApiResponse(
      apiClient.getInventoryItems(),
      "Fetch inventory items",
    );
  },

  /**
   * Get inventory items by category
   * @param {string} category
   * @returns {Promise<Object>}
   */
  async getItemsByCategory(category) {
    return handleApiResponse(
      apiClient.getInventoryItemsByCategory(category),
      "Fetch inventory items by category",
    );
  },

  /**
   * Create inventory item
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createItem(data) {
    return handleApiResponse(
      apiClient.createInventoryItem(data),
      "Create inventory item",
    );
  },

  /**
   * Update inventory item
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateItem(id, data) {
    return handleApiResponse(
      apiClient.updateInventoryItem(id, data),
      "Update inventory item",
    );
  },

  /**
   * Delete inventory item
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async deleteItem(id) {
    return handleApiResponse(
      apiClient.deleteInventoryItem(id),
      "Delete inventory item",
    );
  },

  /**
   * Get low stock items
   * @returns {Promise<Object>}
   */
  async getLowStock() {
    return handleApiResponse(
      apiClient.getLowStockItems(),
      "Fetch low stock items",
    );
  },

  /**
   * Get expiring items
   * @returns {Promise<Object>}
   */
  async getExpiring() {
    return handleApiResponse(
      apiClient.getExpiringItems(),
      "Fetch expiring items",
    );
  },

  /**
   * Get all suppliers
   * @returns {Promise<Object>}
   */
  async getSuppliers() {
    return handleApiResponse(apiClient.getSuppliers(), "Fetch suppliers");
  },

  /**
   * Create supplier
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createSupplier(data) {
    return handleApiResponse(apiClient.createSupplier(data), "Create supplier");
  },

  /**
   * Get inventory transactions
   * @returns {Promise<Object>}
   */
  async getTransactions() {
    return handleApiResponse(
      apiClient.getInventoryTransactions(),
      "Fetch inventory transactions",
    );
  },

  /**
   * Create inventory transaction
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createTransaction(data) {
    return handleApiResponse(
      apiClient.createInventoryTransaction(data),
      "Create inventory transaction",
    );
  },

  /**
   * Get inventory statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return handleApiResponse(
      apiClient.getInventoryStats(),
      "Fetch inventory stats",
    );
  },

  // ==================== VACCINE INVENTORY ====================

  /**
   * Get vaccine inventory
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async getVaccineInventory(url) {
    return handleApiResponse(
      apiClient.getVaccineInventory(url),
      "Fetch vaccine inventory",
    );
  },

  /**
   * Get vaccine inventory by clinic
   * @param {string|number} clinicId
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async getVaccineInventoryByClinic(clinicId, filters = {}) {
    return handleApiResponse(
      apiClient.getVaccineInventoryByClinic(clinicId, filters),
      "Fetch vaccine inventory by clinic",
    );
  },

  /**
   * Create vaccine inventory item
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createVaccineInventory(data) {
    return handleApiResponse(
      apiClient.createVaccineInventory(data),
      "Create vaccine inventory item",
    );
  },

  /**
   * Update vaccine inventory item
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateVaccineInventory(id, data) {
    return handleApiResponse(
      apiClient.updateVaccineInventory(id, data),
      "Update vaccine inventory item",
    );
  },

  /**
   * Delete vaccine inventory item
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async deleteVaccineInventory(id) {
    return handleApiResponse(
      apiClient.deleteVaccineInventory(id),
      "Delete vaccine inventory item",
    );
  },

  /**
   * Get vaccine inventory transactions
   * @param {string|number} vaccineInventoryId
   * @returns {Promise<Object>}
   */
  async getVaccineInventoryTransactions(vaccineInventoryId) {
    return handleApiResponse(
      apiClient.getVaccineInventoryTransactions(vaccineInventoryId),
      "Fetch vaccine inventory transactions",
    );
  },

  /**
   * Create vaccine inventory transaction
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createVaccineInventoryTransaction(data) {
    return handleApiResponse(
      apiClient.createVaccineInventoryTransaction(data),
      "Create vaccine inventory transaction",
    );
  },

  /**
   * Get vaccine stock alerts by clinic
   * @param {string|number} clinicId
   * @returns {Promise<Object>}
   */
  async getVaccineStockAlertsByClinic(clinicId) {
    return handleApiResponse(
      apiClient.getVaccineStockAlertsByClinic(clinicId),
      "Fetch vaccine stock alerts",
    );
  },

  /**
   * Get vaccine stock alerts
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async getVaccineStockAlerts(filters = {}) {
    return handleApiResponse(
      apiClient.getVaccineStockAlerts(filters),
      "Fetch vaccine stock alerts",
    );
  },

  /**
   * Acknowledge vaccine stock alert
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async acknowledgeVaccineStockAlert(id) {
    return handleApiResponse(
      apiClient.acknowledgeVaccineStockAlert(id),
      "Acknowledge vaccine stock alert",
    );
  },

  /**
   * Resolve vaccine stock alert
   * @param {string|number} id
   * @param {string} resolutionNotes
   * @returns {Promise<Object>}
   */
  async resolveVaccineStockAlert(id, resolutionNotes) {
    return handleApiResponse(
      apiClient.resolveVaccineStockAlert(id, resolutionNotes),
      "Resolve vaccine stock alert",
    );
  },

  /**
   * Get vaccine inventory stats by clinic
   * @param {string|number} clinicId
   * @returns {Promise<Object>}
   */
  async getVaccineInventoryStatsByClinic(clinicId) {
    return handleApiResponse(
      apiClient.getVaccineInventoryStatsByClinic(clinicId),
      "Fetch vaccine inventory stats",
    );
  },

  /**
   * Get vaccine inventory stats
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async getVaccineInventoryStats(filters = {}) {
    return handleApiResponse(
      apiClient.getVaccineInventoryStats(filters),
      "Fetch vaccine inventory stats",
    );
  },
};

export default inventoryService;
