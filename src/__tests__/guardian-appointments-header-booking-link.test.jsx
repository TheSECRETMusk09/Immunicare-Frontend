import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import GuardianAppointmentsPage from "../pages/GuardianAppointmentsPage";
import apiClient from "../utils/api";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

jest.mock("@mui/material", () => ({
  useMediaQuery: () => false,
}));

jest.mock("@fullcalendar/react", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef((_props, _ref) => <div data-testid="fullcalendar-mock" />),
  };
});

jest.mock("@fullcalendar/daygrid", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/timegrid", () => ({ __esModule: true, default: {} }));
jest.mock("@fullcalendar/interaction", () => ({ __esModule: true, default: {} }));

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    guardianId: 1,
    user: { id: 1, role: "guardian", role_type: "guardian" },
  }),
}));

jest.mock("../components/GuardianModuleHeader", () => ({
  __esModule: true,
  default: ({ title, actions }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

jest.mock("../components/GuardianTopHeader", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../components/UI", () => ({
  Alert: ({ children }) => <div>{children}</div>,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Input: (props) => <input {...props} />,
  Modal: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
  Select: ({ children, ...props }) => <select {...props}>{children}</select>,
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getGuardianAppointments: jest.fn(),
    getAppointmentCalendarAvailability: jest.fn(),
    getAppointmentDateDetails: jest.fn(),
    getInfantsByGuardian: jest.fn(),
    getVaccines: jest.fn(),
    checkAppointmentAvailability: jest.fn(),
    getAppointmentTimeSlots: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  },
}));

describe("Guardian appointments header booking link", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiClient.getInfantsByGuardian.mockResolvedValue([
      {
        id: 5001,
        first_name: "Christian",
        last_name: "Samorin",
        dob: "2026-03-20",
        sex: "M",
        control_number: "INF-2026-357447",
      },
    ]);

    apiClient.getVaccines.mockResolvedValue([]);
    apiClient.getGuardianAppointments.mockResolvedValue([]);
    apiClient.getAppointmentCalendarAvailability.mockResolvedValue({ dates: [] });
    apiClient.getAppointmentDateDetails.mockResolvedValue({
      date: "2026-04-03",
      appointments: [],
      availability: { isAvailable: true, reason: "" },
    });
    apiClient.checkAppointmentAvailability.mockResolvedValue({
      available: true,
      message: "Available",
    });
    apiClient.getAppointmentTimeSlots.mockResolvedValue({ slots: [] });
  });

  test("routes the violet header New Appointment button to the dedicated booking page", async () => {
    const { MemoryRouter } = jest.requireActual("react-router-dom");

    render(
      <MemoryRouter initialEntries={["/guardian/appointments?childId=5001"]}>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    const headerButton = await screen.findByRole("button", {
      name: /new appointment/i,
    });

    fireEvent.click(headerButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/guardian/appointments/new?childId=5001",
        { state: undefined },
      );
    });
  });
});
