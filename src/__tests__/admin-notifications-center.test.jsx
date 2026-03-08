import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import Notifications from "../pages/Notifications";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ isGuardian: false }),
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

const NOW_ISO = "2026-03-08T10:00:00.000Z";

const fixedNow = new Date(NOW_ISO).getTime();

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(fixedNow);
});

afterAll(() => {
  jest.useRealTimers();
});

const buildNotificationsPayload = () => [
  {
    id: 1,
    title: "Appointment reminder pending",
    message: "Baby A has an appointment today at 2:00 PM.",
    notification_type: "appointment_reminder",
    created_at: "2026-03-08T06:30:00.000Z",
    is_read: false,
  },
  {
    id: 2,
    title: "Vaccine inventory warning",
    message: "MMR doses are running low in inventory.",
    category: "low_stock",
    created_at: "2026-03-06T08:00:00.000Z",
    read: false,
  },
  {
    id: 3,
    title: "Outbound SMS delivery failed",
    message: "SMS failed for guardian +639171234567.",
    delivery_status: "failed",
    created_at: "2026-03-01T09:30:00.000Z",
    is_read: false,
  },
  {
    id: 4,
    title: "System announcement",
    message: "Platform maintenance completed.",
    category: "system_announcement",
    created_at: "2026-03-08T05:00:00.000Z",
    is_read: true,
  },
  {
    notification_id: "rx-5",
    title: "Generated report ready",
    message: "Monthly vaccination summary report is ready.",
    event_type: "report_generated",
    timestamp: "2026-03-02T07:00:00.000Z",
    read: true,
  },
];

const renderPage = async (payload = buildNotificationsPayload()) => {
  apiClient.getNotifications.mockResolvedValueOnce({ data: payload });

  render(
    <MemoryRouter initialEntries={["/notifications"]}>
      <Notifications />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(apiClient.getNotifications).toHaveBeenCalled();
  });

  await screen.findByTestId("summary-unread-count");
};

describe("Admin notifications center", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  test("renders operational sections and required grouping headers", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: /^notifications$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /today/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /this week/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /earlier/i })).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /notification settings/i }),
    ).not.toBeInTheDocument();
  });

  test("shows compact unread and critical summary cards only", async () => {
    await renderPage();

    expect(
      screen.getByRole("button", { name: /^unread/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^critical/i }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("summary-unread-count")).toHaveTextContent("3");
    expect(screen.getByTestId("summary-critical-count")).toHaveTextContent("1");
  });

  test("applies category and status filters to feed items", async () => {
    await renderPage();

    const categoryFilter = screen.getByLabelText(/category/i);
    fireEvent.change(categoryFilter, {
      target: { value: "inventory_low_stock" },
    });

    expect(
      screen.getByText(/vaccine inventory warning/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/appointment reminder pending/i),
    ).not.toBeInTheDocument();

    const statusFilter = screen.getByLabelText(/status/i);
    fireEvent.change(statusFilter, { target: { value: "failed" } });

    expect(
      screen.getByText(/no notifications matched the active filters/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));

    expect(
      screen.getByText(/outbound sms delivery failed/i),
    ).toBeInTheDocument();
  });

  test("marks one notification as read and updates unread summary", async () => {
    apiClient.markNotificationAsRead.mockResolvedValueOnce({ success: true });

    await renderPage();

    const itemAction = screen.getByRole("button", {
      name: /mark appointment reminder pending as read/i,
    });

    fireEvent.click(itemAction);

    await waitFor(() => {
      expect(apiClient.markNotificationAsRead).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId("summary-unread-count")).toHaveTextContent("2");
    });
  });

  test("marks all notifications as read via header action", async () => {
    apiClient.markAllNotificationsAsRead.mockResolvedValueOnce({ success: true });

    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /mark all read/i }));

    await waitFor(() => {
      expect(apiClient.markAllNotificationsAsRead).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId("summary-unread-count")).toHaveTextContent("0");
    });
  });

  test("normalizes nested API response payloads through adapter fallback", async () => {
    apiClient.getNotifications.mockResolvedValueOnce({
      data: {
        notifications: [
          {
            id: "nested-1",
            message: "Guardian registered successfully.",
            createdAt: "2026-03-08T03:15:00.000Z",
            read: false,
          },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <Notifications />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getNotifications).toHaveBeenCalled();
    });

    await screen.findByRole("heading", { name: /guardian registrations/i });

    expect(
      screen.getByRole("heading", { name: /guardian registrations/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/guardian registered successfully/i),
    ).toBeInTheDocument();
  });
});
