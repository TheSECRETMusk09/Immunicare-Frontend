/**
 * Appointment Service
 * Handles all appointment-related API operations
 */

import apiClient from "../utils/api";
import { handleApiResponse } from "./baseService";

const appointmentService = {
  /**
   * Get all appointments
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getAll(filters = {}) {
    return handleApiResponse(
      apiClient.getAppointments(filters),
      "Fetch appointments",
    );
  },

  /**
   * Get appointment by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    return handleApiResponse(apiClient.getAppointment(id), "Fetch appointment");
  },

  /**
   * Get appointments by infant ID
   * @param {string|number} infantId
   * @returns {Promise<Object>}
   */
  async getByInfant(infantId) {
    return handleApiResponse(
      apiClient.getAppointmentsByInfant(infantId),
      "Fetch appointments by infant",
    );
  },

  /**
   * Get guardian appointments
   * @param {string|number} guardianId
   * @param {Object} filters
   * @returns {Promise<Object>}
   */
  async getByGuardian(guardianId, filters = {}) {
    return handleApiResponse(
      apiClient.getGuardianAppointments(guardianId, filters),
      "Fetch guardian appointments",
    );
  },

  /**
   * Get upcoming appointments
   * @param {number} limit
   * @returns {Promise<Object>}
   */
  async getUpcoming(limit = 10) {
    return handleApiResponse(
      apiClient.getUpcomingAppointments(limit),
      "Fetch upcoming appointments",
    );
  },

  /**
   * Get appointment statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    return handleApiResponse(
      apiClient.getAppointmentStats(),
      "Fetch appointment stats",
    );
  },

  /**
   * Create new appointment
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    return handleApiResponse(
      apiClient.createAppointment(data),
      "Create appointment",
    );
  },

  /**
   * Update appointment
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    return handleApiResponse(
      apiClient.updateAppointment(id, data),
      "Update appointment",
    );
  },

  /**
   * Cancel appointment
   * @param {string|number} id
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async cancel(id, reason) {
    return handleApiResponse(
      apiClient.cancelAppointment(id, reason),
      "Cancel appointment",
    );
  },

  /**
   * Complete appointment
   * @param {string|number} id
   * @param {string} notes
   * @returns {Promise<Object>}
   */
  async complete(id, notes) {
    return handleApiResponse(
      apiClient.completeAppointment(id, notes),
      "Complete appointment",
    );
  },
};

export default appointmentService;
