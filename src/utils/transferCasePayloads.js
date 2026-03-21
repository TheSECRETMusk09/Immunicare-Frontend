export const createTransferVaccineEntry = (id = 1, facilityName = "") => ({
  id,
  vaccineName: "",
  doseNumber: 1,
  dateAdministered: "",
  facilityName,
  batchNumber: "",
});

const normalizePositiveDoseNumber = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const validateTransferHistoryEntries = (entries = []) => {
  const errors = [];
  const seenDoseKeys = new Set();

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      isValid: false,
      errors: ["At least one previously administered dose is required."],
    };
  }

  entries.forEach((entry = {}, index) => {
    const vaccineName = String(entry.vaccineName || "").trim();
    const doseNumber = normalizePositiveDoseNumber(entry.doseNumber);
    const dateAdministered = String(entry.dateAdministered || "").trim();

    if (!vaccineName) {
      errors.push(`Dose entry ${index + 1} must include a vaccine name.`);
    }

    if (!doseNumber) {
      errors.push(`Dose entry ${index + 1} must include a valid positive dose number.`);
    }

    if (!dateAdministered) {
      errors.push(`Dose entry ${index + 1} must include an administered date.`);
    }

    if (vaccineName && doseNumber) {
      const duplicateKey = `${vaccineName}:${doseNumber}`;
      if (seenDoseKeys.has(duplicateKey)) {
        errors.push(`Duplicate vaccine dose detected for ${vaccineName} dose ${doseNumber}.`);
      } else {
        seenDoseKeys.add(duplicateKey);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const buildTransferCaseVaccinesPayload = (
  entries = [],
  fallbackFacilityName = "",
) => {
  return entries
    .filter((entry) =>
      Boolean(
        String(entry?.vaccineName || "").trim() ||
          String(entry?.dateAdministered || "").trim(),
      ),
    )
    .map((entry) => ({
      vaccine_name: String(entry.vaccineName || "").trim(),
      dose_number: normalizePositiveDoseNumber(entry.doseNumber) || 1,
      date_administered: String(entry.dateAdministered || "").trim(),
      batch_number: String(entry.batchNumber || "").trim() || null,
      facility_name:
        String(entry.facilityName || "").trim() ||
        String(fallbackFacilityName || "").trim() ||
        null,
    }));
};
