export const MAX_DAILY_VACCINATION_SLOTS = 400;

export const getCalendarCellSlotsRemaining = ({
  dateKey,
  bookedAppointmentsByDate = {},
  availability = null,
  dailyVaccinationSlotLimit = MAX_DAILY_VACCINATION_SLOTS,
}) =>
  Math.max(
    0,
    dailyVaccinationSlotLimit -
      (bookedAppointmentsByDate[dateKey] ?? availability?.totalAppointments ?? 0),
  );
