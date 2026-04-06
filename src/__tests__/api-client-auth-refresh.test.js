const createAxiosInstance = () => ({
  defaults: {
    baseURL: "http://localhost:3000/api",
  },
  request: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
});

jest.mock("axios", () => ({
  create: jest.fn(),
  post: jest.fn(),
  isCancel: jest.fn(() => false),
}));

jest.mock("axios-retry", () => {
  const retry = jest.fn();
  retry.isNetworkError = jest.fn();
  return retry;
});

describe("apiClient auth refresh behavior", () => {
  let axios;
  let axiosRetry;
  let apiClient;
  let mockAxiosInstance;
  let requestInterceptor;
  let responseErrorInterceptor;
  let consoleWarnSpy;

  const createExpiringToken = () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const encode = (value) => window.btoa(JSON.stringify(value));

    return [
      encode({ alg: "HS256", typ: "JWT" }),
      encode({
        iat: nowSeconds - 3600,
        exp: nowSeconds + 60,
      }),
      "signature",
    ].join(".");
  };

  beforeEach(() => {
    jest.resetModules();

    axios = require("axios");
    axiosRetry = require("axios-retry");
    mockAxiosInstance = createAxiosInstance();

    axios.create.mockReturnValue(mockAxiosInstance);
    axios.post.mockResolvedValue({ data: {} });
    axiosRetry.isNetworkError.mockReturnValue(false);

    localStorage.clear();
    sessionStorage.clear();
    window.history.pushState({}, "", "/login");
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.isolateModules(() => {
      apiClient = require("../utils/api").default;
    });

    requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    responseErrorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test("verifySession opts out of automatic auth refresh", async () => {
    mockAxiosInstance.request.mockResolvedValue({
      data: {
        authenticated: false,
      },
    });

    await apiClient.verifySession();

    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/auth/verify",
        method: "GET",
        disableRetry: true,
        skipAuthRefresh: true,
        suppressAuthErrors: true,
      }),
    );
  });

  test("does not trigger refresh when a request explicitly skips auth refresh", async () => {
    const verifyError = {
      config: {
        url: "/auth/verify",
        method: "get",
        skipAuthRefresh: true,
      },
      response: {
        status: 401,
        data: {
          error: "No token provided",
          code: "NO_TOKEN",
        },
      },
    };

    await expect(responseErrorInterceptor(verifyError)).rejects.toMatchObject({
      message: "No token provided",
      status: 401,
    });

    expect(axios.post).not.toHaveBeenCalled();
  });

  test("still attempts refresh for regular protected requests", async () => {
    axios.post.mockRejectedValue({
      response: {
        status: 401,
        data: {
          error: "Refresh token expired",
          code: "TOKEN_EXPIRED",
        },
      },
    });

    const protectedRequestError = {
      config: {
        url: "/dashboard/stats",
        method: "get",
        headers: {},
      },
      response: {
        status: 401,
        data: {
          error: "Token expired",
          code: "TOKEN_EXPIRED",
        },
      },
    };

    await expect(responseErrorInterceptor(protectedRequestError)).rejects.toMatchObject({
      message: "Session expired",
      status: 401,
      code: "TOKEN_EXPIRED",
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      {},
      expect.objectContaining({
        withCredentials: true,
        timeout: 10000,
      }),
    );
  });

  test("backs off proactive refresh attempts after a refresh 429", async () => {
    const expiringToken = createExpiringToken();
    localStorage.setItem("token", expiringToken);
    localStorage.setItem("refreshToken", "refresh-token");

    axios.post.mockRejectedValueOnce({
      config: {
        url: "http://localhost:3000/api/auth/refresh",
      },
      response: {
        status: 429,
        data: {
          error: "Too many authentication attempts, please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: 120,
        },
      },
    });

    const firstRequestConfig = await requestInterceptor({
      url: "/inventory/vaccine-inventory",
      method: "get",
      headers: {},
    });

    expect(firstRequestConfig.headers.Authorization).toBe(
      `Bearer ${expiringToken}`,
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    const secondRequestConfig = await requestInterceptor({
      url: "/inventory/stock-movements",
      method: "get",
      headers: {},
    });

    expect(secondRequestConfig.headers.Authorization).toBe(
      `Bearer ${expiringToken}`,
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test("stops repeating proactive refresh after a terminal 401 refresh failure", async () => {
    const expiringToken = createExpiringToken();
    localStorage.setItem("token", expiringToken);
    localStorage.setItem("refreshToken", "stale-refresh-token");

    axios.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          error: "Refresh token expired",
          code: "TOKEN_EXPIRED",
        },
      },
    });

    const firstRequestConfig = await requestInterceptor({
      url: "/guardian/notifications?limit=10",
      method: "get",
      headers: {},
    });

    expect(firstRequestConfig.headers.Authorization).toBe(
      `Bearer ${expiringToken}`,
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("refreshToken")).toBe("stale-refresh-token");
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    const secondRequestConfig = await requestInterceptor({
      url: "/growth/infant/5001",
      method: "get",
      headers: {},
    });

    expect(secondRequestConfig.headers.Authorization).toBe(
      `Bearer ${expiringToken}`,
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
