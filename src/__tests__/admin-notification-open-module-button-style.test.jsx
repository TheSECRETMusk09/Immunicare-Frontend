import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import Notifications from "../pages/Notifications";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ isGuardian: false }),
}));

jest.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    isDark: false,
    toggleDarkMode: jest.fn(),
  }),
}));

jest.mock("../services/guardianNotificationService", () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
  },
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
    markNotificationAsRead: jest.fn(),
  },
}));

const renderPage = async (payload) => {
  apiClient.getNotifications.mockResolvedValue({ data: payload });

  render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Notifications />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(apiClient.getNotifications).toHaveBeenCalled();
  });
};

describe("Admin notifications open module button styling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  test("applies readable shared styles to internal module links", async () => {
    await renderPage([
      {
        id: 1,
        title: "Generated report ready",
        message: "Monthly vaccination summary report is ready.",
        event_type: "report_generated",
        action_url: "/reports",
        created_at: "2026-05-20T09:00:00.000Z",
        is_read: false,
      },
    ]);

    const openModuleLink = await screen.findByRole("link", {
      name: /open module/i,
    });

    expect(openModuleLink.className).toContain("border-[var(--color-medical-700)]");
    expect(openModuleLink.className).toContain("bg-[var(--color-medical-700)]");
    expect(openModuleLink.className).toContain("text-white");
    expect(openModuleLink.className).toContain("visited:text-white");
    expect(openModuleLink.className).toContain("dark:bg-[var(--color-medical-600)]");
    expect(openModuleLink.className).toContain("dark:text-white");
    expect(openModuleLink.className).toContain("focus-visible:ring-[var(--color-medical-300)]");
  });

  test("uses the same readable styles for external notification links", async () => {
    await renderPage([
      {
        id: 2,
        title: "Vaccine inventory warning",
        message: "MMR doses are running low in inventory.",
        category: "low_stock",
        action_url: "https://example.com/inventory",
        created_at: "2026-05-20T08:30:00.000Z",
        is_read: false,
      },
    ]);

    const viewInventoryLink = await screen.findByRole("link", {
      name: /view inventory/i,
    });

    expect(viewInventoryLink.className).toContain("border-[var(--color-medical-700)]");
    expect(viewInventoryLink.className).toContain("bg-[var(--color-medical-700)]");
    expect(viewInventoryLink.className).toContain("text-white");
    expect(viewInventoryLink.className).toContain("visited:text-white");
    expect(viewInventoryLink.className).toContain("dark:bg-[var(--color-medical-600)]");
    expect(viewInventoryLink.className).toContain("dark:text-white");
  });
});
