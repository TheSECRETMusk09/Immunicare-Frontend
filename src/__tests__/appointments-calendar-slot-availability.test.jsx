import { getCalendarCellSlotsRemaining } from "../pages/Appointments";

describe("appointments calendar slot availability", () => {
  test("subtracts the booked count from the provided daily slot limit", () => {
    expect(
      getCalendarCellSlotsRemaining({
        dateKey: "2026-05-15",
        bookedAppointmentsByDate: {},
        availability: { totalAppointments: 1 },
        dailyVaccinationSlotLimit: 3,
      }),
    ).toBe(2);
  });

  test("prefers booked appointments already loaded in page state for the same date", () => {
    expect(
      getCalendarCellSlotsRemaining({
        dateKey: "2026-05-15",
        bookedAppointmentsByDate: { "2026-05-15": 4 },
        availability: { totalAppointments: 1 },
        dailyVaccinationSlotLimit: 10,
      }),
    ).toBe(6);
  });

  test("never returns a negative remaining slot count", () => {
    expect(
      getCalendarCellSlotsRemaining({
        dateKey: "2026-05-15",
        bookedAppointmentsByDate: { "2026-05-15": 12 },
        availability: null,
        dailyVaccinationSlotLimit: 10,
      }),
    ).toBe(0);
  });
});
