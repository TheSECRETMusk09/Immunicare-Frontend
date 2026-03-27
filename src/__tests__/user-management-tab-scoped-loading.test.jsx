import React from "react";
import { render, screen } from "@testing-library/react";
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
  guardians: [{ id: 1, name: "Maria Clara Santos", username: "maria.santos" }],
  totalCount: 1,
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
  loading: false,
  isFetching: false,
  error: null,
  refreshGuardians: jest.fn(),
});

const createSystemUsersHookResult = () => ({
  systemUsers: [{ id: 1, username: "admin.user", role_name: "admin", display_name: "Admin", is_active: true }],
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

const renderPage = (initialEntry) =>
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

describe("UserManagement tab-scoped data loading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGuardians.mockReturnValue(createGuardiansHookResult());
    mockUseSystemUsers.mockReturnValue(createSystemUsersHookResult());
  });

  test("enables only guardian fetching on the guardians tab", () => {
    renderPage("/users?tab=guardians");

    expect(mockUseGuardians).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 }),
      expect.objectContaining({ enabled: true }),
    );
    expect(mockUseSystemUsers).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByText(/guardians \(1\)/i)).toBeInTheDocument();
  });

  test("enables only system-user fetching on the admins tab", () => {
    renderPage("/users?tab=admins");

    expect(mockUseSystemUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        sort_field: "created_at",
        sort_direction: "desc",
      }),
      expect.objectContaining({ enabled: true }),
    );
    expect(mockUseGuardians).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByText(/admins \(1\)/i)).toBeInTheDocument();
  });
});
