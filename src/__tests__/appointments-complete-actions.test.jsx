import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import Appointments from "../pages/Appointments";
import apiClient from "../utils/api";

let mockDashboardAppointments = [];

jest.mock("../hooks/useDashboard", () => ({
  useAppointments: () => ({
    appointments: mockDashboardAppointments,
    loading: false,
    error: null,
  }),
  useInfants: () => ({
    infants: [
      {
        id: 1,
        first_name: "Baby",
        last_name: "One",
        control_number: "INF-2026-000001",
      },
    ],
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAppointmentCalendarAvailability: jest.fn(),
    getBlockedDates: jest.fn(),
    getAppointmentDateDetails: jest.fn(),
    getAppointments: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    completeAppointment: jest.fn(),
  },
}));

const scheduledAppointment = {
  id: 1,
  infant_id: 1,
  first_name: "Baby",
  last_name: "One",
  guardian_name: "Guardian One",
  scheduled_date: "2026-03-28T09:00:00.000Z",
  type: "Vaccination",
  status: "scheduled",
  control_number: "INF-2026-000001",
};

const renderAppointmentsPage = () =>
  render(
    <MemoryRouter>
      <Appointments />
    </MemoryRouter>,
  );

describe("Appointments completion action workflow", () => {
  beforeEach(() => {
    mockDashboardAppointments = [{ ...scheduledAppointment }];

    apiClient.getAppointmentCalendarAvailability.mockResolvedValue({ dates: [] });
    apiClient.getBlockedDates.mockResolvedValue({ blockedDates: {} });
    apiClient.getAppointmentDateDetails.mockResolvedValue({
      summary: { total: 0 },
      appointments: [],
      isWeekend: false,
      holiday: null,
    });
    apiClient.getAppointments.mockResolvedValue({
      data: [
        {
          ...scheduledAppointment,
          status: "attended",
          completion_notes: "Completed by admin",
        },
      ],
    });
    apiClient.completeAppointment.mockResolvedValue({
      ...scheduledAppointment,
      status: "attended",
    });
    apiClient.createAppointment.mockResolvedValue({});
    apiClient.updateAppointment.mockResolvedValue({});
    apiClient.cancelAppointment.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("completed appointments keep edit access after clicking Complete", async () => {
    renderAppointmentsPage();

    const initialRow = await screen.findByText("Baby One");
    const scheduledRow = initialRow.closest("tr");
    expect(scheduledRow).toBeInTheDocument();

    expect(
      within(scheduledRow).getByRole("button", { name: /^view$/i }),
    ).toBeInTheDocument();
    expect(
      within(scheduledRow).getByRole("button", { name: /^edit$/i }),
    ).toBeInTheDocument();
    expect(
      within(scheduledRow).getByRole("button", { name: /^cancel$/i }),
    ).toBeInTheDocument();
    expect(
      within(scheduledRow).getByRole("button", { name: /^complete$/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(scheduledRow).getByRole("button", { name: /^complete$/i }),
    );

    await waitFor(() => {
      expect(apiClient.completeAppointment).toHaveBeenCalledWith(
        1,
        "Completed by admin",
      );
    });

    await waitFor(() => {
      expect(apiClient.getAppointments).toHaveBeenCalled();
    });

    const attendedRow = screen.getByText("Baby One").closest("tr");
    expect(attendedRow).toBeInTheDocument();

    expect(
      within(attendedRow).getByRole("button", { name: /^view$/i }),
    ).toBeInTheDocument();
    expect(
      within(attendedRow).getByRole("button", { name: /^edit$/i }),
    ).toBeInTheDocument();
    expect(
      within(attendedRow).queryByRole("button", { name: /^complete$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(attendedRow).queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });

  test("completed rows render the same action set after reload", async () => {
    mockDashboardAppointments = [
      {
        ...scheduledAppointment,
        status: "completed",
        completion_notes: "Completed earlier",
      },
    ];

    renderAppointmentsPage();

    const completedRow = (await screen.findByText("Baby One")).closest("tr");
    expect(completedRow).toBeInTheDocument();

    expect(
      within(completedRow).getByRole("button", { name: /^view$/i }),
    ).toBeInTheDocument();
    expect(
      within(completedRow).getByRole("button", { name: /^edit$/i }),
    ).toBeInTheDocument();
    expect(
      within(completedRow).queryByRole("button", { name: /^complete$/i }),
    ).not.toBeInTheDocument();
    expect(
      within(completedRow).queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();

    expect(within(completedRow).getByText(/attended/i)).toBeInTheDocument();
  });
});
