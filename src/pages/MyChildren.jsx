import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import apiClient from "../utils/api";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import {
  Button,
  Alert,
  Input,
  Modal,
  Select,
} from "../components/UI";
import {
   Baby,
   Calendar,
   FileText,
   Plus,
   Loader2,
   Edit2,
   Trash2,
   User,
   AlertTriangle,
   CheckCircle,
   Clock,
   AlertCircle,
 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
  triggerGuardianInfantRegistered,
} from "../components/QuickActionFAB";
import { APPROVED_VACCINE_NAMES } from "../constants/approvedVaccines";
import {
  PUROK_OPTIONS,
  getPurokStreetColorOptions,
  isValidPurokStreetColorSelection,
} from "../constants/purokOptions";
import { guardianRoutePaths } from "../utils/routePaths";
import {
  buildTransferCaseVaccinesPayload,
  createTransferVaccineEntry,
  validateTransferHistoryEntries,
} from "../utils/transferCasePayloads";
import { trackEvent } from "../utils/telemetry";
import { normalizeArrayPayload } from "../utils/apiUtils";

const getErrorFieldMap = (error) => {
  if (!error || !error.response || !error.response.data) {
    return {};
  }

  const fields = error.response.data.fields;
  if (!fields || typeof fields !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      normalized[key] = value;
      return;
    }

    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = String(value[0]);
    }
  });

  return normalized;
};

const mapInfantFieldErrors = (fields = {}) => {
  const mapped = {};

  if (fields.first_name) {
    mapped.first_name = fields.first_name;
  }
  if (fields.last_name) {
    mapped.last_name = fields.last_name;
  }
  if (fields.dob) {
    mapped.dob = fields.dob;
  }
  if (fields.sex) {
    mapped.sex = fields.sex;
  }
  if (fields.birth_weight) {
    mapped.birth_weight = fields.birth_weight;
  }
  if (fields.birth_height) {
    mapped.birth_length = fields.birth_height;
  }
  if (fields.birth_head_circumference) {
    mapped.birth_head_circumference = fields.birth_head_circumference;
  }
  if (fields.place_of_birth) {
    mapped.birthplace = fields.place_of_birth;
  }
  if (fields.purok) {
    mapped.purok = fields.purok;
  }
  if (fields.street_color) {
    mapped.street_color = fields.street_color;
  }

  return mapped;
};

const hasFieldErrors = (errors = {}) => Object.keys(errors).length > 0;
const PDF_MIME_TYPE = "application/pdf";

const isImageMimeType = (mimeType = "") => String(mimeType).startsWith("image/");
const isPdfMimeType = (mimeType = "") => String(mimeType) === PDF_MIME_TYPE;

const createInitialChildForm = () => ({
  first_name: "",
  last_name: "",
  dob: "",
  sex: "M",
  birth_weight: "",
  birth_length: "",
  birth_head_circumference: "",
  birthplace: "",
  purok: "",
  street_color: "",
});

const validateChildRegistrationForm = (values = {}) => {
  const errors = {};
  const firstName = String(values.first_name || "").trim();
  const lastName = String(values.last_name || "").trim();
  const dobValue = String(values.dob || "").trim();
  const sexValue = String(values.sex || "").trim();
  const purokValue = String(values.purok || "").trim();
  const streetColorValue = String(values.street_color || "").trim();

  if (!firstName) {
    errors.first_name = "First name is required";
  } else if (firstName.length < 2) {
    errors.first_name = "First name must be at least 2 characters long";
  }

  if (!lastName) {
    errors.last_name = "Last name is required";
  } else if (lastName.length < 2) {
    errors.last_name = "Last name must be at least 2 characters long";
  }

  if (!dobValue) {
    errors.dob = "Date of birth is required";
  } else {
    const parsedDob = parseDobLocal(dobValue);
    if (!parsedDob) {
      errors.dob = "Date of birth must be a valid date";
    } else {
      const today = new Date();
      const todayMidnight = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const dobMidnight = new Date(
        parsedDob.getFullYear(),
        parsedDob.getMonth(),
        parsedDob.getDate(),
      );

      if (dobMidnight > todayMidnight) {
        errors.dob = "Date of birth cannot be in the future";
      }
    }
  }

  if (!sexValue) {
    errors.sex = "Sex is required";
  }

  if (!purokValue) {
    errors.purok = "Purok is required";
  }

  if (!streetColorValue) {
    errors.street_color = "Purok-Street-Color is required";
  } else if (
    purokValue &&
    !isValidPurokStreetColorSelection(purokValue, streetColorValue)
  ) {
    errors.street_color =
      "Selected Purok-Street-Color does not match the selected Purok";
  }

  return errors;
};

const getActionErrorMessage = (error, fallback) => {
  if (error?.response?.data?.error && typeof error.response.data.error === "string") {
    return error.response.data.error;
  }

  if (error?.response?.data?.message && typeof error.response.data.message === "string") {
    return error.response.data.message;
  }

  return error?.message || fallback;
};

const READINESS_REQUEST_TIMEOUT_MS = 25000;
const DOB_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

const parseDobLocal = (value) => {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw || !raw.includes("-")) return null;

  const hasTime = raw.includes("T") || /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw);
  let year;
  let month;
  let day;

  if (hasTime) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsed).reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    year = Number.parseInt(parts.year, 10);
    month = Number.parseInt(parts.month, 10);
    day = Number.parseInt(parts.day, 10);
  } else {
    const parts = raw.split("-");
    if (parts.length !== 3) return null;
    year = Number.parseInt(parts[0], 10);
    month = Number.parseInt(parts[1], 10);
    day = Number.parseInt(parts[2], 10);
  }

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDobInputValue = (value) => {
  const date = parseDobLocal(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDobDisplay = (value) => {
  const date = parseDobLocal(value);
  if (!date) return "";

  return `${DOB_MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const parseLocalDateFromYMD = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const datePart = raw.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const year = Number.parseInt(parts[0], 10);
    const month = Number.parseInt(parts[1], 10);
    const day = Number.parseInt(parts[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toLocalDateString = (value) => {
  const date = parseLocalDateFromYMD(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getAgeDisplay = (value) => {
  const dob = parseDobLocal(value);
  if (!dob) return "Unknown";

  const today = new Date();
  const birthYear = dob.getFullYear();
  const birthMonth = dob.getMonth();
  const birthDay = dob.getDate();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  let yearDiff = currentYear - birthYear;
  const hasHadBirthday =
    currentMonth > birthMonth ||
    (currentMonth === birthMonth && currentDay >= birthDay);

  if (!hasHadBirthday) {
    yearDiff -= 1;
  }

  if (yearDiff <= 0) {
    let monthDiff = (currentYear - birthYear) * 12 + (currentMonth - birthMonth);
    if (currentDay < birthDay) {
      monthDiff -= 1;
    }
    if (monthDiff < 0) monthDiff = 0;
    return `${monthDiff} month${monthDiff === 1 ? "" : "s"}`;
  }

  return `${yearDiff} year${yearDiff === 1 ? "" : "s"}`;
};

export default function MyChildren() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const readinessRequestIdRef = useRef(0);
  const inFlightReadiness = useRef(new Set());
  const transferCardPreviewUrlRef = useRef("");
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [registerSuccess, setRegisterSuccess] = useState(null);
  const [registerWarning, setRegisterWarning] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { success } = useNotification();
  const [registerFieldErrors, setRegisterFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  // Readiness state for each child
  const [childrenReadiness, setChildrenReadiness] = useState({});

  // Transfer-in specific state
  const [registrationType, setRegistrationType] = useState("new"); // "new" or "transfer"
  const [transferFormData, setTransferFormData] = useState({
    source_facility: "",
    prior_vaccines: [createTransferVaccineEntry(1)],
    vaccination_card: null,
    vaccination_card_preview: "",
    vaccination_card_preview_type: "",
    notes: "",
  });
  const [vaccineOptions] = useState(
    APPROVED_VACCINE_NAMES.map((name) => ({ value: name, label: name })),
  );

  const revokeTransferCardPreviewUrl = useCallback(() => {
    const previewUrl = transferCardPreviewUrlRef.current;
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    transferCardPreviewUrlRef.current = "";
  }, []);

  const clearTransferCardPreview = useCallback(() => {
    revokeTransferCardPreviewUrl();
    setTransferFormData((prev) => ({
      ...prev,
      vaccination_card: null,
      vaccination_card_preview: "",
      vaccination_card_preview_type: "",
    }));
  }, [revokeTransferCardPreviewUrl]);

  useEffect(() => () => {
    revokeTransferCardPreviewUrl();
  }, [revokeTransferCardPreviewUrl]);



  // Check if we're on the "new" route
  const isNewRoute = location.pathname.endsWith("/new");

  // Show modal on mount if on new route
  useEffect(() => {
    if (isNewRoute) {
      setShowRegisterModal(true);
    }
  }, [isNewRoute]);

  useEffect(() => {
    const handleOpenAddChildModal = (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      setRegisterError(null);
      setRegisterSuccess(null);
      setRegisterWarning(null);
      setRegisterFieldErrors({});
      setShowRegisterModal(true);
    };

    window.addEventListener(
      GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
      handleOpenAddChildModal,
    );

    return () => {
      window.removeEventListener(
        GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
        handleOpenAddChildModal,
      );
    };
  }, []);

  // Fetch vaccine readiness for a child
  const fetchChildReadiness = useCallback(async (childId) => {
    if (inFlightReadiness.current.has(childId)) {
      return null;
    }
    inFlightReadiness.current.add(childId);
    try {
      const response = await withTimeout(
        apiClient.get(`/vaccination-readiness/${childId}`),
        READINESS_REQUEST_TIMEOUT_MS,
        `Readiness request timed out for child ${childId}`,
      );
      if (response?.success) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching readiness for child ${childId}:`, err);
      return null;
    } finally {
      inFlightReadiness.current.delete(childId);
    }
  }, []);

  // Fetch readiness for all children
  const fetchAllChildrenReadiness = useCallback(async (childrenList, requestId) => {
    if (!Array.isArray(childrenList) || childrenList.length === 0) {
      if (requestId === readinessRequestIdRef.current) {
        setChildrenReadiness({});
      }
      return;
    }

    const readinessEntries = await Promise.allSettled(
      childrenList.map(async (child) => [child.id, await fetchChildReadiness(child.id)]),
    );

    if (requestId !== readinessRequestIdRef.current) {
      return;
    }

    const readinessMap = readinessEntries.reduce((accumulator, entry) => {
      if (entry.status !== "fulfilled") {
        return accumulator;
      }

      const [childId, readiness] = entry.value;
      if (readiness) {
        accumulator[childId] = readiness;
      }
      return accumulator;
    }, {});

    setChildrenReadiness(readinessMap);
  }, [fetchChildReadiness]);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      readinessRequestIdRef.current += 1;
      setChildren([]);
      setChildrenReadiness({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      const childrenData = normalizeArrayPayload(response, ["infants", "children", "patients"]);
      const normalizedChildrenData = childrenData.map((child) => {
        const normalizedDob = formatDobInputValue(child?.dob);

        if (!normalizedDob) {
          return child;
        }

        return {
          ...child,
          dob: normalizedDob,
        };
      });

      setChildren(normalizedChildrenData);
      setChildrenReadiness({});
      setLoading(false);

      // Fetch readiness for each child without blocking the primary child list.
      const requestId = readinessRequestIdRef.current + 1;
      readinessRequestIdRef.current = requestId;
      void fetchAllChildrenReadiness(normalizedChildrenData, requestId);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [guardianId, fetchAllChildrenReadiness]);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  const formatDate = (dateString) => formatDobDisplay(dateString);
  const todayDateString = toLocalDateString(new Date());

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    sex: "M",
    birth_weight: "",
    birth_length: "",
    birth_head_circumference: "",
    birthplace: "",
  });

  // Normalize sex value for display (handles both "M"/"F" and "male"/"female" from backend)
  const normalizeSexForDisplay = (sex) => {
    if (!sex) return "M";
    const normalized = String(sex).trim().toUpperCase();
    if (normalized === "M" || normalized === "MALE") return "M";
    if (normalized === "F" || normalized === "FEMALE") return "F";
    return "O";
  };

  // Normalize sex for form submission (converts "M"/"F" to "male"/"female" for backend)
  const normalizeSexForSubmission = (sex) => {
    const normalized = normalizeSexForDisplay(sex);
    if (normalized === "M") return "male";
    if (normalized === "F") return "female";
    return "other";
  };

  // Handle edit form changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (editFieldErrors[name]) {
      setEditFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };
  const [formData, setFormData] = useState(createInitialChildForm);

  // Handle Edit Child Click
  const handleEditChild = (child) => {
    setSelectedChild(child);
    setEditFormData({
      first_name: child.first_name || "",
      last_name: child.last_name || "",
      dob: formatDobInputValue(child.dob),
      sex: normalizeSexForDisplay(child.sex),
      birth_weight: child.birth_weight || "",
      birth_length: child.birth_height || "",
      birth_head_circumference: child.birth_head_circumference || "",
      birthplace: child.place_of_birth || "",
    });
    setEditError(null);
    setEditSuccess(null);
    setShowEditModal(true);
  };

  // Handle Update Child
  const handleUpdateChild = async (e) => {
    e.preventDefault();
    if (!selectedChild) return;

    // Validate required fields
    if (
      !editFormData.first_name ||
      !editFormData.last_name ||
      !editFormData.dob
    ) {
      setEditError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setEditError(null);
    setEditSuccess(null);
    setEditFieldErrors({});

    try {
      const infantData = {
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        dob: editFormData.dob,
        sex: normalizeSexForSubmission(editFormData.sex),
        birth_weight: editFormData.birth_weight || null,
        birth_height: editFormData.birth_length || null,
        birth_head_circumference: editFormData.birth_head_circumference || null,
        place_of_birth: editFormData.birthplace || null,
      };

      await apiClient.updateGuardianInfant(selectedChild.id, infantData);
      setEditSuccess("Child information updated successfully!");

      // Refresh children list
      fetchChildren();

      // Close modal after delay
      setTimeout(() => {
        setShowEditModal(false);
        setSelectedChild(null);
        setEditSuccess(null);
      }, 1500);
    } catch (err) {
      const backendFields = getErrorFieldMap(err);
      const mappedFields = mapInfantFieldErrors(backendFields);
      if (hasFieldErrors(mappedFields)) {
        setEditFieldErrors(mappedFields);
      }

      setEditError(
        getActionErrorMessage(err, "Failed to update child. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Child Click
  const handleDeleteChildClick = (child) => {
    setSelectedChild(child);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  // Handle Confirm Delete Child
  const handleConfirmDeleteChild = async () => {
    if (!selectedChild) return;

    setIsSubmitting(true);
    setDeleteError(null);

    try {
      await apiClient.deleteGuardianInfant(selectedChild.id);

      // Optimistic UI update - remove child from list immediately
      setChildren((prev) => prev.filter((c) => c.id !== selectedChild.id));

      setShowDeleteModal(false);
      setSelectedChild(null);
    } catch (err) {
      setDeleteError(
        getActionErrorMessage(err, "Failed to delete child. Please try again."),
      );
      // Refresh list on error to ensure consistency
      fetchChildren();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "purok" ? { street_color: "" } : {}),
    }));

    if (registerFieldErrors[name] || (name === "purok" && registerFieldErrors.street_color)) {
      setRegisterFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        if (name === "purok") {
          delete next.street_color;
        }
        return next;
      });
    }
  };

  // Handle transfer-in form changes
  const handleTransferChange = (e) => {
    const { name, value } = e.target;
    setTransferFormData((prev) => ({
      ...prev,
      [name]: value,
      prior_vaccines:
        name === "source_facility"
          ? prev.prior_vaccines.map((entry) =>
              entry.facilityName
                ? entry
                : {
                    ...entry,
                    facilityName: value,
                  },
            )
          : prev.prior_vaccines,
    }));
  };

  const addTransferVaccineEntry = () => {
    setTransferFormData((prev) => {
      const nextId = Math.max(...prev.prior_vaccines.map((entry) => entry.id), 0) + 1;

      return {
        ...prev,
        prior_vaccines: [
          ...prev.prior_vaccines,
          createTransferVaccineEntry(nextId, prev.source_facility),
        ],
      };
    });
  };

  const updateTransferVaccineEntry = (entryId, field, value) => {
    setTransferFormData((prev) => ({
      ...prev,
      prior_vaccines: prev.prior_vaccines.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: field === "doseNumber" ? Number.parseInt(value, 10) || "" : value,
            }
          : entry,
      ),
    }));
  };

  const removeTransferVaccineEntry = (entryId) => {
    setTransferFormData((prev) => ({
      ...prev,
      prior_vaccines:
        prev.prior_vaccines.length === 1
          ? prev.prior_vaccines
          : prev.prior_vaccines.filter((entry) => entry.id !== entryId),
    }));
  };

  // Handle vaccination card file upload
  const handleCardUpload = (e) => {
    const file = e.target.files?.[0] || null;
    revokeTransferCardPreviewUrl();
    const canPreviewInline =
      file && (isImageMimeType(file.type) || isPdfMimeType(file.type));
    const previewUrl = canPreviewInline ? URL.createObjectURL(file) : "";
    transferCardPreviewUrlRef.current = previewUrl;
    setTransferFormData((prev) => ({
      ...prev,
      vaccination_card: file,
      vaccination_card_preview: previewUrl,
      vaccination_card_preview_type: file?.type || "",
    }));
  };

  // Reset transfer form
  const resetTransferForm = () => {
    revokeTransferCardPreviewUrl();
    setTransferFormData({
      source_facility: "",
      prior_vaccines: [createTransferVaccineEntry(1)],
      vaccination_card: null,
      vaccination_card_preview: "",
      vaccination_card_preview_type: "",
      notes: "",
    });
    setRegistrationType("new");
  };

  // Handle transfer-in submission
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!guardianId) {
      setRegisterError("You must be logged in to register a child");
      return;
    }

    const validationErrors = validateChildRegistrationForm(formData);
    if (hasFieldErrors(validationErrors)) {
      setRegisterFieldErrors(validationErrors);
      setRegisterError("Please correct the highlighted child registration fields.");
      return;
    }

    setIsSubmitting(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterWarning(null);
    setRegisterFieldErrors({});

    try {
      if (!String(transferFormData.source_facility || "").trim()) {
        setRegisterError("Previous health center name is required for transfer-in cases.");
        return;
      }

      const transferEntryValidation = validateTransferHistoryEntries(
        transferFormData.prior_vaccines,
      );

      if (!transferEntryValidation.isValid) {
        setRegisterError(transferEntryValidation.errors[0]);
        return;
      }

      let uploadedCardUrl = null;
      let uploadWarningMessage = null;
      if (transferFormData.vaccination_card) {
        try {
          const fileData = new FormData();
          fileData.append("file", transferFormData.vaccination_card);

          // Bypass uploadFile to prevent header/boundary destruction
          const uploadRes = await apiClient.customRequest("/uploads/upload", {
            method: "POST",
            data: fileData,
            headers: { "Content-Type": undefined } // Forces browser to append the multipart boundary
          });
          uploadedCardUrl =
            uploadRes?.data?.downloadUrl ||
            uploadRes?.data?.path ||
            uploadRes?.downloadUrl ||
            uploadRes?.path ||
            null;
        } catch (uploadErr) {
          console.warn("Vaccination card upload failed", uploadErr);
          uploadWarningMessage =
            "Transfer case submitted without the vaccination card attachment. You can still coordinate with the clinic if proof needs to be reviewed manually.";
        }
      }

      const infantData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: formData.dob,
        sex: normalizeSexForSubmission(formData.sex),
        birth_weight: formData.birth_weight || null,
        birth_height: formData.birth_length || null,
        birth_head_circumference: formData.birth_head_circumference || null,
        place_of_birth: formData.birthplace || null,
        purok: formData.purok,
        street_color: formData.street_color,
      };

      const submittedVaccines = buildTransferCaseVaccinesPayload(
        transferFormData.prior_vaccines,
        transferFormData.source_facility,
      );

      const transferRemarks = [
        transferFormData.notes || null,
        transferFormData.vaccination_card
          ? `Guardian selected local proof file: ${transferFormData.vaccination_card.name}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const transferResponse = await apiClient.registerGuardianTransferChild({
        infant: infantData,
        guardian_id: guardianId,
        source_facility: transferFormData.source_facility,
        submitted_vaccines: submittedVaccines,
        prior_doses: submittedVaccines,
        vaccination_card_url: uploadedCardUrl,
        remarks: transferRemarks || null,
      });

      const registeredInfant = transferResponse?.data?.infant || transferResponse?.infant || null;
      const infantId =
        registeredInfant?.id ||
        transferResponse?.data?.infant?.id ||
        transferResponse?.data?.id ||
        transferResponse?.id;

      success(
        uploadWarningMessage
          ? "Transfer-in case submitted. The clinic did not receive the proof attachment from this upload attempt."
          : "Transfer-in case submitted successfully! Our staff will review your child's vaccination history.",
        {
          title: uploadWarningMessage
            ? "Transfer-In Submitted With Warning"
            : "Transfer-In Submitted",
        },
      );

      if (uploadWarningMessage) {
        setRegisterWarning(uploadWarningMessage);
      }

      setRegisterSuccess(
        uploadWarningMessage
          ? "Transfer-in case submitted successfully. Staff review can begin, but the proof attachment was not included in this submission."
          : "Transfer-in case submitted successfully! Our staff will review your child's vaccination history.",
      );

      triggerGuardianInfantRegistered({
        ...infantData,
        id: infantId || null,
        control_number:
          transferResponse?.data?.control_number ||
          registeredInfant?.control_number ||
          null,
      });
      trackEvent("child_profile_created", { method: "transfer_in" });

      // Refresh children list
      await fetchChildren();

      // Close modal and reset forms after delay
      setTimeout(() => {
        setShowRegisterModal(false);
        setFormData(createInitialChildForm());
        resetTransferForm();
        setRegisterSuccess(null);
        setRegisterWarning(null);
        if (isNewRoute) {
          navigate("/guardian/children");
        }
      }, 2000);
    } catch (err) {
      const backendFields = getErrorFieldMap(err);
      const mappedFields = mapInfantFieldErrors(backendFields);
      if (hasFieldErrors(mappedFields)) {
        setRegisterFieldErrors(mappedFields);
      }

      setRegisterError(
        getActionErrorMessage(err, "Failed to submit transfer case. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle child registration
  const handleRegisterChild = async (e) => {
    e.preventDefault();
    if (!guardianId) {
      setRegisterError("You must be logged in to register a child");
      return;
    }

    const validationErrors = validateChildRegistrationForm(formData);
    if (hasFieldErrors(validationErrors)) {
      setRegisterFieldErrors(validationErrors);
      setRegisterError("Please correct the highlighted child registration fields.");
      return;
    }

    setIsSubmitting(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterWarning(null);
    setRegisterFieldErrors({});

    try {
      const infantData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: formData.dob,
        sex: normalizeSexForSubmission(formData.sex),
        guardian_id: guardianId,
        birth_weight: formData.birth_weight || null,
        birth_height: formData.birth_length || null,
        birth_head_circumference: formData.birth_head_circumference || null,
        place_of_birth: formData.birthplace || null,
        purok: formData.purok,
        street_color: formData.street_color,
      };

      await apiClient.createGuardianInfant(infantData);
      setRegisterSuccess("Child registered successfully!");

      triggerGuardianInfantRegistered(infantData);
      trackEvent("child_profile_created", { method: "direct_registration" });

      // Refresh children list immediately for instant UI sync
      await fetchChildren();

      // Close modal and reset form after delay
      setTimeout(() => {
        setShowRegisterModal(false);
        setFormData(createInitialChildForm());
        setRegisterSuccess(null);
        setRegisterWarning(null);
        // Navigate away from /new route if we're there
        if (isNewRoute) {
          navigate("/guardian/children");
        }
      }, 1500);
    } catch (err) {
      const backendFields = getErrorFieldMap(err);
      const mappedFields = mapInfantFieldErrors(backendFields);
      if (hasFieldErrors(mappedFields)) {
        setRegisterFieldErrors(mappedFields);
      }

      setRegisterError(
        getActionErrorMessage(err, "Failed to register child. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="guardian-page-wrapper min-h-screen bg-theme-bg-primary transition-colors duration-200">
      <div className="min-[1025px]:hidden sticky top-0 z-30 w-full bg-theme-bg-primary border-b border-theme-border-primary shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={fetchChildren}
          isRefreshing={loading}
        />
      </div>

      <GuardianModuleHeader
        title="My Children"
        subtitle="Manage your children’s health records and vaccination schedules"
        icon={<Baby className="w-8 h-8 text-white" />}
        showOnDesktop={false}
        actions={(
          <Button
            onClick={() => setShowRegisterModal(true)}
            className="guardian-module-hero__primary-btn min-[1025px]:hidden"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Child
          </Button>
        )}
      />
      <GuardianModuleHeader
        title="My Children"
        subtitle="Manage your childrenâ€™s health records and vaccination schedules"
        icon={<Baby className="w-8 h-8 text-white" />}
        showOnMobile={false}
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">

        {error && (
          <Alert variant="danger" className="mb-2">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="bg-theme-bg-card rounded-2xl p-8 sm:p-12 border border-theme-border-primary text-center shadow-sm transition-all duration-300">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
            <p className="mt-4 text-theme-secondary font-medium">
              Loading children records...
            </p>
          </div>
        ) : children.length === 0 ? (
          <div className="bg-theme-bg-card rounded-2xl p-8 sm:p-12 border border-theme-border-primary text-center shadow-sm transition-all duration-300">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 transition-colors duration-300">
              <Baby className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-theme-primary mb-2 transition-colors duration-300">
              No Children Registered
            </h3>
            <p className="text-theme-secondary max-w-md mx-auto mb-8 transition-colors duration-300">
              You haven't registered any children yet. Add your first child to
              get started with tracking their health journey.
            </p>
            <Button size="lg" onClick={() => setShowRegisterModal(true)}>
              Register Your First Child
            </Button>
          </div>
        ) : (
          <div className="guardian-children-grid grid grid-cols-1 min-[640px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            {children.map((child) => {
              const normalizedSex = normalizeSexForDisplay(child.sex);
              const sexLabel =
                normalizedSex === "M"
                  ? "Male"
                  : normalizedSex === "F"
                    ? "Female"
                    : "Other";

              return (
                <div
                  key={child.id}
                  className="guardian-child-card guardian-theme-card glassmorphism-card rounded-xl border border-transparent backdrop-blur-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10"
                >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-6">
                    <div className="ml-auto flex flex-col items-end gap-1">
                      <span className="guardian-status-pill guardian-status-pill--active px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider">
                        Active
                      </span>
                      {childrenReadiness[child.id] && (
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${
                          childrenReadiness[child.id].readinessStatus === 'READY' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          childrenReadiness[child.id].readinessStatus === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          childrenReadiness[child.id].readinessStatus === 'PENDING_CONFIRMATION' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {childrenReadiness[child.id].readinessStatus === 'READY' && <CheckCircle className="w-3 h-3" />}
                          {childrenReadiness[child.id].readinessStatus === 'OVERDUE' && <AlertCircle className="w-3 h-3" />}
                          {childrenReadiness[child.id].readinessStatus === 'PENDING_CONFIRMATION' && <Clock className="w-3 h-3" />}
                          {childrenReadiness[child.id].readinessStatus === 'UPCOMING' && <Clock className="w-3 h-3" />}
                          {childrenReadiness[child.id].readinessStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold guardian-card-text-primary mb-4">
                    {child.first_name} {child.last_name}
                  </h3>

                  {child.control_number && (
                    <div className="mb-4 inline-block px-3 py-1 rounded guardian-card-chip">
                      <span className="text-xs guardian-card-text-secondary font-mono tracking-wider">
                        Infant Control Number: {child.control_number}
                      </span>
                    </div>
                  )}

                    <div className="space-y-3 text-sm">
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between py-2 border-b border-theme-border-primary">
                        <span className="guardian-card-text-secondary">
                          Date of Birth
                        </span>
                      <span className="font-semibold guardian-card-text-primary">
                        {formatDate(child.dob)}
                      </span>
                    </div>
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between py-2 border-b border-theme-border-primary">
                        <span className="guardian-card-text-secondary">Age</span>
                      <span className="font-semibold guardian-card-text-primary">
                        {getAgeDisplay(child.dob)}
                      </span>
                    </div>
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between py-2 border-b border-theme-border-primary">
                        <span className="guardian-card-text-secondary">Sex</span>
                      <span className="font-semibold guardian-card-text-primary">
                        {sexLabel}
                      </span>
                    </div>
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between py-2">
                        <span className="guardian-card-text-secondary">
                          Health Center
                        </span>
                      <span className="font-semibold guardian-card-text-primary truncate max-w-[150px]">
                        {child.health_center || "Not specified"}
                      </span>
                    </div>
                    {childrenReadiness[child.id]?.nextAppointmentPrediction && (
                      <div className="mt-3 pt-3 border-t border-theme-border-primary">
                        <p className="text-xs text-theme-secondary mb-1">Next Vaccine:</p>
                        <p className="font-semibold text-theme-primary text-sm">
                          {childrenReadiness[child.id].nextAppointmentPrediction.date}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-row flex-nowrap items-stretch gap-1.5 sm:gap-2 p-3 sm:p-4 border-t border-theme-border-primary bg-white/5 backdrop-blur-md">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 min-w-0 flex-col h-auto py-2 px-1 justify-center items-center gap-1 guardian-card-action guardian-card-action--neutral"
                    onClick={() =>
                      navigate(guardianRoutePaths.vaccinationRecordsByChild(child.id))
                    }
                  >
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 mx-0" />
                    <span className="text-[10px] sm:text-xs font-semibold leading-none truncate max-w-full">Records</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 min-w-0 flex-col h-auto py-2 px-1 justify-center items-center gap-1 guardian-card-action guardian-card-action--neutral"
                    onClick={() =>
                      navigate(guardianRoutePaths.appointmentBooking(child.id))
                    }
                  >
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mx-0" />
                    <span className="text-[10px] sm:text-xs font-semibold leading-none truncate max-w-full">Schedule</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 min-w-0 flex-col h-auto py-2 px-1 justify-center items-center gap-1 guardian-card-action guardian-card-action--edit"
                    onClick={() => handleEditChild(child)}
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 mx-0" />
                    <span className="text-[10px] sm:text-xs font-semibold leading-none truncate max-w-full">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 min-w-0 flex-col h-auto py-2 px-1 justify-center items-center gap-1 guardian-card-action guardian-card-action--delete"
                    onClick={() => handleDeleteChildClick(child)}
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 mx-0 text-red-500" />
                    <span className="text-[10px] sm:text-xs font-semibold leading-none truncate max-w-full text-red-600 dark:text-red-400">Delete</span>
                  </Button>
                </div>
              </div>
            );
            })}
          </div>
        )}


          {/* Registration Modal */}
          <Modal
            isOpen={showRegisterModal}
            onClose={() => {
              clearTransferCardPreview();
              setShowRegisterModal(false);
              setRegisterError(null);
              setRegisterSuccess(null);
              setRegisterWarning(null);
              // Navigate away from /new route if we're there
              if (isNewRoute) {
                navigate("/guardian/children");
              }
            }}
            title={registrationType === "new" ? "Register New Child" : "Transfer Vaccination History"}
            size="md"
            footer={
              <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
                <Button
                  variant="cancel"
                  actionRole="cancel"
                  onClick={() => {
                    clearTransferCardPreview();
                    setShowRegisterModal(false);
                    setRegisterError(null);
                    setRegisterSuccess(null);
                    setRegisterWarning(null);
                    if (isNewRoute) {
                      navigate("/guardian/children");
                    }
                  }}
                  disabled={isSubmitting}
                  className="ui-form-action-btn ui-form-action-btn--secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  actionRole="primary"
                  form={registrationType === "new" ? "registerChildForm" : "transferChildForm"}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  className="ui-form-action-btn ui-form-action-btn--primary"
                >
                  {isSubmitting ? (registrationType === "new" ? "Registering..." : "Submitting...") : (registrationType === "new" ? "Register Child" : "Submit Transfer")}
                </Button>
              </div>
            }
          >
            {registerError && (
              <Alert
                variant="danger"
                className="mb-4"
                onClose={() => setRegisterError(null)}
              >
                {registerError}
              </Alert>
            )}

            {registerSuccess && (
              <Alert
                variant="success"
                className="mb-4"
                onClose={() => setRegisterSuccess(null)}
              >
                {registerSuccess}
              </Alert>
            )}

            {registerWarning && (
              <Alert
                variant="warning"
                className="mb-4"
                onClose={() => setRegisterWarning(null)}
              >
                {registerWarning}
              </Alert>
            )}

            <div className="space-y-4">
              {/* Registration Type Tabs */}
              <div className="flex border-b border-theme-border-primary mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  className={`${registrationType === "new" ? "bg-theme-bg-primary text-theme-primary" : "bg-transparent text-theme-secondary"} px-4 py-2 mr-2 rounded-t-lg`}
                  onClick={() => {
                    setRegistrationType("new");
                    setRegisterError(null);
                    setRegisterSuccess(null);
                    setRegisterWarning(null);
                    setRegisterFieldErrors({});
                  }}
                >
                  New Registration
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`${registrationType === "transfer" ? "bg-theme-bg-primary text-theme-primary" : "bg-transparent text-theme-secondary"} px-4 py-2 rounded-t-lg`}
                  onClick={() => {
                    setRegistrationType("transfer");
                    setRegisterError(null);
                    setRegisterSuccess(null);
                    setRegisterWarning(null);
                    setRegisterFieldErrors({});
                  }}
                >
                  Transfer from Another Center
                </Button>
              </div>

              {registrationType === "new" ? (
                <form
                  id="registerChildForm"
                  onSubmit={handleRegisterChild}
                  className="space-y-4"
                >
                  {/* Personal Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.first_name}
                      required
                      placeholder="Enter first name"
                    />
                    <Input
                      label="Last Name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.last_name}
                      required
                      placeholder="Enter last name"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Date of Birth"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.dob}
                      required
                    />
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-1.5">
                        Gender <span className="text-red-500 ml-1">*</span>
                      </label>
                      <select
                        name="sex"
                        value={formData.sex}
                        onChange={handleRegisterChange}
                        required
                        className={`w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed ${
                          registerFieldErrors.sex ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-600 focus:ring-red-500 focus:border-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        <option value="M" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Male</option>
                        <option value="F" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Female</option>
                      </select>
                      {registerFieldErrors.sex && (
                        <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">{registerFieldErrors.sex}</p>
                      )}
                    </div>
                  </div>

                  {/* Birth Information */}
                  <div className="border-t border-theme-border-primary pt-4 mt-4">
                    <h4 className="text-sm font-medium text-theme-secondary mb-3">
                      Birth Information (Optional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input
                        label="Birth Weight (kg)"
                        name="birth_weight"
                        type="number"
                        step="0.01"
                        value={formData.birth_weight}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_weight}
                        placeholder="e.g., 3.2"
                      />
                      <Input
                        label="Birth Length (cm)"
                        name="birth_length"
                        type="number"
                        step="0.1"
                        value={formData.birth_length}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_length}
                        placeholder="e.g., 50"
                      />
                      <Input
                        label="Head Circumference at Birth (cm)"
                        name="birth_head_circumference"
                        type="number"
                        step="0.1"
                        value={formData.birth_head_circumference}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_head_circumference}
                        placeholder="e.g., 34"
                      />
                    </div>
                    <div className="mt-4 space-y-4">
                      <Input
                        label="Place of Birth"
                        name="birthplace"
                        value={formData.birthplace}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birthplace}
                        placeholder="Hospital or address"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                          label="Purok"
                          name="purok"
                          value={formData.purok}
                          onChange={handleRegisterChange}
                          options={PUROK_OPTIONS}
                          error={registerFieldErrors.purok}
                          required
                        />
                        <Select
                          label="Purok-Street-Color"
                          name="street_color"
                          value={formData.street_color}
                          onChange={handleRegisterChange}
                          options={getPurokStreetColorOptions(formData.purok)}
                          error={registerFieldErrors.street_color}
                          disabled={!formData.purok}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <form
                  id="transferChildForm"
                  onSubmit={handleTransferSubmit}
                  className="space-y-4"
                >
                  {/* Personal Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.first_name}
                      required
                      placeholder="Enter first name"
                    />
                    <Input
                      label="Last Name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.last_name}
                      required
                      placeholder="Enter last name"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Date of Birth"
                      name="dob"
                      type="date"
                      value={formData.dob}
                      onChange={handleRegisterChange}
                      error={registerFieldErrors.dob}
                      required
                    />
                    <div className="space-y-1">
                      <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-1.5">
                        Gender <span className="text-red-500 ml-1">*</span>
                      </label>
                      <select
                        name="sex"
                        value={formData.sex}
                        onChange={handleRegisterChange}
                        required
                        className={`w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed ${
                          registerFieldErrors.sex ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-600 focus:ring-red-500 focus:border-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                      >
                        <option value="M" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Male</option>
                        <option value="F" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Female</option>
                      </select>
                      {registerFieldErrors.sex && (
                        <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">{registerFieldErrors.sex}</p>
                      )}
                    </div>
                  </div>

                  {/* Birth Information */}
                  <div className="border-t border-theme-border-primary pt-4 mt-4">
                    <h4 className="text-sm font-medium text-theme-secondary mb-3">
                      Birth Information (Optional)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input
                        label="Birth Weight (kg)"
                        name="birth_weight"
                        type="number"
                        step="0.01"
                        value={formData.birth_weight}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_weight}
                        placeholder="e.g., 3.2"
                      />
                      <Input
                        label="Birth Length (cm)"
                        name="birth_length"
                        type="number"
                        step="0.1"
                        value={formData.birth_length}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_length}
                        placeholder="e.g., 50"
                      />
                      <Input
                        label="Head Circumference at Birth (cm)"
                        name="birth_head_circumference"
                        type="number"
                        step="0.1"
                        value={formData.birth_head_circumference}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birth_head_circumference}
                        placeholder="e.g., 34"
                      />
                    </div>
                    <div className="mt-4 space-y-4">
                      <Input
                        label="Place of Birth"
                        name="birthplace"
                        value={formData.birthplace}
                        onChange={handleRegisterChange}
                        error={registerFieldErrors.birthplace}
                        placeholder="Hospital or address"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                          label="Purok"
                          name="purok"
                          value={formData.purok}
                          onChange={handleRegisterChange}
                          options={PUROK_OPTIONS}
                          error={registerFieldErrors.purok}
                          required
                        />
                        <Select
                          label="Purok-Street-Color"
                          name="street_color"
                          value={formData.street_color}
                          onChange={handleRegisterChange}
                          options={getPurokStreetColorOptions(formData.purok)}
                          error={registerFieldErrors.street_color}
                          disabled={!formData.purok}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transfer-in Specific Fields */}
                  <div className="border-t border-theme-border-primary pt-4 mt-4">
                    <h4 className="text-sm font-medium text-theme-secondary mb-3">
                      Transfer Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Previous Health Center/Facility"
                        name="source_facility"
                        value={transferFormData.source_facility}
                        onChange={handleTransferChange}
                        required
                        placeholder="Name of health center where vaccines were previously administered"
                      />
                      <Input
                        label="Notes (Optional)"
                        name="notes"
                        value={transferFormData.notes}
                        onChange={handleTransferChange}
                        textarea
                        rows={3}
                        placeholder="Any additional information about vaccination history..."
                      />
                    </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="block text-sm font-medium text-theme-secondary">
                            Previously Administered Doses
                          </label>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={addTransferVaccineEntry}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Dose
                          </Button>
                        </div>
                        <p className="text-xs text-theme-secondary">
                          Enter each vaccine dose separately and include the exact administered date.
                          This information will be submitted to the admin transfer review workflow.
                        </p>

                        <div className="space-y-3">
                          {transferFormData.prior_vaccines.map((entry, index) => (
                            <div
                              key={entry.id}
                              className="rounded-lg border border-theme-border-primary p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-theme-primary">
                                  Dose Entry #{index + 1}
                                </p>
                                {transferFormData.prior_vaccines.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeTransferVaccineEntry(entry.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    Remove
                                  </Button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select
                                  label="Vaccine"
                                  value={entry.vaccineName}
                                  onChange={(event) =>
                                    updateTransferVaccineEntry(
                                      entry.id,
                                      "vaccineName",
                                      event.target.value,
                                    )
                                  }
                                  options={[{ value: "", label: "Select vaccine" }, ...vaccineOptions]}
                                  required
                                />
                                <Input
                                  label="Dose Number"
                                  type="number"
                                  min="1"
                                  value={entry.doseNumber}
                                  onChange={(event) =>
                                    updateTransferVaccineEntry(
                                      entry.id,
                                      "doseNumber",
                                      event.target.value,
                                    )
                                  }
                                  required
                                />
                                <Input
                                  label="Date Administered"
                                  type="date"
                                  value={entry.dateAdministered}
                                  onChange={(event) =>
                                    updateTransferVaccineEntry(
                                      entry.id,
                                      "dateAdministered",
                                      event.target.value,
                                    )
                                  }
                                  required
                                />
                                <Input
                                  label="Facility Name (Optional)"
                                  value={entry.facilityName}
                                  onChange={(event) =>
                                    updateTransferVaccineEntry(
                                      entry.id,
                                      "facilityName",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Facility for this dose"
                                />
                                <Input
                                  label="Batch/Lot Number (Optional)"
                                  value={entry.batchNumber}
                                  onChange={(event) =>
                                    updateTransferVaccineEntry(
                                      entry.id,
                                      "batchNumber",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Recorded on vaccine card"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-theme-secondary mb-2">
                        Vaccination Card/Record (Optional)
                      </label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleCardUpload}
                        className="w-full"
                      />
                      {transferFormData.vaccination_card_preview && (
                        <div className="mt-3">
                          <p className="text-xs text-theme-secondary mb-1">Preview:</p>
                          {isImageMimeType(transferFormData.vaccination_card_preview_type) ? (
                            <img
                              src={transferFormData.vaccination_card_preview}
                              alt="Vaccination card preview"
                              className="max-w-xs max-h-52 h-auto rounded border object-contain"
                            />
                          ) : isPdfMimeType(transferFormData.vaccination_card_preview_type) ? (
                            <embed
                              src={transferFormData.vaccination_card_preview}
                              type={PDF_MIME_TYPE}
                              title="Vaccination card PDF preview"
                              className="w-full max-w-md h-[200px] rounded border"
                            />
                          ) : (
                            <div className="flex max-w-md items-center gap-3 rounded border border-theme-border-primary p-3 text-xs text-theme-secondary">
                              <FileText className="h-5 w-5 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-theme-primary">
                                  {transferFormData.vaccination_card?.name || "Selected file"}
                                </p>
                                <p>Document selected</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </Modal>

        {/* Edit Child Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedChild(null);
            setEditError(null);
            setEditSuccess(null);
          }}
          title="Edit Child Information"
          size="md"
          footer={
            <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedChild(null);
                  setEditError(null);
                  setEditSuccess(null);
                }}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                actionRole="primary"
                form="editChildForm"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--primary"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          }
        >
          {editError && (
            <Alert
              variant="danger"
              className="mb-4"
              onClose={() => setEditError(null)}
            >
              {editError}
            </Alert>
          )}

          {editSuccess && (
            <Alert
              variant="success"
              className="mb-4"
              onClose={() => setEditSuccess(null)}
            >
              {editSuccess}
            </Alert>
          )}

          <form
            id="editChildForm"
            onSubmit={handleUpdateChild}
            className="space-y-4"
          >
            {/* Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                name="first_name"
                value={editFormData.first_name}
                onChange={handleEditChange}
                error={editFieldErrors.first_name}
                required
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                name="last_name"
                value={editFormData.last_name}
                onChange={handleEditChange}
                error={editFieldErrors.last_name}
                required
                placeholder="Enter last name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                name="dob"
                type="date"
                value={editFormData.dob}
                onChange={handleEditChange}
                error={editFieldErrors.dob}
                max={todayDateString}
                required
              />
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-1.5">
                  Gender <span className="text-red-500 ml-1">*</span>
                </label>
                <select
                  name="sex"
                  value={editFormData.sex}
                  onChange={handleEditChange}
                  required
                  className={`w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed ${
                    editFieldErrors.sex ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-600 focus:ring-red-500 focus:border-red-500" : "border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 dark:hover:border-gray-500"
                  }`}
                >
                  <option value="M" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Male</option>
                  <option value="F" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Female</option>
                  <option value="O" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Other</option>
                </select>
                {editFieldErrors.sex && (
                  <p className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">{editFieldErrors.sex}</p>
                )}
              </div>
            </div>

            {/* Birth Information */}
            <div className="border-t border-theme-border-primary pt-4 mt-4">
              <h4 className="text-sm font-medium text-theme-secondary mb-3">
                Birth Information (Optional)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Birth Weight (kg)"
                  name="birth_weight"
                  type="number"
                  step="0.01"
                  value={editFormData.birth_weight}
                  onChange={handleEditChange}
                  error={editFieldErrors.birth_weight}
                  placeholder="e.g., 3.2"
                />
                <Input
                  label="Birth Length (cm)"
                  name="birth_length"
                  type="number"
                  step="0.1"
                  value={editFormData.birth_length}
                  onChange={handleEditChange}
                  error={editFieldErrors.birth_length}
                  placeholder="e.g., 50"
                />
                <Input
                  label="Head Circumference at Birth (cm)"
                  name="birth_head_circumference"
                  type="number"
                  step="0.1"
                  value={editFormData.birth_head_circumference}
                  onChange={handleEditChange}
                  error={editFieldErrors.birth_head_circumference}
                  placeholder="e.g., 34"
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Place of Birth"
                  name="birthplace"
                  value={editFormData.birthplace}
                  onChange={handleEditChange}
                  error={editFieldErrors.birthplace}
                  placeholder="Hospital or address"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedChild(null);
            setDeleteError(null);
          }}
          title="Delete Child"
          size="md"
          footer={
            <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChild(null);
                  setDeleteError(null);
                }}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--secondary"
              >
                No, Keep Child
              </Button>
              <Button
                variant="danger"
                actionRole="primary"
                onClick={handleConfirmDeleteChild}
                loading={isSubmitting}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--primary"
              >
                {isSubmitting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          }
        >
          {deleteError && (
            <Alert
              variant="danger"
              className="mb-4"
              onClose={() => setDeleteError(null)}
            >
              {deleteError}
            </Alert>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-400/30 to-pink-500/30 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-300" />
            </div>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">
              Are you sure you want to delete this child?
            </h3>
            <p className="text-theme-secondary">
              This child's record will be deactivated and removed from your active list.
              The record will be kept in the system for health center records.
            </p>
          </div>

          {selectedChild && (
            <div className="bg-theme-bg-tertiary rounded-lg p-4">
              <div className="text-center flex items-center justify-center">
                {normalizeSexForDisplay(selectedChild.sex) === "M" ? (
                  <User className="w-6 h-6 text-blue-300 mr-2" />
                ) : (
                  <User className="w-6 h-6 text-pink-300 mr-2" />
                )}
                <span className="font-semibold text-theme-primary">
                  {selectedChild.first_name} {selectedChild.last_name}
                </span>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
