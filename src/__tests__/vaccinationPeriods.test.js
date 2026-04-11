import {
  getVaccinationPeriodRange,
  normalizeVaccinationPeriod,
} from "../utils/vaccinationPeriods";

describe("vaccination period helpers", () => {
  test("normalizes unknown values to month", () => {
    expect(normalizeVaccinationPeriod("something-else")).toBe("month");
  });

  test("builds full calendar month ranges", () => {
    const referenceDate = new Date(2026, 2, 29, 12, 0, 0);
    const range = getVaccinationPeriodRange({
      period: "month",
      referenceDate,
    });

    expect(range).toEqual({
      startDate: "",
      endDate: "2026-03-31",
    });
  });
});
