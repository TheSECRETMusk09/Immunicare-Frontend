import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const baseRows = [
  {
    id: 1,
    first_name: "Mia",
    last_name: "Alpha",
    dob: "2026-04-01",
    sex: "female",
    guardian_name: "Guardian Alpha",
    guardian_phone: "+639111111111",
    control_number: "INF-0001",
    pending_vaccinations: 0,
    completed_vaccinations: 0,
    imported_vaccinations: 0,
    validation_status: "",
  },
  {
    id: 2,
    first_name: "Ava",
    last_name: "Zed",
    dob: "2026-04-03",
    sex: "female",
    guardian_name: "Guardian Zed",
    guardian_phone: "+639222222222",
    control_number: "INF-0002",
    pending_vaccinations: 0,
    completed_vaccinations: 0,
    imported_vaccinations: 0,
    validation_status: "for_validation",
  },
  {
    id: 3,
    first_name: "Lia",
    last_name: "Beta",
    dob: "2026-04-02",
    sex: "female",
    guardian_name: "Guardian Beta",
    guardian_phone: "+639333333333",
    control_number: "INF-0003",
    pending_vaccinations: 2,
    completed_vaccinations: 0,
    imported_vaccinations: 0,
    validation_status: "",
  },
];

const surnameSearchRows = [
  {
    id: 10,
    first_name: "Christian",
    middle_name: "Lee",
    last_name: "Samorin",
    dob: "2026-04-10",
    sex: "male",
    guardian_name: "Guardian Samorin",
    guardian_phone: "+639999999999",
    control_number: "INF-0010",
    pending_vaccinations: 0,
    completed_vaccinations: 1,
    imported_vaccinations: 0,
    validation_status: "",
  },
];

const buildResponse = ({
  rows = baseRows,
  page = 1,
  limit = 20,
  total = 60,
  totalPages = 3,
} = {}) => ({
  data: rows,
  pagination: {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  },
  summary: {
    total,
    needsReview: 12,
    withImportedHistory: 3,
    pendingVaccinations: 9,
  },
});

const getRenderedNames = (container) =>
  Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) =>
    cell.textContent.replace(/\s+/g, " ").trim(),
  );

describe("InfantManagement table controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("supports sortable headers and column filter chips within the sticky table header", async () => {
    infantService.getAll.mockResolvedValue(buildResponse());

    const { container } = render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByText(/mia alpha/i);

    expect(getRenderedNames(container)).toEqual([
      "Mia Alpha",
      "Ava Zed",
      "Lia Beta",
    ]);

    const sortNameButton = screen.getByRole("button", { name: /sort name/i });
    fireEvent.click(sortNameButton);
    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        order_by: "full_name",
        order_direction: "asc",
      });
      expect(getRenderedNames(container)).toEqual([
        "Ava Zed",
        "Lia Beta",
        "Mia Alpha",
      ]);
    });

    fireEvent.click(sortNameButton);
    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        order_by: "full_name",
        order_direction: "desc",
      });
      expect(getRenderedNames(container)).toEqual([
        "Mia Alpha",
        "Lia Beta",
        "Ava Zed",
      ]);
    });

    fireEvent.click(sortNameButton);
    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
      });
      expect(getRenderedNames(container)).toEqual([
        "Mia Alpha",
        "Ava Zed",
        "Lia Beta",
      ]);
    });

    expect(
      screen.queryByRole("button", { name: /filter workflow/i }),
    ).not.toBeInTheDocument();

    const workflowDropdown = screen.getByLabelText(/filter by workflow status/i);
    fireEvent.change(workflowDropdown, { target: { value: "needs_review" } });

    expect(await screen.findByText(/workflow: needs review/i)).toBeInTheDocument();
    expect(getRenderedNames(container)).toEqual(["Ava Zed"]);

    fireEvent.click(
      screen.getByRole("button", { name: /remove workflow: needs review/i }),
    );

    await waitFor(() => {
      expect(getRenderedNames(container)).toEqual([
        "Mia Alpha",
        "Ava Zed",
        "Lia Beta",
      ]);
    });
  });

  test("sorts date of birth chronologically and removes the retired gender and vaccination-progress header controls", async () => {
    infantService.getAll.mockResolvedValue(buildResponse());

    const { container } = render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByText(/mia alpha/i);

    expect(screen.queryByRole("button", { name: /filter gender/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sort vaccination progress/i }),
    ).not.toBeInTheDocument();

    const sortDobButton = screen.getByRole("button", { name: /sort date of birth/i });
    fireEvent.click(sortDobButton);

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        order_by: "dob",
        order_direction: "asc",
      });
      expect(getRenderedNames(container)).toEqual([
        "Mia Alpha",
        "Lia Beta",
        "Ava Zed",
      ]);
    });

    fireEvent.click(sortDobButton);

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        order_by: "dob",
        order_direction: "desc",
      });
      expect(getRenderedNames(container)).toEqual([
        "Ava Zed",
        "Lia Beta",
        "Mia Alpha",
      ]);
    });
  });

  test("uses the top search bar for surname searches without rendering a separate name filter", async () => {
    infantService.getAll.mockImplementation((filters = {}) =>
      Promise.resolve(
        filters.search
          ? buildResponse({
              rows: surnameSearchRows,
              total: 1,
              totalPages: 1,
            })
          : buildResponse(),
      ),
    );

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByText(/mia alpha/i);

    expect(screen.queryByRole("button", { name: /filter name/i })).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText(/search by name, control no, or contact/i),
      { target: { value: "samorin" } },
    );

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        scope: "system",
        search: "samorin",
      });
    });

    expect(await screen.findByText(/christian samorin/i)).toBeInTheDocument();
  });

  test("supports rows-per-page changes and direct page navigation", async () => {
    infantService.getAll
      .mockResolvedValueOnce(buildResponse({ page: 1, limit: 20, totalPages: 3 }))
      .mockResolvedValueOnce(buildResponse({ page: 1, limit: 50, totalPages: 2 }))
      .mockResolvedValueOnce(buildResponse({ page: 2, limit: 50, totalPages: 2 }));

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByText(/mia alpha/i);

    fireEvent.change(screen.getByLabelText(/rows per page/i), {
      target: { value: "50" },
    });

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 1,
        limit: 50,
        scope: "system",
      });
    });

    const pageJumpInput = screen.getByLabelText(/go to page/i);
    fireEvent.change(pageJumpInput, {
      target: { value: "2" },
    });
    fireEvent.keyDown(pageJumpInput, {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(infantService.getAll).toHaveBeenLastCalledWith({
        page: 2,
        limit: 50,
        scope: "system",
      });
    });
  });

  test("renders compact icon-only row actions while preserving accessible labels", async () => {
    infantService.getAll.mockResolvedValue(buildResponse());

    render(
      <MemoryRouter initialEntries={["/infants"]}>
        <InfantManagement />
      </MemoryRouter>,
    );

    await screen.findByText(/mia alpha/i);

    expect(screen.queryByText(/^Personal$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Schedule$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Records$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Chart$/i)).not.toBeInTheDocument();

    expect(screen.getAllByRole("button", { name: /personal record/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /vaccine schedule/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /immunization records/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /immunization chart/i }).length).toBeGreaterThan(0);
  });
});
