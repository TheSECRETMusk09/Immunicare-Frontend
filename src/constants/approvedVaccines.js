export const APPROVED_VACCINE_NAMES = Object.freeze([
  "BCG",
  "Diluent",
  "Hepa B",
  "Penta Valent",
  "OPV 20-doses",
  "PCV 13/PCV 10",
  "MMR",
  "Diluent 5ml",
  "IPV multi dose",
]);

export const APPROVED_VACCINE_BRANDS = Object.freeze(
  APPROVED_VACCINE_NAMES.reduce((accumulator, vaccineName) => {
    accumulator[vaccineName] = Object.freeze([]);
    return accumulator;
  }, {}),
);

export const getApprovedBrandsForVaccine = (vaccineName) =>
  Object.prototype.hasOwnProperty.call(APPROVED_VACCINE_BRANDS, vaccineName)
    ? [...APPROVED_VACCINE_BRANDS[vaccineName]]
    : [];

export const isApprovedVaccineName = (value) =>
  typeof value === "string" && APPROVED_VACCINE_NAMES.includes(value);

export const APPROVED_VACCINE_OPTIONS = Object.freeze(
  APPROVED_VACCINE_NAMES.map((name) => ({
    value: name,
    label: name,
    allowedBrands: getApprovedBrandsForVaccine(name),
  })),
);
