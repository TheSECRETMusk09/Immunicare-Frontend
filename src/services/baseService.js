/**
 * Base API Service
 * Centralized service layer for all API operations
 * Provides standardized error handling, response formatting, and retry logic
 */

import apiClient from "../utils/api";

/**
 * Standard response handler for API calls
 * Handles both direct array responses and wrapped {success: true, data: [...]} responses
 * @param {Promise} apiCall - The API call promise
 * @param {string} context - Context for error messages
 * @returns {Object} - Standardized response { success, data, error }
 */
export const handleApiResponse = async (apiCall, context = "Operation") => {
  try {
    const response = await apiCall;

    // Handle different response formats:
    // 1. { success: true, data: [...] } - wrapped format
    // 2. [...] - direct array
    // 3. { someProperty: ... } - single object

    let data;
    let message = null;
    let code = null;
    let details = null;
    let isSuccess = true;

    if (response && typeof response === "object") {
      if (response.success !== undefined) {
        // Wrapped format: { success: true/false, data: ... }
        isSuccess = response.success;
        data = response.data !== undefined ? response.data : response;
        message = typeof response.message === "string" ? response.message : null;
        code = response.code || null;
        details = response.details || null;
      } else if (Array.isArray(response)) {
        // Direct array
        data = response;
      } else {
        // Single object without success property
        data = response;
        message = typeof response.message === "string" ? response.message : null;
        code = response.code || null;
        details = response.details || null;
      }
    } else {
      data = response;
    }

    return {
      success: isSuccess,
      data: data,
      message,
      code,
      error: null,
      status: null,
      details,
    };
  } catch (error) {
    console.error(`${context} failed:`, error);
    return {
      success: false,
      data: null,
      message: null,
      code: error.data?.code || error.response?.data?.code || null,
      error: error.message || `${context} failed. Please try again.`,
      status: error.status || error.response?.status || null,
      details: error.data || error.response?.data || null,
    };
  }
};

/**
 * Base service class with common CRUD operations
 */
class BaseService {
  constructor(resourcePath) {
    this.resourcePath = resourcePath;
    this.client = apiClient;
  }

  /**
   * Get all items
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getAll(filters = {}) {
    const params = new URLSearchParams(filters);
    const queryString = params.toString();
    const endpoint = queryString
      ? `${this.resourcePath}?${queryString}`
      : this.resourcePath;
    return handleApiResponse(
      this.client.request(endpoint),
      `Fetch ${this.resourcePath}`,
    );
  }

  /**
   * Get single item by ID
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    return handleApiResponse(
      this.client.request(`${this.resourcePath}/${id}`),
      `Fetch ${this.resourcePath}/${id}`,
    );
  }

  /**
   * Create new item
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    return handleApiResponse(
      this.client.request(this.resourcePath, {
        method: "POST",
        data,
      }),
      `Create ${this.resourcePath}`,
    );
  }

  /**
   * Update existing item
   * @param {string|number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    return handleApiResponse(
      this.client.request(`${this.resourcePath}/${id}`, {
        method: "PUT",
        data,
      }),
      `Update ${this.resourcePath}/${id}`,
    );
  }

  /**
   * Delete item
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    return handleApiResponse(
      this.client.request(`${this.resourcePath}/${id}`, {
        method: "DELETE",
      }),
      `Delete ${this.resourcePath}/${id}`,
    );
  }
}

export default BaseService;
