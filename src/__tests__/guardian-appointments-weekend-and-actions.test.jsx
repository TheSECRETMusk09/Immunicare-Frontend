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

const mockNavigate = jest.fn();

const toManilaDateTimeKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);

  const lookup = parts.reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}`;
};

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

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
    getAppointmentSuggestions: jest.fn(),
    getAppointmentTimeSlots: jest.fn(),
    getInfantsByGuardian: jest.fn(),
    getVaccinationReadiness: jest.fn(),
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
    Button: ({ children, loading, variant, size, disabled, actionRole, ...props }) => (
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
    mockNavigate.mockReset();
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

    apiClient.getVaccinationReadiness.mockResolvedValue({
      success: true,
      data: {
        readinessStatus: "READY",
        dueVaccines: [
          {
            vaccineId: 11,
            label: "BCG (Dose 1)",
            earliestDate: "2030-03-04",
            recommendedDate: "2030-03-04",
          },
        ],
        overdueVaccines: [],
        blockedVaccines: [],
        nextAppointmentPrediction: {
          date: "2030-03-04",
          reason: "Earliest safe date for next eligible dose",
        },
      },
    });

    apiClient.getAppointmentSuggestions.mockResolvedValue({
      success: true,
      data: {
        suggestions: [
          {
            infant_id: 1,
            infant_name: "John Doe",
            date: "2030-03-04",
            time: "09:00",
            vaccineId: 11,
            vaccine: "BCG (Dose 1)",
            reason: "Earliest clinic slot that meets schedule and stock rules",
            isOverdue: false,
          },
        ],
      },
    });

    apiClient.getAppointmentTimeSlots.mockResolvedValue({
      available: true,
      message: "Available",
      slots: ["09:00", "09:30"],
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
      await screen.findByText(
        /saturday - no appointments available|appointments can only be booked on weekdays/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /book appointment/i })).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    expect(screen.getByText("2030-03-02")).toBeInTheDocument();
  });

  test("weekday click routes to the full booking page with selected date prefilled", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("fullcalendar-mock")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("fc-date-click-monday"));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/guardian/appointments/new?date=2030-03-04",
        expect.objectContaining({
          state: expect.objectContaining({
            selectedDate: "2030-03-04",
            source: "guardian-appointments-calendar",
          }),
        }),
      );
    });
  });

  test("calendar events and date details stay on the clinic-local appointment date", async () => {
    apiClient.getGuardianAppointments.mockResolvedValueOnce([
      {
        id: 202,
        infant_id: 1,
        first_name: "Christian",
        last_name: "Samorin",
        scheduled_date: "2030-03-04T00:00:00.000Z",
        scheduled_time: "08:00",
        type: "Vaccination",
        status: "scheduled",
      },
    ]);

    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockFullCalendarProps.current?.events?.[0]?.start).toBeInstanceOf(Date);
    });

    const calendarEvent = mockFullCalendarProps.current.events[0];
    expect(calendarEvent.start.getFullYear()).toBe(2030);
    expect(calendarEvent.start.getMonth()).toBe(2);
    expect(calendarEvent.start.getDate()).toBe(4);

    fireEvent.click(screen.getByTestId("fc-date-click-monday"));

    await waitFor(() => {
      expect(screen.getByText("2030-03-04")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open date detail panel/i }));

    const dialog = await screen.findByRole("dialog", { name: /date details/i });
    const totalAppointmentsLabel = within(dialog).getByText(/total appointments/i);

    expect(totalAppointmentsLabel.nextElementSibling).toHaveTextContent("1");
    expect(within(dialog).getByText("Christian Samorin")).toBeInTheDocument();
    expect(within(dialog).queryByText(/no appointments scheduled for this date/i)).not.toBeInTheDocument();
  });

  test("guardian appointments page hides vaccine stock details from guardians", async () => {
    apiClient.getAppointmentCalendarAvailability.mockResolvedValueOnce({
      inventory: {
        totalAvailableStock: 0,
        availableVaccines: 0,
        vaccines: [],
      },
    });

    apiClient.getAppointmentDateDetails.mockResolvedValueOnce({
      availability: { available: true, message: "Date is available" },
      summary: { total: 0 },
      holiday: null,
      isWeekend: false,
      appointments: [],
      inventory: {
        totalAvailableStock: 99,
        availableVaccines: 3,
      },
    });

    render(
      <MemoryRouter>
        <GuardianAppointmentsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /selected date/i }),
    ).toBeInTheDocument();

    expect(screen.queryByText(/available vaccines/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total stock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no vaccines available right now/i)).not.toBeInTheDocument();
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

  test("booking page preserves calendar-selected date and auto-loads slots for prefilled child context", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/guardian/appointments/new?childId=1&date=2030-03-04"]}>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    });

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toHaveValue("2030-03-04");

    await waitFor(() => {
      expect(apiClient.getVaccinationReadiness).toHaveBeenCalledWith(1, {
        scheduled_date: "2030-03-04",
      });
    });

    await waitFor(() => {
      expect(apiClient.getAppointmentSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ infantId: 1, guardianId: 1 }),
      );
    });

    await waitFor(() => {
      expect(apiClient.getAppointmentTimeSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled_date: "2030-03-04",
          vaccine_id: "11",
        }),
      );
    });
  });

  test("booking page submits a vaccine-aware appointment from smart suggestions", async () => {
    render(
      <MemoryRouter>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /john doe/i }));

    await waitFor(() => {
      expect(apiClient.getVaccinationReadiness).toHaveBeenCalledWith(1, {
        scheduled_date: "2030-03-04",
      });
    });

    await waitFor(() => {
      expect(apiClient.getAppointmentSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ infantId: 1, guardianId: 1 }),
      );
    });

    expect(await screen.findByText(/recommended vaccine/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /bcg \(dose 1\)/i }),
    );

    await waitFor(() => {
      expect(apiClient.getAppointmentTimeSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled_date: "2030-03-04",
          vaccine_id: "11",
        }),
      );
    });

    fireEvent.click(screen.getByTestId("guardian-booking-page-submit-btn"));

    await waitFor(() => {
      expect(apiClient.createAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          infant_id: 1,
          vaccine_id: 11,
          type: "Vaccination",
          scheduled_date: expect.any(String),
        }),
      );
    });

    const submittedPayload = apiClient.createAppointment.mock.calls.at(-1)?.[0];
    expect(toManilaDateTimeKey(submittedPayload?.scheduled_date)).toBe("2030-03-04T09:00");
  });

  test("booking page deduplicates repeated pending confirmation reasons", async () => {
    apiClient.getVaccinationReadiness.mockResolvedValue({
      success: true,
      data: {
        readinessStatus: "PENDING_CONFIRMATION",
        dueVaccines: [],
        overdueVaccines: [],
        blockedVaccines: [
          { vaccineId: 11, reason: "Pending admin confirmation" },
          { vaccineId: 12, reason: "Pending admin confirmation" },
        ],
        nextAppointmentPrediction: null,
      },
    });

    render(
      <MemoryRouter>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /john doe/i }));

    expect(await screen.findByText(/booking is blocked:/i)).toHaveTextContent(
      "Booking is blocked: Pending admin confirmation",
    );
    expect(
      screen.queryByText(
        "Booking is blocked: Pending admin confirmation, Pending admin confirmation",
      ),
    ).not.toBeInTheDocument();
  });

  test("booking page reads guardian child sex from the canonical gender field when sex is missing", async () => {
    apiClient.getInfantsByGuardian.mockResolvedValueOnce([
      {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        dob: "2023-01-01",
        gender: "Male",
        control_number: "CN-001",
      },
    ]);

    render(
      <MemoryRouter>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /john doe/i }));

    expect(await screen.findByText("Male")).toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  test("booking page loads time slots when a future selected date makes the next dose eligible", async () => {
    apiClient.getVaccinationReadiness
      .mockResolvedValueOnce({
        success: true,
        data: {
          readinessStatus: "UPCOMING",
          dueVaccines: [],
          overdueVaccines: [],
          blockedVaccines: [],
          nextAppointmentPrediction: null,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          readinessStatus: "OVERDUE",
          dueVaccines: [],
          overdueVaccines: [
            {
              vaccineId: 11,
              label: "BCG (Dose 1)",
              earliestDate: "2030-03-04",
              recommendedDate: "2030-03-04",
            },
          ],
          blockedVaccines: [],
          nextAppointmentPrediction: {
            date: "2030-03-04",
            reason: "Earliest safe date for next eligible dose",
          },
        },
      });

    const { container } = render(
      <MemoryRouter>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /john doe/i }));

    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
    fireEvent.change(dateInput, { target: { value: "2030-03-04" } });

    await waitFor(() => {
      expect(apiClient.getVaccinationReadiness).toHaveBeenLastCalledWith(1, {
        scheduled_date: "2030-03-04",
      });
    });

    await waitFor(() => {
      expect(apiClient.getAppointmentTimeSlots).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduled_date: "2030-03-04",
          vaccine_id: "11",
        }),
      );
    });

    expect(
      within(screen.getByText(/appointment time \(8am - 4pm\)/i).parentElement).getByRole("combobox"),
    ).not.toBeDisabled();
  });

  test("booking page shows slot availability feedback instead of silently failing", async () => {
    apiClient.getAppointmentTimeSlots.mockResolvedValueOnce({
      available: false,
      message: "Selected vaccine is currently out of stock for this date.",
      slots: [],
    });

    render(
      <MemoryRouter initialEntries={["/guardian/appointments/new?childId=1&date=2030-03-04"]}>
        <GuardianAppointmentBooking />
      </MemoryRouter>,
    );

    const appointmentTimeSection = await screen.findByText(/appointment time \(8am - 4pm\)/i);

    expect(
      await screen.findByText(/selected vaccine is currently out of stock for this date/i),
    ).toBeInTheDocument();
    expect(
      within(appointmentTimeSection.parentElement).getByRole("combobox"),
    ).toBeDisabled();
  });
});
