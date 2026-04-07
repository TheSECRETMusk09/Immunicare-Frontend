import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import GuardianLoginPage from "../pages/GuardianLoginPage";
import AdminLoginPage from "../pages/AdminLoginPage";
import ProtectedRoute from "../components/ProtectedRoute";
import {
  resolveRoleType,
  normalizeAuthUser,
  getDefaultAuthenticatedRouteFromRoleType,
  getDefaultAuthenticatedRouteFromUser,
  getLoginRouteFromPathname,
} from "../utils/authRedirect";

const mockNavigate = jest.fn();
const mockLogin = jest.fn();

let mockPathname = "/guardian/login";
let mockAuthState = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isGuardian: false,
  loading: false,
  login: mockLogin,
};

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

jest.mock("../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

describe("Auth + role routing regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = "/guardian/login";
    mockAuthState = {
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      isGuardian: false,
      loading: false,
      login: mockLogin,
    };
  });

  test("guardian login accepts username and routes only to guardian dashboard", async () => {
    mockLogin.mockResolvedValue({
      success: true,
      user: { id: 10, role_type: "GUARDIAN", username: "guardian_09123456789" },
    });

    render(
      <MemoryRouter initialEntries={["/guardian/login"]}>
        <GuardianLoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/email or patient id/i), {
      target: { name: "guardian_id", value: "guardian_09123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { name: "password", value: "Guardian123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "guardian_09123456789",
          expectedRole: "GUARDIAN",
        }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/guardian/dashboard", {
      replace: true,
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard", {
      replace: true,
    });
  });

  test("admin login routes only to admin dashboard", async () => {
    mockPathname = "/admin/login";
    mockLogin.mockResolvedValue({
      success: true,
      user: { id: 1, role_type: "SYSTEM_ADMIN", username: "admin" },
    });

    render(
      <MemoryRouter initialEntries={["/admin/login"]}>
        <AdminLoginPage />
      </MemoryRouter>,
    );

    const usernameInput = await screen.findByPlaceholderText(/username/i);

    fireEvent.change(usernameInput, {
      target: { name: "admin_user", value: "admin" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { name: "password", value: "Immunicare2026!" },
    });

    fireEvent.click(await screen.findByRole("button", { name: /system login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "admin",
          expectedRole: "SYSTEM_ADMIN",
        }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/analytics", { replace: true });
    expect(mockNavigate).not.toHaveBeenCalledWith("/guardian/dashboard", {
      replace: true,
    });
  });

  test("guardian cannot access admin protected route", () => {
    mockAuthState = {
      ...mockAuthState,
      user: { id: 20, role_type: "GUARDIAN" },
      isAuthenticated: true,
      isGuardian: true,
      isAdmin: false,
    };

    render(
      <MemoryRouter initialEntries={["/admin-only"]}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <ProtectedRoute adminOnly>
                <div>Admin Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/guardian/dashboard" element={<div>Guardian Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Admin Secret")).not.toBeInTheDocument();
    expect(screen.getByText(/guardian dashboard/i)).toBeInTheDocument();
  });

  test("admin cannot access guardian protected route", () => {
    mockAuthState = {
      ...mockAuthState,
      user: { id: 1, role_type: "SYSTEM_ADMIN" },
      isAuthenticated: true,
      isGuardian: false,
      isAdmin: true,
    };

    render(
      <MemoryRouter initialEntries={["/guardian-only"]}>
        <Routes>
          <Route
            path="/guardian-only"
            element={
              <ProtectedRoute requireGuardian>
                <div>Guardian Secret</div>
              </ProtectedRoute>
            }
          />
          <Route path="/analytics" element={<div>Analytics</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Guardian Secret")).not.toBeInTheDocument();
    expect(screen.getByText(/analytics/i)).toBeInTheDocument();
  });

  test("role normalization and routes stay canonical", () => {
    expect(resolveRoleType("guardian")).toBe("GUARDIAN");
    expect(resolveRoleType("admin")).toBe("SYSTEM_ADMIN");
    expect(resolveRoleType("unknown_role")).toBeNull();

    const guardianUser = normalizeAuthUser({ id: 7, role: "guardian" });
    const adminUser = normalizeAuthUser({ id: 8, role: "super_admin" });

    expect(guardianUser.role_type).toBe("GUARDIAN");
    expect(adminUser.role_type).toBe("SYSTEM_ADMIN");

    expect(getDefaultAuthenticatedRouteFromRoleType("GUARDIAN")).toBe(
      "/guardian/dashboard",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType("SYSTEM_ADMIN")).toBe(
      "/analytics",
    );
    expect(getDefaultAuthenticatedRouteFromRoleType("unknown_role")).toBe(
      "/login",
    );

    expect(getDefaultAuthenticatedRouteFromUser(guardianUser)).toBe(
      "/guardian/dashboard",
    );
    expect(getDefaultAuthenticatedRouteFromUser(adminUser)).toBe("/analytics");
  });

  test("reload fallbacks keep admin and guardian login routes separate", () => {
    expect(getLoginRouteFromPathname("/guardian/dashboard")).toBe(
      "/guardian/login",
    );
    expect(getLoginRouteFromPathname("/guardian/appointments")).toBe(
      "/guardian/login",
    );
    expect(getLoginRouteFromPathname("/analytics")).toBe("/admin/login");
    expect(getLoginRouteFromPathname("/dashboard")).toBe("/admin/login");
    expect(getLoginRouteFromPathname("/unknown-route")).toBe("/admin/login");
  });
});
