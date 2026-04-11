import holidayUtils from "../shared/philippineHolidays";

const {
  CLINIC_TIMEZONE,
  DATE_ONLY_PATTERN,
  PH_FIXED_HOLIDAYS,
  parseDateInput,
  toDateKey,
  fromDateKey,
  getPhilippineHolidays,
  getHolidayInfo,
  isPhilippineHoliday,
  isWeekend,
  isSaturday,
  isSunday,
  isDateAvailableForBooking,
  getMinBookingDate,
  getHolidaysForMonth,
  formatHoliday,
  getUpcomingHolidays,
  getDatePickerFilter,
  getHolidayTypeClass,
} = holidayUtils;

export {
  CLINIC_TIMEZONE,
  DATE_ONLY_PATTERN,
  PH_FIXED_HOLIDAYS,
  parseDateInput,
  toDateKey,
  fromDateKey,
  getPhilippineHolidays,
  getHolidayInfo,
  isPhilippineHoliday,
  isWeekend,
  isSaturday,
  isSunday,
  isDateAvailableForBooking,
  getMinBookingDate,
  getHolidaysForMonth,
  formatHoliday,
  getUpcomingHolidays,
  getDatePickerFilter,
  getHolidayTypeClass,
};

export default holidayUtils;
