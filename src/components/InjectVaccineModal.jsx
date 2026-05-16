import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiClient from "../utils/api";
import { Button, Input, Modal, Select, Alert, AdminModalActions, TextArea } from "./UI";
import { useAuth } from "../contexts/AuthContext";
import SearchableInfantSelect from "./SearchableInfantSelect";
import VaccineEligibilityIndicator from "./VaccineEligibilityIndicator";
import {
  normalizeVaccinesResponse,
  normalizeInfantsResponse,
  normalizeVaccinationRecordsResponse,
  normalizeVaccinationRecordResponse,
  normalizeVaccineInventoryResponse,
  buildFefoBatchOptions,
} from "../utils/adminDataAdapters";
import {
  getApprovedBrandsForVaccine,
  APPROVED_VACCINE_OPTIONS,
  normalizeApprovedVaccineName,
} from "../constants/approvedVaccines";
import {
  buildVaccinationBatchOptionLabel,
  resolveLotBatchValue,
} from "../utils/vaccinationFormOptions";
import { normalizeRoleLabel } from "../utils/roleLabels";
import {
  buildInfantSearchText,
  getInfantControlNumber,
  getInfantDisplayLabel,
  getInfantFullName,
} from "../utils/infantIdentity";
import { toClinicDateKey } from "../utils/dateUtils";

const ADMINISTERED_BY_ROLE_OPTIONS = [
  { value: "physician", label: "Physician" },
  { value: "nurse", label: "Nurse" },
  { value: "midwife", label: "Midwife" },
];

const normalizeRoleName = (value) => String(value || "").trim().toLowerCase();

const resolveAdministeredByRole = (user = {}) => {
  const normalizedRole = normalizeRoleName(user.role_name || user.role);
  if (["physician", "doctor", "health_worker", "system_admin", "super_admin", "admin"].includes(normalizedRole)) {
    return "physician";
  }
  if (["nurse", "midwife"].includes(normalizedRole)) {
    return normalizedRole;
  }
  return "";
};

const buildAdministeredByDisplayName = (user = {}) => {
  const composedName = [user.first_name, user.middle_name, user.last_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  if (composedName) {
    return composedName;
  }

  return String(
    user.full_name || user.name || user.username || user.email || `User ${user.id || ""}`,
  ).trim();
};

const normalizeSearchValue = (value) => String(value || "").trim().toLowerCase();

const formatDateInputValue = (value, fallback = "") => {
  if (!value) return fallback;
  return toClinicDateKey(value) || fallback;
};

const createTodayDateInput = () => toClinicDateKey(new Date()) || "";

const injectionSiteOptions = [
  { value: "", label: "Select Site" },
  { value: "Left Arm", label: "Left Arm" },
  { value: "Right Arm", label: "Right Arm" },
  { value: "Left Thigh", label: "Left Thigh" },
  { value: "Right Thigh", label: "Right Thigh" },
  { value: "Left Buttock", label: "Left Buttock" },
  { value: "Right Buttock", label: "Right Buttock" },
];

const routeOfInjectionOptions = [
  { value: "", label: "Select Route" },
  { value: "IM", label: "Intramuscular (IM)" },
  { value: "SC", label: "Subcutaneous (SC)" },
  { value: "ID", label: "Intradermal (ID)" },
  { value: "Oral", label: "Oral" },
];

const generateTimeOptions = () => {
  const options = [{ value: "", label: "Select Time" }];
  for (let hour = 8; hour <= 17; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${min
        .toString()
        .padStart(2, "0")}`;
      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString(
        "en-US",
        {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        },
      );
      options.push({ value: time, label: displayTime });
    }
  }
  return options;
};

const reactionOptions = [
  { value: "", label: "Select reaction (if any)" },
  { value: "None", label: "None" },
  { value: "Mild redness", label: "Mild redness" },
  { value: "Mild swelling", label: "Mild swelling" },
  { value: "Mild fever", label: "Mild fever" },
  { value: "Soreness", label: "Soreness" },
  { value: "Fatigue", label: "Fatigue" },
  { value: "Crying", label: "Crying" },
  { value: "Loss of appetite", label: "Loss of appetite" },
  { value: "Other", label: "Other (specify)" },
];

const nextAppointmentOptions = [
  { value: "", label: "Select next appointment" },
  { value: "Follow-up", label: "Follow-up" },
  { value: "Next dose", label: "Next vaccine dose" },
  { value: "Checkup", label: "General checkup" },
  { value: "Consultation", label: "Consultation" },
];

// DOH EPI: vaccine-name keyword -> default site + route
const vaxMap = [
  { rx: /\bbcg\b/i, site: "Left Arm", route: "ID" },
  { rx: /hep(a|atitis)\s*b/i, site: "Right Thigh", route: "IM" },
  { rx: /penta/i, site: "Left Thigh", route: "IM" },
  { rx: /\bopv\b/i, site: "Oral", route: "Oral" },
  { rx: /\bpcv\b/i, site: "Right Arm", route: "IM" },
  { rx: /\bipv\b/i, site: "Right Thigh", route: "IM" },
  { rx: /\bmmr\b/i, site: "Right Arm", route: "SC" },
];

const findVaxDefaults = (name) => {
  const n = String(name || "");
  return vaxMap.find((entry) => entry.rx.test(n)) || null;
};

// DOH EPI next-dose offsets in days from DOB; returns null when no next scheduled dose
const epiNextDose = (name, dose) => {
  const n = String(name || "");
  const d = Number(dose) || 1;
  if (/\bbcg\b/i.test(n) || /hep(a|atitis)\s*b/i.test(n)) {
    return d === 1 ? 42 : null;
  }
  if (/penta|\bopv\b|\bpcv\b/i.test(n)) {
    if (d === 1) return 70;
    if (d === 2) return 98;
    if (d === 3) return 270;
    return null;
  }
  if (/\bipv\b/i.test(n)) {
    if (d === 1) return 270;
    if (d === 2) return 365;
    return null;
  }
  if (/\bmmr\b/i.test(n)) {
    return d === 1 ? 365 : null;
  }
  return null;
};

const addDaysIso = (iso, days) => {
  const base = iso ? new Date(iso) : null;
  if (!base || Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + Number(days || 0));
  return formatDateInputValue(base, "");
};

const computeNextApptDate = ({ type, vaccineName, doseNumber, dob, adminDate }) => {
  if (!type) return "";
  if (type === "Follow-up") return addDaysIso(adminDate, 14);
  if (type === "Checkup" || type === "Consultation") return addDaysIso(adminDate, 30);
  if (type === "Next dose") {
    const days = epiNextDose(vaccineName, doseNumber);
    if (days == null) return "";
    if (dob) return addDaysIso(dob, days);
    return addDaysIso(adminDate, days);
  }
  return "";
};

const INITIAL_FORM = {
  vaccine_id: "",
  batch_id: "",
  vaccine_inventory_id: "",
  date_administered: createTodayDateInput(),
  time_administered: "",
  dose_number: 1,
  lot_batch_number: "",
  expiration_date: "",
  site_of_injection: "",
  route_of_injection: "IM",
  administered_by: "",
  administered_by_role: "",
  administered_by_search: "",
  manufacturer: "",
  reaction: "",
  reaction_other: "",
  notes: "",
  next_appointment_type: "",
  next_appointment_date: "",
  status: "completed",
};

const createInitialFormState = (prefill = {}) => {
  const normalizedDoseNumber = Number(prefill.dose_number ?? prefill.dose_no ?? 1) || 1;

  return {
    ...INITIAL_FORM,
    vaccine_id: prefill.vaccine_id ? String(prefill.vaccine_id) : "",
    dose_number: Math.max(1, normalizedDoseNumber),
    date_administered: formatDateInputValue(
      prefill.date_administered ?? prefill.admin_date,
      createTodayDateInput(),
    ),
    time_administered: String(
      prefill.time_administered ?? prefill.admin_time ?? INITIAL_FORM.time_administered,
    ),
    next_appointment_date: formatDateInputValue(
      prefill.next_appointment_date ?? prefill.next_due_date,
      "",
    ),
    status: String(prefill.status || INITIAL_FORM.status).toLowerCase() || INITIAL_FORM.status,
  };
};

const getEligibleDoseMetadata = (entry = {}) => {
  const nextDoseNumber = Number(
    entry.nextDoseNumber ??
      entry.next_dose_number ??
      entry.dose_number ??
      entry.dose_no ??
      0,
  ) || 0;
  const totalDoses = Number(
    entry.totalDoses ??
      entry.total_doses ??
      entry.total_dose ??
      entry.schedule?.total_doses ??
      entry.schedule?.dose_number ??
      entry.dose_number ??
      0,
  ) || 0;

  return {
    nextDoseNumber,
    totalDoses,
    dueDate: entry.dueDate ?? entry.due_date ?? null,
    status: String(entry.status || "").trim().toLowerCase(),
    vaccineId: Number(entry.vaccineId ?? entry.vaccine_id ?? 0) || 0,
    vaccineName: String(entry.vaccineName || entry.vaccine_name || "").trim(),
  };
};

const buildSelectedInfantSnapshot = ({
  infant = {},
  infantId = null,
  infantName = "",
} = {}) => {
  const resolvedInfantId =
    Number(
      infantId ??
        infant.id ??
        infant.infant_id ??
        infant.infantId ??
        infant.patient_id ??
        0,
    ) || null;

  if (!resolvedInfantId) {
    return null;
  }

  const firstName = String(
    infant.first_name || infant.patient_first_name || infant.infant_first_name || "",
  ).trim();
  const middleName = String(
    infant.middle_name || infant.patient_middle_name || infant.infant_middle_name || "",
  ).trim();
  const lastName = String(
    infant.last_name || infant.patient_last_name || infant.infant_last_name || "",
  ).trim();
  const composedName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
  const fallbackName = getInfantDisplayLabel({
    ...infant,
    id: resolvedInfantId,
    infant_id: resolvedInfantId,
    patient_id: resolvedInfantId,
    full_name:
      infantName ||
      infant.full_name ||
      infant.display_name ||
      infant.infant_name ||
      infant.name ||
      "",
    name:
      infantName ||
      infant.name ||
      infant.display_name ||
      infant.full_name ||
      infant.infant_name ||
      "",
  });
  const displayName = composedName || fallbackName;
  const fullName = getInfantFullName({
    ...infant,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
  }) || displayName;
  const controlNumber = getInfantControlNumber({
    ...infant,
    control_number:
      infant.control_number || infant.infant_control_number || infant.patient_control_number,
  });

  return {
    ...infant,
    id: resolvedInfantId,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    full_name: fullName,
    name: fullName,
    display_name: displayName,
    dob:
      infant.dob ||
      infant.date_of_birth ||
      infant.dateOfBirth ||
      infant.birth_date ||
      infant.patient_dob ||
      "",
    control_number: controlNumber,
    infant_control_number:
      infant.infant_control_number || controlNumber,
    patient_control_number:
      infant.patient_control_number || controlNumber,
    search_text: buildInfantSearchText({
      ...infant,
      id: resolvedInfantId,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      control_number: controlNumber,
      full_name: fullName,
    }),
  };
};

export default function InjectVaccineModal({
  isOpen,
  onClose,
  infantId,
  infantName,
  prefillContext = null,
  onSuccess = () => {},
  title = "Record Vaccinations",
  submitLabel = "Record Vaccinations",
  infantLabel = "Select Infant",
}) {
  const { isAdmin, user } = useAuth();
  const scopedClinicId = user?.clinic_id || user?.facility_id || null;

  const [vaccines, setVaccines] = useState([]);
  const [infants, setInfants] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [healthWorkerUsers, setHealthWorkerUsers] = useState([]);
  const [selectedInfantId, setSelectedInfantId] = useState(infantId || "");
  const [eligibleVaccines, setEligibleVaccines] = useState(null);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [showAdministeredBySuggestions, setShowAdministeredBySuggestions] = useState(false);
  const [vaccinationBatchOptions, setVaccinationBatchOptions] = useState([]);
  const [vaccinationBatchOptionsLoading, setVaccinationBatchOptionsLoading] = useState(false);
  const [vaccinationBatchOptionsError, setVaccinationBatchOptionsError] = useState(null);
  const [selectedInfantSnapshot, setSelectedInfantSnapshot] = useState(null);

  // Infant pagination and search states
  const [infantsLoading, setInfantsLoading] = useState(false);
  const [infantsSearchQuery, setInfantsSearchQuery] = useState("");
  const [infantsPage, setInfantsPage] = useState(1);
  const [infantsHasMore, setInfantsHasMore] = useState(true);

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vaccinationHistory, setVaccinationHistory] = useState([]);
  const batchSelectionModeRef = useRef("auto");

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const selectedInfantDob = useMemo(() => {
    const id = Number(selectedInfantId || infantId || 0);
    const fromList = id ? infants.find((entry) => Number(entry.id) === id) : null;
    const raw =
      fromList?.dob ||
      fromList?.date_of_birth ||
      prefillContext?.dob ||
      prefillContext?.date_of_birth ||
      prefillContext?.dateOfBirth ||
      "";
    return formatDateInputValue(raw, "");
  }, [selectedInfantId, infantId, infants, prefillContext]);

  const selectedInfantOverride = useMemo(() => {
    const selectedId = Number(
      selectedInfantId ||
        infantId ||
        prefillContext?.infant_id ||
        prefillContext?.infantId ||
        0,
    );

    if (!Number.isFinite(selectedId) || selectedId <= 0) {
      return null;
    }

    const existingInfant = infants.find((entry) => Number(entry.id) === selectedId) || null;
    if (existingInfant) {
      return null;
    }

    return buildSelectedInfantSnapshot({
      infant:
        selectedInfantSnapshot && Number(selectedInfantSnapshot.id) === selectedId
          ? selectedInfantSnapshot
          : prefillContext || {},
      infantId: selectedId,
      infantName,
    });
  }, [infantId, infantName, infants, prefillContext, selectedInfantId, selectedInfantSnapshot]);

  const fetchData = useCallback(async () => {
    try {
      const [vaccinesResponse, inventoryResponse, systemUsersResponse] =
        await Promise.all([
          apiClient.getVaccines(),
          apiClient.getVaccineInventory(
            scopedClinicId ? { clinic_id: scopedClinicId } : {}
          ),
          apiClient
            .getSystemUsers({
              limit: 200,
              roles: "physician,doctor,nurse,midwife,health_worker,system_admin,admin,super_admin",
              is_active: true,
            })
            .catch(() => ({ data: [] })),
        ]);

      const normalizedVaccines = normalizeVaccinesResponse(vaccinesResponse);
      const normalizedInventory = normalizeVaccineInventoryResponse(inventoryResponse);

      const allUsers = Array.isArray(systemUsersResponse)
        ? systemUsersResponse
        : (systemUsersResponse?.data || systemUsersResponse?.users || []);

      const normalizedHealthWorkers = allUsers
        .map((rawUser) => {
          const id = Number(rawUser?.id);
          const role = resolveAdministeredByRole(rawUser);
          const isActive =
            rawUser?.is_active !== false &&
            normalizeRoleName(rawUser?.status) !== "inactive";
          const isGuardianAccount =
            rawUser?.is_guardian_account === true ||
            normalizeRoleName(rawUser?.role_name) === "guardian";
          const scopedUserClinicId =
            Number(rawUser?.clinic_id || rawUser?.facility_id || 0) || null;

          if (!Number.isFinite(id) || id <= 0) return null;
          if (!role || !isActive || isGuardianAccount) return null;
          // Only filter out if the user has a specific clinic assigned that doesn't match the current scope
          if (scopedClinicId && scopedUserClinicId && scopedUserClinicId !== Number(scopedClinicId)) {
            return null;
          }

          const displayName = buildAdministeredByDisplayName(rawUser);
          const roleLabel = normalizeRoleLabel(
            role === "midwife" ? "Midwife" : role === "nurse" ? "Nurse" : "Physician",
          );

          return {
            ...rawUser,
            id,
            role,
            roleLabel,
            displayName,
            optionLabel: `${displayName} (${roleLabel})`,
            searchText: [
              displayName,
              rawUser?.username || "",
              rawUser?.email || "",
              rawUser?.contact || "",
            ]
              .join(" ")
              .toLowerCase(),
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.optionLabel.localeCompare(right.optionLabel));

      setVaccines(normalizedVaccines);
      setInventoryRecords(normalizedInventory);
      setHealthWorkerUsers(normalizedHealthWorkers);
    } catch (err) {
      console.error("Error fetching data:", err);
      setVaccines([]);
      setInventoryRecords([]);
      setHealthWorkerUsers([]);
    }
  }, [scopedClinicId]);

  const fetchInfantsBatch = useCallback(async (query = "", page = 1, append = false) => {
    setInfantsLoading(true);
    try {
      const infantQuery = {
        limit: 50,
        page,
        search: query || undefined,
        orderBy: "dob",
        orderDirection: "DESC",
        ...(isAdmin ? { scope: "system" } : {}),
      };

      const response = await apiClient.getInfants(infantQuery);
      const normalizedInfants = normalizeInfantsResponse(response);

      if (append) {
        setInfants((prev) => {
          const existingIds = new Set(prev.map(i => i.id));
          const newInfants = normalizedInfants.filter(i => !existingIds.has(i.id));
          return [...prev, ...newInfants];
        });
      } else {
        setInfants(normalizedInfants);
      }

      const pagination = response?.pagination || response?.data?.pagination;
      setInfantsHasMore(pagination ? pagination.page < pagination.totalPages : normalizedInfants.length === 50);
    } catch (err) {
      console.error("Error fetching infants batch:", err);
    } finally {
      setInfantsLoading(false);
    }
  }, [isAdmin]);

  const fetchVaccinationHistory = useCallback(async (targetInfantId) => {
    if (!targetInfantId) {
      setVaccinationHistory([]);
      return;
    }

    try {
      if (typeof apiClient.getVaccinationRecordsByInfant !== "function") {
        setVaccinationHistory([]);
        return;
      }

      const historyResponse = await apiClient.getVaccinationRecordsByInfant(
        Number(targetInfantId),
      );
      setVaccinationHistory(normalizeVaccinationRecordsResponse(historyResponse));
    } catch (err) {
      console.error("Error fetching vaccination history:", err);
      setVaccinationHistory([]);
    }
  }, []);

  const fetchEligibleVaccines = useCallback(async (targetInfantId) => {
    if (!targetInfantId) {
      setEligibleVaccines(null);
      return;
    }

    setEligibleLoading(true);
    try {
      if (typeof apiClient.getEligibleVaccines === "function") {
        const response = await apiClient.getEligibleVaccines(Number(targetInfantId));
        setEligibleVaccines(response);
      } else {
        setEligibleVaccines(null);
      }
    } catch (err) {
      console.error("Error fetching eligible vaccines:", err);
      setEligibleVaccines(null);
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchData();

      setInfantsPage(1);
      setInfantsSearchQuery("");
      fetchInfantsBatch("", 1, false);

      const normalizedPrefillInfantId =
        Number(prefillContext?.infant_id ?? prefillContext?.infantId ?? infantId ?? 0) ||
        null;

      setSelectedInfantId(normalizedPrefillInfantId ? String(normalizedPrefillInfantId) : "");
      setSelectedInfantSnapshot(
        normalizedPrefillInfantId
          ? buildSelectedInfantSnapshot({
              infant: prefillContext || {},
              infantId: normalizedPrefillInfantId,
              infantName,
            })
          : null,
      );
      setFormData(createInitialFormState(prefillContext || {}));

      setError(null);
      setSuccess(null);
      setShowAdministeredBySuggestions(false);
      setVaccinationBatchOptions([]);
      setVaccinationBatchOptionsLoading(false);
      setVaccinationBatchOptionsError(null);
      batchSelectionModeRef.current = "auto";
    }
  }, [isOpen, infantId, infantName, fetchData, fetchInfantsBatch, prefillContext]);

  useEffect(() => {
    if (!selectedInfantId || !infants.length) {
      return;
    }

    const matchedInfant = infants.find(
      (entry) => Number(entry.id) === Number(selectedInfantId),
    );

    if (matchedInfant) {
      setSelectedInfantSnapshot(matchedInfant);
    }
  }, [infants, selectedInfantId]);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = setTimeout(() => {
      setInfantsPage(1);
      fetchInfantsBatch(infantsSearchQuery, 1, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [infantsSearchQuery, isOpen, fetchInfantsBatch]);

  const handleLoadMoreInfants = useCallback(() => {
    const nextPage = infantsPage + 1;
    setInfantsPage(nextPage);
    fetchInfantsBatch(infantsSearchQuery, nextPage, true);
  }, [infantsPage, infantsSearchQuery, fetchInfantsBatch]);

  useEffect(() => {
    if (!isOpen) return;

    const targetInfantId = selectedInfantId || infantId;
    void fetchVaccinationHistory(targetInfantId);
    void fetchEligibleVaccines(targetInfantId);
  }, [isOpen, infantId, selectedInfantId, fetchVaccinationHistory, fetchEligibleVaccines]);

  const selectedVaccine = useMemo(
    () => vaccines.find((v) => v.id === Number(formData.vaccine_id)) || null,
    [vaccines, formData.vaccine_id],
  );

  const eligibleVaccineById = useMemo(() => {
    const selectableVaccines = [
      ...(eligibleVaccines?.eligibleVaccines || []),
      ...(eligibleVaccines?.upcomingVaccines || []),
    ];

    return new Map(
      selectableVaccines
        .filter((entry) => Number.isFinite(Number(entry?.vaccineId ?? entry?.vaccine_id)))
        .map((entry) => [Number(entry.vaccineId ?? entry.vaccine_id), entry]),
    );
  }, [eligibleVaccines]);

  const completedVaccines = useMemo(() => {
    if (!eligibleVaccines?.completedVaccines) return [];
    return eligibleVaccines.completedVaccines.map((vaccine) => {
      const metadata = getEligibleDoseMetadata(vaccine);
      return {
        ...vaccine,
        ...metadata,
        displayLabel: `${metadata.vaccineName || vaccine.vaccineName} (Completed: ${
          metadata.totalDoses || vaccine.totalDoses || 0
        }/${metadata.totalDoses || vaccine.totalDoses || 0} doses)`,
      };
    });
  }, [eligibleVaccines]);

  const selectedEligibleVaccine = useMemo(() => {
    if (!eligibleVaccines || !formData.vaccine_id) return null;
    return eligibleVaccineById.get(Number(formData.vaccine_id)) || null;
  }, [eligibleVaccineById, eligibleVaccines, formData.vaccine_id]);

  const approvedVaccineMasterByName = useMemo(() => {
    const vaccinesByName = new Map();
    vaccines
      .filter((vaccine) => normalizeApprovedVaccineName(vaccine?.name))
      .forEach((vaccine) => {
        const canonicalName = normalizeApprovedVaccineName(vaccine.name);
        if (!canonicalName || vaccinesByName.has(canonicalName)) {
          return;
        }

        vaccinesByName.set(canonicalName, vaccine);
      });

    return vaccinesByName;
  }, [vaccines]);

  const vaccineDropdownOptions = useMemo(() => {
    if (!eligibleVaccines) {
      return APPROVED_VACCINE_OPTIONS.map((option) => {
        const vaccine = approvedVaccineMasterByName.get(option.value);
        if (!vaccine) {
          return {
            value: option.value,
            label: option.label,
            sortOrder: 0,
          };
        }

        return {
          value: String(vaccine.id),
          label: vaccine.name || option.label,
          sortOrder: 0,
        };
      });
    }

    const completedNames = new Set(
      (eligibleVaccines.completedVaccines || [])
        .map((entry) => normalizeApprovedVaccineName(entry?.vaccineName || entry?.vaccine_name))
        .filter(Boolean),
    );

    const entriesByCanonicalName = new Map();

    [...(eligibleVaccines.eligibleVaccines || []), ...(eligibleVaccines.upcomingVaccines || [])].forEach(
      (entry) => {
        const metadata = getEligibleDoseMetadata(entry);
        const canonicalName = normalizeApprovedVaccineName(metadata.vaccineName);

        if (!canonicalName || completedNames.has(canonicalName)) {
          return;
        }

        const currentEntry = entriesByCanonicalName.get(canonicalName);
        const currentSortOrder = metadata.status === "ready" ? 0 : 1;
        const nextDueDate = metadata.dueDate ? new Date(metadata.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const existingDueDate = currentEntry?.dueDate ? new Date(currentEntry.dueDate).getTime() : Number.POSITIVE_INFINITY;

        if (
          !currentEntry ||
          currentSortOrder < currentEntry.sortOrder ||
          (currentSortOrder === currentEntry.sortOrder && nextDueDate < existingDueDate)
        ) {
          entriesByCanonicalName.set(canonicalName, {
            ...metadata,
            sortOrder: currentSortOrder,
          });
        }
      },
    );

    return APPROVED_VACCINE_OPTIONS.flatMap((option) => {
      if (completedNames.has(option.value)) {
        return [];
      }

      const masterVaccine = approvedVaccineMasterByName.get(option.value);
      const eligibleEntry = entriesByCanonicalName.get(option.value);

      if (!eligibleEntry) {
        return [];
      }

      const optionValue = masterVaccine?.id ? String(masterVaccine.id) : String(eligibleEntry.vaccineId || option.value);
      const displayName = masterVaccine?.name || eligibleEntry.vaccineName || option.label;
      const doseLabel = `${eligibleEntry.nextDoseNumber || 1}/${eligibleEntry.totalDoses || eligibleEntry.nextDoseNumber || 1}`;

      return [{
        value: optionValue,
        label:
          eligibleEntry.status === "ready"
            ? `Ready: ${displayName} - Dose ${doseLabel}`
            : `Due: ${displayName} - Dose ${doseLabel}${eligibleEntry.dueDate ? ` (Due: ${eligibleEntry.dueDate})` : ""}`,
        sortOrder: eligibleEntry.sortOrder,
      }];
    }).sort((left, right) => {
      const sortOrder = Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
      if (sortOrder !== 0) {
        return sortOrder;
      }
      return String(left.label).localeCompare(String(right.label));
    });
  }, [approvedVaccineMasterByName, eligibleVaccines]);

  useEffect(() => {
    if (!formData.vaccine_id) {
      return;
    }

    if (!eligibleVaccines) {
      return;
    }

    const allowedValues = new Set(vaccineDropdownOptions.map((option) => String(option.value)));
    if (allowedValues.has(String(formData.vaccine_id))) {
      return;
    }

    batchSelectionModeRef.current = "auto";
    setFormData((prev) => ({
      ...prev,
      vaccine_id: "",
      batch_id: "",
      vaccine_inventory_id: "",
      lot_batch_number: "",
      manufacturer: "",
      dose_number: 1,
    }));
  }, [eligibleVaccines, formData.vaccine_id, vaccineDropdownOptions]);


  const selectedBatchOption = useMemo(
    () =>
      vaccinationBatchOptions.find(
        (option) => String(option.batch_id) === String(formData.batch_id || ""),
      ) || null,
    [vaccinationBatchOptions, formData.batch_id],
  );

  const selectedInventoryRecord = useMemo(
    () =>
      inventoryRecords.find(
        (record) => record.id === Number(formData.vaccine_inventory_id),
      ) || null,
    [inventoryRecords, formData.vaccine_inventory_id],
  );

  const batchSourceSelectOptions = useMemo(
    () => [
      {
        value: "",
        label: vaccinationBatchOptionsLoading
          ? "Loading valid FEFO batch sources..."
          : "Select FEFO batch source",
      },
      ...vaccinationBatchOptions.map((record) => ({
        value: String(record.batch_id),
        label: buildVaccinationBatchOptionLabel(record),
        disabled: record.selection_disabled,
      })),
    ],
    [vaccinationBatchOptions, vaccinationBatchOptionsLoading],
  );

  const selectedVaccineBrandOptions = useMemo(() => {
    if (!selectedVaccine?.name) return [];

    if (
      Array.isArray(selectedVaccine.allowed_brands) &&
      selectedVaccine.allowed_brands.length > 0
    ) {
      return selectedVaccine.allowed_brands;
    }

    return getApprovedBrandsForVaccine(selectedVaccine.name);
  }, [selectedVaccine]);

  const defaultAdministeredBy = useMemo(() => {
    const currentUserId = Number(user?.id || 0) || null;
    if (!currentUserId) return "";

    return healthWorkerUsers.some((entry) => Number(entry.id) === currentUserId)
      ? String(currentUserId)
      : "";
  }, [healthWorkerUsers, user?.id]);

  const healthWorkerById = useMemo(
    () => new Map(healthWorkerUsers.map((entry) => [Number(entry.id), entry])),
    [healthWorkerUsers],
  );

  const selectedAdministeredByWorker = useMemo(() => {
    const administeredById = Number(formData.administered_by || 0);
    if (!administeredById) return null;
    return healthWorkerById.get(administeredById) || null;
  }, [healthWorkerById, formData.administered_by]);

  const administeredByUsersByRole = useMemo(() => {
    const selectedRole = normalizeRoleName(formData.administered_by_role);
    if (!selectedRole) {
      return [];
    }

    return healthWorkerUsers.filter((entry) => entry.role === selectedRole);
  }, [healthWorkerUsers, formData.administered_by_role]);

  const administeredBySuggestions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(formData.administered_by_search);

    if (!administeredByUsersByRole.length) {
      return [];
    }

    if (!normalizedQuery) {
      return administeredByUsersByRole.slice(0, 12);
    }

    return administeredByUsersByRole
      .filter((entry) => entry.searchText.includes(normalizedQuery))
      .slice(0, 12);
  }, [administeredByUsersByRole, formData.administered_by_search]);

  const administeredByRoleSelectOptions = useMemo(() => {
    const roleCount = healthWorkerUsers.reduce(
      (accumulator, entry) => {
        const role = normalizeRoleName(entry.role);
        if (["physician", "nurse", "midwife"].includes(role)) {
          accumulator[role] = (accumulator[role] || 0) + 1;
        }
        return accumulator;
      },
      { physician: 0, nurse: 0, midwife: 0 },
    );

    return [
      {
        value: "",
        label: healthWorkerUsers.length
          ? "Select Physician, Nurse, or Midwife"
          : "No Healthcare providers available",
      },
      ...ADMINISTERED_BY_ROLE_OPTIONS.map((option) => ({
        value: option.value,
        label:
          roleCount[option.value] > 0
            ? `${option.label} (${roleCount[option.value]})`
            : option.label,
      })),
    ];
  }, [healthWorkerUsers]);

  useEffect(() => {
    if (!isOpen || formData.administered_by || !defaultAdministeredBy) {
      return;
    }

    const defaultHealthWorker = healthWorkerById.get(Number(defaultAdministeredBy || 0)) || null;
    if (!defaultHealthWorker) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      administered_by: String(defaultHealthWorker.id),
      administered_by_role: prev.administered_by_role || defaultHealthWorker.role,
      administered_by_search: prev.administered_by_search || defaultHealthWorker.displayName,
    }));
  }, [defaultAdministeredBy, formData.administered_by, healthWorkerById, isOpen]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setShowAdministeredBySuggestions(false);
  }, [isOpen]);

  const batchReferenceDate = useMemo(
    () => formatDateInputValue(formData.date_administered, createTodayDateInput()),
    [formData.date_administered],
  );

  useEffect(() => {
    let isCurrent = true;

    if (!isOpen || !formData.vaccine_id) {
      setVaccinationBatchOptions([]);
      setVaccinationBatchOptionsError(null);
      setVaccinationBatchOptionsLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setVaccinationBatchOptionsLoading(true);
    setVaccinationBatchOptionsError(null);

    const loadBatchSources =
      typeof apiClient.getAvailableInventoryLots === "function"
        ? () =>
            apiClient.getAvailableInventoryLots({
              vaccine_id: Number(formData.vaccine_id),
            })
        : () => apiClient.getVaccineInventoryStatus(Number(formData.vaccine_id));

    loadBatchSources()
      .then((response) => {
        if (!isCurrent) return;

        setVaccinationBatchOptions(
          buildFefoBatchOptions({
            batches: response,
            inventoryRecords,
            vaccineId: formData.vaccine_id,
            clinicId: scopedClinicId,
            referenceDate: batchReferenceDate,
          }),
        );
      })
      .catch((err) => {
        if (!isCurrent) return;

        setVaccinationBatchOptions([]);
        setVaccinationBatchOptionsError(
          err.message || "Failed to load FEFO batch inventory for the selected vaccine.",
        );
      })
      .finally(() => {
        if (isCurrent) {
          setVaccinationBatchOptionsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [batchReferenceDate, formData.vaccine_id, inventoryRecords, isOpen, scopedClinicId]);

  useEffect(() => {
    if (!isOpen || !formData.vaccine_id) {
      return;
    }

    if (!vaccinationBatchOptions.length) {
      if (formData.batch_id || formData.vaccine_inventory_id || formData.lot_batch_number) {
        setFormData((prev) => ({
          ...prev,
          batch_id: "",
          vaccine_inventory_id: "",
          lot_batch_number: "",
          expiration_date: "",
        }));
      }
      batchSelectionModeRef.current = "auto";
      return;
    }

    const matchingSelectedOption = vaccinationBatchOptions.find(
      (option) =>
        String(option.batch_id) === String(formData.batch_id || "") && !option.selection_disabled,
    );

    const recommendedBatchOption =
      vaccinationBatchOptions.find(
        (option) => option.is_fefo_recommended && !option.selection_disabled,
      ) ||
      vaccinationBatchOptions.find((option) => !option.selection_disabled) ||
      null;

    const nextSelectedOption =
      batchSelectionModeRef.current === "manual" && matchingSelectedOption
        ? matchingSelectedOption
        : recommendedBatchOption;

    const nextBatchId = nextSelectedOption ? String(nextSelectedOption.batch_id) : "";
    const nextInventoryRecordId = nextSelectedOption?.matched_inventory_record_id
      ? String(nextSelectedOption.matched_inventory_record_id)
      : "";
    const nextLotBatchValue = resolveLotBatchValue(
      nextSelectedOption?.lot_batch_number,
      nextSelectedOption?.matched_inventory_record?.lot_batch_number,
    );

    if (
      String(formData.batch_id || "") === nextBatchId &&
      String(formData.vaccine_inventory_id || "") === nextInventoryRecordId &&
      String(formData.lot_batch_number || "") === nextLotBatchValue
    ) {
      return;
    }

    const batchExp = formatDateInputValue(
      nextSelectedOption?.expiry_date ||
        nextSelectedOption?.expiration_date ||
        nextSelectedOption?.matched_inventory_record?.expiry_date ||
        nextSelectedOption?.matched_inventory_record?.expiration_date ||
        "",
      "",
    );

    setFormData((prev) => ({
      ...prev,
      batch_id: nextBatchId,
      vaccine_inventory_id: nextInventoryRecordId,
      lot_batch_number: nextLotBatchValue,
      expiration_date: batchExp,
    }));
    batchSelectionModeRef.current = "auto";
  }, [
    formData.batch_id,
    formData.lot_batch_number,
    formData.vaccine_id,
    formData.vaccine_inventory_id,
    isOpen,
    vaccinationBatchOptions,
  ]);

  const handleAdministeredBySelection = useCallback((entry) => {
    if (!entry) return;

    setFormData((prev) => ({
      ...prev,
      administered_by: String(entry.id),
      administered_by_role: entry.role,
      administered_by_search: entry.displayName,
    }));
    setShowAdministeredBySuggestions(false);
  }, []);

  const handleAdministeredByRoleChange = useCallback(
    (event) => {
      const nextRole = normalizeRoleName(event.target.value);

      setFormData((prev) => {
        const existingSelection = healthWorkerById.get(Number(prev.administered_by || 0));
        const shouldPreserveExistingSelection =
          existingSelection && existingSelection.role === nextRole;

        return {
          ...prev,
          administered_by_role: nextRole,
          administered_by: shouldPreserveExistingSelection
            ? String(existingSelection.id)
            : "",
          administered_by_search: shouldPreserveExistingSelection
            ? existingSelection.displayName
            : "",
        };
      });

      setShowAdministeredBySuggestions(true);
    },
    [healthWorkerById],
  );

  const handleAdministeredBySearchChange = useCallback(
    (event) => {
      const nextSearch = event.target.value;
      const normalizedSearch = normalizeSearchValue(nextSearch);

      setFormData((prev) => {
        const existingSelection = healthWorkerById.get(Number(prev.administered_by || 0));
        const shouldKeepSelection =
          existingSelection &&
          normalizeSearchValue(existingSelection.displayName) === normalizedSearch;

        return {
          ...prev,
          administered_by_search: nextSearch,
          administered_by: shouldKeepSelection ? String(existingSelection.id) : "",
        };
      });

      setShowAdministeredBySuggestions(true);
    },
    [healthWorkerById],
  );

  const handleAdministeredBySearchBlur = useCallback(() => {
    const currentSearch = normalizeSearchValue(formData.administered_by_search);

    if (currentSearch) {
      const exactMatch = administeredByUsersByRole.find((entry) => {
        const exactCandidates = [
          entry.displayName,
          entry.optionLabel,
          entry.username,
          entry.email,
        ]
          .filter(Boolean)
          .map((candidate) => normalizeSearchValue(candidate));

        return exactCandidates.includes(currentSearch);
      });

      if (exactMatch) {
        setFormData((prev) => ({
          ...prev,
          administered_by: String(exactMatch.id),
          administered_by_role: exactMatch.role,
          administered_by_search: exactMatch.displayName,
        }));
      }
    }

    window.setTimeout(() => {
      setShowAdministeredBySuggestions(false);
    }, 120);
  }, [administeredByUsersByRole, formData.administered_by_search]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setError("Only healthcare administrators can record vaccine administrations.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!selectedInfantId) {
      setError("Please select an infant/patient from the dropdown.");
      setLoading(false);
      return;
    }

    if (!formData.vaccine_id) {
      setError("Please select a vaccine.");
      setLoading(false);
      return;
    }

    const selectedBatchId = Number(formData.batch_id || 0) || null;
    if (!selectedBatchId) {
      setError("Please select a valid FEFO batch source.");
      setLoading(false);
      return;
    }

    if (!formData.vaccine_inventory_id) {
      setError(
        "The selected FEFO batch is not linked to an inventory sheet record. Update Inventory Management first.",
      );
      setLoading(false);
      return;
    }

    const administeredByValue = Number(formData.administered_by);
    const administeredBy =
      Number.isFinite(administeredByValue) && administeredByValue > 0
        ? administeredByValue
        : null;

    if (!administeredBy) {
      setError(
        "Please select a Physician, Nurse, or Midwife using the Administered By role and name fields.",
      );
      setLoading(false);
      return;
    }

    const lotBatchValue =
      resolveLotBatchValue(
        formData.lot_batch_number,
        selectedBatchOption?.lot_batch_number,
        selectedInventoryRecord?.lot_batch_number,
      ) || "";

    if (!lotBatchValue) {
      setError("The selected inventory source does not have a Lot / Batch number.");
      setLoading(false);
      return;
    }

    let createdVaccinationRecordId = null;
    let usedTransactionalEndpoint = false;

    try {
      const recordPayload = {
        patient_id: Number(selectedInfantId),
        vaccine_id: Number(formData.vaccine_id),
        dose_no: Number(formData.dose_number) || 1,
        admin_date: formData.date_administered,
        administered_by: administeredBy,
        batch_id: selectedBatchId,
        vaccine_inventory_id: Number(formData.vaccine_inventory_id) || null,
        site_of_injection: formData.site_of_injection || null,
        route_of_injection: formData.route_of_injection || null,
        time_administered: formData.time_administered || null,
        reactions:
          formData.reaction === "Other"
            ? formData.reaction_other
            : formData.reaction || null,
        next_due_date: formData.next_appointment_date || null,
        notes: formData.notes || null,
        lot_batch_number: lotBatchValue || null,
        lot_number: lotBatchValue || null,
        batch_number: lotBatchValue || null,
        manufacturer: formData.manufacturer || null,
        expiration_date: formData.expiration_date || null,
        status: formData.status || "completed",
      };

      if (typeof apiClient.recordVaccinationWithInventory === "function") {
        const response = await apiClient.recordVaccinationWithInventory(recordPayload);
        const normalizedCreatedVaccination = normalizeVaccinationRecordResponse(
          response?.vaccination || response?.data?.vaccination || response,
        );
        createdVaccinationRecordId = normalizedCreatedVaccination?.id || null;
        usedTransactionalEndpoint = true;
      } else {
        const createdVaccinationResponse =
          await apiClient.createVaccinationRecord(recordPayload);
        const normalizedCreatedVaccination = normalizeVaccinationRecordResponse(
          createdVaccinationResponse,
        );
        createdVaccinationRecordId = normalizedCreatedVaccination?.id || null;

        await apiClient.createVaccineInventoryTransaction({
          vaccine_inventory_id: Number(formData.vaccine_inventory_id),
          vaccine_id: Number(formData.vaccine_id),
          clinic_id: selectedInventoryRecord?.clinic_id
            ? Number(selectedInventoryRecord.clinic_id)
            : undefined,
          transaction_type: "ISSUE",
          quantity: 1,
          lot_batch_number: lotBatchValue || null,
          reference_number: createdVaccinationRecordId
            ? `VAC-${createdVaccinationRecordId}`
            : null,
          notes: createdVaccinationRecordId
            ? `Vaccination record ${createdVaccinationRecordId} administered to infant ID ${selectedInfantId}`
            : `Vaccination administered to infant ID ${selectedInfantId}`,
        });
      }

      setSuccess("Vaccination recorded and inventory updated successfully.");

      // Dispatch synchronization event to update charts and booklets across the UI
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("vaccination-update", {
            detail: { patient_id: recordPayload.patient_id },
          })
        );
        window.dispatchEvent(
          new CustomEvent("child-data-update", {
            detail: { patient_id: recordPayload.patient_id },
          })
        );
      }

      setTimeout(() => {
        setSuccess(null);
        onSuccess();
        onClose();
      }, 1000);
     } catch (err) {
       console.error("Error recording vaccination:", err);
       if (createdVaccinationRecordId && !usedTransactionalEndpoint) {
          try {
            await apiClient.deleteVaccinationRecord(createdVaccinationRecordId);
          } catch (rollbackError) {
           console.error(
             "Failed to rollback vaccination record after inventory transaction failure:",
             rollbackError,
           );
         }
       }

       setError(err.message || "Failed to record vaccination. Please try again.");
     } finally {
       setLoading(false);
     }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "vaccine_id") {
      batchSelectionModeRef.current = "auto";

      const newVaccine = value ? vaccines.find((v) => v.id === Number(value)) || null : null;
      const eligibleEntry = value ? eligibleVaccineById.get(Number(value)) : null;
      const doseMeta = eligibleEntry ? getEligibleDoseMetadata(eligibleEntry) : null;
      const siteRoute = findVaxDefaults(newVaccine?.name);
      const hasOralSite = injectionSiteOptions.some((opt) => opt.value === "Oral");

      setFormData((prev) => {
        const nextDose = doseMeta?.nextDoseNumber || prev.dose_number || 1;
        const next = {
          ...prev,
          vaccine_id: value,
          batch_id: "",
          vaccine_inventory_id: "",
          lot_batch_number: "",
          manufacturer: "",
          expiration_date: "",
        };

        if (doseMeta) next.dose_number = nextDose;

        if (siteRoute) {
          next.route_of_injection = siteRoute.route;
          if (siteRoute.site === "Oral") {
            if (hasOralSite) next.site_of_injection = "Oral";
          } else {
            next.site_of_injection = siteRoute.site;
          }
        }

        if (prev.next_appointment_type) {
          next.next_appointment_date = computeNextApptDate({
            type: prev.next_appointment_type,
            vaccineName: newVaccine?.name,
            doseNumber: nextDose,
            dob: selectedInfantDob,
            adminDate: prev.date_administered,
          });
        }

        return next;
      });
      return;
    }

    if (name === "next_appointment_type") {
      setFormData((prev) => {
        const vName = vaccines.find((v) => v.id === Number(prev.vaccine_id))?.name;
        return {
          ...prev,
          next_appointment_type: value,
          next_appointment_date: value
            ? computeNextApptDate({
                type: value,
                vaccineName: vName,
                doseNumber: prev.dose_number,
                dob: selectedInfantDob,
                adminDate: prev.date_administered,
              })
            : "",
        };
      });
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInfantSelectionChange = useCallback((event) => {
    const newInfantId = event.target.value;
    const matchedInfant = infants.find(
      (entry) => Number(entry.id) === Number(newInfantId),
    );

    setSelectedInfantId(newInfantId);
    setSelectedInfantSnapshot(
      matchedInfant
        ? matchedInfant
        : newInfantId
          ? selectedInfantSnapshot
          : null,
    );
    void fetchVaccinationHistory(newInfantId);
    void fetchEligibleVaccines(newInfantId);
  }, [fetchEligibleVaccines, fetchVaccinationHistory, infants, selectedInfantSnapshot]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <AdminModalActions>
          <Button type="button" variant="cancel" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="injectVaccineForm"
            disabled={
              loading ||
              !isAdmin ||
              healthWorkerUsers.length === 0 ||
              vaccinationBatchOptionsLoading
            }
          >
            {loading ? "Recording..." : submitLabel}
          </Button>
        </AdminModalActions>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          variant="success"
          className="mb-4"
          dismissible
          onDismiss={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {!isAdmin && (
        <Alert variant="warning" className="mb-4">
          Note: Only healthcare administrators can record vaccine administrations.
        </Alert>
      )}

      <form id="injectVaccineForm" onSubmit={handleSubmit} className="admin-form">
        <select
          aria-label={infantLabel}
          className="sr-only"
          value={selectedInfantId}
          onChange={handleInfantSelectionChange}
        >
          <option value="">{infantLabel}</option>
          {infants.map((infant) => (
            <option key={infant.id} value={String(infant.id)}>
              {getInfantDisplayLabel(infant)}
            </option>
          ))}
        </select>

        <SearchableInfantSelect
          infants={infants}
          value={selectedInfantId}
          onChange={handleInfantSelectionChange}
          label={infantLabel}
          required
          placeholder="Search by name, control number, or date of birth..."
          loading={infantsLoading}
          searchQuery={infantsSearchQuery}
          onSearchQueryChange={setInfantsSearchQuery}
          selectedInfant={selectedInfantOverride}
          hasMore={infantsHasMore}
          onLoadMore={handleLoadMoreInfants}
        />

        <div className="admin-form-row-2">
          <Select
            label="Vaccine"
            surface="light"
            name="vaccine_id"
            value={formData.vaccine_id}
            onChange={handleChange}
            options={[
              {
                value: "",
                label: eligibleLoading ? "Loading eligibility..." : "Select Vaccine",
                disabled: eligibleLoading,
              },
              ...vaccineDropdownOptions,
            ]}
            required
            disabled={eligibleLoading}
          />
          <Input
            label="Dose Number"
            surface="light"
            name="dose_number"
            type="number"
            min="1"
            max="10"
            value={formData.dose_number}
            onChange={handleChange}
            required
          />
        </div>

        {/* Completed Vaccines Guidance */}
        {completedVaccines.length > 0 && !formData.vaccine_id && (
          <div className="admin-form-card admin-form-card-info mt-3">
            <div className="font-medium text-gray-900 dark:text-white mb-2">
              Completed Vaccinations for this Infant
            </div>
            <div className="flex flex-wrap gap-2">
              {completedVaccines.map((vaccine) => (
                <span
                  key={vaccine.vaccineId}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  {vaccine.vaccineName} (All doses complete)
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="admin-field-group">
          <Select
            label="Batch Source (FEFO)"
            surface="light"
            name="batch_id"
            value={formData.batch_id}
            onChange={(e) => {
              batchSelectionModeRef.current = "manual";
              const selectedBatchId = e.target.value;
              const batchOption = vaccinationBatchOptions.find(
                (record) => record.batch_id === Number(selectedBatchId),
              );

              const batchExp = formatDateInputValue(
                batchOption?.expiry_date ||
                  batchOption?.expiration_date ||
                  batchOption?.matched_inventory_record?.expiry_date ||
                  batchOption?.matched_inventory_record?.expiration_date ||
                  "",
                "",
              );

              setFormData((prev) => ({
                ...prev,
                batch_id: selectedBatchId,
                vaccine_inventory_id: batchOption?.matched_inventory_record_id
                  ? String(batchOption.matched_inventory_record_id)
                  : "",
                lot_batch_number: resolveLotBatchValue(
                  batchOption?.lot_batch_number,
                  batchOption?.matched_inventory_record?.lot_batch_number,
                ),
                expiration_date: selectedBatchId ? batchExp : "",
              }));
            }}
            options={batchSourceSelectOptions}
            required
          />
          {vaccinationBatchOptionsLoading && formData.vaccine_id && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Loading FEFO-eligible batch sources for the selected vaccine...
            </p>
          )}
          {vaccinationBatchOptionsError && formData.vaccine_id && (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
              {vaccinationBatchOptionsError}
            </p>
          )}
          {!vaccinationBatchOptionsLoading &&
            !vaccinationBatchOptionsError &&
            !vaccinationBatchOptions.length &&
            formData.vaccine_id && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              No non-expired FEFO batch with available stock was found for the selected vaccine.
            </p>
          )}
          {!vaccinationBatchOptionsLoading &&
            vaccinationBatchOptions.length > 0 &&
            vaccinationBatchOptions.every((option) => option.selection_disabled) && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Valid batches were found, but none are linked to an inventory sheet record.
                Update Inventory Management before recording this vaccination.
              </p>
            )}
          {selectedBatchOption?.is_fefo_recommended && !selectedBatchOption?.selection_disabled && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              FEFO recommended batch selected automatically to use the earliest valid expiry first.
            </p>
          )}
          {selectedBatchOption?.is_expiring_soon && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Selected batch expires soon on {new Date(selectedBatchOption.expiry_date).toLocaleDateString()}.
            </p>
          )}
        </div>

        {selectedVaccine && (
          <div className="admin-form-card admin-form-card-info">
            <div className="font-medium text-gray-900 dark:text-white">
              {selectedVaccine.name}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              Code: {selectedVaccine.code || "N/A"} | Approved brand options:{" "}
              {selectedVaccineBrandOptions.length > 0
                ? selectedVaccineBrandOptions.join(", ")
                : "None configured"}
            </div>
            {selectedInventoryRecord && (
              <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Facility: {selectedInventoryRecord.facility_name || "N/A"}</span>
                <span>
                  Lot/Batch: {resolveLotBatchValue(selectedInventoryRecord.lot_batch_number) || "N/A"}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {selectedInventoryRecord.stock_on_hand || 0} in stock
                </span>
              </div>
            )}
          </div>
        )}

        {/* Eligibility Indicator */}
        {selectedEligibleVaccine && (
          <div className="mt-3">
            <VaccineEligibilityIndicator
              vaccine={selectedEligibleVaccine}
              showDetails={true}
            />
          </div>
        )}

        <div className="admin-form-row-2">
          <Input
            label="Date Administered"
            surface="light"
            name="date_administered"
            type="date"
            value={formData.date_administered}
            onChange={handleChange}
            required
          />
          <Select
            label="Time Administered (8AM - 5PM)"
            surface="light"
            name="time_administered"
            value={formData.time_administered}
            onChange={handleChange}
            options={timeOptions}
            required
          />
        </div>

        <div className="admin-form-row-2">
          <Input
            label="Lot / Batch Number"
            surface="light"
            name="lot_batch_number"
            value={formData.lot_batch_number}
            placeholder="Auto-filled from selected inventory record"
            disabled
          />
        </div>

        <div className="admin-form-row-2">
          <Input
            label="Expiration Date"
            surface="light"
            name="expiration_date"
            type="date"
            value={formData.expiration_date}
            onChange={handleChange}
          />
          <Select
            label="Vaccine Brand"
            surface="light"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            options={[
              {
                value: "",
                label: selectedVaccineBrandOptions.length > 0
                  ? "Select approved brand"
                  : "Brand optional",
              },
              ...selectedVaccineBrandOptions.map((brand) => ({
                value: brand,
                label: brand,
              })),
            ]}
            disabled={!formData.vaccine_id || selectedVaccineBrandOptions.length === 0}
          />
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Site of Injection"
            surface="light"
            name="site_of_injection"
            value={formData.site_of_injection}
            onChange={handleChange}
            options={injectionSiteOptions}
            required
          />
          <Select
            label="Route of Injection"
            surface="light"
            name="route_of_injection"
            value={formData.route_of_injection}
            onChange={handleChange}
            options={routeOfInjectionOptions}
            required
          />
        </div>

        <div className="admin-field-group">
          <Select
            label="Administered By Role"
            surface="light"
            value={formData.administered_by_role}
            onChange={handleAdministeredByRoleChange}
            options={administeredByRoleSelectOptions}
            required
          />

          <div className="mt-3 relative">
            <Input
              label="Administered By Name"
              surface="light"
              value={formData.administered_by_search}
              onChange={handleAdministeredBySearchChange}
              onFocus={() => setShowAdministeredBySuggestions(true)}
              onBlur={handleAdministeredBySearchBlur}
              placeholder={
                formData.administered_by_role
                  ? `Type to search ${formData.administered_by_role.charAt(0).toUpperCase() + formData.administered_by_role.slice(1)} name`
                  : "Select role first"
              }
              disabled={
                !formData.administered_by_role ||
                administeredByUsersByRole.length === 0
              }
              autoComplete="off"
              containerClassName="mb-0"
              required
            />

            {showAdministeredBySuggestions &&
              formData.administered_by_role &&
              administeredBySuggestions.length > 0 && (
                <ul className="absolute z-40 mt-1 max-h-52 w-full overflow-y-auto modern-scrollbar rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {administeredBySuggestions.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleAdministeredBySelection(entry);
                        }}
                      >
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entry.displayName}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {entry.roleLabel}
                          {entry.username ? ` • ${entry.username}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>

          {!healthWorkerUsers.length && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              No active Physician, Nurse, or Midwife users were found for this facility.
            </p>
          )}

          {formData.administered_by_role &&
            healthWorkerUsers.length > 0 &&
            administeredByUsersByRole.length === 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                No active {formData.administered_by_role.charAt(0).toUpperCase() + formData.administered_by_role.slice(1)} users are available for this facility.
              </p>
            )}

          {formData.administered_by_role &&
            Boolean(normalizeSearchValue(formData.administered_by_search)) &&
            administeredBySuggestions.length === 0 &&
            !selectedAdministeredByWorker && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                No matching user found. Select a name from the autocomplete suggestions.
              </p>
            )}

          {selectedAdministeredByWorker && (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              Selected {selectedAdministeredByWorker.roleLabel}: {selectedAdministeredByWorker.displayName}
            </p>
          )}
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Reaction (if any)"
            surface="light"
            name="reaction"
            value={formData.reaction}
            onChange={handleChange}
            options={reactionOptions}
          />
          {formData.reaction === "Other" && (
            <Input
              label="Specify Other Reaction"
              surface="light"
              name="reaction_other"
              value={formData.reaction_other}
              onChange={handleChange}
              placeholder="Describe the reaction"
              required
            />
          )}
        </div>

        <div className="admin-form-row-2">
          <Select
            label="Next Appointment Type"
            surface="light"
            name="next_appointment_type"
            value={formData.next_appointment_type}
            onChange={handleChange}
            options={nextAppointmentOptions}
          />
          <Input
            label="Next Appointment Date"
            surface="light"
            name="next_appointment_date"
            type="date"
            value={formData.next_appointment_date}
            onChange={handleChange}
            min={formData.date_administered}
          />
        </div>

        <div className="admin-field-group">
          <Select
            label="Status"
            surface="light"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={[
              { value: "pending", label: "Pending" },
              { value: "completed", label: "Completed" },
              { value: "due", label: "Due" },
              { value: "overdue", label: "Overdue" },
            ]}
            required
          />
        </div>

        <div className="admin-field-group">
          <TextArea
            label="Additional Notes"
            surface="light"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any observations or notes..."
          />
        </div>

        {selectedInfantId && vaccinationHistory.length > 0 && (
          <div className="admin-form-section">
            <h4 className="admin-form-section-title">
              Previous Vaccinations for this Infant
            </h4>
            <div className="admin-table-container">
              <table className="admin-table">
                <thead className="admin-table-head">
                  <tr>
                    <th className="admin-table-header">Vaccine</th>
                    <th className="admin-table-header">Date</th>
                    <th className="admin-table-header">Dose</th>
                  </tr>
                </thead>
                <tbody className="admin-table-body">
                  {vaccinationHistory.slice(0, 5).map((record) => (
                    <tr key={record.id}>
                      <td className="admin-table-cell">{record.vaccine_name}</td>
                      <td className="admin-table-cell">
                        {record.admin_date
                          ? new Date(record.admin_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="admin-table-cell">{record.dose_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
