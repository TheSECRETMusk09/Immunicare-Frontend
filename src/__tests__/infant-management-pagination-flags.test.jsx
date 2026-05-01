import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";

import InfantManagement from "../pages/InfantManagement";
import infantService from "../services/infantService";

jest.mock("../services/infantService", () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
  },
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
    isGuardian: false,
  }),
}));

jest.mock("../hooks/useInfantManagementSocket", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../components/VaccineScheduleBooklet", () => () => null);
jest.mock("../components/ImmunizationRecordBooklet", () => () => null);
jest.mock("../components/InfantPersonalRecord", () => () => null);
jest.mock("../components/ImmunizationChart", () => () => null);
jest.mock("../pages/TransferInCases", () => () => null);
jest.mock("../components/AddInfantModal", () => () => null);
jest.mock("../components/InjectVaccineModal", () => () => null);
jest.mock("../components/VaccineReadinessManager", () => () => null);

const buildResponse = (page) => ({
  data: [
    {
      id: page,
      first_name: `Baby${page}`,
      last_name: "Tester",
      dob: "2025-01-01",
      sex: "male",
      guardian_name: "Guardian Tester",
      control_number: `INF-${page}`,
      pending_vaccinations: 0,
      completed_vaccinations: 0,
      imported_vaccinations: 0,
      workflow_status: "up_to_date",
    },
  ],
  pagination: {
    page,
    limit: 20,
    total: 5001,
    totalPages: 251,
    hasNext: page < 251,
    hasPrev: page > 1,
  },
  summary: {
    total: 5001,
    needsReview: 0,
    withImportedHistory: 541,
    pendingVaccinations: 563,
  },
});

describe("InfantManagement pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("enables next pagination when backend provides next-page availability", async () => {
    infantService.getAll
      .mockResolvedValueOnce(buildResponse(1))
      .mockResolvedValueOnce(buildResponse(2));

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    const nextButton = await screen.findByRole("button", { name: /next/i });
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 2,
        limit: 20,
        scope: "system",
      });
    });
  });

  test("falls back to totalPages when backend pagination flags are missing", async () => {
    infantService.getAll
      .mockResolvedValueOnce({
        ...buildResponse(1),
        pagination: {
          page: 1,
          limit: 20,
          total: 5001,
          totalPages: 251,
        },
      })
      .mockResolvedValueOnce({
        ...buildResponse(2),
        pagination: {
          page: 2,
          limit: 20,
          total: 5001,
          totalPages: 251,
        },
      });

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    const nextButton = await screen.findByRole("button", { name: /next/i });
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 2,
        limit: 20,
        scope: "system",
      });
    });
  });

  test("keeps the search input mounted during debounced searches after the initial load", async () => {
    jest.useFakeTimers();

    let resolveSearchRequest;
    const pendingSearchRequest = new Promise((resolve) => {
      resolveSearchRequest = resolve;
    });

    infantService.getAll
      .mockResolvedValueOnce(buildResponse(1))
      .mockImplementationOnce(() => pendingSearchRequest);

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    const searchInput = await screen.findByPlaceholderText(
      /search by name, control no, or contact/i,
    );

    fireEvent.change(searchInput, { target: { value: "baby" } });

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        search: "baby",
      });
    });

    expect(
      screen.getByPlaceholderText(/search by name, control no, or contact/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading infants/i)).not.toBeInTheDocument();

    resolveSearchRequest(buildResponse(1));

    await waitFor(() => {
      expect(screen.getByDisplayValue("baby")).toBeInTheDocument();
    });
  });

  test("applies a custom date range without forcing a hardcoded DOB sort", async () => {
    infantService.getAll.mockResolvedValue(buildResponse(1));

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText(/search by name, control no, or contact/i);

    fireEvent.change(screen.getByTitle(/filter by registration period/i), {
      target: { value: "custom" },
    });

    let dateInputs;
    await waitFor(() => {
      dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });

    const [fromInput, toInput] = dateInputs;

    fireEvent.change(fromInput, {
      target: { value: "2026-03-01" },
    });
    fireEvent.change(toInput, {
      target: { value: "2026-03-31" },
    });

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        start_date: "2026-03-01",
        end_date: "2026-03-31",
      });
    });
  });
});
