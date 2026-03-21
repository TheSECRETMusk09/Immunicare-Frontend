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
}));

jest.mock("axios-retry", () => {
  const retry = jest.fn();
  retry.isNetworkError = jest.fn();
  return retry;
});

describe("apiClient request deduplication", () => {
  let axios;
  let axiosRetry;
  let apiClient;
  let mockAxiosInstance;

  beforeEach(() => {
    jest.resetModules();

    axios = require("axios");
    axiosRetry = require("axios-retry");
    mockAxiosInstance = createAxiosInstance();

    axios.create.mockReturnValue(mockAxiosInstance);
    axios.post.mockResolvedValue({ data: {} });
    axiosRetry.isNetworkError.mockReturnValue(false);

    jest.isolateModules(() => {
      apiClient = require("../utils/api").default;
    });
  });

  test("reuses the same in-flight promise for identical GET requests", async () => {
    let resolveRequest;

    mockAxiosInstance.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const firstRequest = apiClient.getGuardianNotifications({ limit: 50 });
    const secondRequest = apiClient.getGuardianNotifications({ limit: 50 });

    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { notifications: [] } });

    await expect(firstRequest).resolves.toEqual({ notifications: [] });
    await expect(secondRequest).resolves.toEqual({ notifications: [] });
  });

  test("does not deduplicate non-GET mutation requests", async () => {
    mockAxiosInstance.request.mockResolvedValue({ data: { success: true } });

    await Promise.all([
      apiClient.createAppointment({ infant_id: 1, scheduled_date: "2026-03-19T09:00:00" }),
      apiClient.createAppointment({ infant_id: 1, scheduled_date: "2026-03-19T09:00:00" }),
    ]);

    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
  });

  test("allows the same GET request again after the first one settles", async () => {
    mockAxiosInstance.request.mockResolvedValue({ data: { notifications: [] } });

    await apiClient.getGuardianNotifications({ limit: 50 });
    await apiClient.getGuardianNotifications({ limit: 50 });

    expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
  });
});
