import { useCallback, useMemo, useState } from "react";
import {
  formatPrintDateRangeLabel,
  resolvePrintLocale,
  resolvePrintTimeZone,
  validatePrintDateRange,
} from "../utils/printDateRange";

export default function usePrintDateRange({
  initialStartDate = "",
  initialEndDate = "",
  fallbackLabel = "All available records",
  headerPrefix = "Date Range",
} = {}) {
  const [startDateInput, setStartDateInput] = useState(initialStartDate);
  const [endDateInput, setEndDateInput] = useState(initialEndDate);
  const [appliedStartDate, setAppliedStartDate] = useState(initialStartDate);
  const [appliedEndDate, setAppliedEndDate] = useState(initialEndDate);
  const [validationError, setValidationError] = useState("");

  const locale = useMemo(() => resolvePrintLocale(), []);
  const timeZone = useMemo(() => resolvePrintTimeZone(), []);

  const draftValidation = useMemo(
    () =>
      validatePrintDateRange({
        startDate: startDateInput,
        endDate: endDateInput,
      }),
    [startDateInput, endDateInput],
  );

  const applyDateRange = useCallback(() => {
    const nextValidation = validatePrintDateRange({
      startDate: startDateInput,
      endDate: endDateInput,
    });

    if (!nextValidation.isValid) {
      setValidationError(nextValidation.error);
      return false;
    }

    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
    setValidationError("");
    return true;
  }, [endDateInput, startDateInput]);

  const ensureReadyForPrint = useCallback(() => {
    const hasDraftRange = Boolean(startDateInput || endDateInput);
    const draftChanged =
      startDateInput !== appliedStartDate || endDateInput !== appliedEndDate;

    if (!hasDraftRange && !appliedStartDate && !appliedEndDate) {
      setValidationError("");
      return true;
    }

    if (draftChanged) {
      if (!draftValidation.isValid) {
        setValidationError(draftValidation.error);
        return false;
      }

      setValidationError(
        "Click Apply Range before printing or exporting so the preview uses the selected dates.",
      );
      return false;
    }

    if (!draftValidation.isValid) {
      setValidationError(draftValidation.error);
      return false;
    }

    setValidationError("");
    return true;
  }, [
    appliedEndDate,
    appliedStartDate,
    draftValidation.error,
    draftValidation.isValid,
    endDateInput,
    startDateInput,
  ]);

  const clearDateRange = useCallback(() => {
    setStartDateInput("");
    setEndDateInput("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setValidationError("");
  }, []);

  const updateStartDate = useCallback((value) => {
    setStartDateInput(value);
    setValidationError("");
  }, []);

  const updateEndDate = useCallback((value) => {
    setEndDateInput(value);
    setValidationError("");
  }, []);

  const hasAppliedDateRange = Boolean(appliedStartDate && appliedEndDate);
  const activeDateRangeLabel = useMemo(
    () =>
      formatPrintDateRangeLabel({
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        locale,
        timeZone,
        prefix: headerPrefix,
        fallbackLabel,
      }),
    [appliedEndDate, appliedStartDate, fallbackLabel, headerPrefix, locale, timeZone],
  );

  return {
    startDateInput,
    endDateInput,
    appliedStartDate,
    appliedEndDate,
    validationError,
    locale,
    timeZone,
    hasAppliedDateRange,
    activeDateRangeLabel,
    draftValidation,
    setStartDateInput: updateStartDate,
    setEndDateInput: updateEndDate,
    applyDateRange,
    clearDateRange,
    ensureReadyForPrint,
    setValidationError,
  };
}
