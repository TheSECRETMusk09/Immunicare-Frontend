export const APPROVED_VACCINE_NAMES = Object.freeze([
  "BCG",
  "Hepa B",
  "IPV multi dose",
  "MMR",
  "OPV 20-doses",
  "Penta Valent",
  "PCV 13/PCV 10",
]);

const NORMALIZED_VACCINE_ALIAS_MAP = Object.freeze({
  BCG: Object.freeze(["BCG"]),
  "Hepa B": Object.freeze(["HEPA B"]),
  "IPV multi dose": Object.freeze(["IPV MULTI DOSE"]),
  MMR: Object.freeze(["MMR"]),
  "OPV 20-doses": Object.freeze(["OPV 20-DOSES"]),
  "Penta Valent": Object.freeze(["PENTA VALENT"]),
  "PCV 13/PCV 10": Object.freeze([
    "PCV 13/PCV 10",
    "PCV 13",
    "PCV 10",
    "PCV13",
    "PCV10",
    "PCV",
  ]),
});

const NORMALIZED_ALIAS_LOOKUP = Object.freeze(
  Object.entries(NORMALIZED_VACCINE_ALIAS_MAP).reduce(
    (accumulator, [canonicalName, aliases]) => {
      aliases.forEach((alias) => {
        accumulator[alias] = canonicalName;
      });
      return accumulator;
    },
    {},
  ),
);

const normalizeAliasKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const normalizeApprovedVaccineName = (value) => {
  const normalizedKey = normalizeAliasKey(value);
  return NORMALIZED_ALIAS_LOOKUP[normalizedKey] || null;
};

export const resolveApprovedVaccineAliases = (value) => {
  const canonicalName = normalizeApprovedVaccineName(value);
  return canonicalName ? [...(NORMALIZED_VACCINE_ALIAS_MAP[canonicalName] || [])] : [];
};

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
  Boolean(normalizeApprovedVaccineName(value));

export const buildApprovedVaccineOptions = (values = []) => {
  const seen = new Set();

  values.forEach((value) => {
    const canonicalName = normalizeApprovedVaccineName(value);
    if (canonicalName) {
      seen.add(canonicalName);
    }
  });

  return APPROVED_VACCINE_NAMES.filter((name) => seen.has(name)).map((name) => ({
    value: name,
    label: name,
    allowedBrands: getApprovedBrandsForVaccine(name),
  }));
};

export const APPROVED_VACCINE_OPTIONS = Object.freeze(
  APPROVED_VACCINE_NAMES.map((name) => ({
    value: name,
    label: name,
    allowedBrands: getApprovedBrandsForVaccine(name),
  })),
);
