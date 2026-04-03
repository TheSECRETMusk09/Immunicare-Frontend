import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { getApprovedBrandsForVaccine } from "../constants/approvedVaccines";
import {
  buildVaccinationBatchOptionLabel,
  resolveLotBatchValue,
} from "../utils/vaccinationFormOptions";

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

const INFANT_DROPDOWN_LOCALE = "en-PH";
const INFANT_DROPDOWN_TIME_ZONE = "Asia/Manila";

const formatInfantDropdownDate = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(INFANT_DROPDOWN_LOCALE, {
    timeZone: INFANT_DROPDOWN_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const buildInfantDropdownLabel = (infant = {}) => {
  const displayName = [
    infant.first_name,
    infant.last_name,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim() || String(infant.full_name || infant.name || "").trim() || "Unnamed infant";

  const birthDateLabel = formatInfantDropdownDate(
    infant.dob ?? infant.date_of_birth ?? infant.birth_date,
  );

  return birthDateLabel ? `${displayName} (${birthDateLabel})` : displayName;
};

const formatDateInputValue = (value, fallback = "") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().split("T")[0];
};

const createTodayDateInput = () => new Date().toISOString().split("T")[0];

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
    next_appointment_date: formatDateInputValue(
      prefill.next_appointment_date ?? prefill.next_due_date,
      "",
    ),
    status: String(prefill.status || INITIAL_FORM.status).toLowerCase() || INITIAL_FORM.status,
  };
};

export default function InjectVaccineModal({
  isOpen,
  onClose,
  infantId,
  infantName,
  prefillContext = null,
  onSuccess = () => {},
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

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vaccinationHistory, setVaccinationHistory] = useState([]);

  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const fetchData = useCallback(async () => {
    try {
      const infantQuery = isAdmin
        ? { limit: 10000, scope: "system" }
        : { limit: 1500 };
      const [vaccinesResponse, infantsResponse, inventoryResponse, systemUsersResponse] =
        await Promise.all([
          apiClient.getVaccines(),
          apiClient.getInfants(infantQuery),
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
      const normalizedInfants = normalizeInfantsResponse(infantsResponse);
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
          const roleLabel = role === "midwife" ? "Midwife" : role === "nurse" ? "Nurse" : "Physician";

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
      setInfants(normalizedInfants);
      setInventoryRecords(normalizedInventory);
      setHealthWorkerUsers(normalizedHealthWorkers);
    } catch (err) {
      console.error("Error fetching data:", err);
      setVaccines([]);
      setInfants([]);
      setInventoryRecords([]);
      setHealthWorkerUsers([]);
    }
  }, [isAdmin, scopedClinicId]);

  const fetchVaccinationHistory = useCallback(async (targetInfantId) => {
    if (!targetInfantId) {
      setVaccinationHistory([]);
      return;
    }

    try {
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
      const response = await apiClient.getEligibleVaccines(Number(targetInfantId));
      setEligibleVaccines(response);
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

      const normalizedPrefillInfantId =
        Number(prefillContext?.infant_id ?? prefillContext?.infantId ?? infantId ?? 0) ||
        null;

      setSelectedInfantId(normalizedPrefillInfantId ? String(normalizedPrefillInfantId) : "");
      setFormData(createInitialFormState(prefillContext || {}));

      setError(null);
      setSuccess(null);
      setShowAdministeredBySuggestions(false);
      setVaccinationBatchOptions([]);
      setVaccinationBatchOptionsLoading(false);
      setVaccinationBatchOptionsError(null);
    }
  }, [isOpen, infantId, fetchData, prefillContext]);

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

  // Get eligible vaccines for dropdown - filter vaccines that are ready or upcoming
  const eligibleVaccineOptions = useMemo(() => {
    if (!eligibleVaccines) return [];
    const { eligibleVaccines: ready, upcomingVaccines } = eligibleVaccines;

    // Combine ready and upcoming vaccines for selection
    const selectableVaccines = [
      ...(ready || []),
      ...(upcomingVaccines || [])
    ];

    const uniqueSelectableVaccines = Array.from(
      new Map(selectableVaccines.map((vaccine) => [vaccine.vaccineId, vaccine])).values(),
    );

    return uniqueSelectableVaccines.map(v => ({
      ...v,
      displayLabel: `${v.vaccineName} - Dose ${v.nextDoseNumber}/${v.totalDoses}`
    }));
  }, [eligibleVaccines]);

  // Get completed vaccines for guidance display
  const completedVaccines = useMemo(() => {
    if (!eligibleVaccines?.completedVaccines) return [];
    return eligibleVaccines.completedVaccines.map(v => ({
      ...v,
      displayLabel: `${v.vaccineName} (Completed: ${v.totalDoses}/${v.totalDoses} doses)`
    }));
  }, [eligibleVaccines]);

  // Get selected eligible vaccine info
  const selectedEligibleVaccine = useMemo(() => {
    if (!eligibleVaccines || !formData.vaccine_id) return null;
    const allVaccines = [
      ...(eligibleVaccines.eligibleVaccines || []),
      ...(eligibleVaccines.upcomingVaccines || []),
      ...(eligibleVaccines.notEligibleVaccines || []),
      ...(eligibleVaccines.completedVaccines || [])
    ];
    return allVaccines.find(v => v.vaccineId === Number(formData.vaccine_id)) || null;
  }, [eligibleVaccines, formData.vaccine_id]);


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
  }, [formData.vaccine_id, inventoryRecords, isOpen, scopedClinicId]);

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
        }));
      }
      return;
    }

    const matchingSelectedOption = vaccinationBatchOptions.find(
      (option) =>
        String(option.batch_id) === String(formData.batch_id || "") && !option.selection_disabled,
    );

    const nextSelectedOption =
      matchingSelectedOption ||
      vaccinationBatchOptions.find((option) => !option.selection_disabled) ||
      null;

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

    setFormData((prev) => ({
      ...prev,
      batch_id: nextBatchId,
      vaccine_inventory_id: nextInventoryRecordId,
      lot_batch_number: nextLotBatchValue,
    }));
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

    // Auto-set dose number when vaccine is selected based on eligibility
    if (name === "vaccine_id" && eligibleVaccines && value) {
      const allVaccines = [
        ...(eligibleVaccines.eligibleVaccines || []),
        ...(eligibleVaccines.upcomingVaccines || []),
        ...(eligibleVaccines.notEligibleVaccines || []),
        ...(eligibleVaccines.completedVaccines || [])
      ];
      const selectedVaccine = allVaccines.find(v => v.vaccineId === Number(value));
      if (selectedVaccine) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
          batch_id: "",
          vaccine_inventory_id: "",
          lot_batch_number: "",
          manufacturer: "",
          dose_number: selectedVaccine.nextDoseNumber || 1
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "vaccine_id"
        ? {
            batch_id: "",
            vaccine_inventory_id: "",
            lot_batch_number: "",
            manufacturer: "",
          }
        : {}),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Vaccinations"
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
            {loading ? "Recording..." : "Record Vaccinations"}
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
        <SearchableInfantSelect
          infants={infants}
          value={selectedInfantId}
          onChange={(e) => {
            const newInfantId = e.target.value;
            setSelectedInfantId(newInfantId);
            void fetchVaccinationHistory(newInfantId);
            void fetchEligibleVaccines(newInfantId);
          }}
          label="Select Infant"
          required
          placeholder="Search by name, control number, or date of birth..."
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
              ...(!eligibleLoading
                ? eligibleVaccineOptions.length > 0
                  ? [
                      ...eligibleVaccineOptions.filter(v => v.status === 'ready').map((vaccine) => ({
                        value: vaccine.vaccineId,
                        label: `✅ ${vaccine.vaccineName} - Dose ${vaccine.nextDoseNumber}/${vaccine.totalDoses} (Ready)`,
                      })),
                      ...eligibleVaccineOptions.filter(v => v.status === 'upcoming').map((vaccine) => ({
                        value: vaccine.vaccineId,
                        label: `⏰ ${vaccine.vaccineName} - Dose ${vaccine.nextDoseNumber}/${vaccine.totalDoses} (Due: ${vaccine.dueDate})`,
                      }))
                    ]
                  : vaccines.map((vaccine) => ({
                      value: vaccine.id,
                      label: `${vaccine.name} (${vaccine.code || "N/A"})`,
                    }))
                : []),
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
              📋 Completed Vaccinations for this Infant
            </div>
            <div className="flex flex-wrap gap-2">
              {completedVaccines.map((vaccine) => (
                <span
                  key={vaccine.vaccineId}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  ✅ {vaccine.vaccineName} (All doses complete)
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
              const selectedBatchId = e.target.value;
              const batchOption = vaccinationBatchOptions.find(
                (record) => record.batch_id === Number(selectedBatchId),
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
