import React, { useState, useEffect, useCallback } from "react";
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
   RefreshCw,
   Bell,
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

const TRANSFER_STATUS_META = {
  approved: {
    label: "Transfer Approved",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  for_validation: {
    label: "Transfer Review",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  needs_clarification: {
    label: "Needs Clarification",
    className:
      "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
  rejected: {
    label: "Transfer Rejected",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const READINESS_STATUS_META = {
  READY: {
    label: "Ready to Schedule",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    Icon: CheckCircle,
  },
  OVERDUE: {
    label: "Overdue",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Icon: AlertCircle,
  },
  PENDING_CONFIRMATION: {
    label: "Awaiting Confirmation",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Icon: Clock,
  },
  UPCOMING: {
    label: "Upcoming",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Icon: Clock,
  },
};

const getReadinessMeta = (readinessStatus) =>
  READINESS_STATUS_META[String(readinessStatus || "").toUpperCase()] || null;

const getNextReadinessVaccineLabel = (readiness = {}) =>
  [
    ...(Array.isArray(readiness.overdueVaccines) ? readiness.overdueVaccines : []),
    ...(Array.isArray(readiness.dueVaccines) ? readiness.dueVaccines : []),
    ...(Array.isArray(readiness.blockedVaccines) ? readiness.blockedVaccines : []),
  ][0]?.label || null;

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

const createInitialChildForm = () => ({
  first_name: "",
  last_name: "",
  dob: "",
  sex: "M",
  birth_weight: "",
  birth_length: "",
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
    const parsedDob = new Date(dobValue);
    if (Number.isNaN(parsedDob.getTime())) {
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

export default function MyChildren() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const { transferInSubmitted, success } = useNotification();
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
    notes: "",
  });
  const [vaccineOptions] = useState(
    APPROVED_VACCINE_NAMES.map((name) => ({ value: name, label: name })),
  );



  // Check if we're on the "new" route
  const isNewRoute = location.pathname.endsWith("/new");

  const openRegistrationModal = useCallback((mode = "new") => {
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterFieldErrors({});
    setRegistrationType(mode === "transfer" ? "transfer" : "new");
    setShowRegisterModal(true);
  }, []);

  // Show modal on mount if on new route
  useEffect(() => {
    if (isNewRoute) {
      openRegistrationModal("new");
    }
  }, [isNewRoute, openRegistrationModal]);

  useEffect(() => {
    if (location.state?.openGuardianRegistrationModal) {
      openRegistrationModal(location.state.registrationType || "new");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, openRegistrationModal]);

  useEffect(() => {
    const handleOpenAddChildModal = (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      openRegistrationModal("new");
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
  }, [openRegistrationModal]);

  // Fetch vaccine readiness for a child
  const fetchChildReadiness = useCallback(async (childId) => {
    try {
      const response = await apiClient.getVaccinationReadiness(childId);
      if (response?.success) {
        return response.data;
      }
      return null;
    } catch (err) {
      console.error(`Error fetching readiness for child ${childId}:`, err);
      return null;
    }
  }, []);

  // Fetch readiness for all children
  const fetchAllChildrenReadiness = useCallback(async (childrenList) => {
    const readinessEntries = await Promise.all(
      childrenList.map(async (child) => [child.id, await fetchChildReadiness(child.id)]),
    );

    const readinessMap = readinessEntries.reduce((accumulator, [childId, readiness]) => {
      if (readiness) {
        accumulator[childId] = readiness;
      }
      return accumulator;
    }, {});

    setChildrenReadiness(readinessMap);
  }, [fetchChildReadiness]);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      // Handle both direct array response and wrapped response
      const childrenData = Array.isArray(response)
        ? response
        : response?.data || response || [];
      setChildren(childrenData);
      // Fetch readiness for each child
      await fetchAllChildrenReadiness(childrenData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId, fetchAllChildrenReadiness]);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    sex: "M",
    birth_weight: "",
    birth_length: "",
    birthplace: "",
  });

  // Normalize sex value for display (handles both "M"/"F" and "male"/"female" from backend)
  const normalizeSexForDisplay = (sex) => {
    if (!sex) return 'M'; // Default to Male
    const normalized = String(sex).toUpperCase().charAt(0);
    return normalized === 'M' || normalized === 'F' ? normalized : 'M';
  };

  // Normalize sex for form submission (converts "M"/"F" to "male"/"female" for backend)
  const normalizeSexForSubmission = (sex) => {
    const normalized = normalizeSexForDisplay(sex);
    return normalized === 'M' ? 'male' : 'female';
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
      dob: child.dob ? child.dob.split("T")[0] : "",
      sex: normalizeSexForDisplay(child.sex),
      birth_weight: child.birth_weight || "",
      birth_length: child.birth_height || "",
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
      setChildren(children.filter((c) => c.id !== selectedChild.id));

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
    const file = e.target.files[0];
    if (file) {
      setTransferFormData((prev) => ({
        ...prev,
        vaccination_card: file,
        vaccination_card_preview: URL.createObjectURL(file),
      }));
    }
  };

  // Reset transfer form
  const resetTransferForm = () => {
    setTransferFormData({
      source_facility: "",
      prior_vaccines: [createTransferVaccineEntry(1)],
      vaccination_card: null,
      vaccination_card_preview: "",
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
      if (transferFormData.vaccination_card) {
        try {
          const uploadRes = await apiClient.uploadFile(transferFormData.vaccination_card);
          uploadedCardUrl =
            uploadRes?.data?.downloadUrl ||
            uploadRes?.data?.path ||
            uploadRes?.downloadUrl ||
            uploadRes?.path ||
            null;
        } catch (uploadErr) {
          console.warn("Vaccination card upload failed", uploadErr);
        }
      }

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

      await apiClient.registerGuardianTransferChild({
        infant: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          dob: formData.dob,
          sex: normalizeSexForSubmission(formData.sex),
          guardian_id: guardianId,
          birth_weight: formData.birth_weight || null,
          birth_height: formData.birth_length || null,
          place_of_birth: formData.birthplace || null,
          purok: formData.purok,
          street_color: formData.street_color,
        },
        source_facility: transferFormData.source_facility,
        submitted_vaccines: submittedVaccines,
        vaccination_card_url: uploadedCardUrl,
        remarks: transferRemarks || null,
      });

      success(
        "Transfer-in case submitted successfully! Our staff will review your child's vaccination history.",
        { title: "Transfer-In Submitted" }
      );

      transferInSubmitted({
        childName: `${formData.first_name} ${formData.last_name}`,
        vaccines: submittedVaccines
          .map((entry) => `${entry.vaccine_name} dose ${entry.dose_number}`)
          .join(", "),
      });

      setRegisterSuccess("Transfer-in case submitted successfully! Our staff will review your child's vaccination history.");

      triggerGuardianInfantRegistered({
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: formData.dob,
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
        actions={(
          <>
            <Button
              onClick={() => openRegistrationModal("new")}
              className="guardian-module-hero__primary-btn min-[1025px]:hidden"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Child
            </Button>
            <div className="hidden min-[1025px]:flex guardian-desktop-pageheader-actions guardian-desktop-pageheader-actions--with-primary">
              <button
                type="button"
                onClick={fetchChildren}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Refresh My Children"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/notifications")}
                className="guardian-desktop-pageheader-icon-btn guardian-desktop-pageheader-icon-btn--notif"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="guardian-desktop-pageheader-notif-dot" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/profile")}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Open profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
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
            <Button size="lg" onClick={() => openRegistrationModal("new")}>
              Register Your First Child
            </Button>
          </div>
        ) : (
          <div className="guardian-children-grid grid grid-cols-1 min-[640px]:grid-cols-2 min-[1025px]:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            {children.map((child) => {
              const readiness = childrenReadiness[child.id] || null;
              const readinessMeta = getReadinessMeta(readiness?.readinessStatus);
              const transferMeta = TRANSFER_STATUS_META[child.latest_transfer_case_status] || null;
              const nextRecommendedVaccine = getNextReadinessVaccineLabel(readiness);
              const ReadinessIcon = readinessMeta?.Icon;

              return (
                <div
                  key={child.id}
                  className="guardian-child-card guardian-theme-card glassmorphism-card rounded-xl border border-transparent backdrop-blur-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-400/30 to-purple-500/30 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        {normalizeSexForDisplay(child.sex) === "M" ? (
                          <User className="w-8 h-8 guardian-card-icon-accent guardian-card-icon-accent--blue" />
                        ) : (
                          <User className="w-8 h-8 guardian-card-icon-accent guardian-card-icon-accent--pink" />
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="guardian-status-pill guardian-status-pill--active px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider">
                          Active
                        </span>
                        {readinessMeta && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${readinessMeta.className}`}>
                            {ReadinessIcon ? <ReadinessIcon className="w-3 h-3" /> : null}
                            {readinessMeta.label}
                          </span>
                        )}
                        {transferMeta && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${transferMeta.className}`}>
                            {transferMeta.label}
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
                          {Math.floor(
                            (new Date() - new Date(child.dob)) /
                              (1000 * 60 * 60 * 24 * 365),
                          )}{" "}
                          years
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between py-2 border-b border-theme-border-primary">
                        <span className="guardian-card-text-secondary">Sex</span>
                        <span className="font-semibold guardian-card-text-primary">
                          {normalizeSexForDisplay(child.sex) === "M" ? "Male" : "Female"}
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
                      {readiness?.nextAppointmentPrediction && (
                        <div className="mt-3 pt-3 border-t border-theme-border-primary">
                          <p className="text-xs text-theme-secondary mb-1">Recommended Date:</p>
                          <p className="font-semibold text-theme-primary text-sm">
                            {formatDate(readiness.nextAppointmentPrediction.date)}
                          </p>
                          {nextRecommendedVaccine && (
                            <p className="text-xs text-theme-secondary mt-1">
                              {nextRecommendedVaccine}
                            </p>
                          )}
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

        {/* Quick Actions */}
        {children.length > 0 && (
          <section className="bg-theme-bg-card rounded-2xl p-4 sm:p-5 border border-theme-border-primary shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-theme-primary">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Button
                variant="secondary"
                className="p-3 sm:p-6 h-auto flex-col items-center justify-center text-center guardian-quick-action-card guardian-quick-action-card--blue"
                onClick={() => navigate(guardianRoutePaths.vaccinationRecords)}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400/30 to-purple-500/30 backdrop-blur-sm flex items-center justify-center mb-2 sm:mb-3">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 guardian-card-icon-accent guardian-card-icon-accent--blue" />
                </div>
                <span className="text-xs sm:text-sm font-bold guardian-quick-action-title leading-tight">
                  Records
                </span>
                <span className="hidden sm:block text-xs guardian-quick-action-description mt-1">
                  Complete history for all children
                </span>
              </Button>

              <Button
                variant="secondary"
                className="p-3 sm:p-6 h-auto flex-col items-center justify-center text-center guardian-quick-action-card guardian-quick-action-card--emerald"
                onClick={() => navigate(guardianRoutePaths.appointmentBooking())}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-500/30 backdrop-blur-sm flex items-center justify-center mb-2 sm:mb-3">
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 guardian-card-icon-accent guardian-card-icon-accent--emerald" />
                </div>
                <span className="text-xs sm:text-sm font-bold guardian-quick-action-title leading-tight">
                  Schedule
                </span>
                <span className="hidden sm:block text-xs guardian-quick-action-description mt-1">
                  Schedule a new vaccination visit
                </span>
              </Button>

              <Button
                variant="secondary"
                className="p-3 sm:p-6 h-auto flex-col items-center justify-center text-center guardian-quick-action-card guardian-quick-action-card--purple"
                onClick={() => navigate(guardianRoutePaths.documents)}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center mb-2 sm:mb-3">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 guardian-card-icon-accent guardian-card-icon-accent--purple" />
                </div>
                <span className="text-xs sm:text-sm font-bold guardian-quick-action-title leading-tight">
                  Documents
                </span>
                <span className="hidden sm:block text-xs guardian-quick-action-description mt-1">
                  Open current charts, records, and document-ready views
                </span>
              </Button>
            </div>
          </section>
        )}

          {/* Registration Modal */}
          <Modal
            isOpen={showRegisterModal}
            onClose={() => {
              setShowRegisterModal(false);
              setRegisterError(null);
              setRegisterSuccess(null);
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
                    setShowRegisterModal(false);
                    setRegisterError(null);
                    setRegisterSuccess(null);
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          {transferFormData.vaccination_card_preview.startsWith('http') ? (
                            <img
                              src={transferFormData.vaccination_card_preview}
                              alt="Vaccination card preview"
                              className="max-w-xs h-auto rounded border"
                            />
                          ) : (
                            <img
                              src={transferFormData.vaccination_card_preview}
                              alt="Vaccination card preview"
                              className="max-w-xs h-auto rounded border"
                            />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              This action cannot be undone. All records associated with this child
              will be permanently removed.
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
