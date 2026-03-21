import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import MyChildren from "../pages/MyChildren";
import TransferVaccinationHistory from "../components/VaccinationManagement/TransferVaccinationHistory";
import {
  buildTransferCaseVaccinesPayload,
  validateTransferHistoryEntries,
} from "../utils/transferCasePayloads";

const mockNavigate = jest.fn();

let mockAuthState = {
  guardianId: 1,
  isAdmin: false,
  logout: jest.fn(),
  user: { id: 1, firstName: "Guardian", username: "guardian.user" },
};

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    transferInSubmitted: jest.fn(),
  }),
}));

jest.mock("../services/notificationService", () => ({
  sendTransferInSubmittedNotification: jest.fn(),
}));

jest.mock("../utils/api", () => {
  const mockApiClient = {
    getInfantsByGuardian: jest.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          first_name: "Jamie",
          last_name: "Doe",
          sex: "F",
          dob: "2025-01-15",
          control_number: "INF-001",
          health_center: "San Nicolas Health Center",
        },
      ],
    }),
    get: jest.fn().mockResolvedValue({
      success: true,
      data: {
        readinessStatus: "READY",
        nextAppointmentPrediction: { date: "2026-03-30" },
      },
    }),
    createGuardianInfant: jest.fn().mockResolvedValue({
      data: { id: 99 },
    }),
    createTransferInCase: jest.fn().mockResolvedValue({
      success: true,
      data: {
        caseId: 501,
      },
      message: "Transfer case submitted successfully for review.",
    }),
  };

  return {
    __esModule: true,
    ...mockApiClient,
    default: mockApiClient,
  };
});

describe("Phase 2 transfer intake helpers", () => {
  test("rejects incomplete transfer history entries before submission", () => {
    const result = validateTransferHistoryEntries([
      {
        vaccineName: "BCG",
        doseNumber: 1,
        dateAdministered: "",
      },
    ]);

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/administered date/i);
  });

  test("builds structured transfer vaccine payloads with facility fallback", () => {
    const payload = buildTransferCaseVaccinesPayload(
      [
        {
          vaccineName: "BCG",
          doseNumber: 1,
          dateAdministered: "2025-01-15",
          facilityName: "",
          batchNumber: "LOT-01",
        },
      ],
      "Other Health Center",
    );

    expect(payload).toEqual([
      {
        vaccine_name: "BCG",
        dose_number: 1,
        date_administered: "2025-01-15",
        batch_number: "LOT-01",
        facility_name: "Other Health Center",
      },
    ]);
  });
});

describe("Phase 2 transfer workflow UI", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockAuthState = {
      guardianId: 1,
      isAdmin: false,
      logout: jest.fn(),
      user: { id: 1, firstName: "Guardian", username: "guardian.user" },
    };
  });

  test("guardian registration modal exposes structured prior-dose fields", async () => {
    render(
      <MemoryRouter initialEntries={["/guardian/children"]}>
        <MyChildren />
      </MemoryRouter>,
    );

    const addChildButton = await screen.findByRole("button", {
      name: /add new child/i,
    });
    fireEvent.click(addChildButton);

    fireEvent.click(screen.getByRole("button", { name: /transfer from another center/i }));

    expect(
      await screen.findByText(/previously administered doses/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/dose entry #1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date administered/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add dose/i })).toBeInTheDocument();
  });

  test("transfer vaccination history modal now submits a transfer case instead of direct import", async () => {
    render(
      <MemoryRouter>
        <TransferVaccinationHistory
          infantId={1}
          infantName="Jamie Doe"
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("button", { name: /submit transfer case/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/creates a transfer-in case for admin review/i),
    ).toBeInTheDocument();
  });
});
