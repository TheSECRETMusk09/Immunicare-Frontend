import React from "react";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import VaccinationsDashboard from "../pages/VaccinationsDashboard";
import apiClient from "../utils/api";
import useVaccinationSocket from "../hooks/useVaccinationSocket";

jest.mock("../utils/api", () =>( {
  __esModule: true,
  default: {
    getDashboardInfants: jest.fn(),
    getVaccinationRecords: jest.fn(),
    getVaccinationReconciliationRecords: jest.fn(),
    getVaccinationTracking: jest.fn(),
    getVaccinationScheduleOverview: jest.fn(),
    getVaccinationSchedules: jest.fn(),
    getInfants: jest.fn(),
    getVaccines: jest.fn(),
    getSystemUsers: jest.fn(),
    getAnalyticsDashboardSummary: jest.fn(),
    getAnalyticsDashboard: jest.fn(),
  },
}));

jest.mock("../hooks/useVaccinationSocket", () =>( {
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../contexts/AuthContext", () =>( {
  useAuth: () =>( {
    isAdmin: true,
    user: { id: 100, role_type: "SYSTEM_ADMIN", clinic_id: 7, facility_id: 7 },
  }),
}));








const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readMetricValue = (label) =>
  screen
    .getAllByText(new RegExp(`^${escapeRegExp(label)}$`, "i"))
    .find((node) => /^[\d,]+$/.test(node.previousElementSibling?.textContent?.trim() || ""))
    ?.previousElementSibling?.textContent?.trim();

const createDeferred = () => {
  let resolve;

  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe("Vaccinations dashboard metric consistency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-29T08:00:00.000Z"));

    useVaccinationSocket.mockImplementation(() => undefined);
    apiClient.getSystemUsers.mockResolvedValue([]);
    apiClient.getAnalyticsDashboardSummary.mockResolvedValue(null);
    apiClient.getAnalyticsDashboard.mockResolvedValue(null);
    apiClient.getVaccinationReconciliationRecords.mockResolvedValue([]);
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [],
      summary: { completed: 0, dueSoon: 0, overdue: 0, trackedInfants: 0 },
      metadata: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [],
      summary: {
        upcoming: 0,
        due: 0,
        completed: 0,
        overdue: 0,
        trackedInfants: 0,
        totalRows: 0,
      },
      metadata: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    apiClient.getDashboardInfants.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("schedule status cards use full schedule-derived counts instead of only pending record rows", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue([
      {
        id: 901,
        patient_id: 1,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-03-20",
        status: "completed",
        patient_first_name: "Baby",
        patient_last_name: "One",
      },
    ]);
    apiClient.getVaccinationReconciliationRecords.mockResolvedValue([
      {
        id: 901,
        patient_id: 1,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-03-20",
        status: "completed",
        patient_first_name: "Baby",
        patient_last_name: "One",
      },
    ]);

    apiClient.getVaccinationSchedules.mockResolvedValue([
      {
        id: 11,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_number: 1,
        total_doses: 1,
        age_in_months: 0,
        description: "At birth",
        is_active: true,
      },
      {
        id: 12,
        vaccine_id: 2,
        vaccine_name: "Penta Valent",
        dose_number: 1,
        total_doses: 1,
        age_in_months: 2,
        description: "2 months",
        is_active: true,
      },
    ]);

    apiClient.getDashboardInfants.mockResolvedValue([
      {
        id: 1,
        first_name: "Baby",
        last_name: "One",
        dob: "2026-03-20",
        sex: "female",
      },
      {
        id: 2,
        first_name: "Baby",
        last_name: "Two",
        dob: "2026-03-25",
        sex: "male",
      },
      {
        id: 3,
        first_name: "Baby",
        last_name: "Three",
        dob: "2026-01-31",
        sex: "female",
      },
      {
        id: 4,
        first_name: "Future",
        last_name: "Seed",
        dob: "2030-06-01",
        sex: "male",
      },
    ]);

    apiClient.getVaccines.mockResolvedValue([
      { id: 1, name: "BCG", code: "BCG", doses_required: 1 },
      { id: 2, name: "Penta Valent", code: "PENTA", doses_required: 1 },
    ]);
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [
        {
          row_id: "1-1-1",
          infant_id: 1,
          infant_context: {
            id: 1,
            first_name: "Baby",
            last_name: "One",
            dob: "2026-03-20",
          },
          infant_name: "Baby One",
          infant_dob: "2026-03-20",
          vaccine_id: 1,
          vaccine_name: "BCG",
          disease_prevented: "At birth",
          age_label: "At Birth",
          dose_number: 1,
          due_date: "2026-03-20",
          admin_date: "2026-03-20",
          status_key: "completed",
          status_label: "Completed",
        },
        {
          row_id: "2-2-1",
          infant_id: 2,
          infant_context: {
            id: 2,
            first_name: "Baby",
            last_name: "Two",
            dob: "2026-03-25",
          },
          infant_name: "Baby Two",
          infant_dob: "2026-03-25",
          vaccine_id: 2,
          vaccine_name: "Penta Valent",
          disease_prevented: "2 months",
          age_label: "2 months",
          dose_number: 1,
          due_date: "2026-03-29",
          admin_date: null,
          status_key: "due",
          status_label: "Due",
        },
        {
          row_id: "3-2-1",
          infant_id: 3,
          infant_context: {
            id: 3,
            first_name: "Baby",
            last_name: "Three",
            dob: "2026-01-31",
          },
          infant_name: "Baby Three",
          infant_dob: "2026-01-31",
          vaccine_id: 2,
          vaccine_name: "Penta Valent",
          disease_prevented: "2 months",
          age_label: "2 months",
          dose_number: 1,
          due_date: "2026-03-31",
          admin_date: null,
          status_key: "overdue",
          status_label: "Overdue",
        },
      ],
      summary: {
        upcoming: 0,
        due: 1,
        completed: 1,
        overdue: 1,
        trackedInfants: 3,
        totalRows: 3,
      },
      metadata: { page: 1, limit: 20, total: 3, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=schedule"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationScheduleOverview).toHaveBeenCalledWith({
        scope: "system",
        period: "month",
        page: 1,
        limit: 20,
      });
      expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
      expect(apiClient.getDashboardInfants).not.toHaveBeenCalled();
      expect(apiClient.getVaccinationReconciliationRecords).not.toHaveBeenCalled();
    });

    expect(readMetricValue("Upcoming")).toBe("0");
    expect(readMetricValue("Due")).toBe("1");
    expect(readMetricValue("Completed")).toBe("1");
    expect(readMetricValue("Overdue")).toBe("1");
    expect(screen.queryByText(/future seed/i)).not.toBeInTheDocument();
  });

  test("records tab can be restored from the URL without hydrating schedule data", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue([]);
    apiClient.getVaccinationSchedules.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=records"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination records/i }),
    ).toHaveClass("bg-white");

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "system",
          period: "month",
          page: 1,
          limit: 20,
          date_view: "all",
        }),
      );
      expect(apiClient.getAnalyticsDashboardSummary).toHaveBeenCalled();
      expect(apiClient.getAnalyticsDashboard).not.toHaveBeenCalled();
      expect(apiClient.getVaccinationSchedules).not.toHaveBeenCalled();
      expect(apiClient.getDashboardInfants).not.toHaveBeenCalled();
      expect(apiClient.getVaccinationReconciliationRecords).not.toHaveBeenCalled();
    });
  });

  test("schedule tab does not preload hidden records and refreshes shared summary metrics", async () => {
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [],
      summary: {
        upcoming: 0,
        due: 0,
        completed: 0,
        overdue: 0,
        trackedInfants: 0,
        totalRows: 0,
      },
      metadata: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    apiClient.getVaccinationRecords.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=schedule"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getVaccinationScheduleOverview).toHaveBeenCalledWith({
        scope: "system",
        period: "month",
        page: 1,
        limit: 20,
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
    expect(apiClient.getVaccinationSchedules).not.toHaveBeenCalled();
    expect(apiClient.getDashboardInfants).not.toHaveBeenCalled();
    expect(apiClient.getVaccinationReconciliationRecords).not.toHaveBeenCalled();
    expect(apiClient.getAnalyticsDashboardSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "system",
        period: "month",
      }),
    );
    expect(apiClient.getAnalyticsDashboard).not.toHaveBeenCalled();
  });

  test("records tab search scopes KPI cards to the matching child schedule", async () => {
    apiClient.getAnalyticsDashboardSummary.mockResolvedValue({
      summary: {
        completedDoseTotal: 337755,
        dueSoon7Days: 0,
        overdueVaccinations: 412,
        totalRegisteredInfants: 100001,
      },
    });
    apiClient.getAnalyticsDashboard.mockResolvedValue({
      summary: {
        completedDoseTotal: 337755,
        dueSoon7Days: 0,
        overdueVaccinations: 412,
        totalRegisteredInfants: 100001,
      },
    });

    apiClient.getVaccinationRecords.mockResolvedValue({
      records: [
        {
          id: 901,
          patient_id: 5001,
          vaccine_id: 1,
          vaccine_name: "BCG",
          dose_no: 1,
          admin_date: "2026-03-22",
          status: "completed",
          patient_first_name: "Christian",
          patient_last_name: "Samorin",
        },
        {
          id: 902,
          patient_id: 5001,
          vaccine_id: 2,
          vaccine_name: "Hepa B",
          dose_no: 1,
          admin_date: "2026-03-22",
          status: "completed",
          patient_first_name: "Christian",
          patient_last_name: "Samorin",
        },
      ],
      metadata: {
        page: 1,
        total: 2,
        totalPages: 1,
      },
    });

    apiClient.getDashboardInfants.mockResolvedValue([
      {
        id: 5001,
        first_name: "Christian",
        last_name: "Samorin",
        dob: "2026-03-22",
        sex: "male",
      },
    ]);

    apiClient.getVaccinationReconciliationRecords.mockResolvedValue([
      {
        id: 901,
        patient_id: 5001,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_no: 1,
        admin_date: "2026-03-22",
        status: "completed",
      },
      {
        id: 902,
        patient_id: 5001,
        vaccine_id: 2,
        vaccine_name: "Hepa B",
        dose_no: 1,
        admin_date: "2026-03-22",
        status: "completed",
      },
    ]);

    apiClient.getVaccinationSchedules.mockResolvedValue([
      {
        id: 11,
        vaccine_id: 1,
        vaccine_name: "BCG",
        dose_number: 1,
        total_doses: 1,
        minimum_age_days: 0,
        is_active: true,
      },
      {
        id: 12,
        vaccine_id: 2,
        vaccine_name: "Hepa B",
        dose_number: 1,
        total_doses: 3,
        minimum_age_days: 0,
        is_active: true,
      },
      {
        id: 13,
        vaccine_id: 2,
        vaccine_name: "Hepa B",
        dose_number: 2,
        total_doses: 3,
        minimum_age_days: 7,
        is_active: true,
      },
      {
        id: 14,
        vaccine_id: 3,
        vaccine_name: "OPV 20-doses",
        dose_number: 1,
        total_doses: 3,
        minimum_age_days: 7,
        is_active: true,
      },
      {
        id: 15,
        vaccine_id: 4,
        vaccine_name: "PCV 13/PCV 10",
        dose_number: 1,
        total_doses: 3,
        minimum_age_days: 7,
        is_active: true,
      },
      {
        id: 16,
        vaccine_id: 5,
        vaccine_name: "Penta Valent",
        dose_number: 1,
        total_doses: 3,
        minimum_age_days: 7,
        is_active: true,
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=records"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination records/i }),
    ).toHaveClass("bg-white");

    fireEvent.change(screen.getByPlaceholderText(/search vaccinations/i), {
      target: { value: "christian samorin" },
    });

    act(() => {
      jest.advanceTimersByTime(2600);
    });

    await waitFor(() => {
      expect(apiClient.getDashboardInfants).toHaveBeenCalledWith({
        scope: "system",
        exclude_future_dob: true,
        fields: "lite",
        page: 1,
        limit: 10000,
        search: "christian samorin",
      });
    });

    await waitFor(() => {
      expect(readMetricValue("Completed Vaccinations")).toBe("2");
      expect(readMetricValue("Due Soon (7 Days)")).toBe("4");
      expect(readMetricValue("Overdue Vaccinations")).toBe("0");
      expect(readMetricValue("Children Tracked")).toBe("1");
    });
  });

  test("records tab keeps the loading guard visible until a silent refresh resolves", async () => {
    const deferredRecords = createDeferred();

    apiClient.getVaccinationRecords.mockReturnValueOnce(deferredRecords.promise);
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [],
      summary: {
        upcoming: 0,
        due: 0,
        completed: 0,
        overdue: 0,
        trackedInfants: 0,
        totalRows: 0,
      },
      metadata: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=schedule"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toHaveClass("bg-white");

    fireEvent.click(screen.getByRole("button", { name: /vaccination records/i }));

    expect(
      await screen.findByText(/loading vaccination records/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /no vaccination records/i }),
    ).not.toBeInTheDocument();

    deferredRecords.resolve([]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /no vaccination records/i }),
      ).toBeInTheDocument();
    });
  });

  test("tracking tab can be restored from the URL and loads the canonical overview", async () => {
    apiClient.getVaccinationRecords.mockResolvedValue([]);
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [],
      summary: { completed: 0, dueSoon: 0, overdue: 0, trackedInfants: 0 },
      metadata: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=tracking"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination tracking/i }),
    ).toHaveClass("bg-white");

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).not.toHaveBeenCalled();
      expect(apiClient.getVaccinationTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "system",
          period: "month",
          page: 1,
          limit: 9,
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
      expect(apiClient.getVaccinationSchedules).not.toHaveBeenCalled();
      expect(apiClient.getDashboardInfants).not.toHaveBeenCalled();
      expect(apiClient.getVaccinationReconciliationRecords).not.toHaveBeenCalled();
    });
  });

  test("tracking tab summary cards use the canonical overview summary when row timelines are missing", async () => {
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [
        {
          infant: {
            id: 77,
            first_name: "Adrian",
            last_name: "Mendoza",
            dob: "2026-01-10",
          },
          dueCount: 0,
          completed: 1,
          pending: 4,
          overdue: 4,
          completionRate: 20,
          timeline: [],
        },
      ],
      summary: { completed: 3, dueSoon: 2, overdue: 7, trackedInfants: 4 },
      metadata: { page: 1, limit: 9, total: 4, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=tracking"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination tracking/i }),
    ).toHaveClass("bg-white");

    expect(await screen.findByText(/adrian mendoza/i)).toBeInTheDocument();
    expect(readMetricValue("Completed Vaccinations")).toBe("3");
    expect(readMetricValue("Due Soon (7 Days)")).toBe("2");
    expect(readMetricValue("Overdue Vaccinations")).toBe("7");
    expect(readMetricValue("Children Tracked")).toBe("4");
  });

  test("tracking infant cards derive compliance from the timeline when the API returns a stale zero rate", async () => {
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [
        {
          infant: {
            id: 19,
            first_name: "Completed",
            last_name: "Child",
            dob: "2026-01-10",
          },
          dueCount: 1,
          completed: 1,
          pending: 2,
          overdue: 1,
          completionRate: 0,
          timeline: [
            {
              vaccine_name: "BCG",
              status: "completed",
              due_date: "2026-03-05",
              admin_date: "2026-03-05",
            },
            {
              vaccine_name: "Penta Valent",
              status: "due",
              due_date: "2026-03-30",
            },
            {
              vaccine_name: "OPV",
              status: "overdue",
              due_date: "2026-03-01",
            },
          ],
        },
      ],
      summary: { completed: 1, dueSoon: 1, overdue: 1, trackedInfants: 1 },
      metadata: { page: 1, limit: 9, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=tracking"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination tracking/i }),
    ).toHaveClass("bg-white");

    expect(await screen.findByText(/completed child/i)).toBeInTheDocument();
    expect(screen.getByText(/^33%$/i)).toBeInTheDocument();
  });

  test("tracking and records KPI cards stay aligned with their tab-specific period summaries", async () => {
    apiClient.getAnalyticsDashboardSummary.mockResolvedValue({
      summary: {
        administeredInPeriod: 3086,
        dueSoon7Days: 412,
        overdueVaccinations: 128,
        totalRegisteredInfants: 8328,
      },
    });
    apiClient.getVaccinationRecords.mockResolvedValue([]);
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [],
      summary: { completed: 3199, dueSoon: 6017, overdue: 12246, trackedInfants: 8328 },
      metadata: { page: 1, limit: 9, total: 0, totalPages: 0 },
    });
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [],
      summary: {
        upcoming: 0,
        due: 6017,
        completed: 3072,
        overdue: 12246,
        trackedInfants: 10134,
        totalRows: 0,
      },
      metadata: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=tracking"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination tracking/i }),
    ).toHaveClass("bg-white");

    await waitFor(() => {
      expect(apiClient.getVaccinationTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "system",
          period: "month",
          page: 1,
          limit: 9,
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
    });

    expect(readMetricValue("Completed Vaccinations")).toBe("3199");
    expect(readMetricValue("Due Soon (7 Days)")).toBe("6017");
    expect(readMetricValue("Overdue Vaccinations")).toBe("12246");
    expect(readMetricValue("Children Tracked")).toBe("8328");

    fireEvent.click(screen.getByRole("button", { name: /vaccination schedule/i }));

    await waitFor(() => {
      expect(apiClient.getVaccinationScheduleOverview).toHaveBeenCalledWith({
        scope: "system",
        period: "month",
        page: 1,
        limit: 20,
      });
    });

    expect(screen.queryByText("Completed Vaccinations")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /vaccination records/i }));

    await waitFor(() => {
      expect(apiClient.getVaccinationRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "system",
          period: "month",
          page: 1,
          limit: 20,
          date_view: "all",
        }),
      );
    });

    expect(readMetricValue("Completed Vaccinations")).toBe("3086");
    expect(readMetricValue("Due Soon (7 Days)")).toBe("412");
    expect(readMetricValue("Overdue Vaccinations")).toBe("128");
    expect(readMetricValue("Children Tracked")).toBe("8328");
  });

  test("tracking tab respects the selected period and hides future-dated infants", async () => {
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [
        {
          infant: {
            id: 1,
            first_name: "March",
            last_name: "Due",
            dob: "2026-01-20",
          },
          dueCount: 1,
          completed: 0,
          pending: 1,
          overdue: 0,
          completionRate: 0,
          timeline: [
            {
              vaccine_name: "Penta Valent",
              status: "due",
              due_date: "2026-03-20",
            },
          ],
        },
        {
          infant: {
            id: 2,
            first_name: "April",
            last_name: "Later",
            dob: "2026-02-12",
          },
          dueCount: 1,
          completed: 0,
          pending: 1,
          overdue: 0,
          completionRate: 0,
          timeline: [
            {
              vaccine_name: "Penta Valent",
              status: "due",
              due_date: "2026-04-20",
            },
          ],
        },
      ],
      summary: { completed: 0, dueSoon: 1, overdue: 0, trackedInfants: 1 },
      metadata: { page: 1, limit: 9, total: 2, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=tracking"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination tracking/i }),
    ).toHaveClass("bg-white");

    await waitFor(() => {
      expect(apiClient.getVaccinationTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "system",
          period: "month",
          page: 1,
          limit: 9,
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
    });

    expect(await screen.findByText(/march due/i)).toBeInTheDocument();
    expect(screen.queryByText(/april later/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/future seed/i)).not.toBeInTheDocument();
  });

  test("schedule tab status cards follow the locally filtered rows instead of stale analytics totals", async () => {
    apiClient.getAnalyticsDashboard.mockResolvedValue({
      summary: {
        completedDoseTotal: 999,
        dueSoon7Days: 0,
        overdueVaccinations: 999,
        totalRegisteredInfants: 999,
      },
    });

    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [
        {
          row_id: "1-2-1",
          infant_id: 1,
          infant_context: {
            id: 1,
            first_name: "Due",
            last_name: "Soon",
            dob: "2026-01-31",
          },
          infant_name: "Due Soon",
          infant_dob: "2026-01-31",
          vaccine_id: 2,
          vaccine_name: "Penta Valent",
          disease_prevented: "2 months",
          age_label: "2 months",
          dose_number: 1,
          due_date: "2026-03-31",
          admin_date: null,
          status_key: "due",
          status_label: "Due",
        },
        {
          row_id: "2-2-1",
          infant_id: 2,
          infant_context: {
            id: 2,
            first_name: "Already",
            last_name: "Overdue",
            dob: "2026-01-20",
          },
          infant_name: "Already Overdue",
          infant_dob: "2026-01-20",
          vaccine_id: 2,
          vaccine_name: "Penta Valent",
          disease_prevented: "2 months",
          age_label: "2 months",
          dose_number: 1,
          due_date: "2026-03-20",
          admin_date: null,
          status_key: "overdue",
          status_label: "Overdue",
        },
      ],
      summary: {
        upcoming: 0,
        due: 1,
        completed: 0,
        overdue: 1,
        trackedInfants: 2,
        totalRows: 2,
      },
      metadata: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=schedule"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toHaveClass("bg-white");

    expect(await screen.findByText(/^Due Soon$/i)).toBeInTheDocument();
    expect(await screen.findByText(/^Already Overdue$/i)).toBeInTheDocument();

    expect(readMetricValue("Upcoming")).toBe("0");
    expect(readMetricValue("Due")).toBe("1");
    expect(readMetricValue("Completed")).toBe("0");
    expect(readMetricValue("Overdue")).toBe("1");
  });

  test("overview tabs revisit server summaries without hydrating legacy schedule sources", async () => {
    apiClient.getVaccinationScheduleOverview.mockResolvedValue({
      rows: [
        {
          row_id: "1-2-1",
          infant_id: 1,
          infant_context: {
            id: 1,
            first_name: "Cached",
            last_name: "Infant",
            dob: "2026-01-31",
          },
          infant_name: "Cached Infant",
          infant_dob: "2026-01-31",
          vaccine_id: 2,
          vaccine_name: "Penta Valent",
          disease_prevented: "2 months",
          age_label: "2 months",
          dose_number: 1,
          due_date: "2026-03-31",
          admin_date: null,
          status_key: "due",
          status_label: "Due",
        },
      ],
      summary: {
        upcoming: 0,
        due: 1,
        completed: 0,
        overdue: 0,
        trackedInfants: 1,
        totalRows: 1,
      },
      metadata: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    apiClient.getVaccinationTracking.mockResolvedValue({
      rows: [
        {
          infant: {
            id: 1,
            first_name: "Cached",
            last_name: "Infant",
            dob: "2026-01-31",
          },
          dueCount: 1,
          completed: 0,
          pending: 1,
          overdue: 0,
          completionRate: 0,
          timeline: [
            {
              vaccine_name: "Penta Valent",
              status: "due",
              due_date: "2026-03-31",
            },
          ],
        },
      ],
      summary: { completed: 0, dueSoon: 1, overdue: 0, trackedInfants: 1 },
      metadata: { page: 1, limit: 9, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={["/vaccination-management?tab=schedule"]}>
        <VaccinationsDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", { name: /vaccination schedule/i }),
    ).toHaveClass("bg-white");

    await waitFor(() => {
      expect(apiClient.getVaccinationScheduleOverview).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /vaccination tracking/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /vaccination tracking/i }),
      ).toHaveClass("bg-white");
    });

    fireEvent.click(screen.getByRole("button", { name: /vaccination schedule/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /vaccination schedule/i }),
      ).toHaveClass("bg-white");
    });

    expect(apiClient.getVaccinationScheduleOverview).toHaveBeenCalled();
    expect(apiClient.getVaccinationTracking).toHaveBeenCalled();
    expect(apiClient.getVaccinationSchedules).not.toHaveBeenCalled();
    expect(apiClient.getDashboardInfants).not.toHaveBeenCalled();
    expect(apiClient.getVaccinationReconciliationRecords).not.toHaveBeenCalled();
  });
});
