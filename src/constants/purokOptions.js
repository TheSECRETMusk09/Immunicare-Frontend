export const PUROK_STREET_COLOR_MAPPING = {
  "Purok 1": [
    "Son Risa St. - Pink",
    "G. Monaco St. - Yellow",
    "Fatalla St. - Violet",
  ],
  "Purok 2": ["M.H Del Pilar - Blue"],
  "Purok 3": ["M.H Del Pilar - Orange"],
  "Purok 4": ["M.H Del Pilar - Green"],
  "Purok 5": ["M.H Del Pilar - Green"],
  "Purok 6": ["Dimanlig St. - White"],
  "Purok 7": ["Bedana / Dimanlig St. - Red"],
};

export const PUROK_OPTIONS = [
  { value: "", label: "Select Purok" },
  ...Object.keys(PUROK_STREET_COLOR_MAPPING).map((value) => ({
    value,
    label: value,
  })),
];

const toOption = (value) => ({ value, label: value });

export const getPurokStreetColorValues = (selectedPurok) =>
  PUROK_STREET_COLOR_MAPPING[selectedPurok] || [];

export const getPurokStreetColorOptions = (selectedPurok) => [
  {
    value: "",
    label: selectedPurok
      ? "Select Purok-Street-Color"
      : "Select Purok first",
  },
  ...getPurokStreetColorValues(selectedPurok).map(toOption),
];

export const isValidPurokSelection = (selectedPurok) =>
  Object.prototype.hasOwnProperty.call(
    PUROK_STREET_COLOR_MAPPING,
    String(selectedPurok || "").trim(),
  );

export const isValidPurokStreetColorSelection = (
  selectedPurok,
  selectedStreetColor,
) =>
  getPurokStreetColorValues(String(selectedPurok || "").trim()).includes(
    String(selectedStreetColor || "").trim(),
  );
