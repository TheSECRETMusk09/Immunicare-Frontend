import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGuardians,
  useSystemUsers,
  useUserPasswords,
  useRoles,
  useClinics,
} from "../hooks/useDashboard";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import userService from "../services/userService";
import infantService from "../services/infantService";
import {
  Button,
  TextInput,
  Modal,
  PageHeader,
  PageContainer,
  Alert,
  Badge,
  LoadingSpinner,
  EmptyState,
  SkeletonTable,
  Select,
  LoadingButton,
  PasswordInput,
  AdminModalActions,
} from "../components/UI";
import {
  Key,
  Edit,
  Trash2,
  UserPlus,
  ShieldAlert,
  User,
  Power,
  PowerOff,
  Search,
  ArrowUpDown,
} from "lucide-react";
import useUserManagementSocket from "../hooks/useUserManagementSocket";
import ErrorBoundary from "../components/ErrorBoundary";
import { useDebounce } from "../hooks/usePerformance";

const isSameEntityId = (left, right) => String(left) === String(right);

const toComparableTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const hasOnlyAsciiCharacters = (value = "") =>
  String(value)
    .split("")
    .every((character) => character.charCodeAt(0) <= 127);

const normalizeGuardianUsernameForDisplay = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const calculatePasswordStrength = (password) => {
  const checks = [
    /.{8,}/.test(password),
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  return checks.filter(Boolean).length;
};

const validatePasswordResetForm = ({
  password = "",
  confirmPassword = "",
}) => {
  const errors = {};

  if (!password) {
    errors.password = "New password is required.";
  } else if (calculatePasswordStrength(password) < 4) {
    errors.password =
      "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm the new password.";
  } else if (password && password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
};

const USER_MANAGEMENT_TABS = new Set(["admins", "system", "guardians"]);
const PASSWORD_REQUIREMENT_DEFINITIONS = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (password = "") => password.length >= 8,
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password = "") => /[a-z]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    test: (password = "") => /[^A-Za-z0-9]/.test(password),
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password = "") => /[A-Z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    test: (password = "") => /[0-9]/.test(password),
  },
];

const resolveUserManagementTab = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return USER_MANAGEMENT_TABS.has(normalized) ? normalized : "admins";
};

const USER_FORM_INITIAL_STATE = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
  address: "",
  infant_first_name: "",
  infant_last_name: "",
  infant_dob: "",
  infant_sex: "",
  infant_national_id: "",
  infant_address: "",
  infant_contact: "",
  username: "",
  role_id: "",
  clinic_id: "",
  contact: "",
  password: "",
};

const ADMIN_FORM_INITIAL_STATE = {
  username: "",
  email: "",
  contact: "",
  role_id: "",
  clinic_id: "",
  password: "",
  confirmPassword: "",
};

const GUARDIAN_PHONE_REGEX = /^(\+63|0)\d{10}$/;

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveClinicId = (...values) => {
  for (const value of values) {
    const parsed = toPositiveInteger(value);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const isValidOptionalEmail = (value = "") => {
  if (!String(value || "").trim()) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
};

export default function UserManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { roles } = useRoles();
  const { clinics } = useClinics();
  const {
    resetUserPassword,
  } = useUserPasswords();
  const { isAdmin, isSuperAdmin, user, hasPermission } = useAuth();
  const { success, error: notifyError, warning } = useNotification();

  const isSystemAdmin = String(user?.role || "").toUpperCase() === "SYSTEM_ADMIN" || String(user?.role_type || "").toUpperCase() === "SYSTEM_ADMIN";
  const canManageAdmins = isSuperAdmin || isSystemAdmin;

  const canCreateUsers = hasPermission("user:create") || isSystemAdmin;
  const canManageUsers = ['super_admin', 'system_admin', 'admin'].includes(String(user?.role || user?.role_name || '').toLowerCase());

  // Get current user ID for self-protection checks
  const currentUserId = user?.id;

  // Memoized tab state to prevent unnecessary re-renders
  const [activeTab, setActiveTab] = useState(() =>
    resolveUserManagementTab(searchParams.get("tab")),
  );
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [passwordFormData, setPasswordFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [passwordResetErrors, setPasswordResetErrors] = useState({});
  const [passwordResetFormError, setPasswordResetFormError] = useState("");
  const [adminFormData, setAdminFormData] = useState({
    ...ADMIN_FORM_INITIAL_STATE,
  });
  const [formData, setFormData] = useState({
    ...USER_FORM_INITIAL_STATE,
  });

  // Sorting state
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [systemCurrentPage, setSystemCurrentPage] = useState(1);
  const [guardianCurrentPage, setGuardianCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Toggle user active state
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 350);

  const closePasswordResetModal = useCallback(() => {
    setShowPasswordModal(false);
    setSelectedUserForPassword(null);
    setPasswordFormData({ password: "", confirmPassword: "" });
    setPasswordResetErrors({});
    setPasswordResetFormError("");
  }, []);

  const openPasswordResetModal = useCallback((selectedUser) => {
    setSelectedUserForPassword(selectedUser);
    setPasswordFormData({ password: "", confirmPassword: "" });
    setPasswordResetErrors({});
    setPasswordResetFormError("");
    setShowPasswordModal(true);
  }, []);

  const handlePasswordResetFieldChange = useCallback(
    (field, value) => {
      const nextPasswordFormData = {
        ...passwordFormData,
        [field]: value,
      };

      setPasswordFormData(nextPasswordFormData);

      if (passwordResetFormError) {
        setPasswordResetFormError("");
      }

      if (Object.keys(passwordResetErrors).length > 0) {
        setPasswordResetErrors(validatePasswordResetForm(nextPasswordFormData));
      }
    },
    [passwordFormData, passwordResetErrors, passwordResetFormError],
  );

  useEffect(() => {
    const requestedTab = resolveUserManagementTab(searchParams.get("tab"));
    setActiveTab((prev) => (prev === requestedTab ? prev : requestedTab));
  }, [searchParams]);

  // Loading states for CRUD operations
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState({});
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [adminFormTouched, setAdminFormTouched] = useState({});

  const currentClinicId = useMemo(
    () => resolveClinicId(user?.clinic_id, user?.facility_id, clinics?.[0]?.id),
    [clinics, user?.clinic_id, user?.facility_id],
  );

  const resolveClinicName = useCallback(
    (clinicId, fallbackName = "San Nicolas Health Center, Pasig City") => {
      const normalizedClinicId = resolveClinicId(clinicId);
      const matchingClinic = Array.isArray(clinics)
        ? clinics.find(
            (clinic) => resolveClinicId(clinic?.id) === normalizedClinicId,
          )
        : null;

      return (
        matchingClinic?.name ||
        fallbackName ||
        clinics?.[0]?.name ||
        "San Nicolas Health Center, Pasig City"
      );
    },
    [clinics],
  );

  const resolvedUserFormClinicId = useMemo(
    () =>
      resolveClinicId(formData.clinic_id, editingUser?.clinic_id, currentClinicId),
    [currentClinicId, editingUser?.clinic_id, formData.clinic_id],
  );

  const resolvedUserFormClinicName = useMemo(
    () =>
      resolveClinicName(
        resolvedUserFormClinicId,
        editingUser?.clinic_name || user?.clinic_name,
      ),
    [
      editingUser?.clinic_name,
      resolveClinicName,
      resolvedUserFormClinicId,
      user?.clinic_name,
    ],
  );

  const resolvedAdminFormClinicId = useMemo(
    () => resolveClinicId(adminFormData.clinic_id, currentClinicId),
    [adminFormData.clinic_id, currentClinicId],
  );

  const resolvedAdminFormClinicName = useMemo(
    () => resolveClinicName(resolvedAdminFormClinicId, user?.clinic_name),
    [resolveClinicName, resolvedAdminFormClinicId, user?.clinic_name],
  );

  const passwordRequirementItems = useMemo(
    () =>
      PASSWORD_REQUIREMENT_DEFINITIONS.map((requirement) => ({
        ...requirement,
        met: requirement.test(passwordFormData.password || ""),
      })),
    [passwordFormData.password],
  );

  const closeUserModal = useCallback(() => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ ...USER_FORM_INITIAL_STATE });
    setFormErrors({});
    setFormTouched({});
  }, []);

  const closeAdminModal = useCallback(() => {
    setShowAddAdminModal(false);
    setAdminFormData({ ...ADMIN_FORM_INITIAL_STATE });
    setAdminFormErrors({});
    setAdminFormTouched({});
  }, []);

  // Guardian relationship options
  const relationshipOptions = [
    { value: "", label: "Select relationship" },
    { value: "Mother", label: "Mother" },
    { value: "Father", label: "Father" },
    { value: "Grandmother", label: "Grandmother" },
    { value: "Grandfather", label: "Grandfather" },
    { value: "Guardian", label: "Guardian" },
    { value: "Aunt", label: "Aunt" },
    { value: "Uncle", label: "Uncle" },
    { value: "Other", label: "Other" },
  ];

  // Sex options for infant
  const sexOptions = [
    { value: "", label: "Select sex" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  const ADMIN_ROLE_NAMES = useMemo(
    () => new Set(["super_admin", "system_admin", "admin", "administrator"]),
    [],
  );

  const staffRoles = useMemo(
    () =>
      (Array.isArray(roles) ? roles : []).filter(
        (role) => String(role?.name || "").trim().toLowerCase() !== "guardian",
      ),
    [roles],
  );

  const staffRoleNameById = useMemo(() => {
    const roleMap = new Map();
    staffRoles.forEach((role) => {
      roleMap.set(String(role.id), String(role.name || "").trim().toLowerCase());
    });
    return roleMap;
  }, [staffRoles]);

  const selectedRoleName = useMemo(
    () => staffRoleNameById.get(String(roleFilter)) || "",
    [roleFilter, staffRoleNameById],
  );

  const adminRoleCsv = useMemo(
    () => Array.from(ADMIN_ROLE_NAMES).join(","),
    [ADMIN_ROLE_NAMES],
  );

  const guardianQueryParams = useMemo(
    () => ({
      page: guardianCurrentPage,
      limit: itemsPerPage,
      search: debouncedSearchQuery || undefined,
      created_from: startDate || undefined,
      created_to: endDate || undefined,
    }),
    [debouncedSearchQuery, endDate, guardianCurrentPage, itemsPerPage, startDate],
  );

  const systemUserQueryParams = useMemo(() => {
    const isAdminTab = activeTab === "admins";
    const isSystemTab = activeTab === "system";
    const queryPage = isAdminTab ? currentPage : systemCurrentPage;
    const params = {
      page: queryPage,
      limit: itemsPerPage,
      include_guardians: false,
      search: debouncedSearchQuery || undefined,
      created_from: startDate || undefined,
      created_to: endDate || undefined,
      is_active: statusFilter ? String(statusFilter === "active") : undefined,
    };

    if (isAdminTab) {
      params.roles = selectedRoleName || adminRoleCsv;
      params.sort_field = sortField;
      params.sort_direction = sortDirection;
    } else if (isSystemTab && selectedRoleName) {
      params.roles = selectedRoleName;
    }

    return params;
  }, [
    activeTab,
    adminRoleCsv,
    currentPage,
    debouncedSearchQuery,
    endDate,
    itemsPerPage,
    selectedRoleName,
    sortDirection,
    sortField,
    startDate,
    statusFilter,
    systemCurrentPage,
  ]);

  const {
    guardians,
    totalCount: guardianTotalCount,
    pagination: guardianPagination,
    loading: guardiansLoading,
    isFetching: guardiansIsFetching,
    error: guardiansError,
    refreshGuardians,
  } = useGuardians(guardianQueryParams, {
    enabled: canManageUsers && activeTab === "guardians",
  });

  const {
    systemUsers,
    totalCount: systemUserTotalCount,
    pagination: systemUserPagination,
    loading: systemUsersLoading,
    isFetching: systemUsersIsFetching,
    error: systemUsersError,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    refreshSystemUsers,
  } = useSystemUsers(systemUserQueryParams, {
    enabled: canManageUsers && (activeTab === "system" || activeTab === "admins"),
  });

  const invalidateGuardianQueries = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["users", "guardians"] }),
    [queryClient],
  );

  const invalidateSystemUserQueries = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["users", "system-users"] }),
    [queryClient],
  );

  useUserManagementSocket({
    onGuardianCreated: () => {
      void invalidateGuardianQueries();
    },
    onGuardianUpdated: () => {
      void invalidateGuardianQueries();
    },
    onGuardianDeleted: () => {
      void invalidateGuardianQueries();
    },
    onSystemUserCreated: () => {
      void invalidateSystemUserQueries();
    },
    onSystemUserUpdated: () => {
      void invalidateSystemUserQueries();
    },
    onSystemUserDeleted: () => {
      void invalidateSystemUserQueries();
    },
  });

  const normalizedSystemUsers = useMemo(() => {
    if (!Array.isArray(systemUsers)) {
      return [];
    }

    return systemUsers.map((user) => {
      const isGuardianAccount =
        Boolean(user?.guardian_id) ||
        Boolean(user?.is_guardian_account) ||
        String(user?.role_name || "").toLowerCase() === "guardian";

      return {
        ...user,
        is_guardian_account: isGuardianAccount,
        username: isGuardianAccount
          ? normalizeGuardianUsernameForDisplay(user?.username)
          : user?.username || "",
        normalized_role_name: String(user?.role_name || "").trim().toLowerCase(),
      };
    });
  }, [systemUsers]);

  const roleFilterOptions = useMemo(() => {
    const sourceRoles =
      activeTab === "admins"
        ? staffRoles.filter((role) =>
            ADMIN_ROLE_NAMES.has(String(role?.name || "").trim().toLowerCase()),
          )
        : staffRoles;

    return sourceRoles.map((role) => ({
      value: String(role.id),
      label: role.display_name || role.name,
    }));
  }, [ADMIN_ROLE_NAMES, activeTab, staffRoles]);

  const addStaffRoleOptions = useMemo(
    () =>
      staffRoles
        .filter((role) => !["guardian", "super_admin", "admin"].includes(String(role?.name || "").trim().toLowerCase()))
        .map((role) => ({
          value: String(role.id),
          label: role.display_name || role.name,
        })),
    [staffRoles],
  );

  const admins = normalizedSystemUsers;
  const filteredAdmins = normalizedSystemUsers;
  const filteredSystemUsers = normalizedSystemUsers;
  const paginatedAdmins = normalizedSystemUsers;
  const paginatedSystemUsers = normalizedSystemUsers;

  const filteredGuardians = useMemo(() => {
    if (!Array.isArray(guardians)) {
      return [];
    }

    return guardians.map((guardian) => {
      const phone =
        guardian.phone ||
        guardian.contact_number ||
        guardian.contact ||
        guardian.mobile_number ||
        "";

      const infantCountRaw =
        guardian.infant_count ?? guardian.children_count ?? guardian.child_count;

      const infantCount = Number.isFinite(Number(infantCountRaw))
        ? Number(infantCountRaw)
        : 0;

      return {
        ...guardian,
        username: normalizeGuardianUsernameForDisplay(
          guardian.username ||
            guardian.user_username ||
            guardian.account_username ||
            "",
        ),
        name:
          guardian.name || guardian.full_name || guardian.guardian_name || "N/A",
        phone,
        email: guardian.email || guardian.contact_email || "",
        relationship: guardian.relationship || guardian.relation || "Parent",
        address: guardian.address || guardian.home_address || "",
        infant_count: infantCount,
      };
    });
  }, [guardians]);

  const paginatedGuardians = filteredGuardians;
  const totalGuardianPages = guardianPagination?.totalPages || 0;
  const totalAdminPages = systemUserPagination?.totalPages || 0;
  const totalSystemPages = systemUserPagination?.totalPages || 0;

  const activeListLoading =
    activeTab === "guardians" ? guardiansLoading : systemUsersLoading;
  const activeListFetching =
    activeTab === "guardians" ? guardiansIsFetching : systemUsersIsFetching;
  const activeListError =
    activeTab === "guardians" ? guardiansError : systemUsersError;

  // Handle sorting
  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setCurrentPage(1);
    },
    [sortField, sortDirection],
  );

  // Handle toggle user active - with self-protection
  const handleToggleUserActive = async (user) => {
    if (String(user.id) === String(currentUserId)) {
      notifyError("You cannot disable your own account.");
      return;
    }

    const newStatus = !user.is_active;
    if (
      !window.confirm(
        `Are you sure you want to ${newStatus ? "enable" : "disable"} this user?`,
      )
    ) {
      return;
    }

    setIsTogglingActive(true);

    try {
      const result = await toggleUserActive(user.id, newStatus);
      if (!result.success) {
        throw new Error(result.error || "Error toggling user status");
      }

      success(`User ${newStatus ? "enabled" : "disabled"} successfully!`);
      await invalidateSystemUserQueries();
    } catch (error) {
      console.error("Error toggling user status:", error);
      notifyError(error.message || "Error toggling user status");
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Tab change handler - preserves tab state
  const handleTabChange = useCallback((tab) => {
    const nextTab = resolveUserManagementTab(tab);
    setActiveTab(nextTab);
    setSearchQuery("");
    setRoleFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
    setSystemCurrentPage(1);
    setGuardianCurrentPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", nextTab);
      return next;
    });
  }, [setSearchParams]);

  const handleAddUser = useCallback((userType) => {
    setEditingUser(null);
    setFormData({
      ...USER_FORM_INITIAL_STATE,
      clinic_id:
        userType === "guardians" || !currentClinicId
          ? ""
          : String(currentClinicId),
    });
    setFormErrors({});
    setFormTouched({});
    setShowModal(true);
  }, [currentClinicId]);

  const handleEditUser = useCallback((user, userType) => {
    setEditingUser(user);
    // Handle admin, system, and guardian user types
    if (userType === "system" || userType === "admin") {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        email: user.email || "",
        relationship: user.relationship || "",
        address: user.address || "",
        // Infant fields
        infant_first_name: "",
        infant_last_name: "",
        infant_dob: "",
        infant_sex: "",
        infant_national_id: "",
        infant_address: "",
        infant_contact: "",
        username: user.username || "",
        role_id: user.role_id ? user.role_id.toString() : "",
        clinic_id: user.clinic_id ? user.clinic_id.toString() : "",
        contact: user.contact || "",
        password: "",
      });
    } else {
      const guardianRecord = user || {};

      setFormData({
        name: guardianRecord.name || "",
        phone:
          guardianRecord.phone ||
          guardianRecord.contact ||
          guardianRecord.contact_number ||
          "",
        email: guardianRecord.email || guardianRecord.contact_email || "",
        relationship:
          guardianRecord.relationship || guardianRecord.relation || "Guardian",
        address: guardianRecord.address || guardianRecord.home_address || "",
        // Infant fields
        infant_first_name: "",
        infant_last_name: "",
        infant_dob: "",
        infant_sex: "",
        infant_national_id: "",
        infant_address: "",
        infant_contact: "",
        username: "",
        role_id: "",
        clinic_id: "",
        contact: "",
        password: "",
      });
    }
    setFormErrors({});
    setFormTouched({});
    setShowModal(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const shouldHandleGuardianMutation =
      activeTab === "guardians" ||
      (activeTab === "system" && editingUser?.user_type === "guardian");

    const nextErrors = {};

    if (shouldHandleGuardianMutation) {
      const trimmedName = String(formData.name || "").trim();
      const compactPhone = String(formData.phone || "").replace(/[\s\-()]/g, "");

      if (!trimmedName) {
        nextErrors.name = "Name is required";
      } else if (trimmedName.length < 2) {
        nextErrors.name = "Must be at least 2 characters";
      }

      if (!compactPhone) {
        nextErrors.phone = "Phone number is required";
      } else if (!hasOnlyAsciiCharacters(compactPhone)) {
        nextErrors.phone = "Please enter a valid phone number";
      } else if (!GUARDIAN_PHONE_REGEX.test(compactPhone)) {
        nextErrors.phone = "Phone must use 09XXXXXXXXX or +63XXXXXXXXXX format";
      }

      if (!formData.relationship) {
        nextErrors.relationship = "Please select a relationship";
      }

      if (!isValidOptionalEmail(formData.email)) {
        nextErrors.email = "Please enter a valid email address";
      }
    } else if ((activeTab === "system" || activeTab === "admins") && isAdmin) {
      const trimmedUsername = String(formData.username || "").trim();

      if (!trimmedUsername) {
        nextErrors.username = "Username is required";
      } else if (trimmedUsername.length < 3) {
        nextErrors.username = "Must be at least 3 characters";
      }

      if (!formData.role_id) {
        nextErrors.role_id = "Please select a role";
      }

      if (!editingUser && !String(formData.password || "").trim()) {
        nextErrors.password = "Password is required";
      } else if (
        String(formData.password || "").trim() &&
        String(formData.password || "").trim().length < 6
      ) {
        nextErrors.password = "Password must be at least 6 characters";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setFormTouched((prev) => ({
        ...prev,
        ...Object.keys(nextErrors).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {}),
      }));
      warning(
        shouldHandleGuardianMutation
          ? "Please complete the required guardian fields before submitting."
          : "Please complete the required user fields before submitting.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (shouldHandleGuardianMutation) {
        const guardianData = {
          name: String(formData.name || "").trim(),
          phone: String(formData.phone || "").replace(/[\s\-()]/g, ""),
          email: String(formData.email || "").trim(),
          address: formData.address,
          relationship: formData.relationship,
        };

        if (editingUser) {
          const result = await userService.updateGuardian(editingUser.id, guardianData, {
            expected_updated_at: toComparableTimestamp(editingUser?.updated_at),
          });

          if (!result.success) {
            if (result.status === 409 && result.details?.code === "CONFLICT_STALE_WRITE") {
              await invalidateGuardianQueries();
              warning(
                result.details?.message ||
                  "This guardian record was updated elsewhere. Latest server data has been loaded. Please review and retry.",
              );
              return;
            }

            throw new Error(result.error || "Failed to update guardian");
          }

          await invalidateGuardianQueries();
          success("Guardian updated successfully!");
        } else {
          const result = await userService.createGuardian(guardianData);
          if (!result.success) {
            throw new Error(result.error || "Failed to create guardian");
          }

          const guardian = result.data;

          // Create infant if infant data is provided
          if (formData.infant_first_name && formData.infant_last_name) {
            const infantData = {
              first_name: formData.infant_first_name,
              last_name: formData.infant_last_name,
              dob: formData.infant_dob,
              sex: formData.infant_sex,
              national_id: formData.infant_national_id,
              address: formData.infant_address || formData.address,
              contact: formData.infant_contact || formData.phone,
              guardian_id: guardian.id,
            };

            const infantResult = await infantService.create(infantData);
            if (!infantResult.success) {
              console.warn(
                "Guardian created but infant creation failed:",
                infantResult.error,
              );
              warning("Guardian created but infant creation failed");
            } else {
              success("Guardian and infant created successfully!");
            }
          } else {
            success("Guardian created successfully!");
          }

          setGuardianCurrentPage(1);
          await invalidateGuardianQueries();
        }
      } else if (
        (activeTab === "system" || activeTab === "admins") &&
        isAdmin
      ) {
        const resolvedClinicId = resolveClinicId(
          formData.clinic_id,
          editingUser?.clinic_id,
          currentClinicId,
        );

        if (!resolvedClinicId) {
          throw new Error("Unable to resolve a clinic for this user.");
        }

        const userData = {
          username: String(formData.username || "").trim(),
          role_id: parseInt(formData.role_id, 10),
          clinic_id: resolvedClinicId,
          contact: String(formData.contact || "").trim(),
          ...(formData.password && { password: formData.password }),
        };

        if (editingUser) {
          const updateResult = await updateUser(editingUser.id, userData);

          if (!updateResult.success) {
            throw new Error(updateResult.error || "Failed to update user");
          }

          await invalidateSystemUserQueries();
          success("User updated successfully!");
        } else {
          const createResult = await createUser(userData);

          if (!createResult.success) {
            throw new Error(createResult.error || "Failed to create user");
          }

          if (activeTab === "admins") {
            setCurrentPage(1);
          } else {
            setSystemCurrentPage(1);
          }
          await invalidateSystemUserQueries();
          success("User created successfully!");
        }
      }

      closeUserModal();
    } catch (error) {
      console.error("Error saving user:", error);
      notifyError(error.message || "Error saving user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user, userType) => {
    // Self-protection: prevent deleting own account
    if (String(user.id) === String(currentUserId)) {
      notifyError("You cannot delete your own account.");
      return;
    }

    if (
      !window.confirm(`Are you sure you want to delete this ${userType} user?`)
    ) {
      return;
    }

    setIsDeleting(true);

    try {
      if (userType === "system" || userType === "admin") {
        const deleteResult = await deleteUser(user.id);

        if (!deleteResult.success) {
          throw new Error(deleteResult.error || "Failed to delete user");
        }

        if (userType === "admin" && paginatedAdmins.length === 1 && currentPage > 1) {
          setCurrentPage((page) => Math.max(1, page - 1));
        } else if (
          userType === "system" &&
          paginatedSystemUsers.length === 1 &&
          systemCurrentPage > 1
        ) {
          setSystemCurrentPage((page) => Math.max(1, page - 1));
        }

        await invalidateSystemUserQueries();
        success("User deleted successfully!");
      } else {
        const result = await userService.deleteGuardian(user.id, {
          expected_updated_at: toComparableTimestamp(user?.updated_at),
        });

        if (!result.success) {
          if (result.status === 409 && result.details?.code === "CONFLICT_STALE_WRITE") {
            await invalidateGuardianQueries();
            warning(
              result.details?.message ||
                "This guardian record changed remotely before deletion. Latest data has been restored.",
            );
            return;
          }

          throw new Error(result.error || "Failed to delete guardian");
        }

        if (paginatedGuardians.length === 1 && guardianCurrentPage > 1) {
          setGuardianCurrentPage((page) => Math.max(1, page - 1));
        }
        await invalidateGuardianQueries();
        success("Guardian deleted successfully!");
      }
      // Tab state is preserved - no navigation happens
    } catch (error) {
      console.error("Error deleting user:", error);
      notifyError(error.message || "Error deleting user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();

    const validationErrors = validatePasswordResetForm(passwordFormData);
    if (Object.keys(validationErrors).length > 0) {
      const firstErrorMessage =
        validationErrors.password || validationErrors.confirmPassword;
      setPasswordResetErrors(validationErrors);
      setPasswordResetFormError(
        "Please resolve the highlighted password requirements before submitting.",
      );
      warning(firstErrorMessage);
      return;
    }

    const userType =
      activeTab === "guardians" ||
      selectedUserForPassword?.user_type === "guardian"
        ? "guardian"
        : "system";

    setPasswordResetErrors({});
    setPasswordResetFormError("");
    setIsResettingPassword(true);

    try {
      const result = await resetUserPassword(
        selectedUserForPassword.id,
        passwordFormData.password,
        userType,
      );
      if (result.success) {
        if (userType === "guardian") {
          await invalidateGuardianQueries();
        } else {
          await invalidateSystemUserQueries();
        }
        success("Password reset successfully!");
        closePasswordResetModal();
        // Tab state is preserved - no navigation
      } else {
        const errorMessage = result.error || "Error resetting password";
        setPasswordResetFormError(errorMessage);
        notifyError(errorMessage);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      const errorMessage = error.message || "Error resetting password";
      setPasswordResetFormError(errorMessage);
      notifyError(errorMessage);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      // Clear error when user starts typing
      if (formErrors[name]) {
        setFormErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [formErrors],
  );

  // Validate individual field
  const validateField = useCallback((name, value) => {
    if (activeTab === "guardians") {
      if (name === "name") {
        if (!value || value.trim() === "") return "Name is required";
        if (value.trim().length < 2) return "Must be at least 2 characters";
      }
      if (name === "phone") {
        if (!value || value.trim() === "") return "Phone number is required";
        if (!hasOnlyAsciiCharacters(value))
          return "Please enter a valid phone number";
        const compactPhone = value.replace(/[\s\-()]/g, "");
        if (!GUARDIAN_PHONE_REGEX.test(compactPhone)) {
          return "Phone must use 09XXXXXXXXX or +63XXXXXXXXXX format";
        }
      }
      if (name === "email" && !isValidOptionalEmail(value)) {
        return "Please enter a valid email address";
      }
      if (name === "relationship") {
        if (!value) return "Please select a relationship";
      }
    } else {
      if (name === "username") {
        if (!value || value.trim() === "") return "Username is required";
        if (value.trim().length < 3) return "Must be at least 3 characters";
      }
      if (name === "role_id") {
        if (!value) return "Please select a role";
      }
      if (name === "password") {
        if (!editingUser && !value) return "Password is required";
        if (value && value.trim().length < 6) {
          return "Password must be at least 6 characters";
        }
      }
    }
    return null;
  }, [activeTab, editingUser]);

  // Handle blur for real-time validation
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setFormTouched((prev) => ({ ...prev, [name]: true }));
    const validationError = validateField(name, value);
    if (validationError) {
      setFormErrors((prev) => ({ ...prev, [name]: validationError }));
    }
  }, [validateField]);

  const handleAdminChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setAdminFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
      // Clear error when user starts typing
      if (adminFormErrors[name]) {
        setAdminFormErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [adminFormErrors],
  );

  // Validate admin form field
  const validateAdminField = useCallback((name, value) => {
    if (name === "username") {
      if (!value || value.trim() === "") return "Username is required";
      if (value.trim().length < 3) return "Must be at least 3 characters";
    }
    if (name === "email" && !isValidOptionalEmail(value)) {
      return "Please enter a valid email address";
    }
    if (name === "role_id") {
      if (!value) return "Please select a role";
    }
    if (name === "password") {
      if (!value) return "Password is required";
      if (calculatePasswordStrength(value) < 4) return "Password must meet strength requirements (8+ chars, mixed case, numbers, symbols)";
    }
    if (name === "confirmPassword") {
      if (!value) return "Please confirm password";
      if (value !== adminFormData.password) return "Passwords do not match";
    }
    return null;
  }, [adminFormData.password]);

  // Handle blur for admin form real-time validation
  const handleAdminBlur = useCallback((e) => {
    const { name, value } = e.target;
    setAdminFormTouched((prev) => ({ ...prev, [name]: true }));
    const validationError = validateAdminField(name, value);
    if (validationError) {
      setAdminFormErrors((prev) => ({ ...prev, [name]: validationError }));
    }
  }, [validateAdminField]);

  const handleAddAdmin = useCallback(() => {
    setAdminFormData({
      ...ADMIN_FORM_INITIAL_STATE,
      clinic_id: currentClinicId ? String(currentClinicId) : "",
    });
    setAdminFormErrors({});
    setAdminFormTouched({});
    setShowAddAdminModal(true);
  }, [currentClinicId]);

  const handleSubmitAdmin = async (e) => {
    e.preventDefault();

    const validationErrors = {
      username: validateAdminField("username", adminFormData.username),
      email: validateAdminField("email", adminFormData.email),
      role_id: validateAdminField("role_id", adminFormData.role_id),
      password: validateAdminField("password", adminFormData.password),
      confirmPassword: validateAdminField(
        "confirmPassword",
        adminFormData.confirmPassword,
      ),
    };

    const nextErrors = Object.entries(validationErrors).reduce(
      (acc, [field, value]) => {
        if (value) {
          acc[field] = value;
        }
        return acc;
      },
      {},
    );

    if (Object.keys(nextErrors).length > 0) {
      setAdminFormErrors(nextErrors);
      setAdminFormTouched((prev) => ({
        ...prev,
        ...Object.keys(nextErrors).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {}),
      }));
      warning(
        nextErrors.confirmPassword ||
          nextErrors.password ||
          nextErrors.username ||
          nextErrors.role_id ||
          "Please review the admin account details before submitting.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const resolvedClinicId = resolveClinicId(
        adminFormData.clinic_id,
        currentClinicId,
      );

      if (!resolvedClinicId) {
        throw new Error("Unable to resolve a clinic for this admin account.");
      }

      const userData = {
        username: String(adminFormData.username || "").trim(),
        role_id: parseInt(adminFormData.role_id, 10),
        clinic_id: resolvedClinicId,
        contact: String(adminFormData.contact || "").trim(),
        password: adminFormData.password,
      };

      const result = await createUser(userData);
      if (result.success) {
        setCurrentPage(1);
        await invalidateSystemUserQueries();
        success("Admin account created successfully!");
        closeAdminModal();
      } else {
        notifyError(result.error || "Error creating admin account");
      }
    } catch (error) {
      console.error("Error creating admin account:", error);
      notifyError(error.message || "Error creating admin account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminColumns = [
    {
      key: "username",
      label: "Username",
      sortable: true,
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-danger-500" />
          {val}
        </div>
      ),
    },
    {
      key: "role_name",
      label: "Admin Role",
      sortable: true,
      render: (val, row) => (
        <Badge
          variant={
            String(row.role_name || "").trim().toLowerCase() === "super_admin"
              ? "danger"
              : "warning"
          }
        >
          {row.display_name || val}
        </Badge>
      ),
    },
    {
      key: "clinic_name",
      label: "Clinic",
      sortable: true,
    },
    {
      key: "contact",
      label: "Contact",
      sortable: true,
      render: (val) => val || <span className="text-gray-400 italic">N/A</span>,
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (val) =>
        val ? (
          <Badge variant="success" className="flex items-center gap-1">
            <Power className="w-3 h-3" /> Active
          </Badge>
        ) : (
          <Badge variant="default" className="flex items-center gap-1">
            <PowerOff className="w-3 h-3" /> Disabled
          </Badge>
        ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (val) =>
        val ? (
          new Date(val).toLocaleDateString()
        ) : (
          <span className="text-gray-400 italic">N/A</span>
        ),
    },
  ];

  const adminActions = (row) => (
    <div className="flex items-center justify-start gap-1">
      <Button
        variant={row.is_active ? "warning" : "success"}
        size="xs"
        onClick={() => handleToggleUserActive(row)}
        className="p-1.5"
        title={
          String(row.id) === String(currentUserId)
            ? "You cannot disable your own account"
            : row.is_active
              ? "Disable User"
              : "Enable User"
        }
        disabled={isTogglingActive || String(row.id) === String(currentUserId)}
        aria-label={row.is_active ? "Disable user" : "Enable user"}
      >
        {row.is_active ? (
          <PowerOff className="w-3.5 h-3.5" />
        ) : (
          <Power className="w-3.5 h-3.5" />
        )}
      </Button>
      <Button
        variant="info"
        size="xs"
        onClick={() => openPasswordResetModal(row)}
        className="p-1.5"
        title="Reset Password"
        aria-label="Reset password"
        disabled={isResettingPassword}
      >
        <Key className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="success"
        size="xs"
        onClick={() => handleEditUser(row, "admin")}
        className="p-1.5"
        title="Edit User"
        aria-label="Edit user"
      >
        <Edit className="w-3.5 h-3.5" />
      </Button>
      {canManageAdmins && (
        <LoadingButton
          variant="danger"
          size="xs"
          onClick={() => handleDeleteUser(row, "admin")}
          loading={isDeleting}
          className="p-1.5"
          title={
            String(row.id) === String(currentUserId)
              ? "You cannot delete your own account"
              : "Delete User"
          }
          aria-label="Delete user"
          disabled={String(row.id) === String(currentUserId)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </LoadingButton>
      )}
    </div>
  );

  const guardianColumns = [
    {
      key: "username",
      label: "Username",
      width: "12%",
      headerClassName: "min-w-[100px]",
      cellClassName: "min-w-[100px]",
      render: (val) => (
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={val}>
          {val}
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      width: "14%",
      headerClassName: "min-w-[120px]",
      cellClassName: "min-w-[120px]",
      render: (val) => (
        <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={val}>
          {val}
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      width: "10%",
      headerClassName: "min-w-[90px] w-[90px]",
      cellClassName: "min-w-[90px] w-[90px]",
      render: (val) =>
        val ? (
          <span className="text-gray-700 dark:text-gray-200 whitespace-nowrap">{val}</span>
        ) : (
          <span className="text-gray-400 italic">N/A</span>
        ),
    },
    {
      key: "email",
      label: "Email",
      width: "16%",
      headerClassName: "min-w-[140px] max-w-[180px]",
      cellClassName: "min-w-[140px] max-w-[180px]",
      render: (val) =>
        val ? (
          <span className="text-gray-700 dark:text-gray-200 truncate block" title={val}>
            {val}
          </span>
        ) : (
          <span className="text-gray-400 italic">N/A</span>
        ),
    },
    {
      key: "relationship",
      label: "Relationship",
      width: "9%",
      headerClassName: "min-w-[80px] w-[80px]",
      cellClassName: "min-w-[80px] w-[80px]",
      render: (val) => (
        <Badge variant="secondary" className="capitalize text-xs px-2 py-0.5">
          {String(val || "Parent")}
        </Badge>
      ),
    },
    {
      key: "infant_count",
      label: "Infants",
      width: "7%",
      headerClassName: "min-w-[60px] w-[60px]",
      cellClassName: "min-w-[60px] w-[60px]",
      render: (val) => {
        const infantCount = Number.isFinite(Number(val)) ? Number(val) : 0;
        return (
          <Badge variant="info" className="text-xs px-2 py-0.5">
            {infantCount}
          </Badge>
        );
      },
    },
    {
      key: "is_password_set",
      label: "Password",
      width: "8%",
      headerClassName: "min-w-[70px] w-[70px]",
      cellClassName: "min-w-[70px] w-[70px]",
      render: (val) =>
        val ? (
          <Badge variant="success" className="text-xs px-2 py-0.5 flex items-center gap-1">
            <Key className="w-3 h-3" /> Set
          </Badge>
        ) : (
          <Badge variant="warning" className="text-xs px-2 py-0.5">
            Not Set
          </Badge>
        ),
    },
    {
      key: "address",
      label: "Address",
      width: "14%",
      headerClassName: "min-w-[120px] max-w-[160px]",
      cellClassName: "min-w-[120px] max-w-[160px]",
      render: (val) => {
        const address = typeof val === "string" ? val : "";
        return (
          <div
            className="text-gray-500 dark:text-gray-400 truncate block text-xs"
            title={address || "No address provided"}
          >
            {address || <span className="text-gray-400 italic">N/A</span>}
          </div>
        );
      },
    },
  ];

  const guardianActions = (row) => (
    <div className="flex items-center justify-start gap-1">
      <Button
        variant="info"
        size="xs"
        onClick={() => openPasswordResetModal(row)}
        className="p-1.5"
        title="Reset Password"
        aria-label="Reset password"
        disabled={isResettingPassword}
      >
        <Key className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="success"
        size="xs"
        onClick={() => handleEditUser(row, "guardian")}
        className="p-1.5"
        title="Edit Guardian"
        aria-label="Edit guardian"
      >
        <Edit className="w-3.5 h-3.5" />
      </Button>
      <LoadingButton
        variant="danger"
        size="xs"
        onClick={() => handleDeleteUser(row, "guardian")}
        loading={isDeleting}
        className="p-1.5"
        title="Delete Guardian"
        aria-label="Delete guardian"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </LoadingButton>
    </div>
  );

  if (activeListLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-8" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <SkeletonTable rows={10} columns={5} />
      </div>
    );
  }

  if (activeListError) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading users">
          {activeListError}
          <div className="mt-4">
            <Button
              onClick={() => {
                if (activeTab === "guardians") {
                  refreshGuardians();
                } else {
                  refreshSystemUsers();
                }
              }}
              size="sm"
            >
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  if (!canManageUsers) {
    return (
      <PageContainer>
        <Alert variant="error" title="Access Denied">
          You do not have permission to view or manage users. This feature is restricted to system administrators.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
        title="User Management"
        subtitle="Manage admins, system users, and guardians"
        icon="👥"
        actions={
          <div className="flex gap-2">
            {activeTab === "admins" && canManageAdmins && canCreateUsers && (
              <Button
                onClick={handleAddAdmin}
                variant="primary"
                className="flex items-center gap-2"
                disabled={isSubmitting}
              >
                <ShieldAlert className="w-4 h-4" />
                Add New Admin
              </Button>
            )}
            {activeTab === "system" && isAdmin && canCreateUsers && (
              <Button
                onClick={() => handleAddUser("system")}
                variant="primary"
                className="flex items-center gap-2"
                disabled={isSubmitting}
              >
                <UserPlus className="w-4 h-4" />
                Add New Staff
              </Button>
            )}
            {activeTab === "guardians" && canCreateUsers && (
              <Button
                onClick={() => handleAddUser("guardians")}
                variant="primary"
                className="flex items-center gap-2"
                disabled={isSubmitting}
              >
                <UserPlus className="w-4 h-4" />
                Add New Guardian
              </Button>
            )}
          </div>
        }
      />
      </div>

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden space-y-4">
      {/* Security Warning for Admin Features */}
      {isAdmin && (
        <Alert
          variant="warning"
          title="Administrator Access"
          icon={<ShieldAlert className="h-5 w-5" />}
          className="flex-shrink-0"
        >
          Password management is restricted to admin users only. All password
          access is logged for security purposes.
        </Alert>
      )}

      {/* Tab Navigation & Global Filters - Sticky at top */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 z-20">
        <div className="border-b border-gray-200 dark:border-gray-700 flex flex-col xl:flex-row xl:items-center justify-between px-4 py-3 gap-4">
          <nav className="flex space-x-2 overflow-x-auto bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
            onClick={() => handleTabChange("system")}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "system"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span className="text-lg">🛡️</span>
            <span>
              System Users
              {activeTab === "system" ? ` (${systemUserTotalCount || 0})` : ""}
            </span>
          </button>
            <button
            onClick={() => handleTabChange("admins")}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "admins"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              Admins
              {activeTab === "admins" ? ` (${systemUserTotalCount || 0})` : ""}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("guardians")}
            className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "guardians"
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span className="text-lg">👥</span>
            <span>
              Guardians
              {activeTab === "guardians" ? ` (${guardianTotalCount || 0})` : ""}
            </span>
          </button>
          </nav>

          {/* Global Search and Filters */}
          <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-3 pb-3 xl:pb-0 mt-3 xl:mt-0 w-full xl:w-auto">
            {activeListFetching ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <LoadingSpinner size="sm" />
                <span>Refreshing...</span>
              </div>
            ) : null}
            <div className="relative w-full md:w-56 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setSystemCurrentPage(1);
                  setGuardianCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                  setSystemCurrentPage(1);
                  setGuardianCurrentPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-32"
                title="Start Date"
              />
              <span className="hidden sm:inline text-gray-500">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                  setSystemCurrentPage(1);
                  setGuardianCurrentPage(1);
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-32"
                title="End Date"
              />
            </div>

            {activeTab !== "guardians" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                    setSystemCurrentPage(1);
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-32"
                >
                  <option value="">All Roles</option>
                  {roleFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                    setSystemCurrentPage(1);
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-32"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            )}
          </div>
        </div>
        {activeTab === "system" && roleFilterOptions.length > 0 ? (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {roleFilterOptions.map((option) => (
              <Badge key={option.value} variant="secondary">
                {option.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
        <ErrorBoundary>
        {activeTab === "admins" ? (
          isAdmin ? (
            admins.length === 0 ? (
              <EmptyState
                title="No admin accounts found"
                description="There are no administrator accounts configured. Super admins can create new admin accounts."
                icon="🛡️"
                actionLabel={canManageAdmins ? "Add New Admin" : null}
                onAction={canManageAdmins ? handleAddAdmin : null}
                className="py-20"
              />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden space-y-4 mt-4">
                {/* Admin Table */}
                <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex-1 overflow-auto auto-hide-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                        <tr>
                          {adminColumns.map((column) => (
                            <th
                              key={column.key}
                              scope="col"
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() =>
                                column.sortable && handleSort(column.key)
                              }
                            >
                              <div className="flex items-center gap-1">
                                {column.label}
                                {column.sortable &&
                                  sortField === column.key && (
                                    <ArrowUpDown
                                      className={`w-3 h-3 ${sortDirection === "desc" ? "rotate-180" : ""}`}
                                    />
                                  )}
                              </div>
                            </th>
                          ))}
                          <th
                            scope="col"
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                          >
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {paginatedAdmins.length === 0 ? (
                          <tr>
                            <td
                              colSpan={adminColumns.length + 1}
                              className="px-6 py-12 text-center text-gray-500"
                            >
                              No admin accounts found matching your criteria.
                            </td>
                          </tr>
                        ) : (
                          paginatedAdmins.map((row) => (
                            <tr
                              key={row.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              {adminColumns.map((column, colIndex) => (
                                <td
                                  key={colIndex}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                                >
                                  {column.render
                                    ? column.render(row[column.key], row)
                                    : row[column.key]}
                                </td>
                              ))}
                              <td className="px-4 py-4 text-sm font-medium">
                                {adminActions(row)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalAdminPages > 1 && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
                      <div className="text-sm text-gray-500">
                        Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(
                          currentPage * itemsPerPage,
                          systemUserTotalCount,
                        )}{" "}
                        of {systemUserTotalCount} admins
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        {Array.from(
                          { length: Math.min(5, totalAdminPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalAdminPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalAdminPages - 2) {
                              pageNum = totalAdminPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  currentPage === pageNum
                                    ? "primary"
                                    : "secondary"
                                }
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          },
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(totalAdminPages, p + 1),
                            )
                          }
                          disabled={currentPage === totalAdminPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <Alert variant="error" title="Access Denied">
              Admin privileges required to view admin accounts.
            </Alert>
          )
        ) : activeTab === "system" ? (
          isAdmin ? (
              filteredSystemUsers && filteredSystemUsers.length > 0 ? (
              <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
                <div className="flex-1 overflow-auto auto-hide-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Username</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Role</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Password</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Clinic</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Contact</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Status</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {paginatedSystemUsers.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {row.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            <Badge variant="primary" className="capitalize">{row.display_name || row.role_name}</Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {row.is_password_set ? (
                              <Badge variant="success" className="flex items-center gap-1 w-fit"><Key className="w-3 h-3" /> Set</Badge>
                            ) : (
                              <Badge variant="warning">Not Set</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {row.clinic_name || "San Nicolas Health Center"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {row.contact || <span className="text-gray-400 italic">N/A</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {row.is_active ? (
                              <Badge variant="success" className="flex items-center gap-1 w-fit"><Power className="w-3 h-3" /> Active</Badge>
                            ) : (
                              <Badge variant="default" className="flex items-center gap-1 w-fit"><PowerOff className="w-3 h-3" /> Disabled</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center justify-start gap-1">
                              <Button
                                variant={row.is_active ? "warning" : "success"}
                                size="xs"
                                onClick={() => handleToggleUserActive(row)}
                                className="p-1.5"
                                title={
                                  String(row.id) === String(currentUserId)
                                    ? "You cannot disable your own account"
                                    : row.is_active
                                      ? "Disable User"
                                      : "Enable User"
                                }
                                disabled={
                                  isTogglingActive ||
                                  String(row.id) === String(currentUserId)
                                }
                                aria-label={row.is_active ? "Disable user" : "Enable user"}
                              >
                                {row.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="info"
                                size="xs"
                                onClick={() => openPasswordResetModal(row)}
                                className="p-1.5"
                                title="Reset Password"
                                aria-label="Reset password"
                                disabled={isResettingPassword}
                              >
                                <Key className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="success"
                                size="xs"
                                onClick={() => handleEditUser(row, "system")}
                                className="p-1.5"
                                title="Edit User"
                                aria-label="Edit user"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {String(row.id) !== String(currentUserId) && (
                                <LoadingButton
                                  variant="danger"
                                  size="xs"
                                  onClick={() => handleDeleteUser(row, "system")}
                                  loading={isDeleting}
                                  className="p-1.5"
                                  title="Delete User"
                                  aria-label="Delete user"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </LoadingButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalSystemPages > 1 && (
                  <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
                    <div className="text-sm text-gray-500">
                      Showing {(systemCurrentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(systemCurrentPage * itemsPerPage, systemUserTotalCount)} of{" "}
                      {systemUserTotalCount} users
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setSystemCurrentPage((page) => Math.max(1, page - 1))
                        }
                        disabled={systemCurrentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {systemCurrentPage} of {totalSystemPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setSystemCurrentPage((page) =>
                            Math.min(totalSystemPages, page + 1),
                          )
                        }
                        disabled={systemCurrentPage === totalSystemPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title="No users found"
                description="There are no users configured. Add users like doctors, nurses, staff, or guardians."
                icon="🛡️"
                actionLabel="Add New Staff"
                onAction={() => handleAddUser("system")}
                className="py-20"
              />
            )
          ) : (
            <Alert variant="error" title="Access Denied">
              Admin privileges required to view system users.
            </Alert>
          )
        ) : filteredGuardians.length === 0 ? (
          <EmptyState
            title={searchQuery || startDate || endDate ? "No guardians match filters" : "No guardians registered"}
            description={searchQuery || startDate || endDate ? "Adjust your search or date filters." : "There are no guardians registered in the system yet. Start by adding a new guardian."}
            icon="👥"
            actionLabel="Add New Guardian"
            onAction={() => handleAddUser("guardians")}
            className="py-20"
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mt-4">
            <div className="flex-1 overflow-auto auto-hide-scrollbar">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {guardianColumns.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 ${col.headerClassName || ''}`}
                        style={col.width ? { width: col.width } : {}}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 w-[100px] min-w-[100px]"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredGuardians.length === 0 ? (
                    <tr>
                      <td colSpan={guardianColumns.length + 1} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-4xl mb-3">👥</span>
                          <p className="text-lg font-medium">No guardians registered yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  paginatedGuardians.map((row) => (
                      <tr key={`guardian:${String(row?.id)}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        {guardianColumns.map((col, colIndex) => (
                          <td key={col.key || colIndex} className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${col.cellClassName || ''}`}>
                            {col.render
                              ? col.render(row[col.key], row)
                              : row[col.key]}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium w-[100px] min-w-[100px]">
                          {guardianActions(row)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalGuardianPages > 1 && (
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900">
                <div className="text-sm text-gray-500">
                  Showing {(guardianCurrentPage - 1) * itemsPerPage + 1} to{" "}
                  {Math.min(guardianCurrentPage * itemsPerPage, guardianTotalCount)}{" "}
                  of {guardianTotalCount} guardians
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setGuardianCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={guardianCurrentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {guardianCurrentPage} of {totalGuardianPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setGuardianCurrentPage((p) => Math.min(totalGuardianPages, p + 1))}
                    disabled={guardianCurrentPage === totalGuardianPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        </ErrorBoundary>
      </div>
      </div>

      {/* User Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeUserModal}
        title={
          editingUser
            ? `Edit ${activeTab === "guardians" ? "Guardian" : "User"}`
            : `Add New ${activeTab === "guardians" ? "Guardian" : activeTab === "admins" ? "Admin" : "User"}`
        }
        size={activeTab === "guardians" ? "xl" : "lg"}
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={closeUserModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" form="userForm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  {editingUser ? "Updating..." : "Adding..."}
                </span>
              ) : editingUser ? (
                "Update User"
              ) : (
                "Add User"
              )}
            </Button>
          </AdminModalActions>
        }
      >
        <form id="userForm" onSubmit={handleSubmit} className="admin-form">
          {activeTab === "guardians" ? (
            <>
              <div className="admin-form-card admin-form-card-info">
                <div className="admin-form-card-header">
                  <h3 className="admin-form-card-title">
                    Guardian Information
                  </h3>
                </div>
                <div className="admin-form-card-body">
                  <div className="admin-field-group">
                    <TextInput
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={formTouched.name ? formErrors.name : undefined}
                      required
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <TextInput
                        label="Phone Number"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.phone ? formErrors.phone : undefined}
                        required
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Email Address"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.email ? formErrors.email : undefined}
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <Select
                        label="Relationship"
                        name="relationship"
                        value={formData.relationship}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.relationship ? formErrors.relationship : undefined}
                        required
                        options={relationshipOptions}
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Enter home address"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Infant Information Section */}
              <div className="admin-form-card admin-form-card-success">
                <div className="admin-form-card-header">
                  <h3 className="admin-form-card-title">
                    Infant/Child Information (Optional)
                  </h3>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Add the infant/child information connected to this guardian
                </p>
                <div className="admin-form-card-body">
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <TextInput
                        label="First Name"
                        name="infant_first_name"
                        value={formData.infant_first_name}
                        onChange={handleChange}
                        placeholder="Enter infant first name"
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Last Name"
                        name="infant_last_name"
                        value={formData.infant_last_name}
                        onChange={handleChange}
                        placeholder="Enter infant last name"
                      />
                    </div>
                  </div>
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <TextInput
                        label="Date of Birth"
                        name="infant_dob"
                        type="date"
                        value={formData.infant_dob}
                        onChange={handleChange}
                        placeholder="Select date of birth"
                      />
                    </div>
                    <div className="admin-field-group">
                      <Select
                        label="Sex"
                        name="infant_sex"
                        value={formData.infant_sex}
                        onChange={handleChange}
                        options={sexOptions}
                      />
                    </div>
                  </div>
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <TextInput
                        label="National ID"
                        name="infant_national_id"
                        value={formData.infant_national_id}
                        onChange={handleChange}
                        placeholder="Enter national ID"
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Contact Number"
                        name="infant_contact"
                        type="tel"
                        value={formData.infant_contact}
                        onChange={handleChange}
                        placeholder="Enter contact number"
                      />
                    </div>
                  </div>
                  <div className="admin-field-group">
                    <TextInput
                      label="Address"
                      name="infant_address"
                      value={formData.infant_address}
                      onChange={handleChange}
                      placeholder="Enter infant address (same as guardian if empty)"
                    />
                  </div>
                </div>
              </div>

              {editingUser && (
                <Alert
                  variant="info"
                  title="Password Configuration"
                  className="mt-3"
                >
                  <p className="text-sm">
                    To reset this guardian's password, use the "Reset Password"
                    button in the user list, or set a new password below.
                  </p>
                </Alert>
              )}
            </>
          ) : isAdmin ? (
            <>
              {/* System User Information Section */}
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h4 className="admin-form-card-title">
                    <User className="w-4 h-4" />
                    Account Information
                  </h4>
                </div>
                <div className="admin-form-card-body">
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <TextInput
                        label="Username"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.username ? formErrors.username : undefined}
                        required
                        placeholder="Enter username"
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Contact"
                        name="contact"
                        value={formData.contact}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.contact ? formErrors.contact : undefined}
                        placeholder="Phone or email"
                      />
                    </div>
                  </div>
                  <div className="admin-form-row-2">
                    <div className="admin-field-group">
                      <Select
                        label="Role"
                        name="role_id"
                        value={formData.role_id}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.role_id ? formErrors.role_id : undefined}
                        required
                        options={[
                          { value: "", label: "Select a role" },
                          ...addStaffRoleOptions,
                        ]}
                      />
                    </div>
                    <div className="admin-field-group">
                      <TextInput
                        label="Clinic"
                        name="clinic_name"
                        value={resolvedUserFormClinicName}
                        readOnly
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Section */}
              <div className="admin-form-card">
                <div className="admin-form-card-header">
                  <h4 className="admin-form-card-title">
                    <Key className="w-4 h-4" />
                    Security Credentials
                  </h4>
                </div>
                <div className="admin-form-card-body">
                  <div className="admin-field-group">
                    <PasswordInput
                      label={
                        editingUser
                          ? "New Password (leave blank to keep current)"
                          : "Password"
                      }
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={formTouched.password ? formErrors.password : undefined}
                      showPasswordAriaLabel="Show user password"
                      hidePasswordAriaLabel="Hide user password"
                      required={!editingUser}
                      placeholder={
                        editingUser
                          ? "Leave blank to keep current password"
                          : "Enter password"
                      }
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Alert variant="error">
              Access denied. Admin privileges required to manage system users.
            </Alert>
          )}
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={closePasswordResetModal}
        title={`Reset Password`}
        size="md"
        footer={
          <AdminModalActions className="gap-3 sm:gap-4">
            <Button
              variant="cancel"
              type="button"
              onClick={closePasswordResetModal}
              disabled={isResettingPassword}
              className="form-action--cancel ui-form-action-btn ui-form-action-btn--secondary user-password-reset-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              form="passwordForm"
              disabled={isResettingPassword}
              className="form-action--primary ui-form-action-btn ui-form-action-btn--primary min-w-[11rem] shadow-sm user-password-reset-submit-btn"
            >
              {isResettingPassword ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Resetting...
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>
          </AdminModalActions>
        }
      >
        <form
          id="passwordForm"
          onSubmit={handlePasswordReset}
          className="admin-form user-password-reset-form"
        >
          {/* User Info Card */}
          <div className="admin-user-info user-password-reset-info">
            <div className="admin-user-info-avatar user-password-reset-info-avatar">
              <Key className="w-5 h-5" />
            </div>
            <div className="admin-user-info-details">
              <p className="admin-user-info-label">Resetting password for</p>
              <p className="admin-user-info-name">
                {selectedUserForPassword?.name ||
                  selectedUserForPassword?.username}
              </p>
            </div>
          </div>

          <Alert
            variant="warning"
            title="Security Warning"
            icon={<ShieldAlert className="h-5 w-5" />}
            className="user-password-reset-warning"
          >
            <p className="whitespace-normal">
              This will{" "}
              {selectedUserForPassword?.password_hash ? "reset" : "set"} the
              user's password. Enter a strong password that meets the policy
              below, then share it securely with the user if needed.
            </p>
          </Alert>

          {/* Password Fields */}
          <div className="admin-form-card user-password-reset-card">
            <div className="admin-form-card-body user-password-reset-card-body">
              {passwordResetFormError && (
                <Alert variant="error" className="mb-4 user-password-reset-error">
                  {passwordResetFormError}
                </Alert>
              )}
              <div className="admin-field-group">
                <PasswordInput
                  label="New Password"
                  name="password"
                  value={passwordFormData.password}
                  onChange={(e) =>
                    handlePasswordResetFieldChange("password", e.target.value)
                  }
                  showPasswordAriaLabel="Show reset password"
                  hidePasswordAriaLabel="Hide reset password"
                  required
                  disabled={isResettingPassword}
                  placeholder="Use 8+ chars with upper/lowercase, number, and symbol"
                  error={passwordResetErrors.password}
                  containerClassName="user-password-reset-field"
                  className="user-password-reset-input"
                />
              </div>
              <div className="admin-field-group">
                <PasswordInput
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) =>
                    handlePasswordResetFieldChange(
                      "confirmPassword",
                      e.target.value,
                    )
                  }
                  showPasswordAriaLabel="Show reset confirm password"
                  hidePasswordAriaLabel="Hide reset confirm password"
                  required
                  disabled={isResettingPassword}
                  placeholder="Confirm new password"
                  error={passwordResetErrors.confirmPassword}
                  containerClassName="user-password-reset-field"
                  className="user-password-reset-input"
                />
              </div>
              <div className="user-password-reset-requirements">
                <p className="user-password-reset-requirements-title">
                  Password Requirements
                </p>
                <ul className="user-password-reset-requirements-list">
                  {passwordRequirementItems.map((requirement) => (
                    <li
                      key={requirement.id}
                      className="user-password-reset-requirement-item"
                      data-met={requirement.met ? "true" : "false"}
                      aria-label={`${requirement.label} ${requirement.met ? "complete" : "incomplete"}`}
                    >
                      <span
                        aria-hidden="true"
                        className="user-password-reset-requirement-bullet"
                        data-met={requirement.met ? "true" : "false"}
                      >
                        {requirement.met ? (
                          <span className="user-password-reset-requirement-bullet-dot" />
                        ) : null}
                      </span>
                      <span className="user-password-reset-requirement-label">
                        {requirement.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Admin Modal */}
      <Modal
        isOpen={showAddAdminModal}
        onClose={closeAdminModal}
        title="Create New Admin Account"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={closeAdminModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" form="adminForm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Creating...
                </span>
              ) : (
                "Create Admin Account"
              )}
            </Button>
          </AdminModalActions>
        }
      >
        <form
          id="adminForm"
          onSubmit={handleSubmitAdmin}
          className="admin-form"
        >
          <Alert
            variant="info"
            title="Admin Account Creation"
            icon={<ShieldAlert className="h-5 w-5" />}
          >
            Create a new administrator account with full system access
            privileges. The new admin will be able to manage users, guardians,
            and system settings.
          </Alert>

          {/* Account Information Section */}
          <div className="admin-form-card">
            <div className="admin-form-card-header">
              <h4 className="admin-form-card-title">
                <User className="w-4 h-4" />
                Account Information
              </h4>
            </div>
            <div className="admin-form-card-body">
              <div className="admin-form-row-2">
                <div className="admin-field-group">
                  <TextInput
                    label="Username"
                    name="username"
                    value={adminFormData.username}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.username ? adminFormErrors.username : undefined}
                    required
                    placeholder="Enter admin username"
                  />
                </div>
                <div className="admin-field-group">
                  <TextInput
                    label="Email"
                    name="email"
                    type="email"
                    value={adminFormData.email}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.email ? adminFormErrors.email : undefined}
                    placeholder="Enter email address"
                  />
                </div>
              </div>
              <div className="admin-form-row-2">
                <div className="admin-field-group">
                  <TextInput
                    label="Contact"
                    name="contact"
                    value={adminFormData.contact}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.contact ? adminFormErrors.contact : undefined}
                    placeholder="Phone or email"
                  />
                </div>
                <div className="admin-field-group">
                  <Select
                    label="Role"
                    name="role_id"
                    value={adminFormData.role_id}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.role_id ? adminFormErrors.role_id : undefined}
                    required
                    options={[
                      { value: "", label: "Select a role" },
                      ...roles
                        .filter(
                          (role) =>
                            role.name === "super_admin" ||
                            role.name === "admin",
                        )
                        .map((role) => ({
                          value: role.id.toString(),
                          label: role.display_name || role.name,
                        })),
                    ]}
                  />
                </div>
              </div>
              <div className="admin-field-group">
                <TextInput
                  label="Clinic"
                  name="clinic_name"
                  value={resolvedAdminFormClinicName}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="admin-form-card">
            <div className="admin-form-card-header">
              <h4 className="admin-form-card-title">
                <Key className="w-4 h-4" />
                Security Credentials
              </h4>
            </div>
            <div className="admin-form-card-body">
              <div className="admin-form-row-2">
                <div className="admin-field-group">
                  <PasswordInput
                    label="Password"
                    name="password"
                    value={adminFormData.password}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.password ? adminFormErrors.password : undefined}
                    showPasswordAriaLabel="Show admin account password"
                    hidePasswordAriaLabel="Hide admin account password"
                    required
                    placeholder="Enter password (min 8 characters)"
                    minLength={8}
                  />
                </div>
                <div className="admin-field-group">
                  <PasswordInput
                    label="Confirm Password"
                    name="confirmPassword"
                    value={adminFormData.confirmPassword}
                    onChange={handleAdminChange}
                    onBlur={handleAdminBlur}
                    error={adminFormTouched.confirmPassword ? adminFormErrors.confirmPassword : undefined}
                    showPasswordAriaLabel="Show admin confirm password"
                    hidePasswordAriaLabel="Hide admin confirm password"
                    required
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
