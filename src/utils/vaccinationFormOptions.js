import { toArrayPayload } from "./adminDataAdapters";
import { normalizeRoleLabel } from "./roleLabels";

export const HEALTH_WORKER_ROLE_NAMES = ["nurse", "midwife"];

const normalizeText = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTitleCase = (value) =>
  normalizeText(value)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const resolveLotBatchValue = (...values) => {
  for (const value of values.flat()) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const matchesClinicScope = (user, scopedClinicId) => {
  const normalizedScopedClinicId = toNumberOrNull(scopedClinicId);
  if (!normalizedScopedClinicId) return true;

  const userClinicId = toNumberOrNull(user?.clinic_id ?? user?.facility_id);
  return userClinicId === normalizedScopedClinicId;
};

const resolveRoleLabel = (user) =>
  normalizeRoleLabel(
    normalizeText(user?.display_name) ||
      normalizeText(user?.role_display_name) ||
      toTitleCase(user?.role_name || user?.role),
  );

const resolveUserLabel = (user) =>
  normalizeText(user?.username) ||
  normalizeText(user?.full_name) ||
  normalizeText(user?.name) ||
  normalizeText(user?.email) ||
  `User ${user?.id ?? ""}`.trim();

export const formatHealthWorkerOptionLabel = (user = {}) => {
  const roleLabel = resolveRoleLabel(user) || "User";
  const userLabel = resolveUserLabel(user);
  return `${roleLabel}: ${userLabel}`;
};

export const buildHealthWorkerOptions = (responseOrUsers, scopedClinicId = null) => {
  const users = Array.isArray(responseOrUsers)
    ? responseOrUsers
    : toArrayPayload(responseOrUsers, ["users"]);

  return users
    .filter((user) => {
      const normalizedRole = normalizeText(user?.role_name || user?.role).toLowerCase();
      const isActive = user?.is_active !== false;

      return (
        isActive &&
        HEALTH_WORKER_ROLE_NAMES.includes(normalizedRole) &&
        matchesClinicScope(user, scopedClinicId)
      );
    })
    .map((user) => ({
      ...user,
      optionLabel: formatHealthWorkerOptionLabel(user),
    }))
    .sort((left, right) => left.optionLabel.localeCompare(right.optionLabel));
};

export const buildInventorySourceOptionLabel = (record = {}) => {
  const facilityName =
    normalizeText(record?.facility_name) ||
    normalizeText(record?.clinic_name) ||
    "Barangay San Nicolas Health Center";
  const stockOnHand = Number(record?.stock_on_hand || 0);
  const lotBatchValue =
    resolveLotBatchValue(
      record?.lot_batch_number,
      record?.batch_number,
      record?.lot_number,
    ) || "N/A";

  return `${facilityName} • Stock ${stockOnHand} • Lot/Batch ${lotBatchValue}`;
};

export const buildVaccinationBatchOptionLabel = (record = {}) => {
  const facilityName =
    normalizeText(record?.facility_name) ||
    normalizeText(record?.clinic_name) ||
    "Barangay San Nicolas Health Center";
  const stockOnHand = Number(record?.stock_on_hand ?? record?.qty_current ?? 0);
  const lotBatchValue =
    resolveLotBatchValue(
      record?.lot_batch_number,
      record?.batch_number,
      record?.lot_number,
      record?.lot_no,
    ) || "N/A";
  const rawExpiryDate = normalizeText(record?.expiry_date || record?.expiration_date);
  const expiryDate = rawExpiryDate
    ? new Date(rawExpiryDate).toLocaleDateString("en-US")
    : "No expiry date";
  const recommendationLabel =
    record?.selection_disabled_reason === "expired"
      ? "Expired ledger batch"
      : record?.selection_disabled_reason === "out_of_stock"
        ? "Out-of-stock batch"
        : record?.selection_disabled_reason === "inactive"
          ? "Inactive batch"
          : record?.selection_disabled_reason === "no_inventory_match"
            ? "Inventory sheet missing"
            : record?.is_fefo_recommended
              ? "FEFO recommended"
              : "Available batch";

  return `${recommendationLabel} - ${facilityName} - Lot/Batch ${lotBatchValue} - Exp ${expiryDate} - Stock ${stockOnHand}`;
};
