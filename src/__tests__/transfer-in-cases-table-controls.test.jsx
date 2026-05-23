import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TransferInCases from "../pages/TransferInCases";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAdmin: true,
  }),
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  }),
}));

jest.mock("../utils/api", () => {
  const mockApiClient = {
    getTransferInCases: jest.fn(),
    approveTransferCaseVaccines: jest.fn(),
    customRequest: jest.fn(),
  };

  return {
    __esModule: true,
    ...mockApiClient,
    default: mockApiClient,
  };
});

const transferCases = [
  {
    id: 1,
    guardian_name: "zoe guardian",
    source_facility: "North Clinic",
    submitted_vaccines: [],
    auto_computed_next_vaccine: "MMR",
    triage_category: "ready_for_scheduling",
    validation_status: "for_validation",
    validation_priority: "normal",
    created_at: "2026-04-28T08:00:00.000Z",
  },
  {
    id: 2,
    guardian_name: "Alpha Guardian",
    source_facility: "South Clinic",
    submitted_vaccines: [],
    auto_computed_next_vaccine: "BCG",
    triage_category: "needs_record_verification",
    validation_status: "approved",
    validation_priority: "high",
    created_at: "2026-04-25T08:00:00.000Z",
  },
  {
    id: 3,
    guardian_name: "bravo guardian",
    source_facility: "West Clinic",
    submitted_vaccines: [],
    auto_computed_next_vaccine: "PCV 10",
    triage_category: "not_yet_due",
    validation_status: "needs_clarification",
    validation_priority: "low",
    created_at: "2026-04-27T08:00:00.000Z",
  },
];

const getRenderedGuardians = (container) =>
  Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) =>
    cell.textContent.replace(/\s+/g, " ").trim(),
  );

describe("TransferInCases table controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.getTransferInCases.mockResolvedValue({
      success: true,
      data: transferCases,
      pagination: {
        total: transferCases.length,
      },
    });
  });

  test("supports guardian and submitted-date sorting", async () => {
    const { container } = render(<TransferInCases showHeader={false} />);

    await screen.findByText(/zoe guardian/i);

    expect(getRenderedGuardians(container)).toEqual([
      "zoe guardian",
      "Alpha Guardian",
      "bravo guardian",
    ]);

    const sortGuardianButton = screen.getByRole("button", { name: /sort guardian/i });
    fireEvent.click(sortGuardianButton);
    expect(getRenderedGuardians(container)).toEqual([
      "Alpha Guardian",
      "bravo guardian",
      "zoe guardian",
    ]);

    fireEvent.click(sortGuardianButton);
    expect(getRenderedGuardians(container)).toEqual([
      "zoe guardian",
      "bravo guardian",
      "Alpha Guardian",
    ]);

    const sortSubmittedDateButton = screen.getByRole("button", {
      name: /sort submitted date/i,
    });
    fireEvent.click(sortSubmittedDateButton);
    expect(getRenderedGuardians(container)).toEqual([
      "Alpha Guardian",
      "bravo guardian",
      "zoe guardian",
    ]);

    expect(
      screen.queryByRole("button", { name: /filter next vaccine/i }),
    ).not.toBeInTheDocument();
  });
});
