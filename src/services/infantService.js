/**
 * Infant Service
 * Handles all infant-related API operations including control numbers and allergies
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const requestApi = (endpoint, options = {}) =>
  apiClient.request(endpoint, {
    method: options.method || "GET",
    data: options.data,
    params: options.params,
    ...options,
  });

const infantService = {
  /**
   * Get all infants
   * @returns {Promise<Object>}
   */
  async getAll() {
    return handleApiResponse(apiClient.getInfants(), "Fetch infants");
  },

  /**
   * Get infant by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    return handleApiResponse(apiClient.getInfant(id), "Fetch infant");
  },

  /**
   * Get infant by control number
   * @param {string} controlNumber
   * @returns {Promise<Object>}
   */
  async getByControlNumber(controlNumber) {
    return handleApiResponse(
      requestApi(`/infants/control-number/${controlNumber}`),
      "Fetch infant by control number",
    );
  },

  /**
   * Get infants by guardian ID
   * @param {string|number} guardianId
   * @returns {Promise<Object>}
   */
  async getByGuardian(guardianId) {
    return handleApiResponse(
      apiClient.getInfantsByGuardian(guardianId),
      "Fetch infants by guardian",
    );
  },

  /**
   * Search infants (includes control number search)
   * @param {string} query
   * @returns {Promise<Object>}
   */
  async search(query) {
    return handleApiResponse(apiClient.searchInfants(query), "Search infants");
  },

  /**
   * Create new infant (auto-generates control number)
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    return handleApiResponse(apiClient.createInfant(data), "Create infant");
  },

  /**
   * Update infant
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    return handleApiResponse(apiClient.updateInfant(id, data), "Update infant");
  },

  /**
   * Delete infant (soft delete)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    return handleApiResponse(apiClient.deleteInfant(id), "Delete infant");
  },

  // ========================================
  // ALLERGY MANAGEMENT
  // ========================================

  /**
   * Get allergies for an infant
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async getAllergies(infantId) {
    return handleApiResponse(
      requestApi(`/infant-allergies/${infantId}`),
      "Fetch infant allergies",
    );
  },

  /**
   * Add allergy to infant
   * @param {Object} allergyData
   * @returns {Promise<Object>}
   */
  async addAllergy(allergyData) {
    return handleApiResponse(
      requestApi(`/infant-allergies`, {
        method: "POST",
        data: allergyData,
      }),
      "Add infant allergy",
    );
  },

  /**
   * Update allergy
   * @param {string|number} allergyId
   * @param {Object} allergyData
   * @returns {Promise<Object>}
   */
  async updateAllergy(allergyId, allergyData) {
    return handleApiResponse(
      requestApi(`/infant-allergies/${allergyId}`, {
        method: "PUT",
        data: allergyData,
      }),
      "Update infant allergy",
    );
  },

  /**
   * Delete allergy
   * @param {string|number} allergyId
   * @returns {Promise<Object>}
   */
  async deleteAllergy(allergyId) {
    return handleApiResponse(
      requestApi(`/infant-allergies/${allergyId}`, {
        method: "DELETE",
      }),
      "Delete infant allergy",
    );
  },

  /**
   * Check vaccine allergy contraindication
   * @param {string|number} infantId
   * @param {string|number} vaccineId
   * @returns {Promise<Object>}
   */
  async checkVaccineAllergy(infantId, vaccineId) {
    return handleApiResponse(
      requestApi(`/infant-allergies/${infantId}/vaccine-check/${vaccineId}`),
      "Check vaccine allergy",
    );
  },

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get infant statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return handleApiResponse(
      requestApi(`/infants/stats/overview`),
      "Fetch infant statistics",
    );
  },

  /**
   * Get infants with upcoming vaccinations
   * @returns {Promise<Object>}
   */
  async getUpcomingVaccinations() {
    return handleApiResponse(
      requestApi(`/infants/upcoming-vaccinations`),
      "Fetch upcoming vaccinations",
    );
  },

  /**
   * Get infants by age range
   * @param {number} minAge
   * @param {number} maxAge
   * @returns {Promise<Object>}
   */
  async getByAgeRange(minAge, maxAge) {
    return handleApiResponse(
      requestApi(`/infants/age-range/${minAge}/${maxAge}`),
      "Fetch infants by age range",
    );
  },
};

export default infantService;
