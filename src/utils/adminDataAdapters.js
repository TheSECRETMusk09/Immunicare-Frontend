const NUMBER_FALLBACK = null;

const toNumber = (value, fallback = NUMBER_FALLBACK) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringSafe = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return Boolean(value);
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const unwrapApiData = (response) => {
  if (response === null || response === undefined) return response;

  if (Array.isArray(response)) return response;

  if (isObject(response)) {
    if (Object.prototype.hasOwnProperty.call(response, "data")) {
      return response.data;
    }

    return response;
  }

  return response;
};

export const toArrayPayload = (response, candidateKeys = []) => {
  const payload = unwrapApiData(response);
  if (Array.isArray(payload)) return payload;

  if (isObject(payload)) {
    const keys = [
      ...candidateKeys,
      "rows",
      "items",
      "records",
      "vaccinations",
      "vaccinationHistory",
      "schedules",
      "vaccines",
      "infants",
      "patients",
      "transactions",
      "alerts",
      "requests",
      "allocations",
    ];

    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }

  return [];
};

export const toObjectPayload = (response) => {
  const payload = unwrapApiData(response);
  return isObject(payload) ? payload : null;
};

const normalizeSex = (value) => {
  const normalized = toStringSafe(value).trim().toLowerCase();
  if (["m", "male"].includes(normalized)) return "male";
  if (["f", "female"].includes(normalized)) return "female";
  if (!normalized) return "other";
  return normalized;
};

const normalizeStatus = (value, fallback = "pending") => {
  const normalized = toStringSafe(value).trim().toLowerCase();
  return normalized || fallback;
};

const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateString = (value) => {
  const validDate = toValidDate(value);
  if (!validDate) return null;
  return validDate.toISOString();
};

const joinName = (...parts) =>
  parts
    .map((part) => toStringSafe(part).trim())
    .filter(Boolean)
    .join(" ")
    .trim();

export const normalizeInfant = (row = {}) => {
  const firstName = toStringSafe(
    row.first_name ?? row.patient_first_name ?? row.infant_first_name,
  );
  const lastName = toStringSafe(
    row.last_name ?? row.patient_last_name ?? row.infant_last_name,
  );
  const middleName = toStringSafe(
    row.middle_name ?? row.middlename ?? row.patient_middle_name,
  );
  const validationStatus = normalizeStatus(
    row.validation_status ?? row.latest_transfer_case_status,
    "not_started",
  );
  const completedVaccinations = toNumber(row.completed_vaccinations, 0);
  const pendingVaccinations = toNumber(row.pending_vaccinations, 0);
  const importedVaccinations = toNumber(row.imported_vaccinations, 0);

  let workflowStatus = "up_to_date";
  if (["for_validation", "needs_clarification", "pending_validation"].includes(validationStatus)) {
    workflowStatus = "needs_review";
  } else if (pendingVaccinations > 0) {
    workflowStatus = "pending_doses";
  } else if (completedVaccinations > 0 || importedVaccinations > 0) {
    workflowStatus = "in_progress";
  }

  return {
    ...row,
    id: toNumber(row.id ?? row.infant_id ?? row.patient_id),
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    full_name:
      toStringSafe(row.full_name) ||
      toStringSafe(row.infant_name) ||
      joinName(firstName, middleName, lastName),
    dob: row.dob ?? row.date_of_birth ?? null,
    sex: normalizeSex(row.sex),
    address: row.address ?? row.street_address ?? row.full_address ?? null,
    guardian_id: toNumber(row.guardian_id),
    guardian_name:
      row.guardian_name ??
      row.guardian?.name ??
      joinName(row.guardian_first_name, row.guardian_last_name),
    guardian_phone:
      row.guardian_phone ?? row.guardian?.phone ?? row.primary_contact ?? null,
    control_number:
      row.control_number ?? row.infant_control_number ?? row.patient_control_number,
    mother_name:
      row.mother_name ??
      joinName(row.mother_first_name, row.mother_middle_name, row.mother_last_name) ??
      null,
    father_name:
      row.father_name ??
      joinName(row.father_first_name, row.father_middle_name, row.father_last_name) ??
      null,
    place_of_birth: row.place_of_birth ?? row.birthplace ?? null,
    birth_weight: row.birth_weight ?? row.weight_at_birth ?? null,
    birth_height: row.birth_height ?? row.birth_length ?? null,
    barangay: row.barangay ?? row.barangay_name ?? null,
    health_center:
      row.health_center ?? row.facility_name ?? row.clinic_name ?? null,
    family_no: row.family_no ?? row.family_number ?? null,
    time_of_delivery: row.time_of_delivery ?? null,
    type_of_delivery: row.type_of_delivery ?? null,
    doctor_midwife_nurse:
      row.doctor_midwife_nurse ?? row.attended_by ?? row.delivered_by ?? null,
    nbs_done: row.nbs_done ?? row.newborn_screening_done ?? null,
    nbs_date: row.nbs_date ?? row.newborn_screening_date ?? null,
    cellphone_number:
      row.cellphone_number ?? row.contact ?? row.contact_number ?? null,
    facility_id: toNumber(row.facility_id ?? row.clinic_id),
    allergy_information: row.allergy_information ?? null,
    health_care_provider: row.health_care_provider ?? null,
    purok: row.purok ?? null,
    street_color: row.street_color ?? null,
    completed_vaccinations: completedVaccinations,
    pending_vaccinations: pendingVaccinations,
    imported_vaccinations: importedVaccinations,
    latest_transfer_case_id: toNumber(row.latest_transfer_case_id),
    latest_transfer_case_status: normalizeStatus(row.latest_transfer_case_status, ""),
    latest_transfer_source_facility: row.latest_transfer_source_facility ?? null,
    latest_transfer_case_updated_at: row.latest_transfer_case_updated_at ?? null,
    validation_status: validationStatus,
    workflow_status: workflowStatus,
    is_active:
      row.is_active === undefined ? true : toBoolean(row.is_active, true),
  };
};

export const normalizeVaccinationRecord = (row = {}) => {
  const patientId = toNumber(row.patient_id ?? row.infant_id ?? row.child_id);
  const adminDate = row.admin_date ?? row.date_administered ?? row.date_given ?? null;
  const vaccineName =
    row.vaccine_name ?? row.vaccine?.name ?? row.vaccine ?? row.vaccine_code ?? "";
  const lotBatchNumber =
    row.lot_batch_number ?? row.batch_number ?? row.lot_number ?? row.lot_no ?? null;

  return {
    ...row,
    id: toNumber(row.id),
    patient_id: patientId,
    infant_id: patientId,
    vaccine_id: toNumber(row.vaccine_id),
    vaccine_name: vaccineName,
    lot_batch_number: lotBatchNumber,
    lot_number:
      row.lot_number ?? row.lot_batch_number ?? row.batch_number ?? row.lot_no ?? null,
    batch_id: toNumber(row.batch_id),
    batch_number:
      row.batch_number ?? row.lot_batch_number ?? row.lot_number ?? row.lot_no ?? null,
    expiration_date: row.expiration_date ?? null,
    route_of_injection: row.route_of_injection ?? null,
    dose_no: toNumber(row.dose_no ?? row.dose_number ?? row.dose, 1),
    dose_number: toNumber(row.dose_number ?? row.dose_no ?? row.dose, 1),
    admin_date: adminDate,
    date_administered: adminDate,
    time_administered: row.time_administered ?? null,
    next_due_date: row.next_due_date ?? row.due_date ?? null,
    status: normalizeStatus(
      row.status,
      adminDate ? "completed" : "pending",
    ),
    administered_by_name:
      row.administered_by_name ??
      row.healthcare_worker ??
      row.administered_by_display ??
      null,
    administered_by:
      toNumber(row.administered_by, null) ??
      row.administered_by_name ??
      row.healthcare_worker ??
      null,
    health_care_provider: row.health_care_provider ?? null,
    infant_name:
      row.infant_name ??
      joinName(
        row.patient_first_name ?? row.first_name,
        row.patient_last_name ?? row.last_name,
      ),
    patient_first_name: row.patient_first_name ?? row.first_name ?? null,
    patient_last_name: row.patient_last_name ?? row.last_name ?? null,
    schedule_id: toNumber(row.schedule_id),
    vaccine_inventory_id: toNumber(row.vaccine_inventory_id),
    notes: row.notes ?? "",
    is_active:
      row.is_active === undefined ? true : toBoolean(row.is_active, true),
  };
};

export const normalizeVaccinationSchedule = (row = {}) => {
  const ageInMonths = toNumber(
    row.age_in_months,
    row.target_age_weeks !== undefined
      ? Math.floor(toNumber(row.target_age_weeks, 0) / 4)
      : 0,
  );
  const targetAgeWeeks = toNumber(
    row.target_age_weeks,
    ageInMonths !== null ? ageInMonths * 4 : 0,
  );
  const doseNumber = toNumber(row.dose_number ?? row.dose_no, 1);

  return {
    ...row,
    id: toNumber(row.id),
    vaccine_id: toNumber(row.vaccine_id),
    vaccine_name: row.vaccine_name ?? row.name ?? "",
    disease_prevented:
      row.disease_prevented ?? row.description ?? row.recommended_age ?? "",
    age_in_months: ageInMonths,
    target_age_weeks: targetAgeWeeks,
    dose_number: doseNumber,
    dose_no: doseNumber,
    total_doses: toNumber(row.total_doses ?? row.doses_required ?? doseNumber, doseNumber),
    doses_required: toNumber(row.doses_required ?? row.total_doses ?? doseNumber, doseNumber),
    description: row.description ?? "",
    is_active:
      row.is_active === undefined ? true : toBoolean(row.is_active, true),
  };
};

export const normalizeVaccine = (row = {}) => {
  const currentStock = toNumber(
    row.current_stock ?? row.stock_on_hand ?? row.stock ?? row.qty_current,
    0,
  );
  const lowStockThreshold = toNumber(row.low_stock_threshold, 10);

  return {
    ...row,
    id: toNumber(row.id),
    name: row.name ?? row.vaccine_name ?? "",
    code: row.code ?? row.vaccine_code ?? "",
    doses_required: toNumber(row.doses_required ?? row.total_doses, 1),
    manufacturer: row.manufacturer ?? null,
    allowed_brands: Array.isArray(row.allowed_brands) ? row.allowed_brands : [],
    current_stock: currentStock,
    stock_on_hand: toNumber(row.stock_on_hand, currentStock),
    low_stock_threshold: lowStockThreshold,
    is_low_stock:
      row.is_low_stock !== undefined
        ? toBoolean(row.is_low_stock)
        : currentStock <= lowStockThreshold,
    is_active:
      row.is_active === undefined ? true : toBoolean(row.is_active, true),
  };
};

export const normalizeVaccineInventoryRecord = (row = {}) => {
  const beginningBalance = toNumber(row.beginning_balance, 0);
  const receivedDuringPeriod = toNumber(row.received_during_period, 0);
  const transferredIn = toNumber(row.transferred_in, 0);
  const transferredOut = toNumber(row.transferred_out, 0);
  const expiredWasted = toNumber(row.expired_wasted, 0);
  const issuance = toNumber(row.issuance, 0);
  const computedStockOnHand =
    beginningBalance +
    receivedDuringPeriod +
    transferredIn -
    transferredOut -
    expiredWasted -
    issuance;

  const lowStockThreshold = toNumber(row.low_stock_threshold, 10);
  const stockOnHand = toNumber(row.stock_on_hand, computedStockOnHand);

  return {
    ...row,
    id: toNumber(row.id),
    vaccine_id: toNumber(row.vaccine_id),
    clinic_id: toNumber(row.clinic_id ?? row.facility_id),
    vaccine_name: row.vaccine_name ?? row.name ?? "",
    vaccine_code: row.vaccine_code ?? row.code ?? "",
    facility_name: row.facility_name ?? row.clinic_name ?? null,
    lot_batch_number: row.lot_batch_number ?? row.batch_number ?? row.lot_number ?? null,
    stock_on_hand: stockOnHand,
    low_stock_threshold: lowStockThreshold,
    is_low_stock:
      row.is_low_stock !== undefined
        ? toBoolean(row.is_low_stock)
        : stockOnHand <= lowStockThreshold,
    is_critical_stock: toBoolean(row.is_critical_stock, false),
  };
};

export const normalizeVaccineInventoryTransaction = (row = {}) => ({
  ...row,
  id: toNumber(row.id),
  vaccine_inventory_id: toNumber(row.vaccine_inventory_id),
  vaccine_id: toNumber(row.vaccine_id),
  clinic_id: toNumber(row.clinic_id ?? row.facility_id),
  transaction_type: toStringSafe(row.transaction_type).toUpperCase(),
  quantity: toNumber(row.quantity, 0),
  previous_balance: toNumber(row.previous_balance, 0),
  new_balance: toNumber(row.new_balance, 0),
  lot_batch_number: row.lot_batch_number ?? row.batch_number ?? row.lot_number ?? null,
  created_at: row.created_at ?? row.transaction_date ?? null,
  vaccine_name: row.vaccine_name ?? "",
  vaccine_code: row.vaccine_code ?? "",
});

export const normalizeVaccineStockAlert = (row = {}) => ({
  ...row,
  id: toNumber(row.id),
  vaccine_inventory_id: toNumber(row.vaccine_inventory_id),
  vaccine_id: toNumber(row.vaccine_id),
  clinic_id: toNumber(row.clinic_id ?? row.facility_id),
  alert_type: toStringSafe(row.alert_type).toUpperCase(),
  status: normalizeStatus(row.status, "active"),
  priority: toStringSafe(row.priority).toUpperCase(),
  current_stock: toNumber(row.current_stock, 0),
  threshold_value: toNumber(row.threshold_value, 0),
  message: toStringSafe(row.message),
});

const normalizeLotBatchText = (...values) => {
  for (const value of values.flat()) {
    const normalized = toStringSafe(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
};

const normalizeVaccineBatch = (row = {}, fallbackClinicId = null) => ({
  ...row,
  id: toNumber(row.id ?? row.batch_id),
  batch_id: toNumber(row.batch_id ?? row.id),
  vaccine_id: toNumber(row.vaccine_id),
  clinic_id: toNumber(row.clinic_id ?? row.facility_id ?? fallbackClinicId),
  vaccine_name: row.vaccine_name ?? row.name ?? "",
  vaccine_code: row.vaccine_code ?? row.code ?? "",
  clinic_name: row.clinic_name ?? row.facility_name ?? null,
  lot_batch_number: normalizeLotBatchText(
    row.lot_batch_number,
    row.batch_number,
    row.lot_number,
    row.lot_no,
  ),
  stock_on_hand: toNumber(
    row.stock_on_hand ??
      row.qty_current ??
      row.available_quantity ??
      row.available_stock ??
      row.stock,
    0,
  ),
  expiry_date: row.expiry_date ?? null,
});

export const buildFefoBatchOptions = ({
  batches = [],
  inventoryRecords = [],
  vaccineId = null,
  clinicId = null,
  referenceDate = new Date(),
}) => {
  const effectiveClinicId = toNumber(clinicId);
  const normalizedVaccineId = toNumber(vaccineId);
  const normalizedInventoryRecords = Array.isArray(inventoryRecords)
    ? inventoryRecords.map((row) => normalizeVaccineInventoryRecord(row || {}))
    : normalizeVaccineInventoryResponse(inventoryRecords);

  const referenceDay = toValidDate(referenceDate) || new Date();
  referenceDay.setHours(0, 0, 0, 0);

  const relevantInventoryRecords = normalizedInventoryRecords.filter((record) => {
    if (normalizedVaccineId && Number(record.vaccine_id) !== normalizedVaccineId) {
      return false;
    }

    if (
      effectiveClinicId &&
      Number(record.clinic_id || 0) > 0 &&
      Number(record.clinic_id) !== effectiveClinicId
    ) {
      return false;
    }

    return true;
  });

  const fallbackInventoryRecord =
    relevantInventoryRecords.length === 1 ? relevantInventoryRecords[0] : null;

  const sortedOptions = toArrayPayload(batches, ["batches"])
    .map((row) => normalizeVaccineBatch(row || {}, effectiveClinicId))
    .filter((batch) => {
      if (!batch.batch_id || batch.stock_on_hand <= 0) {
        return false;
      }

      if (normalizedVaccineId && Number(batch.vaccine_id) !== normalizedVaccineId) {
        return false;
      }

      const expiryDate = toValidDate(batch.expiry_date);
      if (expiryDate) {
        expiryDate.setHours(0, 0, 0, 0);
        if (expiryDate < referenceDay) {
          return false;
        }
      }

      return true;
    })
    .map((batch) => {
      const normalizedLotBatch = normalizeLotBatchText(batch.lot_batch_number).toLowerCase();
      const matchingInventoryRecord =
        relevantInventoryRecords
          .filter(
            (record) =>
              normalizeLotBatchText(record.lot_batch_number).toLowerCase() ===
              normalizedLotBatch,
          )
          .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))[0] ||
        fallbackInventoryRecord ||
        null;

      const expiryDate = toValidDate(batch.expiry_date);
      const daysUntilExpiry = expiryDate
        ? Math.ceil((expiryDate.getTime() - referenceDay.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      return {
        ...batch,
        matched_inventory_record_id: matchingInventoryRecord?.id ?? null,
        matched_inventory_record: matchingInventoryRecord,
        selection_disabled: !matchingInventoryRecord?.id,
        is_expiring_soon:
          daysUntilExpiry !== null && Number.isFinite(daysUntilExpiry) && daysUntilExpiry <= 30,
        days_until_expiry: daysUntilExpiry,
      };
    })
    .sort((left, right) => {
      const leftExpiry = toValidDate(left.expiry_date);
      const rightExpiry = toValidDate(right.expiry_date);

      if (leftExpiry && rightExpiry) {
        const expirySort = leftExpiry.getTime() - rightExpiry.getTime();
        if (expirySort !== 0) return expirySort;
      } else if (leftExpiry) {
        return -1;
      } else if (rightExpiry) {
        return 1;
      }

      return normalizeLotBatchText(left.lot_batch_number).localeCompare(
        normalizeLotBatchText(right.lot_batch_number),
      );
    });

  const fefoRecommendedBatchId =
    sortedOptions.find((option) => !option.selection_disabled)?.batch_id ||
    sortedOptions[0]?.batch_id ||
    null;

  return sortedOptions.map((option) => ({
    ...option,
    is_fefo_recommended: Number(option.batch_id) === Number(fefoRecommendedBatchId),
  }));
};

const mapArray = (rows, mapper) => rows.map((row) => mapper(row || {}));

export const normalizeInfantsResponse = (response) =>
  mapArray(toArrayPayload(response, ["infants", "patients"]), normalizeInfant);

export const normalizeInfantResponse = (response) => {
  const objectPayload = toObjectPayload(response);
  return normalizeInfant(objectPayload || response || {});
};

export const normalizeVaccinationRecordsResponse = (response) =>
  mapArray(
    toArrayPayload(response, ["vaccinations", "records", "vaccinationHistory"]),
    normalizeVaccinationRecord,
  );

export const normalizeVaccinationSchedulesResponse = (response) =>
  mapArray(
    toArrayPayload(response, ["schedules", "vaccinationSchedules"]),
    normalizeVaccinationSchedule,
  );

export const normalizeVaccinationScheduleResponse = (response) => {
  const objectPayload = toObjectPayload(response);
  return normalizeVaccinationSchedule(objectPayload || response || {});
};

export const normalizeVaccinesResponse = (response) =>
  mapArray(toArrayPayload(response, ["vaccines"]), normalizeVaccine);

export const normalizeVaccinationRecordResponse = (response) => {
  const objectPayload = toObjectPayload(response);
  return normalizeVaccinationRecord(objectPayload || response || {});
};

export const normalizeVaccineInventoryResponse = (response) =>
  mapArray(
    toArrayPayload(response, ["inventory", "vaccineInventory"]),
    normalizeVaccineInventoryRecord,
  );

export const normalizeVaccineInventoryTransactionsResponse = (response) =>
  mapArray(
    toArrayPayload(response, ["transactions", "vaccineTransactions"]),
    normalizeVaccineInventoryTransaction,
  );

export const normalizeVaccineStockAlertsResponse = (response) =>
  mapArray(toArrayPayload(response, ["alerts"]), normalizeVaccineStockAlert);

export const computeVaccinationRecordStats = (records = []) => {
  const now = new Date();

  const completed = records.filter(
    (record) =>
      Boolean(record.admin_date) || normalizeStatus(record.status) === "completed",
  ).length;

  const overdue = records.filter((record) => {
    if (normalizeStatus(record.status) === "overdue") return true;

    if (!record.admin_date && record.next_due_date) {
      const dueDate = new Date(record.next_due_date);
      return !Number.isNaN(dueDate.getTime()) && dueDate < now;
    }

    return false;
  }).length;

  const pending = Math.max(records.length - completed, 0);

  return {
    total: records.length,
    completed,
    pending,
    overdue,
    completionRate: records.length
      ? Math.round((completed / records.length) * 100)
      : 0,
  };
};

export const calculateAgeInMonths = (dob, referenceDate = new Date()) => {
  const birthDate = toValidDate(dob);
  const reference = toValidDate(referenceDate);

  if (!birthDate || !reference || birthDate > reference) return 0;

  let months =
    (reference.getFullYear() - birthDate.getFullYear()) * 12 +
    (reference.getMonth() - birthDate.getMonth());

  if (reference.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  return Math.max(months, 0);
};

export const buildVaccinationScheduleTimeline = ({
  schedules = [],
  records = [],
  infantDob,
  referenceDate = new Date(),
}) => {
  const normalizedSchedules = mapArray(
    Array.isArray(schedules) ? schedules : [],
    normalizeVaccinationSchedule,
  );
  const normalizedRecords = mapArray(
    Array.isArray(records) ? records : [],
    normalizeVaccinationRecord,
  );

  const recordByDoseKey = new Map();

  normalizedRecords.forEach((record) => {
    const doseNumber = toNumber(record.dose_number ?? record.dose_no, 1);
    const key = `${record.vaccine_id || 0}:${doseNumber}`;
    const existing = recordByDoseKey.get(key);

    if (!existing) {
      recordByDoseKey.set(key, record);
      return;
    }

    // Prefer the record that has a concrete administration date.
    if (!existing.admin_date && record.admin_date) {
      recordByDoseKey.set(key, record);
    }
  });

  const now = toValidDate(referenceDate) || new Date();
  const dueSoonThreshold = new Date(now);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + 14);

  return normalizedSchedules
    .map((schedule) => {
      const doseNumber = toNumber(schedule.dose_number ?? schedule.dose_no, 1);
      const recordKey = `${schedule.vaccine_id || 0}:${doseNumber}`;
      const matchedRecord = recordByDoseKey.get(recordKey) || null;

      let dueDate = null;
      if (infantDob && schedule.age_in_months !== null && schedule.age_in_months !== undefined) {
        const birthDate = toValidDate(infantDob);
        if (birthDate) {
          dueDate = new Date(birthDate);
          dueDate.setMonth(dueDate.getMonth() + Number(schedule.age_in_months || 0));
        }
      }

      const explicitStatus = normalizeStatus(matchedRecord?.status, "");
      let status = "pending";

      if (matchedRecord?.admin_date || explicitStatus === "completed") {
        status = "completed";
      } else if (
        explicitStatus &&
        explicitStatus !== "pending" &&
        explicitStatus !== "scheduled"
      ) {
        status = explicitStatus;
      } else if (dueDate && dueDate < now) {
        status = "overdue";
      } else if (dueDate && dueDate <= dueSoonThreshold) {
        status = "due";
      }

      return {
        ...schedule,
        dose_number: doseNumber,
        status,
        due_date: toDateString(dueDate),
        admin_date: matchedRecord?.admin_date ?? null,
        record_id: matchedRecord?.id ?? null,
        notes: matchedRecord?.notes ?? "",
        batch_number: matchedRecord?.batch_number ?? null,
        lot_number: matchedRecord?.lot_number ?? null,
      };
    })
    .sort((a, b) => {
      const ageSort = Number(a.age_in_months || 0) - Number(b.age_in_months || 0);
      if (ageSort !== 0) return ageSort;

      const nameSort = toStringSafe(a.vaccine_name).localeCompare(
        toStringSafe(b.vaccine_name),
      );
      if (nameSort !== 0) return nameSort;

      return Number(a.dose_number || 0) - Number(b.dose_number || 0);
    });
};

export const buildNextDueVaccinationOptions = ({
  schedules = [],
  records = [],
  infantDob,
  referenceDate = new Date(),
}) => {
  const timeline = buildVaccinationScheduleTimeline({
    schedules,
    records,
    infantDob,
    referenceDate,
  });

  const firstPendingDoseByVaccine = new Map();

  timeline.forEach((entry) => {
    const vaccineId = Number(entry.vaccine_id || 0);
    const status = normalizeStatus(entry.status, "pending");

    if (!vaccineId || status === "completed" || firstPendingDoseByVaccine.has(vaccineId)) {
      return;
    }

    firstPendingDoseByVaccine.set(vaccineId, entry);
  });

  return Array.from(firstPendingDoseByVaccine.values()).sort((left, right) => {
    if (!left.due_date && !right.due_date) return 0;
    if (!left.due_date) return 1;
    if (!right.due_date) return -1;
    return new Date(left.due_date) - new Date(right.due_date);
  });
};

export const computeVaccinationComplianceSummary = ({
  schedules = [],
  records = [],
  infantDob,
  referenceDate = new Date(),
}) => {
  const timeline = buildVaccinationScheduleTimeline({
    schedules,
    records,
    infantDob,
    referenceDate,
  });

  const currentAgeMonths = calculateAgeInMonths(infantDob, referenceDate);
  const dueTimeline = timeline.filter(
    (entry) => Number(entry.age_in_months || 0) <= currentAgeMonths,
  );

  const completed = dueTimeline.filter((entry) => entry.status === "completed").length;
  const overdue = dueTimeline.filter((entry) => entry.status === "overdue").length;
  const pending = Math.max(dueTimeline.length - completed - overdue, 0);

  return {
    dueCount: dueTimeline.length,
    completed,
    pending,
    overdue,
    completionRate: dueTimeline.length
      ? Math.round((completed / dueTimeline.length) * 100)
      : 0,
    timeline,
  };
};
