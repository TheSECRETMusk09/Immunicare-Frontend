import axios from "axios";
import axiosRetry from "axios-retry";
import { safeLocalStorage, safeSessionStorage } from "./safeStorage";
import { API_BASE_URL } from "./apiConfig";

const PUBLIC_AUTH_ROUTES = [
  "/",
  "/login",
  "/guardian/login",
  "/admin/login",
  "/client/login",
  "/guardian/introduction",
  "/register",
  "/forgot-password",
  "/reset-password",
];

let refreshRequest = null;
let refreshCooldownUntil = 0;
let proactiveRefreshTerminalFailure = false;
const inFlightGetRequests = new Map();
const DEFAULT_REFRESH_RATE_LIMIT_COOLDOWN_MS = 30 * 1000;

const getRememberMePreference = () =>
  safeLocalStorage.getItem("rememberMe") === "true";

const getStoredAccessToken = () =>
  safeLocalStorage.getItem("token") || safeSessionStorage.getItem("token");

const getStoredRefreshToken = () =>
  safeLocalStorage.getItem("refreshToken") ||
  safeSessionStorage.getItem("refreshToken");

const getStoredUserJson = () =>
  safeLocalStorage.getItem("user") || safeSessionStorage.getItem("user");

const getPreferredAuthStorage = () => {
  if (safeLocalStorage.getItem("token")) {
    return safeLocalStorage;
  }

  if (safeSessionStorage.getItem("token")) {
    return safeSessionStorage;
  }

  return getRememberMePreference() ? safeLocalStorage : safeSessionStorage;
};

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

const isPublicAuthRoute = (pathname) =>
  PUBLIC_AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const isAuthVerifyRequest = (url = "") => String(url).includes("/auth/verify");
const isAuthRefreshRequest = (url = "") => String(url).includes("/auth/refresh");
const shouldSkipAuthRefresh = (config = {}) => config?.skipAuthRefresh === true;

const parseRetryAfterSeconds = (value) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number.parseInt(normalizedValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const isRefreshRateLimited = () => refreshCooldownUntil > Date.now();

const clearRefreshCooldown = () => {
  refreshCooldownUntil = 0;
};

const clearProactiveRefreshTerminalFailure = () => {
  proactiveRefreshTerminalFailure = false;
};

const hasProactiveRefreshTerminalFailure = () => proactiveRefreshTerminalFailure === true;

const markProactiveRefreshTerminalFailure = () => {
  proactiveRefreshTerminalFailure = true;
};

const setRefreshCooldownFromError = (error) => {
  const status = error?.response?.status || error?.status || null;

  if (status !== 429) {
    return;
  }

  const retryAfterSeconds =
    parseRetryAfterSeconds(error?.response?.headers?.["retry-after"]) ??
    parseRetryAfterSeconds(error?.response?.data?.retryAfter) ??
    parseRetryAfterSeconds(error?.response?.data?.retry_after);

  const cooldownMs = retryAfterSeconds
    ? retryAfterSeconds * 1000
    : DEFAULT_REFRESH_RATE_LIMIT_COOLDOWN_MS;

  refreshCooldownUntil = Date.now() + cooldownMs;
};

const createRefreshRateLimitedError = () => {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((refreshCooldownUntil - Date.now()) / 1000),
  );
  const rateLimitedError = new Error("Token refresh temporarily rate limited");
  rateLimitedError.status = 429;
  rateLimitedError.code = "RATE_LIMIT_EXCEEDED";
  rateLimitedError.isRefreshRateLimited = true;
  rateLimitedError.config = {
    url: `${API_BASE_URL}/auth/refresh`,
  };
  rateLimitedError.response = {
    status: 429,
    data: {
      error: "Too many authentication attempts, please try again later.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: retryAfterSeconds,
    },
  };

  return rateLimitedError;
};

const isTerminalRefreshFailure = (error) => {
  const status = error?.response?.status || error?.status || null;
  const code = error?.response?.data?.code || error?.code || null;

  return (
    status === 401 ||
    status === 403 ||
    code === "NO_REFRESH_TOKEN" ||
    code === "INVALID_TOKEN" ||
    code === "TOKEN_EXPIRED" ||
    code === "USER_NOT_FOUND"
  );
};

const shouldSuppressExpectedAuthErrorLog = (error, config = {}) => {
  const status = error?.status || error?.response?.status;
  const url = String(config?.url || error?.config?.url || "");
  const refreshErrorUrl = String(error?.config?.url || "");

  if (config?.suppressAuthErrors === true) {
    return true;
  }

  return (
    ((status === 401 &&
      (isAuthVerifyRequest(url) || isAuthRefreshRequest(url))) ||
      (status === 429 &&
        (error?.isRefreshRateLimited === true ||
          isAuthRefreshRequest(refreshErrorUrl) ||
          isAuthRefreshRequest(url))))
  );
};

const clearAuthStorage = () => {
  clearRefreshCooldown();
  clearProactiveRefreshTerminalFailure();
  refreshRequest = null;
  safeLocalStorage.removeItem("token");
  safeSessionStorage.removeItem("token");
  safeLocalStorage.removeItem("refreshToken");
  safeSessionStorage.removeItem("refreshToken");
  safeLocalStorage.removeItem("user");
  safeSessionStorage.removeItem("user");
  safeLocalStorage.removeItem("rememberMe");
};

const isRequestCanceled = (error) =>
  axios.isCancel(error) ||
  error?.code === "ERR_CANCELED" ||
  error?.name === "CanceledError" ||
  error?.message === "canceled";

const isTimeoutError = (error) =>
  error?.code === "ECONNABORTED" ||
  String(error?.message || "").toLowerCase().includes("timeout");

const persistAuthSession = ({
  accessToken,
  refreshToken,
  user,
  rememberMe = false,
} = {}) => {
  clearRefreshCooldown();
  clearProactiveRefreshTerminalFailure();

  const targetStorage = rememberMe ? safeLocalStorage : safeSessionStorage;
  const secondaryStorage = rememberMe ? safeSessionStorage : safeLocalStorage;

  secondaryStorage.removeItem("token");
  secondaryStorage.removeItem("refreshToken");
  secondaryStorage.removeItem("user");

  if (rememberMe) {
    safeLocalStorage.setItem("rememberMe", "true");
  } else {
    safeLocalStorage.removeItem("rememberMe");
  }

  if (accessToken) {
    targetStorage.setItem("token", accessToken);
  }

  if (refreshToken) {
    targetStorage.setItem("refreshToken", refreshToken);
  }

  if (user) {
    targetStorage.setItem("user", JSON.stringify(user));
  }
};

const persistStoredUser = (user) => {
  if (!user) {
    return;
  }

  const storage = getPreferredAuthStorage();
  storage.setItem("user", JSON.stringify(user));
};

const persistStoredRefreshToken = (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  const storage = getPreferredAuthStorage();
  storage.setItem("refreshToken", refreshToken);
};

const redirectToLoginIfNeeded = () => {
  if (typeof window === "undefined") return;
  const pathname = getCurrentPath();
  if (!isPublicAuthRoute(pathname)) {
    window.location.href = pathname.startsWith("/guardian")
      ? "/guardian/login"
      : "/admin/login";
  }
};

const getOrCreateRefreshRequest = () => {
  if (isRefreshRateLimited()) {
    return Promise.reject(createRefreshRateLimitedError());
  }

  if (!refreshRequest) {
    const storedRefreshToken = getStoredRefreshToken();
    refreshRequest = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
        {
          withCredentials: true,
          timeout: 10000,
        },
      )
      .then((response) => {
        clearRefreshCooldown();
        return response;
      })
      .catch((error) => {
        setRefreshCooldownFromError(error);
        throw error;
      })
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

const SAFE_RETRY_METHODS = new Set(["get", "head", "options"]);

const canRetryRequest = (config = {}) => {
  if (!config || config.disableRetry === true) {
    return false;
  }

  if (config.enableUnsafeRetry === true) {
    return true;
  }

  const method = String(config.method || "get").toLowerCase();
  return SAFE_RETRY_METHODS.has(method);
};

const DEDUPED_REQUEST_METHODS = new Set(["get"]);

const normalizeRequestCacheValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URLSearchParams) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeRequestCacheValue(entry));
  }

  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = normalizeRequestCacheValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
};

const buildInFlightRequestKey = (config = {}, baseURL = "") => {
  const method = String(config.method || "get").toLowerCase();

  if (
    !DEDUPED_REQUEST_METHODS.has(method) ||
    config.disableRequestDeduplication === true
  ) {
    return null;
  }

  return JSON.stringify({
    method,
    baseURL,
    url: typeof config.url === "string" ? config.url : "",
    params: normalizeRequestCacheValue(config.params),
    data: normalizeRequestCacheValue(config.data),
    responseType: config.responseType || "json",
  });
};

// Configure retry logic - don't retry on 401 Unauthorized
axiosRetry(axiosClient, {
  retries: 2,
  retryDelay: (retryCount) => {
    return retryCount * 1000; // exponential backoff
  },
  retryCondition: (error) => {
    if (isRequestCanceled(error)) {
      return false;
    }

    if (isTimeoutError(error)) {
      return false;
    }

    if (!canRetryRequest(error.config)) {
      return false;
    }

    const responseStatus = error.response?.status;
    if ([400, 401, 403, 404, 409, 422, 429].includes(responseStatus)) {
      return false;
    }

    return (
      axiosRetry.isNetworkError(error) ||
      (typeof responseStatus === "number" && responseStatus >= 500)
    );
  },
});

// Check if the JWT token is within 2 minutes of expiration
const isTokenExpiringSoon = (token) => {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      (typeof window !== 'undefined' && window.atob ? window.atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('binary'))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    const expTime = payload.exp * 1000;
    const iatTime = payload.iat ? payload.iat * 1000 : 0;

    // Phase 3: Proactive Token Refresh at 75% lifetime
    if (iatTime && expTime) {
      const totalLifetime = expTime - iatTime;
      const timePassed = Date.now() - iatTime;
      return timePassed > (totalLifetime * 0.75) && (expTime - Date.now()) > 0;
    }

    // Fallback: Refresh if less than 15 minutes (900000 ms) remaining
    return (expTime - Date.now()) > 0 && (expTime - Date.now()) < 900000;
  } catch (e) {
    return false;
  }
};

// Request interceptor to add auth token
axiosClient.interceptors.request.use(
  async (config) => {
    // Check both localStorage and sessionStorage for token using safe storage
    let token = getStoredAccessToken();

    // Proactive token refresh before request if nearing expiration
    if (
      token &&
      isTokenExpiringSoon(token) &&
      !hasProactiveRefreshTerminalFailure() &&
      !shouldSkipAuthRefresh(config) &&
      !String(config.url || "").includes("/auth/refresh")
    ) {
      try {
        const refreshResponse = await getOrCreateRefreshRequest();
        const newToken = refreshResponse.data.token || refreshResponse.data.accessToken;
        const newRefreshToken = refreshResponse.data.refreshToken;
        if (newToken) {
          persistAuthSession({
            accessToken: newToken,
            refreshToken: newRefreshToken,
            user: refreshResponse.data.user || null,
            rememberMe: getRememberMePreference(),
          });
          if (refreshResponse.data.user) {
            persistStoredUser(refreshResponse.data.user);
          }
          token = newToken;
        }
      } catch (refreshError) {
        const isTerminalFailure = isTerminalRefreshFailure(refreshError);
        if (isTerminalFailure) {
          markProactiveRefreshTerminalFailure();
        }
        if (
          !isTerminalFailure &&
          !shouldSuppressExpectedAuthErrorLog(refreshError, config)
        ) {
          console.warn("Proactive token refresh failed:", refreshError?.message);
        }
        // Ignore error here, let the request proceed.
        // Response interceptor will catch actual 401s if it truly failed.
      }
    }

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

    if (isRequestCanceled(error)) {
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
      !shouldSkipAuthRefresh(originalRequest) &&
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
          persistAuthSession({
            accessToken: newToken,
            refreshToken: newRefreshToken,
            user: refreshResponse.data.user || null,
            rememberMe: getRememberMePreference(),
          });

          if (refreshResponse.data.user) {
            persistStoredUser(refreshResponse.data.user);
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
        if (isTerminalRefreshFailure(refreshError)) {
          const sessionExpiredError = new Error("Session expired");
          sessionExpiredError.status = 401;
          sessionExpiredError.code =
            refreshError?.response?.data?.code || "SESSION_EXPIRED";
          sessionExpiredError.response = refreshError?.response;
          sessionExpiredError.originalError = refreshError;

          clearAuthStorage();
          redirectToLoginIfNeeded();
          return Promise.reject(sessionExpiredError);
        }

        const refreshUnavailableError = new Error(
          "Unable to verify your session right now. Please try again.",
        );
        refreshUnavailableError.status =
          refreshError?.response?.status || refreshError?.status || 503;
        refreshUnavailableError.code = "AUTH_REFRESH_UNAVAILABLE";
        refreshUnavailableError.response = refreshError?.response;
        refreshUnavailableError.originalError = refreshError;
        return Promise.reject(refreshUnavailableError);
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
    const requestConfig = {
      url: endpoint,
      ...options,
    };

    if (
      String(endpoint).includes("/reports/generate") ||
      String(endpoint).includes("/analytics/export") ||
      String(endpoint).includes("/documents/generate")
    ) {
      requestConfig.timeout = 120000;
    }

    const inFlightRequestKey = buildInFlightRequestKey(
      requestConfig,
      this.client.defaults.baseURL,
    );

    if (inFlightRequestKey && inFlightGetRequests.has(inFlightRequestKey)) {
      return inFlightGetRequests.get(inFlightRequestKey);
    }

    const responsePromise = this.client
      .request(requestConfig)
      .then((response) => response.data)
      .catch((error) => {
        if (
          !isRequestCanceled(error) &&
          !shouldSuppressExpectedAuthErrorLog(error, requestConfig)
        ) {
          console.error("API request failed:", error);
        }
        throw error;
      })
      .finally(() => {
        if (inFlightRequestKey) {
          inFlightGetRequests.delete(inFlightRequestKey);
        }
      });

    if (inFlightRequestKey) {
      inFlightGetRequests.set(inFlightRequestKey, responsePromise);
    }

    return responsePromise;
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
        if (
          !isRequestCanceled(error) &&
          !shouldSuppressExpectedAuthErrorLog(error, options)
        ) {
          console.error("Custom API request failed:", error);
        }
        throw error;
      }
    }

  async uploadFile(file, fieldName = "file") {
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await this.customRequest("/uploads/upload", {
      method: "POST",
      data: formData,
    });

    return response?.data || response;
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
      disableRetry: true,
    });
  }

  async resendGuardianRegistrationOtp(payload) {
    return this.request("/auth/register/guardian/resend-otp", {
      method: "POST",
      data: payload,
      disableRetry: true,
    });
  }

  async verifyGuardianRegistration(phone, otp) {
    return this.request("/auth/register/guardian/verify", {
      method: "POST",
      data: { phone, otp },
      disableRetry: true,
    });
  }

  async forgotPassword(email) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      data: { email },
    });
  }

  // New dual-option forgot password methods
  async forgotPasswordOtp(identifierOrPayload, method = "email") {
    const data =
      identifierOrPayload && typeof identifierOrPayload === "object"
        ? { ...identifierOrPayload }
        : method === "sms"
          ? { phone: identifierOrPayload, method }
          : { email: identifierOrPayload, method };

    return this.request("/auth/forgot-password/otp", {
      method: "POST",
      data,
    });
  }

  async verifyResetOtp(identifierOrPayload, otp, method = "email") {
    const data =
      identifierOrPayload && typeof identifierOrPayload === "object"
        ? { ...identifierOrPayload }
        : method === "sms"
          ? { phone: identifierOrPayload, otp, method }
          : { email: identifierOrPayload, otp, method };

    return this.request("/auth/forgot-password/verify-otp", {
      method: "POST",
      data,
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
      disableRetry: true,
      skipAuthRefresh: true,
      suppressAuthErrors: true,
    });
  }

  async refreshSession() {
    const storedRefreshToken = getStoredRefreshToken();

    return this.request("/auth/refresh", {
      method: "POST",
      data: storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
      disableRetry: true,
      skipAuthRefresh: true,
      suppressAuthErrors: true,
    });
  }

  async logout() {
    return this.request("/auth/logout", {
      method: "POST",
    });
  }

  buildQuerySuffix(params = {}) {
    const queryParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    return queryParams.toString() ? `?${queryParams.toString()}` : "";
  }

  // Dashboard endpoints
  async getDashboardStats(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/dashboard/stats${suffix}`);
  }

  async getGuardianStats(guardianId) {
    return this.request(`/dashboard/guardian/${guardianId}/stats`);
  }

  async getGuardianDashboardOverview(guardianId, filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/dashboard/guardian/${guardianId}/overview${suffix}`);
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

  async getInfantActivities(infantId, limit = 10) {
    return this.request(`/infants/${infantId}/activities?limit=${limit}`);
  }

  async getDashboardInfants(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/dashboard/infants${suffix}`);
  }

  async getDashboardGuardians(params = {}, config = {}) {
    return this.getGuardians(params, config);
  }

  async getDashboardAppointments(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/dashboard/appointments${suffix}`);
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

  async getVaccinationAnalytics(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/analytics/vaccinations${suffix}`);
  }

  async getAppointmentAnalytics(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/analytics/appointments${suffix}`);
  }

  // Comprehensive analytics dashboard data
  async getAnalyticsDashboard(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/analytics/dashboard${suffix}`);
  }

  async getInventoryAnalytics(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/analytics/inventory${suffix}`);
  }

  async getTrendsAnalytics(months = 12) {
    return this.request(`/analytics/trends?months=${months}`);
  }

  async getDemographicsAnalytics(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/analytics/demographics${suffix}`);
  }

  // User Management endpoints
  async getAllUsers() {
    return this.request("/users/all-users");
  }

  async getGuardians(params = {}, config = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/users/guardians${suffix}`, {
      method: "GET",
      ...config,
    });
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

  async getSystemUsers(params = {}, config = {}) {
    const queryParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request(`/users/system-users${suffix}`, {
      method: "GET",
      ...config,
    });
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

  async getRoles(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/users/roles${suffix}`);
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

  // Settings endpoints
  async getSettings() {
    return this.request("/settings");
  }

  async updateSettings(settings) {
    return this.request("/settings", {
      method: "PUT",
      data: { settings },
    });
  }

  async resetSettingsCategory(category) {
    return this.request(`/settings/${category}/reset`, {
      method: "POST",
    });
  }

  async exportUserSettings() {
    return this.request("/settings/export");
  }

  async importUserSettings(settings) {
    return this.request("/settings/import", {
      method: "POST",
      data: { settings },
    });
  }

  // Infants Management endpoints
  async getInfants(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/infants${suffix}`);
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

  async updateInfant(id, infantData) {
    return this.request(`/infants/${id}`, {
      method: "PUT",
      data: infantData,
    });
  }

  async createGuardianInfant(infantData) {
    return this.request("/infants/guardian", {
      method: "POST",
      data: infantData,
    });
  }

  // Transfer-in case management
  async createTransferInCase(caseData) {
    return this.request("/transfer-in-cases", {
      method: "POST",
      data: caseData,
    });
  }

  async registerGuardianTransferChild(payload) {
    return this.request("/transfer-in-cases/register-child", {
      method: "POST",
      data: payload,
    });
  }

  async getTransferInCases(filters = {}) {
    const params = new URLSearchParams(filters);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/transfer-in-cases${suffix}`);
  }

  async getTransferInCase(id) {
    return this.request(`/transfer-in-cases/${id}`);
  }

  async updateTransferInCase(id, caseData) {
    return this.request(`/transfer-in-cases/${id}/validate`, {
      method: "PUT",
      data: caseData,
    });
  }

  async approveTransferCaseVaccines(caseId, data) {
    return this.request(`/transfer-in-cases/${caseId}/approve-vaccines`, {
      method: "PUT",
      data,
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

  // Infant Age Management endpoints
  async getInfantAges(limit = 100, offset = 0) {
    return this.request(`/infant-ages?limit=${limit}&offset=${offset}`);
  }

  async getInfantAgeStats() {
    return this.request('/infant-ages/stats');
  }

  async getInfantAgeInfo(infantId) {
    return this.request(`/infant-ages/${infantId}`);
  }

  async updateInfantAge(infantId) {
    return this.request(`/infant-ages/${infantId}`, {
      method: 'PUT',
    });
  }

  async updateAllInfantAges() {
    return this.request('/infant-ages/update-all', {
      method: 'POST',
    });
  }

  async calculateAge(dob) {
    return this.request('/infant-ages/calculate', {
      method: 'POST',
      data: { dob },
    });
  }

  // Vaccinations Management endpoints
  async getAllVaccinations() {
    return this.request("/vaccinations/records");
  }

  async getVaccinationRecords(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/vaccinations/records${suffix}`);
  }

  async getVaccinationReconciliationRecords(params = {}) {
    const suffix = this.buildQuerySuffix(params);
    return this.request(`/vaccinations/records/reconciliation${suffix}`);
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

  async markGuardianVaccinationCompleted(recordData) {
    return this.request("/vaccinations/records/guardian-complete", {
      method: "POST",
      data: recordData,
    });
  }

  async updateGuardianVaccinationAdminDate(id, adminDateOrPayload) {
    const payload =
      adminDateOrPayload &&
      typeof adminDateOrPayload === "object" &&
      !Array.isArray(adminDateOrPayload)
        ? adminDateOrPayload
        : { admin_date: adminDateOrPayload };

    return this.request(`/vaccinations/records/${id}/guardian-date`, {
      method: "PUT",
      data: payload,
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

  // Dynamic Immunization Schedule endpoints
  async getDynamicSchedule(infantId) {
    return this.request(`/vaccinations/schedule/${infantId}`);
  }

  async getOverdueVaccines(infantId) {
    return this.request(`/vaccinations/overdue/${infantId}`);
  }

  async getUpcomingVaccines(infantId, days = 14) {
    return this.request(`/vaccinations/upcoming/${infantId}?days=${days}`);
  }

  async getCatchUpSchedule(infantId) {
    return this.request(`/vaccinations/catchup/${infantId}`);
  }

  async getScheduleStatus(infantId) {
    return this.request(`/vaccinations/status/${infantId}`);
  }

  async getExtendedSchedule(infantId) {
    return this.request(`/vaccinations/extended/${infantId}`);
  }

  // Vaccination readiness - automated vaccine readiness calculation
  async getVaccinationReadiness(infantId, options = {}) {
    const params = new URLSearchParams();
    Object.entries(options || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/vaccination-readiness/${infantId}${suffix}`);
  }

  // Vaccine Eligibility - Get eligible vaccines for an infant
  async getEligibleVaccines(infantId, options = {}) {
    return this.request(`/vaccinations/eligible/${infantId}`, { method: 'GET', ...options });
  }

  // Vaccine Eligibility - Get next dose info for a specific vaccine
  async getNextDoseInfo(infantId, vaccineId) {
    return this.request(`/vaccinations/next-dose/${infantId}/${vaccineId}`);
  }

  // Vaccine Eligibility - Get vaccine readiness for a specific vaccine
  async getVaccineReadiness(infantId, vaccineId) {
    return this.request(`/vaccinations/readiness/${infantId}/${vaccineId}`);
  }

  // Vaccine Eligibility - Check contraindications
  async checkVaccineContraindications(infantId, vaccineId) {
    return this.request(`/vaccinations/contraindications/${infantId}/${vaccineId}`);
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

  // Infant Vaccine Readiness endpoints
  async getInfantVaccineReadiness(infantId) {
    return this.request(`/vaccination-readiness/infant/${infantId}`);
  }

  async setInfantVaccineReadiness(infantId, vaccineId, isReady, notes = null) {
    return this.request(`/vaccination-readiness/infant/${infantId}/vaccine/${vaccineId}`, {
      method: "POST",
      data: { isReady, notes },
    });
  }

  async batchSetInfantVaccineReadiness(infantId, vaccineIds, isReady, notes = null) {
    return this.request(`/vaccination-readiness/infant/${infantId}/batch`, {
      method: "POST",
      data: { vaccineIds, isReady, notes },
    });
  }

  async getInfantVaccinationSchedule(infantId) {
    return this.request(`/vaccination-readiness/schedule/${infantId}`);
  }

  // Vaccination with automatic inventory deduction
  async recordVaccinationWithInventory(recordData) {
    return this.request("/vaccinations/record-with-inventory", {
      method: "POST",
      data: recordData,
    });
  }

   async getVaccineInventoryStatus(vaccineId) {
     return this.request(`/vaccinations/inventory-status/${vaccineId}`);
   }

  async getAppointmentSuggestions(input, legacyGuardianId = null, legacyClinicId = null, options = {}) {
     const normalizedInput =
       input && typeof input === "object"
         ? input
         : {
             infantId: input,
             guardianId: legacyGuardianId,
             clinicId: legacyClinicId,
           };

     const {
       infantId,
       guardianId = null,
       clinicId = null,
     } = normalizedInput || {};

     if (!infantId) {
       throw new Error("infantId is required to load appointment suggestions");
     }

     const params = new URLSearchParams();
     if (guardianId !== null) params.append('guardianId', guardianId);
     if (clinicId !== null) params.append('clinicId', clinicId);

     const queryString = params.toString();
     const url = `/appointments/suggestions/${infantId}${queryString ? `?${queryString}` : ''}`;

     return this.request(url, {
       method: 'GET',
      ...options
     });
   }

  async getVaccinationTransactions(filters = {}) {
    const params = new URLSearchParams(filters);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/vaccinations/transactions${suffix}`);
  }

  // Inventory Management endpoints
  async getInventoryItems() {
    return this.request("/inventory/items");
  }

  async getInventoryItemsByCategory(category) {
    return this.request(`/inventory/items/type/${category}`);
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

  async getInventoryCategories() {
    const items = await this.getInventoryItems();
    const normalizedItems = Array.isArray(items) ? items : [];

    return Array.from(new Set(normalizedItems.map((item) => item.type).filter(Boolean))).map(
      (type) => ({
        id: type,
        name: type,
        label: type,
      }),
    );
  }

  async getWarehouses() {
    const response = await this.request("/vaccine-supply/facilities/warehouse");
    const warehouse = response?.warehouse || response?.data?.warehouse || response?.data || response;
    return Array.isArray(warehouse) ? warehouse : warehouse ? [warehouse] : [];
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

  async getStockTransactions(filters = {}) {
    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/transactions${suffix}`);
  }

  async getStockAlerts(filters = {}) {
    return this.getVaccineStockAlerts(filters);
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

  // Vaccine supply endpoints
  async getVaccineSupplyCityDashboard() {
    return this.request("/vaccine-supply/dashboard/city");
  }

  async getVaccineSupplyBarangayDashboard(facilityId) {
    return this.request(`/vaccine-supply/dashboard/barangay/${facilityId}`);
  }

  async getVaccineSupplyDashboardAlerts() {
    return this.request("/vaccine-supply/dashboard/alerts");
  }

  async getVaccineSupplyRequests(filters = {}) {
    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/vaccine-supply/requests${suffix}`);
  }

  async getVaccineSupplyRequest(id) {
    return this.request(`/vaccine-supply/requests/${id}`);
  }

  async reviewVaccineSupplyRequest(id, reviewData) {
    return this.request(`/vaccine-supply/requests/${id}/review`, {
      method: "PUT",
      data: reviewData,
    });
  }

  // Vaccine Inventory Management endpoints (based on ITEMS_vaccines.docx structure)
  async getVaccineInventory(options = "/inventory/vaccine-inventory") {
    if (typeof options === "string") {
      return this.request(options);
    }

    const params = new URLSearchParams();
    Object.entries(options || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, String(value));
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/vaccine-inventory${suffix}`);
  }

  async getVaccineInventoryByClinic(clinicId, filters = {}) {
    const params = new URLSearchParams({
      ...filters,
      clinic_id: clinicId,
    });
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/vaccine-inventory${suffix}`);
  }

  async getInventoryVaccineBatches(filters = {}) {
    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/vaccine-batches${suffix}`);
  }

  async getAvailableInventoryLots(filters = {}) {
    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const response = await this.request(`/inventory/available-lots${suffix}`);

    if (response && response.success !== undefined) {
      return Array.isArray(response.data) ? response.data : [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    return Array.isArray(response?.data) ? response.data : [];
  }

  async createInventoryVaccineBatch(batchData) {
    return this.request("/inventory/vaccine-batches", {
      method: "POST",
      data: batchData,
    });
  }

  async updateInventoryVaccineBatch(id, batchData) {
    return this.request(`/inventory/vaccine-batches/${id}`, {
      method: "PUT",
      data: batchData,
    });
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

  async getInventoryStockMovements(filters = {}) {
    const params = new URLSearchParams(filters || {});
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/stock-movements${suffix}`);
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
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/inventory/vaccine-stock-alerts${suffix}`);
  }

  async acknowledgeVaccineStockAlert(id) {
    return this.request(`/inventory/vaccine-stock-alerts/${id}/acknowledge`, {
      method: "PUT",
    });
  }

  async acknowledgeAllVaccineStockAlerts(payload = {}) {
    return this.request("/inventory/vaccine-stock-alerts/acknowledge-all", {
      method: "PUT",
      data: payload,
    });
  }

  async resolveVaccineStockAlert(id, resolutionNotes) {
    return this.request(`/inventory/vaccine-stock-alerts/${id}/resolve`, {
      method: "PUT",
      data: { resolution_notes: resolutionNotes },
    });
  }

  async resolveAllVaccineStockAlerts(payload = {}) {
    return this.request("/inventory/vaccine-stock-alerts/resolve-all", {
      method: "PUT",
      data: payload,
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

  async getAppointmentTimeSlots({ scheduled_date, vaccine_id, clinic_id, exclude_appointment_id } = {}, options = {}) {
    const params = new URLSearchParams();
    if (scheduled_date) params.append("scheduled_date", scheduled_date);
    if (vaccine_id) params.append("vaccine_id", vaccine_id);
    if (clinic_id) params.append("clinic_id", clinic_id);
    if (exclude_appointment_id) {
      params.append("exclude_appointment_id", exclude_appointment_id);
    }

    return this.request(`/appointments/availability/slots?${params}`, { method: 'GET', ...options });
  }

  async getAppointmentCalendarAvailability({ month, start_date, end_date, clinic_id } = {}, options = {}) {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (start_date) params.append("start_date", start_date);
    if (end_date) params.append("end_date", end_date);
    if (clinic_id) params.append("clinic_id", clinic_id);

    return this.request(`/appointments/availability/calendar?${params}`, { method: 'GET', ...options });
  }

  async getAppointmentDateDetails(date, { clinic_id } = {}, options = {}) {
    const params = new URLSearchParams();
    if (clinic_id) params.append("clinic_id", clinic_id);
    const suffix = params.toString() ? `?${params}` : "";
    return this.request(`/appointments/availability/date/${date}${suffix}`, { method: 'GET', ...options });
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

  // Blocked Dates Management endpoints (Admin)
  async getBlockedDates({ month, clinic_id } = {}, options = {}) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (clinic_id) params.append('clinic_id', clinic_id);
    return this.request(`/appointments/blocked-dates?${params}`, { method: 'GET', ...options });
  }

  async toggleBlockedDate({ date, reason, clinic_id }) {
    return this.request('/appointments/blocked-dates/toggle', {
      method: 'POST',
      data: { date, reason, clinic_id },
    });
  }

  async setBlockedDate({ date, is_blocked, reason, clinic_id }) {
    return this.request('/appointments/blocked-dates/set', {
      method: 'POST',
      data: { date, is_blocked, reason, clinic_id },
    });
  }

  async deleteBlockedDate(id) {
    return this.request(`/appointments/blocked-dates/${id}`, {
      method: 'DELETE',
    });
  }

  async checkBlockedDate({ date, clinic_id }) {
    const params = new URLSearchParams();
    params.append('date', date);
    if (clinic_id) params.append('clinic_id', clinic_id);
    return this.request(`/appointments/blocked-dates/check?${params}`);
  }

  // Announcements Management endpoints
  async getAnnouncements(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.append(key, value);
      }
    });

    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/announcements${suffix}`);
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
    return this.request("/announcements/my", {
      method: "GET",
    });
  }

  async getAnnouncementCategories() {
    return ["system", "inventory", "vaccination", "policy", "event", "training"];
  }

  async acknowledgeAnnouncement(id) {
    return this.request(`/announcements/${id}/acknowledge`, {
      method: "POST",
    });
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
    return this.request(`/documents/download/${downloadId}`, {
      method: "GET",
      responseType: "blob",
    });
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

  async getGrowthStats(params = {}) {
    const queryParams = new URLSearchParams(params || {});
    const suffix = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return this.request(`/growth/stats/overview${suffix}`);
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
  async createNotification(notificationData) {
    return this.request("/notifications", {
      method: "POST",
      data: notificationData,
    });
  }

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
export const api = axiosClient;
export {
  clearAuthStorage,
  getRememberMePreference,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUserJson,
  getPreferredAuthStorage,
  persistAuthSession,
  persistStoredRefreshToken,
  persistStoredUser,
};
export default apiClient;
