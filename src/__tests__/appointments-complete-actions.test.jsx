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
let mockRefreshAppointments;
let mockInfants = [];
let mockInfantsLoading = false;
let mockInfantsError = null;

jest.mock("../hooks/useDashboard", () => ({
  useAppointments: () => ({
    appointments: mockDashboardAppointments,
    loading: false,
    error: null,
    refreshAppointments: mockRefreshAppointments,
  }),
  useInfants: () => ({
    infants: mockInfants,
    loading: mockInfantsLoading,
    error: mockInfantsError,
  }),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getAppointmentCalendarAvailability: jest.fn(),
    getBlockedDates: jest.fn(),
    getAppointmentDateDetails: jest.fn(),
    getAppointments: jest.fn(),
    getInfants: jest.fn(),
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
    mockRefreshAppointments = undefined;
    mockInfantsLoading = false;
    mockInfantsError = null;
    mockInfants = [
      {
        id: 1,
        first_name: "Baby",
        last_name: "One",
        control_number: "INF-2026-000001",
        dob: "2030-01-01",
      },
    ];

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
    apiClient.getInfants.mockResolvedValue({
      success: true,
      data: mockInfants,
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

    expect(
      within(scheduledRow).getByRole("button", { name: /^edit$/i }),
    ).toBeInTheDocument();
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

  test("completion refresh uses the hook source when available", async () => {
    mockRefreshAppointments = jest.fn().mockResolvedValue([
      {
        ...scheduledAppointment,
        status: "attended",
        completion_notes: "Completed by admin",
      },
    ]);

    renderAppointmentsPage();

    const scheduledRow = (await screen.findByText("Baby One")).closest("tr");
    expect(scheduledRow).toBeInTheDocument();

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
      expect(mockRefreshAppointments).toHaveBeenCalledWith({ silent: true });
    });

    expect(apiClient.getAppointments).not.toHaveBeenCalled();
  });

  test("schedule modal uses the searchable infant picker without changing form mapping", async () => {
    renderAppointmentsPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /schedule new appointment/i }),
    );

    const infantPicker = await screen.findByRole("button", {
      name: /^select infant$/i,
    });
    fireEvent.click(infantPicker);

    const searchInput = await screen.findByPlaceholderText(
      /search by name, control number, or date of birth/i,
    );
    fireEvent.change(searchInput, { target: { value: "2030-01-01" } });

    const infantOption = await screen.findByRole("button", { name: /baby one/i });
    fireEvent.click(infantOption);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /baby one \(jan 1, 2030\)/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByDisplayValue("INF-2026-000001"),
    ).toBeInTheDocument();
  });

  test("schedule modal falls back to direct infant records when dashboard infants are empty", async () => {
    mockInfants = [];
    mockInfantsError = "Dashboard infants unavailable";
    apiClient.getInfants.mockResolvedValue({
      success: true,
      data: [
        {
          id: 2,
          first_name: "Fallback",
          last_name: "Baby",
          control_number: "INF-2026-000099",
          dob: "2030-02-14",
        },
      ],
    });

    renderAppointmentsPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /schedule new appointment/i }),
    );

    const infantPicker = await screen.findByRole("button", {
      name: /^select infant$/i,
    });
    fireEvent.click(infantPicker);

    await waitFor(() => {
      expect(apiClient.getInfants).toHaveBeenCalledWith({
        limit: 10000,
        page: 1,
      });
    });

    expect(
      await screen.findByRole("button", { name: /fallback baby/i }),
    ).toBeInTheDocument();
  });

  test("list view preserves raw appointment status labels and exposes no-show filtering", async () => {
    mockDashboardAppointments = [
      {
        ...scheduledAppointment,
        id: 22,
        status: "confirmed",
      },
      {
        ...scheduledAppointment,
        id: 23,
        first_name: "Baby",
        last_name: "Two",
        status: "no_show",
      },
    ];

    renderAppointmentsPage();

    const confirmedRow = (await screen.findByText("Baby One")).closest("tr");
    const noShowRow = (await screen.findByText("Baby Two")).closest("tr");

    expect(confirmedRow).toBeInTheDocument();
    expect(noShowRow).toBeInTheDocument();
    expect(within(confirmedRow).getByText("Confirmed")).toBeInTheDocument();
    expect(within(noShowRow).getByText("No Show")).toBeInTheDocument();

    expect(screen.getByRole("option", { name: /no show/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /confirmed/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /rescheduled/i })).toBeInTheDocument();
  });
});
