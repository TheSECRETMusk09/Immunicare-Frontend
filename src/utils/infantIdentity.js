const toStringSafe = (value) => String(value ?? "").trim();
const normalizeSearchToken = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[.,]+/g, "");

export const normalizeSearchQuery = (value) =>
  String(value ?? "").trim().toLowerCase();

export const tokenizeSearchQuery = (value) =>
  normalizeSearchQuery(value)
    .split(/\s+/)
    .map(normalizeSearchToken)
    .filter(Boolean);

export const matchesTokenizedTextSearch = (searchableText, rawQuery) => {
  const tokens = tokenizeSearchQuery(rawQuery);
  if (tokens.length === 0) {
    return true;
  }

  const haystack = normalizeSearchQuery(searchableText);
  return tokens.every((token) => haystack.includes(token));
};

const GENERIC_INFANT_LABEL_PATTERN = /^infant(?:[\s#_-]*\d+)?$/i;

const isGenericInfantLabel = (value) => {
  const normalized = toStringSafe(value);
  return Boolean(normalized) && GENERIC_INFANT_LABEL_PATTERN.test(normalized);
};

const infantDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const getInfantDateOfBirthValue = (infant = {}) =>
  infant.dob ?? infant.date_of_birth ?? infant.dateOfBirth ?? infant.birth_date ?? "";

export const formatInfantDate = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return infantDateFormatter.format(parsed);
};

const buildDateSearchTokens = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = String(parsed.getFullYear());

  return [
    formatInfantDate(parsed),
    `${year}-${month}-${day}`,
    `${month}/${day}/${year}`,
    `${Number(month)}/${Number(day)}/${year}`,
  ]
    .filter(Boolean)
    .join(" ");
};

export const getInfantFullName = (infant = {}) => {
  const firstName = toStringSafe(
    infant.first_name ?? infant.firstName ?? infant.patient_first_name ?? infant.infant_first_name,
  );
  const middleName = toStringSafe(
    infant.middle_name ?? infant.middleName ?? infant.middlename ?? infant.patient_middle_name,
  );
  const lastName = toStringSafe(
    infant.last_name ?? infant.lastName ?? infant.patient_last_name ?? infant.infant_last_name,
  );

  const fullName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  return toStringSafe(
    infant.full_name || infant.infant_name || infant.name || infant.display_name,
  );
};

export const getInfantControlNumber = (infant = {}) =>
  toStringSafe(
    infant.control_number ??
      infant.controlNumber ??
      infant.infant_control_number ??
      infant.patient_control_number,
  );

export const getInfantDisplayLabel = (infant = {}) => {
  const fullName = getInfantFullName(infant);
  if (fullName && !isGenericInfantLabel(fullName)) {
    return fullName;
  }

  const controlNumber = getInfantControlNumber(infant);
  if (controlNumber) {
    return controlNumber;
  }

  const readableFallback = [
    infant.full_name,
    infant.infant_name,
    infant.display_name,
    infant.name,
  ]
    .map(toStringSafe)
    .find((value) => value && !isGenericInfantLabel(value));

  if (readableFallback) {
    return readableFallback;
  }

  return "Infant record";
};

export const buildInfantRecordPrefillContext = (infant = {}) => {
  const firstName = toStringSafe(
    infant.first_name ?? infant.firstName ?? infant.patient_first_name ?? infant.infant_first_name,
  );
  const middleName = toStringSafe(
    infant.middle_name ?? infant.middleName ?? infant.middlename ?? infant.patient_middle_name,
  );
  const lastName = toStringSafe(
    infant.last_name ?? infant.lastName ?? infant.patient_last_name ?? infant.infant_last_name,
  );
  const displayName = getInfantDisplayLabel({
    ...infant,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
  });
  const controlNumber = getInfantControlNumber(infant);
  const infantId = Number(infant.id ?? infant.infant_id ?? infant.patient_id ?? 0) || null;

  return {
    id: infantId,
    infant_id: infantId,
    infantId,
    patient_id: infantId,
    first_name: firstName || null,
    middle_name: middleName || null,
    last_name: lastName || null,
    full_name: displayName,
    name: displayName,
    display_name: displayName,
    dob: getInfantDateOfBirthValue(infant) || null,
    control_number: controlNumber || null,
    infant_control_number: controlNumber || null,
    patient_control_number: controlNumber || null,
    search_text: buildInfantSearchText({
      ...infant,
      id: infantId,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      control_number: controlNumber,
      full_name: displayName,
      display_name: displayName,
      name: displayName,
    }),
  };
};

export const buildInfantSearchText = (infant = {}) => {
  const fullName = getInfantFullName(infant);
  const firstName = toStringSafe(
    infant.first_name ?? infant.firstName ?? infant.patient_first_name ?? infant.infant_first_name,
  );
  const middleName = toStringSafe(
    infant.middle_name ?? infant.middleName ?? infant.middlename ?? infant.patient_middle_name,
  );
  const middleInitial = middleName ? middleName.charAt(0) : "";
  const lastName = toStringSafe(
    infant.last_name ?? infant.lastName ?? infant.patient_last_name ?? infant.infant_last_name,
  );
  const controlNumber = getInfantControlNumber(infant);
  const rawDob = getInfantDateOfBirthValue(infant);

  const searchParts = [
    fullName,
    [firstName, middleInitial, lastName].filter(Boolean).join(" "),
    [firstName, lastName].filter(Boolean).join(" "),
    [middleName, lastName].filter(Boolean).join(" "),
    [lastName, firstName].filter(Boolean).join(" "),
    [lastName, firstName, middleName].filter(Boolean).join(" "),
    [lastName, firstName, middleInitial].filter(Boolean).join(" "),
    [lastName, `${firstName}${middleName ? ` ${middleName}` : ""}`.trim()]
      .filter(Boolean)
      .join(", "),
    [lastName, `${firstName}${middleInitial ? ` ${middleInitial}` : ""}`.trim()]
      .filter(Boolean)
      .join(", "),
    infant.first_name,
    infant.firstName,
    infant.middle_name,
    infant.middleName,
    middleInitial,
    infant.last_name,
    infant.lastName,
    infant.patient_first_name,
    infant.patient_middle_name,
    infant.patient_last_name,
    controlNumber,
    infant.infant_control_number,
    infant.patient_control_number,
    // FIX: Client-side child search must NOT match against guardian/parent
    // names or contact numbers. Including those fields caused 'samorin' to
    // surface every child whose GUARDIAN was named Samorin, regardless of
    // the child's own last name. Restricted haystack to child identity only.
    rawDob,
    buildDateSearchTokens(rawDob),
  ];

  return searchParts
    .flat()
    .map((part) => toStringSafe(part))
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase();
};
