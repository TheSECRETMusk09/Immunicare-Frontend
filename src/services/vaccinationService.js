/**
 * Vaccination Service
 * Handles all vaccination-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const vaccinationService = {
  /**
   * Get all vaccination records
   * @returns {Promise<Object>}
   */
  async getAllRecords() {
    return handleApiResponse(
      apiClient.getVaccinationRecords(),
      "Fetch vaccination records",
    );
  },

  /**
   * Get vaccination records by infant ID
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async getRecordsByInfant(infantId) {
    return handleApiResponse(
      apiClient.getVaccinationRecordsByInfant(infantId),
      "Fetch vaccination records by infant",
    );
  },

  /**
   * Create vaccination record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createRecord(data) {
    return handleApiResponse(
      apiClient.createVaccinationRecord(data),
      "Create vaccination record",
    );
  },

  /**
   * Update vaccination record
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateRecord(id, data) {
    return handleApiResponse(
      apiClient.updateVaccinationRecord(id, data),
      "Update vaccination record",
    );
  },

  /**
   * Get all vaccines
   * @returns {Promise<Object>}
   */
  async getVaccines() {
    return handleApiResponse(apiClient.getVaccines(), "Fetch vaccines");
  },

  /**
   * Create vaccine
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createVaccine(data) {
    return handleApiResponse(apiClient.createVaccine(data), "Create vaccine");
  },

  /**
   * Get vaccination schedules
   * @returns {Promise<Object>}
   */
  async getSchedules() {
    return handleApiResponse(
      apiClient.getVaccinationSchedules(),
      "Fetch vaccination schedules",
    );
  },

  /**
   * Get vaccination schedules by infant ID
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async getSchedulesByInfant(infantId) {
    return handleApiResponse(
      apiClient.getVaccinationSchedulesByInfant(infantId),
      "Fetch vaccination schedules by infant",
    );
  },

  /**
   * Get vaccine batches
   * @returns {Promise<Object>}
   */
  async getBatches() {
    return handleApiResponse(
      apiClient.getVaccineBatches(),
      "Fetch vaccine batches",
    );
  },

  /**
   * Create vaccine batch
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createBatch(data) {
    return handleApiResponse(
      apiClient.createVaccineBatch(data),
      "Create vaccine batch",
    );
  },

  /**
   * Get vaccination analytics
   * @returns {Promise<Object>}
   */
  async getAnalytics() {
    return handleApiResponse(
      apiClient.getVaccinationAnalytics(),
      "Fetch vaccination analytics",
    );
  },

  /**
   * Export vaccination records
   * @param {string} format
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async exportRecords(format = "csv", filters = {}) {
    return handleApiResponse(
      apiClient.exportVaccinationRecords(format, filters),
      "Export vaccination records",
    );
  },
};

export default vaccinationService;
