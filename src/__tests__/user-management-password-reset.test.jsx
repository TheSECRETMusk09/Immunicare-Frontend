import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import UserManagement from "../pages/UserManagement";

const mockUseGuardians = jest.fn();
const mockUseSystemUsers = jest.fn();
const mockResetUserPassword = jest.fn();
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
const mockNotifyWarning = jest.fn();

jest.mock("../hooks/useDashboard", () => ({
  useGuardians: (...args) => mockUseGuardians(...args),
  useSystemUsers: (...args) => mockUseSystemUsers(...args),
  useUserPasswords: () => ({
    resetUserPassword: mockResetUserPassword,
  }),
  useRoles: () => ({
    roles: [
      { id: 1, name: "admin", display_name: "Admin" },
      { id: 2, name: "system_admin", display_name: "System Admin" },
      { id: 3, name: "nurse", display_name: "Nurse" },
    ],
  }),
  useClinics: () => ({
    clinics: [{ id: 1, name: "San Nicolas Health Center" }],
  }),
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isSuperAdmin: true,
    user: {
      id: 7,
      role: "SYSTEM_ADMIN",
      role_name: "SYSTEM_ADMIN",
    },
    hasPermission: () => true,
  }),
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    success: mockNotifySuccess,
    error: mockNotifyError,
    warning: mockNotifyWarning,
  }),
}));

jest.mock("../hooks/useUserManagementSocket", () => jest.fn());
jest.mock("../services/userService", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("../services/infantService", () => ({
  __esModule: true,
  default: {},
}));

const createGuardiansHookResult = () => ({
  guardians: [
    {
      id: 42,
      name: "Diana Panganiban Reyes",
      username: "diana.panganiban.reyes",
      phone: "+639171234567",
      email: "diana.reyes@example.com",
      relationship: "Mother",
      infant_count: 1,
      is_active: true,
      password_hash: "hashed-password",
    },
  ],
  totalCount: 1,
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
  loading: false,
  isFetching: false,
  error: null,
  refreshGuardians: jest.fn(),
});

const createSystemUsersHookResult = () => ({
  systemUsers: [],
  totalCount: 0,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
  loading: false,
  isFetching: false,
  error: null,
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  toggleUserActive: jest.fn(),
  refreshSystemUsers: jest.fn(),
});

const renderPage = (initialEntry = "/users?tab=guardians") =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: {
              retry: false,
            },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <UserManagement />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("UserManagement guardian password reset modal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGuardians.mockReturnValue(createGuardiansHookResult());
    mockUseSystemUsers.mockReturnValue(createSystemUsersHookResult());
    mockResetUserPassword.mockResolvedValue({
      success: true,
      message: "Guardian password reset successfully",
    });
  });

  test("submits the guardian reset form when the Reset Password button is clicked", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    const dialog = await screen.findByRole("dialog", { name: /reset password/i });

    expect(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    ).toHaveClass("user-password-reset-submit-btn");
    expect(
      within(dialog).getByRole("button", { name: /^cancel$/i }),
    ).toHaveClass("user-password-reset-cancel-btn");
    expect(within(dialog).getByLabelText(/^new password/i)).toHaveClass(
      "user-password-reset-input",
    );
    expect(dialog.querySelector(".user-password-reset-requirements")).toBeInTheDocument();
    expect(within(dialog).getByText(/password requirements/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/one uppercase letter/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/one number/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: "Guardian2026!" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: "Guardian2026!" },
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    );

    await waitFor(() => {
      expect(mockResetUserPassword).toHaveBeenCalledWith(
        42,
        "Guardian2026!",
        "guardian",
      );
    });

    expect(mockNotifySuccess).toHaveBeenCalledWith("Password reset successfully!");
    expect(mockNotifyWarning).not.toHaveBeenCalled();
    expect(mockNotifyError).not.toHaveBeenCalled();
  });

  test("shows an inline validation error when the new password does not meet policy requirements", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    const dialog = await screen.findByRole("dialog", { name: /reset password/i });

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: "123456789" },
    });
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: "123456789" },
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    );

    expect(
      await within(dialog).findByText(
        /please resolve the highlighted password requirements before submitting/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getAllByText(
        /password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(mockResetUserPassword).not.toHaveBeenCalled();
    expect(mockNotifyWarning).toHaveBeenCalledWith(
      "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
    );
  });

  test("keeps the Reset Password action visible in the system users tab", async () => {
    mockUseSystemUsers.mockReturnValue({
      systemUsers: [
        {
          id: 91,
          username: "factor.123",
          role_name: "nurse",
          display_name: "Nurse",
          is_active: true,
          is_password_set: true,
          clinic_name: "San Nicolas Health Center",
        },
      ],
      totalCount: 1,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
      loading: false,
      isFetching: false,
      error: null,
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      toggleUserActive: jest.fn(),
      refreshSystemUsers: jest.fn(),
    });

    renderPage("/users?tab=system");

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    const dialog = await screen.findByRole("dialog", { name: /reset password/i });
    expect(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/password requirements/i)).toBeInTheDocument();
  });
});
