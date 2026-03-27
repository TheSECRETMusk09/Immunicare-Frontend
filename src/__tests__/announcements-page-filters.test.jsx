import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import Announcements from "../pages/Announcements";
import apiClient from "../utils/api";

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAnnouncements: jest.fn(),
    getAnnouncementDeliverySummaryForMany: jest.fn(),
    createAnnouncement: jest.fn(),
    publishAnnouncement: jest.fn(),
    archiveAnnouncement: jest.fn(),
    deleteAnnouncement: jest.fn(),
    getAnnouncementDeliveries: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 101, role: "SYSTEM_ADMIN" },
  }),
}));

describe("Announcements page filters", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getAnnouncements.mockResolvedValue([
      {
        id: 1,
        title: "Cold chain update",
        content: "Keep storage logs current for every refrigerator.",
        target_audience: "staff",
        priority: "high",
        status: "published",
        created_at: "2026-03-15T08:00:00.000Z",
      },
    ]);
    apiClient.getAnnouncementDeliverySummaryForMany.mockResolvedValue({});
  });

  test("applies and clears posted date, target audience, status, and priority filters", async () => {
    render(<Announcements />);

    await waitFor(() => {
      expect(apiClient.getAnnouncements).toHaveBeenNthCalledWith(1, {
        period_start: "",
        period_end: "",
        target_audience: "",
        status: "",
        priority: "",
      });
    });

    const postedFromInput = await screen.findByLabelText(/posted from/i);
    const postedToInput = screen.getByLabelText(/posted to/i);
    const targetAudienceSelect = screen.getByLabelText(/target audience/i);
    const statusSelect = screen.getByLabelText(/^status$/i);
    const prioritySelect = screen.getByLabelText(/priority/i);

    fireEvent.change(postedFromInput, {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(postedToInput, {
      target: { value: "2026-03-31" },
    });
    fireEvent.change(targetAudienceSelect, {
      target: { value: "staff" },
    });
    fireEvent.change(statusSelect, {
      target: { value: "published" },
    });
    fireEvent.change(prioritySelect, {
      target: { value: "high" },
    });

    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() => {
      expect(apiClient.getAnnouncements).toHaveBeenNthCalledWith(2, {
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        target_audience: "staff",
        status: "published",
        priority: "high",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));

    await waitFor(() => {
      expect(apiClient.getAnnouncements).toHaveBeenNthCalledWith(3, {
        period_start: "",
        period_end: "",
        target_audience: "",
        status: "",
        priority: "",
      });
    });

    expect(postedFromInput).toHaveValue("");
    expect(postedToInput).toHaveValue("");
    expect(targetAudienceSelect).toHaveValue("");
    expect(statusSelect).toHaveValue("");
    expect(prioritySelect).toHaveValue("");
  });

  test("shows a validation error when posted-to is earlier than posted-from", async () => {
    render(<Announcements />);

    await waitFor(() => {
      expect(apiClient.getAnnouncements).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(await screen.findByLabelText(/posted from/i), {
      target: { value: "2026-03-31" },
    });
    fireEvent.change(screen.getByLabelText(/posted to/i), {
      target: { value: "2026-03-01" },
    });

    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    expect(
      screen.getByText(/posted-to date cannot be earlier than posted-from date/i),
    ).toBeInTheDocument();
    expect(apiClient.getAnnouncements).toHaveBeenCalledTimes(1);
  });
});
