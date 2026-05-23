import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import UserManagement from "../pages/UserManagement";
import userService from "../services/userService";
import infantService from "../services/infantService";

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
      { id: 4, name: "staff", display_name: "Staff" },
    ],
  }),
  useClinics: () => ({
    clinics: [
      { id: 7, name: "San Nicolas Health Center, Pasig City" },
      { id: 9, name: "Annex Health Center" },
    ],
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
      clinic_id: 7,
      facility_id: 7,
      clinic_name: "San Nicolas Health Center, Pasig City",
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
  default: {
    createGuardian: jest.fn(),
    updateGuardian: jest.fn(),
    deleteGuardian: jest.fn(),
  },
}));
jest.mock("../services/infantService", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

const baseGuardiansHookResult = {
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
      is_password_set: true,
      updated_at: "2026-03-29T09:00:00.000Z",
    },
  ],
  totalCount: 1,
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  loading: false,
  isFetching: false,
  error: null,
  refreshGuardians: jest.fn(),
};

const renderPage = (initialEntry = "/users?tab=system") =>
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

describe("UserManagement tab actions", () => {
  let createUser;
  let updateUser;
  let deleteUser;
  let toggleUserActive;

  beforeEach(() => {
    jest.clearAllMocks();
    createUser = jest.fn().mockResolvedValue({
      success: true,
      user: { id: 900, username: "new.user" },
    });
    updateUser = jest.fn().mockResolvedValue({
      success: true,
      user: { id: 101, username: "staff.user" },
    });
    deleteUser = jest.fn().mockResolvedValue({ success: true });
    toggleUserActive = jest.fn().mockResolvedValue({
      success: true,
      user: { id: 101, is_active: false },
    });

    mockUseGuardians.mockReturnValue({
      ...baseGuardiansHookResult,
      refreshGuardians: jest.fn(),
    });
    mockUseSystemUsers.mockReturnValue({
      systemUsers: [
        {
          id: 101,
          username: "staff.user",
          role_id: 3,
          role_name: "nurse",
          display_name: "Nurse",
          clinic_id: 9,
          clinic_name: "Annex Health Center",
          contact: "09171234567",
          is_active: true,
          is_password_set: true,
          created_at: "2026-03-20T12:00:00.000Z",
        },
      ],
      totalCount: 1,
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      loading: false,
      isFetching: false,
      error: null,
      createUser,
      updateUser,
      deleteUser,
      toggleUserActive,
      refreshSystemUsers: jest.fn(),
    });

    userService.createGuardian.mockResolvedValue({
      success: true,
      data: { id: 501, name: "New Guardian" },
    });
    userService.updateGuardian.mockResolvedValue({
      success: true,
      data: { id: 42 },
    });
    userService.deleteGuardian.mockResolvedValue({ success: true });
    infantService.create.mockResolvedValue({ success: true });
    mockResetUserPassword.mockResolvedValue({
      success: true,
      message: "Password reset successfully",
    });
  });

  test("blocks empty staff submissions and surfaces inline validation", async () => {
    renderPage("/users?tab=system");

    fireEvent.click(screen.getAllByRole("button", { name: /add new user/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^add user$/i }));

    expect(
      (await screen.findAllByText(/username is required/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/please select a role/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/password is required/i).length).toBeGreaterThan(0);
    expect(createUser).not.toHaveBeenCalled();
    expect(mockNotifyWarning).toHaveBeenCalledWith(
      "Please complete the required user fields before submitting.",
    );
  });

  test("preserves the edited staff clinic assignment when updating a user", async () => {
    renderPage("/users?tab=system");

    fireEvent.click(screen.getByRole("button", { name: /edit user/i }));
    fireEvent.click(screen.getByRole("button", { name: /^update user$/i }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          username: "staff.user",
          role_id: 3,
          clinic_id: 9,
          contact: "09171234567",
        }),
      );
    });

    expect(mockNotifySuccess).toHaveBeenCalledWith("User updated successfully!");
  });

  test("disables self-protection admin actions on the admins tab", () => {
    mockUseSystemUsers.mockReturnValue({
      systemUsers: [
        {
          id: 7,
          username: "admin.self",
          role_id: 2,
          role_name: "system_admin",
          display_name: "System Admin",
          clinic_id: 7,
          clinic_name: "San Nicolas Health Center, Pasig City",
          contact: "09170000000",
          is_active: true,
          is_password_set: true,
          created_at: "2026-03-20T12:00:00.000Z",
        },
      ],
      totalCount: 1,
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      loading: false,
      isFetching: false,
      error: null,
      createUser,
      updateUser,
      deleteUser,
      toggleUserActive,
      refreshSystemUsers: jest.fn(),
    });

    renderPage("/users?tab=admins");

    expect(screen.getByRole("button", { name: /disable user/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /delete user/i }),
    ).not.toBeInTheDocument();
  });

  test("shows the Reset Password primary action when opened from the admins tab", async () => {
    mockUseSystemUsers.mockReturnValue({
      systemUsers: [
        {
          id: 55,
          username: "factor.123",
          role_id: 2,
          role_name: "system_admin",
          display_name: "System Administrator",
          clinic_id: 7,
          clinic_name: "San Nicolas Health Center, Pasig City",
          contact: "09171111111",
          is_active: true,
          is_password_set: true,
          created_at: "2026-03-20T12:00:00.000Z",
        },
      ],
      totalCount: 1,
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
      loading: false,
      isFetching: false,
      error: null,
      createUser,
      updateUser,
      deleteUser,
      toggleUserActive,
      refreshSystemUsers: jest.fn(),
    });

    renderPage("/users?tab=admins");

    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /reset password/i,
    });

    expect(
      within(dialog).getByRole("button", { name: /^reset password$/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/password requirements/i)).toBeInTheDocument();
  });

  test("blocks empty guardian submissions and surfaces inline validation", async () => {
    renderPage("/users?tab=guardians");

    fireEvent.click(screen.getByRole("button", { name: /add new guardian/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add guardian$/i }));

    expect((await screen.findAllByText(/first name is required/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/last name is required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/email is required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/phone number is required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/purok is required/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/purok-street-color is required/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/password is required/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/please confirm the password/i).length,
    ).toBeGreaterThan(0);
    expect(userService.createGuardian).not.toHaveBeenCalled();
    expect(mockNotifyWarning).toHaveBeenCalledWith(
      "Please complete the required guardian fields before submitting.",
    );
  });

  test("creates a guardian account from the registration-style admin form", async () => {
    renderPage("/users?tab=guardians");

    fireEvent.click(screen.getByRole("button", { name: /add new guardian/i }));

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "ana.delacruz@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: "+639171234567" },
    });
    fireEvent.change(screen.getByLabelText(/^purok$/i), {
      target: { value: "Purok 1" },
    });
    fireEvent.change(screen.getByLabelText(/purok-street-color/i), {
      target: { value: "Son Risa St. - Pink" },
    });
    fireEvent.change(screen.getByPlaceholderText(/create a password/i), {
      target: { value: "SafeGuard!9" },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm the password/i), {
      target: { value: "SafeGuard!9" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^add guardian$/i }));

    await waitFor(() => {
      expect(userService.createGuardian).toHaveBeenCalledWith({
        firstName: "Ana",
        lastName: "Dela Cruz",
        email: "ana.delacruz@example.com",
        phone: "+639171234567",
        password: "SafeGuard!9",
        confirmPassword: "SafeGuard!9",
        purok: "Purok 1",
        streetColor: "Son Risa St. - Pink",
        address: "Purok 1, Son Risa St. - Pink",
        relationship: "parent",
      });
    });

    expect(mockNotifySuccess).toHaveBeenCalledWith(
      "Guardian account created successfully!",
    );
  });

  test("blocks invalid admin account submissions before the create action runs", async () => {
    renderPage("/users?tab=admins");

    fireEvent.click(screen.getAllByRole("button", { name: /add new user/i })[0]);

    const dialog = await screen.findByRole("dialog", {
      name: /add new user/i,
    });

    expect(within(dialog).getByLabelText(/role/i)).toHaveValue("2");

    fireEvent.click(within(dialog).getByRole("button", { name: /^add user$/i }));

    expect(
      (await screen.findAllByText(/username is required/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/password is required/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/please select a role/i)).not.toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });
});
