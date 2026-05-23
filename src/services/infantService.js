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

const normalizeInfantPayloadForAdmin = (data = {}) => {
  const payload = {
    ...data,
  };

  if (
    Object.prototype.hasOwnProperty.call(payload, "birth_length") &&
    !Object.prototype.hasOwnProperty.call(payload, "birth_height")
  ) {
    payload.birth_height = payload.birth_length;
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "birthplace") &&
    !Object.prototype.hasOwnProperty.call(payload, "place_of_birth")
  ) {
    payload.place_of_birth = payload.birthplace;
  }

  if (payload.guardian_id === "") {
    payload.guardian_id = null;
  }

  delete payload.birth_length;
  delete payload.birthplace;

  return payload;
};

const infantService = {
  /**
   * Get all infants
   * @returns {Promise<Object>}
   */
  async getAll(filters = {}) {
    return handleApiResponse(apiClient.getInfants(filters), "Fetch infants");
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
    return handleApiResponse(
      apiClient.createInfant(normalizeInfantPayloadForAdmin(data)),
      "Create infant",
    );
  },

  /**
   * Update infant
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    return handleApiResponse(
      apiClient.updateInfant(id, normalizeInfantPayloadForAdmin(data)),
      "Update infant",
    );
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

  // ========================================
  // AGE MANAGEMENT
  // ========================================

  /**
   * Get all infants with their calculated ages
   * @param {number} limit
   * @param {number} offset
   * @returns {Promise<Object>}
   */
  async getInfantAges(limit = 100, offset = 0) {
    return handleApiResponse(
      apiClient.getInfantAges(limit, offset),
      "Fetch infant ages",
    );
  },

  /**
   * Get age statistics for all infants
   * @returns {Promise<Object>}
   */
  async getAgeStats() {
    return handleApiResponse(
      apiClient.getInfantAgeStats(),
      "Fetch infant age statistics",
    );
  },

  /**
   * Get detailed age information for an infant
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async getAgeInfo(infantId) {
    return handleApiResponse(
      apiClient.getInfantAgeInfo(infantId),
      "Fetch infant age info",
    );
  },

  /**
   * Update age for a specific infant
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async updateAge(infantId) {
    return handleApiResponse(
      apiClient.updateInfantAge(infantId),
      "Update infant age",
    );
  },

  /**
   * Update ages for all infants (bulk operation)
   * @returns {Promise<Object>}
   */
  async updateAllAges() {
    return handleApiResponse(
      apiClient.updateAllInfantAges(),
      "Update all infant ages",
    );
  },

  /**
   * Calculate age from a given date of birth
   * @param {string} dob - Date of birth
   * @returns {Promise<Object>}
   */
  async calculateAge(dob) {
    return handleApiResponse(
      apiClient.calculateAge(dob),
      "Calculate infant age",
    );
  },
};

export default infantService;
