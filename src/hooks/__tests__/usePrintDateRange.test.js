import { act, renderHook } from "@testing-library/react";
import usePrintDateRange from "../usePrintDateRange";
import { filterItemsByPrintDateRange } from "../../utils/printDateRange";

describe("usePrintDateRange", () => {
  test("requires users to apply a valid draft range before printing", () => {
    const { result } = renderHook(() =>
      usePrintDateRange({
        headerPrefix: "Date Range",
        fallbackLabel: "All records",
      }),
    );

    let initialReady = false;
    act(() => {
      initialReady = result.current.ensureReadyForPrint();
    });

    expect(initialReady).toBe(true);

    act(() => {
      result.current.setStartDateInput("2026-03-01");
      result.current.setEndDateInput("2026-03-31");
    });

    let readyToPrint = true;
    act(() => {
      readyToPrint = result.current.ensureReadyForPrint();
    });

    expect(readyToPrint).toBe(false);

    expect(result.current.validationError).toMatch(/click apply range/i);

    let didApply = false;
    act(() => {
      didApply = result.current.applyDateRange();
    });

    expect(didApply).toBe(true);
    expect(result.current.hasAppliedDateRange).toBe(true);
    expect(result.current.validationError).toBe("");
    let appliedReady = false;
    act(() => {
      appliedReady = result.current.ensureReadyForPrint();
    });

    expect(appliedReady).toBe(true);
    expect(result.current.activeDateRangeLabel).toMatch(/date range:/i);
  });

  test("rejects invalid date order", () => {
    const { result } = renderHook(() => usePrintDateRange());

    act(() => {
      result.current.setStartDateInput("2026-04-05");
      result.current.setEndDateInput("2026-04-01");
    });

    let didApply = true;
    act(() => {
      didApply = result.current.applyDateRange();
    });

    expect(didApply).toBe(false);
    expect(result.current.validationError).toBe("Start Date cannot be later than End Date.");
  });

  test("can sync an externally controlled applied range", () => {
    const { result } = renderHook(() => usePrintDateRange());

    let didSync = false;
    act(() => {
      didSync = result.current.syncDateRange({
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        apply: true,
      });
    });

    expect(didSync).toBe(true);
    expect(result.current.startDateInput).toBe("2026-04-01");
    expect(result.current.endDateInput).toBe("2026-04-30");
    expect(result.current.appliedStartDate).toBe("2026-04-01");
    expect(result.current.appliedEndDate).toBe("2026-04-30");
    expect(result.current.hasAppliedDateRange).toBe(true);

    act(() => {
      result.current.syncDateRange({
        startDate: "",
        endDate: "",
        clearIfEmpty: true,
      });
    });

    expect(result.current.appliedStartDate).toBe("");
    expect(result.current.appliedEndDate).toBe("");
    expect(result.current.hasAppliedDateRange).toBe(false);
  });
});

describe("filterItemsByPrintDateRange", () => {
  test("keeps only records with matching candidate dates inside the applied range", () => {
    const items = [
      { id: 1, created_at: "2026-03-05", updated_at: null },
      { id: 2, created_at: "2026-04-02", updated_at: null },
      { id: 3, created_at: null, updated_at: "2026-03-18" },
      { id: 4, created_at: null, updated_at: null },
    ];

    const filtered = filterItemsByPrintDateRange(items, {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      getItemDates: (item) => [item.created_at, item.updated_at],
    });

    expect(filtered.map((item) => item.id)).toEqual([1, 3]);
  });
});
