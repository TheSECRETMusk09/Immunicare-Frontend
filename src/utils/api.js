import axios from "axios";
import axiosRetry from "axios-retry";
import { safeLocalStorage, safeSessionStorage } from "./safeStorage";
import { API_BASE_URL } from "./apiConfig";

const LOGIN_ROUTES = new Set([
  "/",
  "/login",
  "/guardian/login",
  "/admin/login",
  "/client/login",
]);

let refreshRequest = null;

const extractErrorMessage = (errorData) => {
  if (!errorData) return null;

  if (typeof errorData === "string") {
    return errorData;
  }

  if (typeof errorData.message === "string" && errorData.message.trim()) {
    return errorData.message;
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    return errorData.error;
  }

  if (errorData.error && typeof errorData.error === "object") {
    if (
      typeof errorData.error.message === "string" &&
      errorData.error.message.trim()
    ) {
      return errorData.error.message;
    }

    if (
      typeof errorData.error.details === "string" &&
      errorData.error.details.trim()
    ) {
      return errorData.error.details;
    }
  }

  if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
    const firstError = errorData.errors[0];
    if (typeof firstError === "string") return firstError;
    if (typeof firstError?.message === "string") return firstError.message;
  }

  return null;
};

const getCurrentPath = () => {
  if (typeof window === "undefined") return "";
  return window.location?.pathname || "";
};

const clearAuthStorage = () => {
  safeLocalStorage.removeItem("token");
  safeSessionStorage.removeItem("token");
  safeLocalStorage.removeItem("refreshToken");
  safeSessionStorage.removeItem("refreshToken");
  safeLocalStorage.removeItem("user");
  safeSessionStorage.removeItem("user");
};

const redirectToLoginIfNeeded = () => {
  if (typeof window === "undefined") return;
  const pathname = getCurrentPath();
  if (!LOGIN_ROUTES.has(pathname)) {
    window.location.href = "/";
  }
};

const getOrCreateRefreshRequest = () => {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          timeout: 10000,
        },
      )
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
};

// Create axios instance with increased timeout
const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable sending cookies in cross-origin requests
  timeout: 30000, // 30 second timeout for all requests (increased from 10s)
});

// Configure retry logic - don't retry on 401 Unauthorized
axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // exponential backoff
  },
  retryCondition: (error) => {
    // Retry on network errors or 5xx status codes, but NOT on 401 (auth errors)
    if (error.response?.status === 401) {
      return false; // Don't retry on auth errors
    }
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500)
    );
  },
});

// Request interceptor to add auth token
axiosClient.interceptors.request.use(
  (config) => {
    // Check both localStorage and sessionStorage for token using safe storage
    const token =
      safeLocalStorage.getItem("token") || safeSessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for token refresh on 401
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle network errors and timeouts
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
        console.warn("Request timeout:", error.config?.url);
        throw new Error("Request timed out. Please try again.");
      }

      if (!navigator.onLine) {
        throw new Error(
          "You are currently offline. Please check your internet connection.",
        );
      }

      // Network error without response - server might be down
      console.error("Network error:", error.message);
      throw new Error(
        "Unable to connect to server. Please check your connection and try again.",
      );
    }

    // Handle 401 Unauthorized - try to refresh token
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !String(originalRequest.url || "").includes("/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await getOrCreateRefreshRequest();

        // If refresh successful, update token and retry original request
        const newToken =
          refreshResponse.data.token || refreshResponse.data.accessToken;
        const newRefreshToken = refreshResponse.data.refreshToken;

        if (newToken) {
          // Store tokens for future requests (both cookie and localStorage for redundancy)
          const rememberMe = safeLocalStorage.getItem("rememberMe") === "true";
          const tokenStorage = rememberMe
            ? safeLocalStorage
            : safeSessionStorage;

          // Update localStorage/sessionStorage for subsequent API calls
          tokenStorage.setItem("token", newToken);

          if (newRefreshToken) {
            tokenStorage.setItem("refreshToken", newRefreshToken);
          }

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;

          // Retry the original request
          return axiosClient(originalRequest);
        }

        clearAuthStorage();
        redirectToLoginIfNeeded();
        return Promise.reject(error);
      } catch (refreshError) {
        // Refresh failed, logout user
        console.error("Token refresh error:", refreshError.message);

        clearAuthStorage();
        redirectToLoginIfNeeded();
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    let errorMessage = `HTTP error! status: ${error.response?.status || "unknown"}`;

    if (error.response?.data) {
      const errorData = error.response.data;
      const extractedMessage = extractErrorMessage(errorData);
      if (extractedMessage) {
        errorMessage = extractedMessage;
      }
    }

    const apiError = new Error(errorMessage);
    apiError.status = error.response?.status;
    apiError.code = error.code;
    apiError.response = error.response;
    apiError.data = error.response?.data;
    apiError.originalError = error;
    throw apiError;
  },
);

class ApiClient {
  constructor() {
    this.client = axiosClient;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await this.client.request({
        url: endpoint,
        ...options,
      });
      return response.data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Generic HTTP helpers for backward compatibility across service modules
  async get(endpoint, config = {}) {
    return this.request(endpoint, {
      method: "GET",
      ...config,
    });
  }

  async post(endpoint, data, config = {}) {
    return this.request(endpoint, {
      method: "POST",
      data,
      ...config,
    });
  }

  async put(endpoint, data, config = {}) {
    return this.request(endpoint, {
      method: "PUT",
      data,
      ...config,
    });
  }

  async delete(endpoint, config = {}) {
    return this.request(endpoint, {
      method: "DELETE",
      ...config,
    });
  }

  // Custom request method for non-standard endpoints
  async customRequest(url, options = {}) {
    try {
      const response = await this.client.request({
        url,
        ...options,
      });
      return response;
    } catch (error) {
      console.error("Custom API request failed:", error);
      throw error;
    }
  }

  // Auth endpoints
  async login(credentials) {
    try {
      console.log(
        "[ApiClient] Sending login request for:",
        credentials.username,
      );
      const response = await axiosClient.post("/auth/login", credentials, {
        withCredentials: true,
      });
      console.log("[ApiClient] Login response status:", response.status);
      console.log("[ApiClient] Login response data:", response.data);
      // Store refresh token for token refresh fallback
      if (response.data.refreshToken) {
        const storage = credentials.rememberMe
          ? safeLocalStorage
          : safeSessionStorage;
        storage.setItem("refreshToken", response.data.refreshToken);
      }
      return response.data;
    } catch (error) {
      console.error(
        "[ApiClient] Login error:",
        error.response?.data || error.message,
      );
      const isInvalidCredentials = error.response?.status === 401;
      const errorMessage = isInvalidCredentials
        ? "Invalid credentials"
        : error.response?.data?.message ||
          error.response?.data?.error ||
          "Login failed. Please check your credentials.";
      throw new Error(errorMessage);
    }
  }

  async register(userData) {
    return this.request("/auth/register/guardian", {
      method: "POST",
      data: userData,
    });
  }

  async verifyGuardianRegistration(phone, otp) {
    return this.request("/auth/register/guardian/verify", {
      method: "POST",
      data: { phone, otp },
    });
  }

  async forgotPassword(email) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      data: { email },
    });
  }

  // New dual-option forgot password methods
  async forgotPasswordOtp(email, method = "email") {
    return this.request("/auth/forgot-password/otp", {
      method: "POST",
      data: { email, method },
    });
  }

  async verifyResetOtp(email, otp) {
    return this.request("/auth/forgot-password/verify-otp", {
      method: "POST",
      data: { email, otp },
    });
  }

  async resetPasswordWithToken(token, newPassword) {
    return this.request("/auth/forgot-password/reset-with-token", {
      method: "POST",
      data: { resetToken: token, newPassword },
    });
  }

  async resetPassword(token, newPassword) {
    return this.request("/auth/reset-password", {
      method: "POST",
      data: { token, newPassword },
    });
  }

  async verifySession() {
    return this.request("/auth/verify", {
      method: "GET",
    });
  }

  async logout() {
    return this.request("/auth/logout", {
      method: "POST",
    });
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.request("/dashboard/stats");
  }

  async getGuardianStats(guardianId) {
    return this.request(`/dashboard/guardian/${guardianId}/stats`);
  }

  async getGuardianAppointments(guardianId, filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/dashboard/guardian/${guardianId}/appointments${suffix}`);
  }

  async getActivityFeed(limit = 10) {
    return this.request(`/dashboard/activity?limit=${limit}`);
  }

  async getDashboardInfants() {
    return this.request("/dashboard/infants");
  }

  async getDashboardGuardians() {
    return this.request("/users/guardians");
  }

  async getDashboardAppointments() {
    return this.request("/dashboard/appointments");
  }

  async getAdminVaccinationMonitoring(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/dashboard/admin/vaccination-monitoring${suffix}`);
  }

  async getVaccinationAnalytics() {
    return this.request("/analytics/vaccinations");
  }

  async getAppointmentAnalytics() {
    return this.request("/analytics/appointments");
  }

  // Comprehensive analytics dashboard data
  async getAnalyticsDashboard(params = {}) {
    const queryParams = new URLSearchParams(params);
    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request(`/analytics/dashboard${suffix}`);
  }

  async getInventoryAnalytics() {
    return this.request("/analytics/inventory");
  }

  async getTrendsAnalytics(months = 12) {
    return this.request(`/analytics/trends?months=${months}`);
  }

  async getDemographicsAnalytics() {
    return this.request("/analytics/demographics");
  }

  // User Management endpoints
  async getAllUsers() {
    return this.request("/users/all-users");
  }

  async getGuardians() {
    return this.request("/users/guardians");
  }

  async createGuardian(guardianData) {
    return this.request("/users/guardians", {
      method: "POST",
      data: guardianData,
    });
  }

  async updateGuardian(id, guardianData, options = {}) {
    const payload = {
      ...(guardianData || {}),
    };

    if (
      options.expected_updated_at !== undefined &&
      payload.expected_updated_at === undefined
    ) {
      payload.expected_updated_at = options.expected_updated_at;
    }

    return this.request(`/users/guardians/${id}`, {
      method: "PUT",
      data: payload,
    });
  }

  async deleteGuardian(id, options = {}) {
    const params = new URLSearchParams();
    if (options.expected_updated_at) {
      params.set("expected_updated_at", options.expected_updated_at);
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";

    return this.request(`/users/guardians/${id}${suffix}`, {
      method: "DELETE",
      data: options.expected_updated_at
        ? { expected_updated_at: options.expected_updated_at }
        : undefined,
    });
  }

  async getSystemUsers() {
    return this.request("/users/system-users");
  }

  async createSystemUser(userData) {
    return this.request("/users/system-users", {
      method: "POST",
      data: userData,
    });
  }

  async updateSystemUser(id, userData) {
    return this.request(`/users/system-users/${id}`, {
      method: "PUT",
      data: userData,
    });
  }

  async deleteSystemUser(id) {
    return this.request(`/users/system-users/${id}`, {
      method: "DELETE",
    });
  }

  async toggleUserActive(id, isActive) {
    return this.request(`/users/system-users/${id}/toggle-active`, {
      method: "PUT",
      data: { is_active: isActive },
    });
  }

  async getRoles() {
    return this.request("/users/roles");
  }

  async getClinics() {
    return this.request("/users/clinics");
  }

  // Get facility info for the current user
  async getFacilityInfo() {
    try {
      // Try to get facility info from settings
      const response = await this.request("/settings/facility");
      return response;
    } catch (error) {
      // Fallback: try to get clinic info
      try {
        const clinics = await this.request("/users/clinics");
        // Handle wrapped response format
        const clinicData = clinics?.data || clinics;
        if (Array.isArray(clinicData) && clinicData.length > 0) {
          return clinicData[0];
        }
        return null;
      } catch (clinicError) {
        console.warn("Failed to get facility info:", clinicError);
        return null;
      }
    }
  }

  // Infants Management endpoints
  async getInfants() {
    return this.request("/infants");
  }

  async getInfant(id) {
    return this.request(`/infants/${id}`);
  }

  async createInfant(infantData) {
    return this.request("/infants", {
      method: "POST",
      data: infantData,
    });
  }

  async createGuardianInfant(infantData) {
    return this.request("/infants/guardian", {
      method: "POST",
      data: infantData,
    });
  }

  async updateInfant(id, infantData) {
    return this.request(`/infants/${id}`, {
      method: "PUT",
      data: infantData,
    });
  }

  async updateGuardianInfant(id, infantData) {
    return this.request(`/infants/${id}/guardian`, {
      method: "PUT",
      data: infantData,
    });
  }

  async deleteInfant(id) {
    return this.request(`/infants/${id}`, {
      method: "DELETE",
    });
  }

  async deleteGuardianInfant(id) {
    return this.request(`/infants/${id}/guardian`, {
      method: "DELETE",
    });
  }

  async searchInfants(query) {
    return this.request(`/infants/search/${query}`);
  }

  async getInfantsByGuardian(guardianId) {
    return this.request(`/infants/guardian/${guardianId}`);
  }

  // Vaccinations Management endpoints
  async getAllVaccinations() {
    return this.request("/vaccinations/records");
  }

  async getVaccinationRecords() {
    return this.request("/vaccinations/records");
  }

  async getVaccinationRecordsByInfant(infantId) {
    return this.request(`/vaccinations/records/infant/${infantId}`);
  }

  // Alias for getVaccinationRecordsByInfant
  async getVaccinationsByInfant(infantId) {
    return this.getVaccinationRecordsByInfant(infantId);
  }

  async createVaccinationRecord(recordData) {
    return this.request("/vaccinations/records", {
      method: "POST",
      data: recordData,
    });
  }

  async updateVaccinationRecord(id, recordData) {
    return this.request(`/vaccinations/records/${id}`, {
      method: "PUT",
      data: recordData,
    });
  }

  async deleteVaccinationRecord(id) {
    return this.request(`/vaccinations/${id}`, {
      method: "DELETE",
    });
  }

  async getVaccines() {
    return this.request("/vaccinations/vaccines");
  }

  async getVaccinationSchedules() {
    return this.request("/vaccinations/schedules");
  }

  async getVaccinationSchedulesByInfant(infantId) {
    return this.request(`/vaccinations/schedules/infant/${infantId}`);
  }

  async createVaccine(vaccineData) {
    return this.request("/vaccinations/vaccines", {
      method: "POST",
      data: vaccineData,
    });
  }

  async getVaccineBatches() {
    return this.request("/vaccinations/batches");
  }

  async createVaccineBatch(batchData) {
    return this.request("/vaccinations/batches", {
      method: "POST",
      data: batchData,
    });
  }

  // Inventory Management endpoints
  async getInventoryItems() {
    return this.request("/inventory/items");
  }

  async getInventoryItemsByCategory(category) {
    return this.request(`/inventory/items/category/${category}`);
  }

  async createInventoryItem(itemData) {
    return this.request("/inventory/items", {
      method: "POST",
      data: itemData,
    });
  }

  async updateInventoryItem(id, itemData) {
    return this.request(`/inventory/items/${id}`, {
      method: "PUT",
      data: itemData,
    });
  }

  async deleteInventoryItem(id) {
    return this.request(`/inventory/items/${id}`, {
      method: "DELETE",
    });
  }

  async getLowStockItems() {
    return this.request("/inventory/low-stock");
  }

  async getExpiringItems() {
    return this.request("/inventory/expiring");
  }

  async getSuppliers() {
    return this.request("/inventory/suppliers");
  }

  async createSupplier(supplierData) {
    return this.request("/inventory/suppliers", {
      method: "POST",
      data: supplierData,
    });
  }

  async getInventoryTransactions() {
    return this.request("/inventory/transactions");
  }

  async createInventoryTransaction(transactionData) {
    return this.request("/inventory/transactions", {
      method: "POST",
      data: transactionData,
    });
  }

  async getInventoryStats() {
    return this.request("/inventory/stats");
  }

  // Vaccine Inventory Management endpoints (based on ITEMS_vaccines.docx structure)
  async getVaccineInventory(url = "/inventory/vaccine-inventory") {
    return this.request(url);
  }

  async getVaccineInventoryByClinic(clinicId, filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(
      `/inventory/vaccine-inventory/clinic/${clinicId}?${params}`,
    );
  }

  async createVaccineInventory(inventoryData) {
    return this.request("/inventory/vaccine-inventory", {
      method: "POST",
      data: inventoryData,
    });
  }

  async updateVaccineInventory(id, inventoryData) {
    return this.request(`/inventory/vaccine-inventory/${id}`, {
      method: "PUT",
      data: inventoryData,
    });
  }

  async deleteVaccineInventory(id) {
    return this.request(`/inventory/vaccine-inventory/${id}`, {
      method: "DELETE",
    });
  }

  async getVaccineInventoryTransactions(vaccineInventoryId = null, filters = {}) {
    // Backward compatible: support both legacy path parameter usage and
    // canonical collection endpoint with optional query filters.
    if (vaccineInventoryId !== null && vaccineInventoryId !== undefined) {
      return this.request(
        `/inventory/vaccine-inventory-transactions/${vaccineInventoryId}`,
      );
    }

    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/vaccine-inventory-transactions${suffix}`);
  }

  async createVaccineInventoryTransaction(transactionData) {
    return this.request("/inventory/vaccine-inventory-transactions", {
      method: "POST",
      data: transactionData,
    });
  }

  async getVaccineStockAlertsByClinic(clinicId) {
    return this.request(`/inventory/vaccine-stock-alerts/clinic/${clinicId}`);
  }

  async getVaccineStockAlerts(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/inventory/vaccine-stock-alerts?${params}`);
  }

  async acknowledgeVaccineStockAlert(id) {
    return this.request(`/inventory/vaccine-stock-alerts/${id}/acknowledge`, {
      method: "PUT",
    });
  }

  async resolveVaccineStockAlert(id, resolutionNotes) {
    return this.request(`/inventory/vaccine-stock-alerts/${id}/resolve`, {
      method: "PUT",
      data: { resolution_notes: resolutionNotes },
    });
  }

  async getVaccineInventoryStatsByClinic(clinicId) {
    return this.request(
      `/inventory/vaccine-inventory/stats/clinic/${clinicId}`,
    );
  }

  async getVaccineInventoryStats(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/inventory/vaccine-inventory/stats?${params}`);
  }

  // Appointments Management endpoints
  async getAppointments(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/appointments?${params}`);
  }

  async checkAppointmentAvailability({ scheduled_date, vaccine_id, clinic_id } = {}) {
    const params = new URLSearchParams();
    if (scheduled_date) params.append("scheduled_date", scheduled_date);
    if (vaccine_id) params.append("vaccine_id", vaccine_id);
    if (clinic_id) params.append("clinic_id", clinic_id);

    return this.request(`/appointments/availability/check?${params}`);
  }

  async getAppointmentCalendarAvailability({ month, start_date, end_date, clinic_id } = {}) {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (start_date) params.append("start_date", start_date);
    if (end_date) params.append("end_date", end_date);
    if (clinic_id) params.append("clinic_id", clinic_id);

    return this.request(`/appointments/availability/calendar?${params}`);
  }

  async getAppointmentDateDetails(date, { clinic_id } = {}) {
    const params = new URLSearchParams();
    if (clinic_id) params.append("clinic_id", clinic_id);
    const suffix = params.toString() ? `?${params}` : "";
    return this.request(`/appointments/availability/date/${date}${suffix}`);
  }

  async getAppointment(id) {
    return this.request(`/appointments/${id}`);
  }

  async createAppointment(appointmentData) {
    return this.request("/appointments", {
      method: "POST",
      data: appointmentData,
    });
  }

  async updateAppointment(id, appointmentData) {
    return this.request(`/appointments/${id}`, {
      method: "PUT",
      data: appointmentData,
    });
  }

  async cancelAppointment(id, reason) {
    return this.request(`/appointments/${id}/cancel`, {
      method: "PUT",
      data: { cancellation_reason: reason },
    });
  }

  async completeAppointment(id, notes) {
    return this.request(`/appointments/${id}/complete`, {
      method: "PUT",
      data: { completion_notes: notes },
    });
  }

  async getUpcomingAppointments(limit = 10) {
    return this.request(`/appointments/upcoming?limit=${limit}`);
  }

  async getAppointmentStats() {
    return this.request("/appointments/stats/overview");
  }

  async getAppointmentsByInfant(infantId) {
    return this.request(`/appointments?infant_id=${infantId}`);
  }

  // Announcements Management endpoints
  async getAnnouncements(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/announcements?${params}`);
  }

  async getAnnouncement(id) {
    return this.request(`/announcements/${id}`);
  }

  async createAnnouncement(announcementData) {
    return this.request("/announcements", {
      method: "POST",
      data: announcementData,
    });
  }

  async updateAnnouncement(id, announcementData) {
    return this.request(`/announcements/${id}`, {
      method: "PUT",
      data: announcementData,
    });
  }

  async deleteAnnouncement(id) {
    return this.request(`/announcements/${id}`, {
      method: "DELETE",
    });
  }

  async publishAnnouncement(id) {
    return this.request(`/announcements/${id}/publish`, {
      method: "PUT",
    });
  }

  async archiveAnnouncement(id) {
    return this.request(`/announcements/${id}/archive`, {
      method: "PUT",
    });
  }

  async getAnnouncementDeliverySummary(announcementId) {
    return this.request(`/announcements/${announcementId}/delivery-summary`);
  }

  async getAnnouncementDeliveries(announcementId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/announcements/${announcementId}/deliveries${suffix}`);
  }

  async getAnnouncementDeliverySummaryForMany(announcementIds = []) {
    if (!Array.isArray(announcementIds) || announcementIds.length === 0) {
      return {};
    }

    const normalizedIds = [...new Set(
      announcementIds
        .map((id) => parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    )];

    if (normalizedIds.length === 0) {
      return {};
    }

    const params = new URLSearchParams({
      announcement_ids: normalizedIds.join(","),
    });
    return this.request(`/announcements/delivery/summary?${params.toString()}`);
  }

  async getMyAnnouncements() {
    return this.request("/announcements", {
      method: "GET",
    });
  }

  async getAnnouncementCategories() {
    return ["system", "inventory", "vaccination", "policy", "event", "training"];
  }

  async acknowledgeAnnouncement(_announcementId) {
    // Backend does not currently expose announcement acknowledgment endpoint.
    // Keep method for API-contract compatibility and fail fast with explicit intent.
    const error = new Error("Announcement acknowledgment endpoint is not available");
    error.code = "ANNOUNCEMENT_ACK_NOT_SUPPORTED";
    throw error;
  }

  async getActiveAnnouncements(audience) {
    return this.request(`/announcements/active/${audience}`);
  }

  async getAnnouncementStats() {
    return this.request("/announcements/stats/overview");
  }

  // Paper Templates Management endpoints
  async getPaperTemplates(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/paper-templates?${params}`);
  }

  async getPaperTemplate(id) {
    return this.request(`/paper-templates/${id}`);
  }

  async createPaperTemplate(templateData) {
    return this.request("/paper-templates", {
      method: "POST",
      data: templateData,
    });
  }

  async updatePaperTemplate(id, templateData) {
    return this.request(`/paper-templates/${id}`, {
      method: "PUT",
      data: templateData,
    });
  }

  async deletePaperTemplate(id) {
    return this.request(`/paper-templates/${id}`, {
      method: "DELETE",
    });
  }

  async getTemplateFields(id) {
    return this.request(`/paper-templates/${id}/fields`);
  }

  // Document Downloads endpoints
  async getDownloadHistory(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/documents/history?${params}`);
  }

  async getCompletionStatus(infantId) {
    return this.request(`/documents/status/${infantId}`);
  }

  async generateDocument(templateId, documentData) {
    return this.request(`/documents/generate/${templateId}`, {
      method: "POST",
      data: documentData,
    });
  }

  async downloadDocument(downloadId) {
    return this.request(`/documents/download/${downloadId}`);
  }

  async getDocumentAnalytics(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/documents/analytics?${params}`);
  }

  // Monitoring endpoints
  async getMonitoringData(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/monitoring?${params}`);
  }

  async getDocumentAlerts(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/alerts?${params}`);
  }

  async getUsageTrends(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/usage-trends?${params}`);
  }

  async getUserActivity(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/user-activity?${params}`);
  }

  async getTemplatePerformance(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/template-performance?${params}`);
  }

  // Audit Log endpoints
  async getAuditLogs(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/audit-logs?${params}`);
  }

  async exportAuditLogs(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/monitoring/audit-logs/export?${params}`, {
      method: "GET",
      responseType: "blob",
    });
  }

  // Growth Monitoring endpoints
  async getGrowthRecords(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/growth/records?${params}`);
  }

  async getGrowthRecord(id) {
    return this.request(`/growth/records/${id}`);
  }

  async createGrowthRecord(growthData) {
    return this.request("/growth/records", {
      method: "POST",
      data: growthData,
    });
  }

  async updateGrowthRecord(id, growthData) {
    return this.request(`/growth/records/${id}`, {
      method: "PUT",
      data: growthData,
    });
  }

  async deleteGrowthRecord(id) {
    return this.request(`/growth/records/${id}`, {
      method: "DELETE",
    });
  }

  async getGrowthRecordsByInfant(infantId) {
    return this.request(`/growth/infant/${infantId}`);
  }

  async getLatestGrowthRecord(infantId) {
    return this.request(`/growth/infant/${infantId}/latest`);
  }

  async getGrowthStats() {
    return this.request("/growth/stats/overview");
  }

  async getAbnormalGrowthAlerts() {
    return this.request("/growth/alerts/abnormal");
  }

  async calculateGrowthPercentiles(data) {
    return this.request("/growth/calculate-percentiles", {
      method: "POST",
      data: data,
    });
  }

  // User Profile endpoints
  async getUserProfile(userId) {
    return this.request(`/users/profile/${userId}`);
  }

  async updateUserProfile(userId, profileData) {
    return this.request(`/users/profile/${userId}`, {
      method: "PUT",
      data: profileData,
    });
  }

  // Guardian Profile endpoints
  async getGuardianProfile(guardianId) {
    return this.request(`/users/guardian/profile/${guardianId}`);
  }

  async updateGuardianProfile(guardianId, profileData) {
    return this.request(`/users/guardian/self/profile/${guardianId}`, {
      method: "PUT",
      data: profileData,
    });
  }

  // Messages endpoints
  async getMessagesByUser(userId) {
    return this.request(`/messages/user/${userId}`);
  }

  async markMessageAsRead(messageId) {
    return this.request(`/messages/${messageId}/read`, {
      method: "PUT",
    });
  }

  // User Profile endpoints
  async changePassword(currentPassword, newPassword) {
    return this.request(`/auth/change-password`, {
      method: "POST",
      data: { currentPassword, newPassword },
    });
  }

  // User Password Management endpoints (Admin Only)
  async resetGuardianPassword(guardianId, password, options = {}) {
    return this.request(`/users/guardians/${guardianId}/password`, {
      method: "PUT",
      data: {
        password,
        isPasswordSet: options.isPasswordSet ?? true,
        mustChangePassword: options.mustChangePassword ?? false,
      },
    });
  }

  async resetSystemUserPassword(userId, password) {
    return this.request(`/users/system-users/${userId}/password`, {
      method: "PUT",
      data: { password },
    });
  }

  async getSystemUserPasswordStatus(userId) {
    return this.request(`/users/system-users/${userId}/password`);
  }

  async getGuardianPasswordStatus(guardianId) {
    return this.request(`/users/guardians/${guardianId}/password`);
  }

  async getGuardianPasswordVisibility(guardianId, sourceContext = "user-management/system-users") {
    const params = new URLSearchParams({ source: sourceContext });
    return this.request(`/users/guardians/${guardianId}/password-visibility?${params.toString()}`);
  }

  async auditGuardianPasswordVisibility(guardianId, action, sourceContext = "user-management/system-users") {
    return this.request(`/users/guardians/${guardianId}/password-visibility/audit`, {
      method: "POST",
      data: {
        action,
        sourceContext,
      },
    });
  }

  // Guardian-specific notifications endpoints
  async getGuardianNotifications(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/guardian/notifications${suffix}`);
  }

  async getGuardianUnreadNotificationCount() {
    return this.request(`/guardian/notifications/unread-count`);
  }

  async getGuardianNotificationStats() {
    return this.request(`/guardian/notifications/stats/summary`);
  }

  async markGuardianNotificationAsRead(id) {
    return this.request(`/guardian/notifications/${id}/read`, {
      method: "PATCH",
    });
  }

  async markGuardianNotificationAsUnread(id) {
    return this.request(`/guardian/notifications/${id}/unread`, {
      method: "PATCH",
    });
  }

  async markAllGuardianNotificationsAsRead() {
    return this.request(`/guardian/notifications/read-all`, {
      method: "PATCH",
    });
  }

  async deleteGuardianNotification(id) {
    return this.request(`/guardian/notifications/${id}`, {
      method: "DELETE",
    });
  }

  // Notifications endpoints
  async getNotifications(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/notifications?${params}`);
  }

  async getNotification(id) {
    return this.request(`/notifications/${id}`);
  }

  async markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  }

  async markAllNotificationsAsRead() {
    return this.request(`/notifications/read-all`, {
      method: "PATCH",
    });
  }

  async getNotificationSettings() {
    return this.request(`/notifications/settings`);
  }

  async updateNotificationSettings(settings) {
    return this.request(`/notifications/settings`, {
      method: "PUT",
      data: settings,
    });
  }

  async getNotificationStats() {
    return this.request(`/notifications/stats`);
  }

  async getUnreadNotificationCount() {
    return this.request(`/notifications/unread-count`);
  }

  // Health Records endpoints (alias for growth records)
  async getHealthRecordsByInfant(infantId) {
    return this.getGrowthRecordsByInfant(infantId);
  }

  // Admin Management endpoints
  async getAdminUsers() {
    return this.request("/admin/admins");
  }

  async getAdminUser(id) {
    return this.request(`/admin/admins/${id}`);
  }

  async updateAdminUser(id, adminData) {
    return this.request(`/admin/admins/${id}`, {
      method: "PUT",
      data: adminData,
    });
  }

  async resetAdminPassword(id, newPassword) {
    return this.request(`/admin/admins/${id}/password`, {
      method: "PUT",
      data: { newPassword },
    });
  }

  async getCurrentAdminProfile() {
    return this.request("/admin/me");
  }

  async updateCurrentAdminProfile(profileData) {
    return this.request("/admin/me", {
      method: "PUT",
      data: profileData,
    });
  }

  async getAdminStats() {
    return this.request("/admin/stats");
  }

  // Export endpoints
  async exportVaccinationRecords(format = "csv", filters = {}) {
    const params = new URLSearchParams({ format, ...filters });
    return this.request(`/analytics/export?type=vaccinations&${params}`, {
      method: "GET",
      responseType: format === "csv" ? "blob" : "json",
    });
  }

  async exportAppointmentRecords(format = "csv", filters = {}) {
    const params = new URLSearchParams({ format, ...filters });
    return this.request(`/analytics/export?type=appointments&${params}`, {
      method: "GET",
      responseType: format === "csv" ? "blob" : "json",
    });
  }

  async exportInfantRecords(format = "csv", filters = {}) {
    const params = new URLSearchParams({ format, ...filters });
    return this.request(`/analytics/export?type=infants&${params}`, {
      method: "GET",
      responseType: format === "csv" ? "blob" : "json",
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
