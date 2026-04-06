import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import MyChildren from "../pages/MyChildren";
import apiClient from "../utils/api";

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    guardianId: 1,
  }),
}));

jest.mock("../contexts/NotificationContext", () => ({
  useNotification: () => ({
    transferInSubmitted: jest.fn(),
    success: jest.fn(),
  }),
}));

jest.mock("../components/GuardianTopHeader", () => () => <div>GuardianTopHeader</div>);
jest.mock("../components/GuardianModuleHeader", () => ({ title }) => <div>{title}</div>);
jest.mock("../components/QuickActionFAB", () => ({
  GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT: "guardian-open-add-child-modal",
  triggerGuardianInfantRegistered: jest.fn(),
}));
jest.mock("../services/notificationService", () => ({
  sendTransferInSubmittedNotification: jest.fn(),
}));
jest.mock("../utils/telemetry", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getInfantsByGuardian: jest.fn(),
    get: jest.fn(),
  },
}));

describe("MyChildren readiness loading resilience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders children even when readiness requests are still pending", async () => {
    apiClient.getInfantsByGuardian.mockResolvedValueOnce({
      data: [
        {
          id: 11,
          first_name: "Ava",
          last_name: "Santos",
          dob: "2024-01-12",
          sex: "F",
          control_number: "CN-011",
        },
      ],
    });

    apiClient.get.mockImplementation(() => new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/guardian/children"]}>
        <MyChildren />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(apiClient.getInfantsByGuardian).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Ava Santos")).toBeInTheDocument();
    });

    expect(screen.queryByText(/Loading children records/i)).not.toBeInTheDocument();
  });
});
