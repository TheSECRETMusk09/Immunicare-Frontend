import {
  buildVaccinationRecordPeriodParams,
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
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });
  });

  test("builds calendar week ranges anchored to Monday-Sunday", () => {
    const range = getVaccinationPeriodRange({
      period: "week",
      referenceDate: new Date("2026-04-17T10:00:00.000Z"),
    });

    expect(range).toEqual({
      startDate: "2026-04-13",
      endDate: "2026-04-19",
    });
  });

  test("builds records params from canonical period keys", () => {
    expect(buildVaccinationRecordPeriodParams({ period: "month" })).toEqual({
      period: "month",
    });

    expect(
      buildVaccinationRecordPeriodParams({
        period: "custom",
        startDate: "2026-04-01",
        endDate: "2026-04-30",
      }),
    ).toEqual({
      period: "custom",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
  });
});
