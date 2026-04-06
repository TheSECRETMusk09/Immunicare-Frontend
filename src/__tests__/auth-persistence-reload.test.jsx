import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  __resetAuthBootstrapCacheForTests,
  AuthProvider,
  useAuth,
} from "../contexts/AuthContext";

const mockVerifySession = jest.fn();
const mockRefreshSession = jest.fn();
const mockClearAuthStorage = jest.fn();
const mockGetStoredAccessToken = jest.fn();
const mockGetStoredUserJson = jest.fn();
const mockPersistStoredUser = jest.fn();
const mockPersistAuthSession = jest.fn();
const mockGetRememberMePreference = jest.fn();

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    verifySession: (...args) => mockVerifySession(...args),
    refreshSession: (...args) => mockRefreshSession(...args),
  },
  clearAuthStorage: (...args) => mockClearAuthStorage(...args),
  getRememberMePreference: (...args) => mockGetRememberMePreference(...args),
  getStoredAccessToken: (...args) => mockGetStoredAccessToken(...args),
  getStoredUserJson: (...args) => mockGetStoredUserJson(...args),
  persistAuthSession: (...args) => mockPersistAuthSession(...args),
  persistStoredUser: (...args) => mockPersistStoredUser(...args),
}));

const AuthProbe = () => {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return <div>loading</div>;
  }

  if (!isAuthenticated) {
    return <div>logged-out</div>;
  }

  return (
    <div>
      authenticated:{user?.role_type}:{user?.username}
    </div>
  );
};

describe("Auth reload persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetAuthBootstrapCacheForTests();
    mockGetStoredAccessToken.mockReturnValue(null);
    mockGetStoredUserJson.mockReturnValue(null);
    mockGetRememberMePreference.mockReturnValue(true);
  });

  test("restores a valid cookie-backed session on reload even without stored access token", async () => {
    mockVerifySession.mockResolvedValue({
      authenticated: true,
      user: {
        id: 7,
        username: "admin_user",
        role: "SYSTEM_ADMIN",
        role_type: "SYSTEM_ADMIN",
      },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated:SYSTEM_ADMIN:admin_user")).toBeInTheDocument();
    expect(mockVerifySession).toHaveBeenCalledTimes(1);
    expect(mockClearAuthStorage).not.toHaveBeenCalled();
    expect(mockPersistStoredUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        username: "admin_user",
        role_type: "SYSTEM_ADMIN",
      }),
    );
  });

  test("recovers from malformed stored user data if backend verify succeeds", async () => {
    mockGetStoredUserJson.mockReturnValue("{bad-json");
    mockVerifySession.mockResolvedValue({
      authenticated: true,
      user: {
        id: 12,
        username: "guardian_user",
        role: "GUARDIAN",
        role_type: "GUARDIAN",
        guardian_id: 12,
      },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated:GUARDIAN:guardian_user")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockClearAuthStorage).not.toHaveBeenCalled();
    });
  });

  test("refreshes the session on reload when verify fails with an expired access token", async () => {
    mockGetStoredAccessToken.mockReturnValue("expired-access-token");
    mockGetStoredUserJson.mockReturnValue(
      JSON.stringify({
        id: 15,
        username: "guardian_user",
        role: "GUARDIAN",
        role_type: "GUARDIAN",
        guardian_id: 15,
      }),
    );
    mockVerifySession.mockRejectedValue({
      status: 401,
      code: "TOKEN_EXPIRED",
    });
    mockRefreshSession.mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      user: {
        id: 15,
        username: "guardian_user",
        role: "GUARDIAN",
        role_type: "GUARDIAN",
        guardian_id: 15,
      },
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("authenticated:GUARDIAN:guardian_user")).toBeInTheDocument();
    expect(mockVerifySession).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockPersistAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        rememberMe: true,
      }),
    );
    expect(mockClearAuthStorage).not.toHaveBeenCalled();
  });

  test("reuses a single auth bootstrap during StrictMode reload replay", async () => {
    mockGetStoredAccessToken.mockReturnValue("expired-access-token");
    mockGetStoredUserJson.mockReturnValue(
      JSON.stringify({
        id: 22,
        username: "admin_user",
        role: "SYSTEM_ADMIN",
        role_type: "SYSTEM_ADMIN",
      }),
    );
    mockVerifySession.mockRejectedValue({
      status: 401,
      code: "TOKEN_EXPIRED",
    });
    mockRefreshSession.mockResolvedValue({
      accessToken: "strict-mode-access-token",
      refreshToken: "strict-mode-refresh-token",
      user: {
        id: 22,
        username: "admin_user",
        role: "SYSTEM_ADMIN",
        role_type: "SYSTEM_ADMIN",
      },
    });

    render(
      <React.StrictMode>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </React.StrictMode>,
    );

    expect(await screen.findByText("authenticated:SYSTEM_ADMIN:admin_user")).toBeInTheDocument();
    expect(mockVerifySession).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockClearAuthStorage).not.toHaveBeenCalled();
  });
});
