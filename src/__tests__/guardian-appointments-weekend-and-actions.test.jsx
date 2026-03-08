import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import GuardianAppointmentsPage from "../pages/GuardianAppointmentsPage";
import GuardianAppointmentBooking from "../pages/GuardianAppointmentBooking";
import apiClient from "../utils/api";

const mockFullCalendarProps = { current: null };
const mockCalendarApi = {
  changeView: jest.fn(),
  prev: jest.fn(),
  next: jest.fn(),
  today: jest.fn(),
  getDate: jest.fn(() => new Date("2030-03-01T00:00:00")),
};

jest.mock("@fullcalendar/react", () => {
  const React = require("react");

  const FullCalendarMock = React.forwardRef((props, ref) => {
    mockFullCalendarProps.current = props;

    React.useImperativeHandle(ref, () => ({
      getApi: () => mockCalendarApi,
    }));

    return (
      <div data-testid="fullcalendar-mock">
        <div data-testid="fc-first-day">{String(props.firstDay)}</div>
        <button
          type="button"
          data-testid="fc-date-click-saturday"
          onClick={() =>
            props.dateClick?.({
              date: new Date("2030-03-02T00:00:00"),
              dateStr: "2030-03-02",
            })
          }
        >
          Saturday Click
        </button>
        <button
          type="button"
          data-testid="fc-date-click-monday"
          onClick={() =>
            props.dateClick?.({
              date: new Date("2030-03-04T00:00:00"),
              dateStr: "2030-03-04",
            })
          }
        >
          Monday Click
        </button>
      </div>
    );
  });

  return {
    __esModule: true,
    default: FullCalendarMock,
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
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

jest.mock("../components/Guardian/DocumentChecklist", () => ({
  __esModule: true,
  default: () => <div data-testid="document-checklist">Document Checklist</div>,
}));

jest.mock("../utils/api", () => ({
  __esModule: true,
  default: {
    getGuardianAppointments: jest.fn(),
    getAppointments: jest.fn(),
    getAppointmentCalendarAvailability: jest.fn(),
    getAppointmentDateDetails: jest.fn(),
    checkAppointmentAvailability: jest.fn(),
    getInfantsByGuardian: jest.fn(),
    getVaccines: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
  },
}));

jest.mock("../components/UI", () => {
  const React = require("react");
  return {
    Alert: ({ children, variant = "info", className = "" }) => (
      <div role="alert" data-variant={variant} className={className}>
        {children}
      </div>
    ),
    Button: ({ children, loading, variant, size, disabled, ...props }) => (
      <button {...props} disabled={disabled || Boolean(loading)}>
        {children}
      </button>
    ),
    Input: ({ label, id, error, ...props }) => {
      const resolvedId = id || `input-${(label || "field").toLowerCase().replace(/\s+/g, "-")}`;
      return (
        <div>
          {label ? <label htmlFor={resolvedId}>{label}</label> : null}
          <input id={resolvedId} aria-invalid={Boolean(error)} {...props} />
          {error ? <span>{error}</span> : null}
        </div>
      );
    },
    Select: ({ label, id, children, error, ...props }) => {
      const resolvedId = id || `select-${(label || "field").toLowerCase().replace(/\s+/g, "-")}`;
      return (
        <div>
          {label ? <label htmlFor={resolvedId}>{label}</label> : null}
          <select id={resolvedId} aria-invalid={Boolean(error)} {...props}>
            {children}
          </select>
          {error ? <span>{error}</span> : null}
        </div>
      );
    },
    Modal: ({ isOpen, title, children }) =>
      isOpen ? (
        <div role="dialog" aria-label={title || "modal"}>
          {title ? <h2>{title}</h2> : null}
          {children}
        </div>
      ) : null,
  };
});

const originalMatchMedia = window.matchMedia;

const setDesktopMatchMedia = () => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: query.includes("min-width") ? true : false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

describe("Guardian appointments weekend blocking and action order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDesktopMatchMedia();
    mockCalendarApi.changeView.mockReset();
    mockCalendarApi.prev.mockReset();
    mockCalendarApi.next.mockReset();
    mockCalendarApi.today.mockReset();
    mockCalendarApi.getDate.mockReset();
    mockCalendarApi.getDate.mockReturnValue(new Date("2030-03-01T00:00:00"));

    apiClient.getInfantsByGuardian.mockResolvedValue([
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        dob: "2023-01-01",
        sex: "M",
        control_number: "CN-001",
      },
    ]);

    apiClient.getVaccines.mockResolvedValue([
      {
        id: 11,
        name: "BCG",
      },
    ]);

    apiClient.getGuardianAppointments.mockResolvedValue([
      {
        id: 101,
        infant_id: 1,
        first_name: "John",
        last_name: "Doe",
        scheduled_date: "2030-03-04T10:00:00",
        scheduled_time: "10:00",
        type: "Vaccination",
        status: "scheduled",
      },
    ]);

    apiClient.getAppointments.mockResolvedValue([]);

    apiClient.getAppointmentCalendarAvailability.mockResolvedValue({
      inventory: {
        totalAvailableStock: 5,
        availableVaccines: 1,
        vaccines: [{ id: 11, name: "BCG" }],
      },
    });

    apiClient.getAppointmentDateDetails.mockResolvedValue({
      availability: { available: true, message: "Date is available" },
      summary: { total: 0 },
      holiday: null,
      isWeekend: false,
      appointments: [],
    });

    apiClient.checkAppointmentAvailability.mockResolvedValue({
      available: true,
      message: "Available",
    });

    apiClient.createAppointment.mockResolvedValue({ id: 1001 });
    apiClient.updateAppointment.mockResolvedValue({ id: 101 });
    apiClient.cancelAppointment.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  test("configures calendar with Sunday as first day of week", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    expect(screen.getByTestId("fc-first-day")).toHaveTextContent("0");
    expect(mockFullCalendarProps.current?.firstDay).toBe(0);
  });

  test("blocks weekend date click and does not open booking modal", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("fc-date-click-saturday"));

    expect(
      await screen.findByText(/appointments can only be booked on weekdays/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /book appointment/i })).not.toBeInTheDocument();

    expect(screen.getByText("2030-03-02")).toBeInTheDocument();
  });

  test("weekday click opens booking modal and guardian action order uses submit before close", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("fc-date-click-monday"));

    expect(await screen.findByRole("dialog", { name: /book appointment/i })).toBeInTheDocument();

    const actions = screen.getByTestId("guardian-booking-form-actions");
    const buttons = within(actions).getAllByRole("button");

    expect(buttons[0]).toHaveTextContent(/book appointment|save changes/i);
    expect(buttons[1]).toHaveTextContent(/close/i);
  });

  test("day view header renderer includes weekday, month, numeric day, and year", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    const dayHeaderContent = mockFullCalendarProps.current?.dayHeaderContent;
    expect(typeof dayHeaderContent).toBe("function");

    const renderedHeader = dayHeaderContent({
      date: new Date("2030-03-04T00:00:00"),
      view: { type: "timeGridDay" },
    });

    render(<div>{renderedHeader}</div>);
    expect(screen.getByText("Monday, March 4, 2030")).toBeInTheDocument();
  });

  test("switching to Day view auto-jumps to selected date from month click", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("fc-date-click-monday"));
    expect(await screen.findByRole("dialog", { name: /book appointment/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    fireEvent.click(screen.getByRole("button", { name: /^day$/i }));

    expect(mockCalendarApi.changeView).toHaveBeenCalled();
    const lastCall = mockCalendarApi.changeView.mock.calls.at(-1);

    expect(lastCall[0]).toBe("timeGridDay");
    expect(lastCall[1]).toBeInstanceOf(Date);
    expect(lastCall[1].getFullYear()).toBe(2030);
    expect(lastCall[1].getMonth()).toBe(2);
    expect(lastCall[1].getDate()).toBe(4);
  });

  test("booking page keeps guardian action order with primary submit first", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("guardian-booking-page-form-actions")).toBeInTheDocument();
    });

    expect(screen.getByTestId("guardian-booking-page-submit-btn")).toHaveTextContent(
      /book appointment/i,
    );

    const actions = screen.getByTestId("guardian-booking-page-form-actions");
    const buttons = within(actions).getAllByRole("button");

    expect(buttons[0]).toHaveTextContent(/book appointment/i);
    expect(buttons[1]).toHaveTextContent(/cancel/i);
  });
});
