import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  DataTable,
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
import SystemUsersTable from "../components/UserManagement/SystemUsersTable";

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

const sortByCreatedAtDesc = (items = []) =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left?.created_at || 0).getTime();
    const rightTime = new Date(right?.created_at || 0).getTime();
    return rightTime - leftTime;
  });

const upsertById = (items = [], entity, { prependOnInsert = false } = {}) => {
  if (!entity || entity.id === undefined || entity.id === null) {
    return items;
  }

  const existingIndex = items.findIndex((item) =>
    isSameEntityId(item?.id, entity.id),
  );

  if (existingIndex === -1) {
    const nextItems = prependOnInsert ? [entity, ...items] : [...items, entity];
    return sortByCreatedAtDesc(nextItems);
  }

  const nextItems = [...items];
  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    ...entity,
  };
  return sortByCreatedAtDesc(nextItems);
};

const removeById = (items = [], id) =>
  sortByCreatedAtDesc(items.filter((item) => !isSameEntityId(item?.id, id)));

const hasOnlyAsciiCharacters = (value = "") =>
  String(value)
    .split("")
    .every((character) => character.charCodeAt(0) <= 127);

const normalizeGuardianUsernameForDisplay = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

export default function UserManagement() {
  const {
    guardians,
    loading: guardiansLoading,
    error: guardiansError,
    refreshGuardians,
  } = useGuardians();
  const {
    systemUsers,
    loading: systemUsersLoading,
    error: systemUsersError,
    createUser,
    updateUser,
    deleteUser,
    toggleUserActive,
    refreshSystemUsers,
  } = useSystemUsers();
  const { roles } = useRoles();
  const { clinics } = useClinics();
  const {
    resetUserPassword,
  } = useUserPasswords();
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const { success, error: notifyError, warning } = useNotification();

  // Get current user ID for self-protection checks
  const currentUserId = user?.id;

  // Memoized tab state to prevent unnecessary re-renders
  const [activeTab, setActiveTab] = useState("admins"); // Default to admins tab
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [passwordFormData, setPasswordFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [adminFormData, setAdminFormData] = useState({
    username: "",
    email: "",
    contact: "",
    role_id: "",
    clinic_id: "",
    password: "",
    confirmPassword: "",
  });
  const [formData, setFormData] = useState({
    // Guardian fields
    name: "",
    phone: "",
    email: "",
    relationship: "",
    address: "",
    // Infant fields
    infant_first_name: "",
    infant_last_name: "",
    infant_dob: "",
    infant_sex: "",
    infant_national_id: "",
    infant_address: "",
    infant_contact: "",
    // System user fields
    username: "",
    role_id: "",
    clinic_id: "",
    contact: "",
    password: "",
  });

  // Sorting state
  const [sortField, setSortField] = useState("created_at");
  const [sortDirection, setSortDirection] = useState("desc");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Toggle user active state
  const [isTogglingActive, setIsTogglingActive] = useState(false);

  // Password visibility states for different modals
  // Password visibility is managed per field by PasswordInput
  const [localGuardians, setLocalGuardians] = useState([]);
  const [localSystemUsers, setLocalSystemUsers] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (!guardiansLoading && Array.isArray(guardians)) {
      setLocalGuardians(sortByCreatedAtDesc(guardians));
    }
  }, [guardians, guardiansLoading]);

  useEffect(() => {
    if (!systemUsersLoading && Array.isArray(systemUsers)) {
      setLocalSystemUsers(sortByCreatedAtDesc(systemUsers));
    }
  }, [systemUsers, systemUsersLoading]);

  useEffect(() => {
    if (!guardiansLoading && !systemUsersLoading) {
      setIsHydrated(true);
    }
  }, [guardiansLoading, systemUsersLoading]);

  const upsertGuardianAcrossStores = useCallback((guardian, options = {}) => {
    if (!guardian || guardian.id === undefined || guardian.id === null) {
      return;
    }

    setLocalGuardians((prev) =>
      upsertById(prev, guardian, {
        prependOnInsert: Boolean(options.prependOnInsert),
      }),
    );
  }, []);

  const removeGuardianAcrossStores = useCallback((guardianId) => {
    setLocalGuardians((prev) => removeById(prev, guardianId));
  }, []);

  const upsertSystemUserAcrossStores = useCallback(
    (systemUser, options = {}) => {
      if (!systemUser || systemUser.id === undefined || systemUser.id === null) {
        return;
      }

      setLocalSystemUsers((prev) =>
        upsertById(prev, systemUser, {
          prependOnInsert: Boolean(options.prependOnInsert),
        }),
      );
    },
    [],
  );

  const removeSystemUserAcrossStores = useCallback((systemUserId) => {
    setLocalSystemUsers((prev) => removeById(prev, systemUserId));
  }, []);

  useUserManagementSocket({
    onGuardianCreated: (guardian) => {
      if (!isHydrated) return;
      upsertGuardianAcrossStores(guardian, { prependOnInsert: true });
    },
    onGuardianUpdated: (guardian) => {
      if (!isHydrated) return;
      upsertGuardianAcrossStores(guardian);
    },
    onGuardianDeleted: ({ id }) => {
      if (!isHydrated) return;
      removeGuardianAcrossStores(id);
    },
    onSystemUserCreated: (systemUser) => {
      if (!isHydrated) return;
      upsertSystemUserAcrossStores(systemUser, { prependOnInsert: true });
    },
    onSystemUserUpdated: (systemUser) => {
      if (!isHydrated) return;
      upsertSystemUserAcrossStores(systemUser);
    },
    onSystemUserDeleted: ({ id }) => {
      if (!isHydrated) return;
      removeSystemUserAcrossStores(id);
    },
  });

  // Handle sorting
  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
      setCurrentPage(1); // Reset to first page on sort
    },
    [sortField, sortDirection],
  );

  // Handle toggle user active - with self-protection
  const handleToggleUserActive = async (user) => {
    // Self-protection: prevent disabling own account
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

    const previousSystemUser = localSystemUsers.find((item) =>
      isSameEntityId(item?.id, user.id),
    );
    const optimisticPayload = {
      ...user,
      is_active: newStatus,
    };

    upsertSystemUserAcrossStores(optimisticPayload);

    try {
      const result = await toggleUserActive(user.id, newStatus);
      if (result.success) {
        success(`User ${newStatus ? "enabled" : "disabled"} successfully!`);
        const resolvedUser = result.user || optimisticPayload;
        upsertSystemUserAcrossStores(resolvedUser);
      } else {
        if (previousSystemUser) {
          upsertSystemUserAcrossStores(previousSystemUser);
        }

        notifyError(result.error || "Error toggling user status");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);

      if (previousSystemUser) {
        upsertSystemUserAcrossStores(previousSystemUser);
      }

      notifyError(error.message || "Error toggling user status");
    } finally {
      setIsTogglingActive(false);
    }
  };

  // Loading states for CRUD operations
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState({});
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [adminFormTouched, setAdminFormTouched] = useState({});

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

  const normalizedSystemUsers = useMemo(() => {
    if (!Array.isArray(localSystemUsers)) {
      return [];
    }

    return localSystemUsers.map((user) => {
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
      };
    });
  }, [localSystemUsers]);

  // Filter admins from system users - use role names for proper filtering
  // Includes: super_admin, system_admin, admin, doctor, nurse, midwife
  const ADMIN_ROLE_NAMES = ['super_admin', 'system_admin', 'admin', 'doctor', 'nurse', 'midwife'];
  const admins = normalizedSystemUsers.filter(
    (user) => ADMIN_ROLE_NAMES.includes((user.role_name || '').toLowerCase())
  );
  const normalizedGuardians = useMemo(() => {
    if (!Array.isArray(localGuardians)) {
      return [];
    }

    return localGuardians.map((guardian) => {
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
  }, [localGuardians]);

  // Filter, sort, and paginate admins
  const filteredAdmins = useMemo(() => {
    let result = [...admins];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.username?.toLowerCase().includes(query) ||
          user.role_name?.toLowerCase().includes(query) ||
          user.clinic_name?.toLowerCase().includes(query) ||
          user.contact?.toLowerCase().includes(query),
      );
    }

    // Apply role filter - use role names for filtering
    if (roleFilter) {
      const roleFilterNum = parseInt(roleFilter);
      // Map role IDs to role names for filtering
      const roleIdToName = {
        1: 'super_admin',
        2: 'admin',
        3: 'system_admin',
        4: 'doctor',
        5: 'nurse',
        6: 'midwife'
      };
      const roleName = roleIdToName[roleFilterNum];
      if (roleName) {
        result = result.filter((user) =>
          (user.role_name || '').toLowerCase() === roleName.toLowerCase()
        );
      }
    }

    // Apply status filter
    if (statusFilter) {
      const isActive = statusFilter === "active";
      result = result.filter((user) => user.is_active === isActive);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle dates
      if (sortField === "created_at") {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }

      // Handle null/undefined
      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [admins, searchQuery, roleFilter, statusFilter, sortField, sortDirection]);

  // Paginate filtered admins
  const paginatedAdmins = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAdmins.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAdmins, currentPage]);

  const totalAdminPages = Math.ceil(filteredAdmins.length / itemsPerPage);

  // Tab change handler - preserves tab state
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const handleAddUser = useCallback((userType) => {
    setEditingUser(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      relationship: "",
      address: "",
      // Infant fields
      infant_first_name: "",
      infant_last_name: "",
      infant_dob: "",
      infant_sex: "",
      infant_national_id: "",
      infant_address: "",
      infant_contact: "",
      // System user fields
      username: "",
      role_id: "",
      clinic_id: "",
      contact: "",
      password: "",
    });
    setShowModal(true);
  }, []);

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
      const guardianRecord =
        localGuardians.find((guardian) => isSameEntityId(guardian?.id, user?.id)) ||
        user ||
        {};

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
    setShowModal(true);
  }, [localGuardians]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const shouldHandleGuardianMutation =
        activeTab === "guardians" ||
        (activeTab === "system" && editingUser?.user_type === "guardian");

      if (shouldHandleGuardianMutation) {
        const guardianData = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          relationship: formData.relationship,
        };

        if (editingUser) {
          const optimisticPreviousGuardian = localGuardians.find((guardian) =>
            isSameEntityId(guardian?.id, editingUser.id),
          );

          const optimisticGuardian = {
            ...(optimisticPreviousGuardian || editingUser || {}),
            ...guardianData,
            id: editingUser.id,
            updated_at: new Date().toISOString(),
          };

          upsertGuardianAcrossStores(optimisticGuardian);

          const result = await userService.updateGuardian(editingUser.id, guardianData, {
            expected_updated_at:
              toComparableTimestamp(editingUser?.updated_at) ||
              toComparableTimestamp(optimisticPreviousGuardian?.updated_at),
          });

          if (!result.success) {
            if (optimisticPreviousGuardian) {
              upsertGuardianAcrossStores(optimisticPreviousGuardian);
            }

            if (result.status === 409 && result.details?.code === "CONFLICT_STALE_WRITE") {
              const latestServerRecord = result.details?.current;

              if (latestServerRecord) {
                upsertGuardianAcrossStores(latestServerRecord);
              }

              warning(
                result.details?.message ||
                  "This guardian record was updated elsewhere. Latest server data has been loaded. Please review and retry.",
              );
              return;
            }

            throw new Error(result.error || "Failed to update guardian");
          }

          if (result.data) {
            upsertGuardianAcrossStores(result.data);
          }

          success("Guardian updated successfully!");
        } else {
          const tempGuardianId = `temp-guardian-${Date.now()}`;
          const optimisticGuardian = {
            ...guardianData,
            id: tempGuardianId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
            is_password_set: false,
          };

          upsertGuardianAcrossStores(optimisticGuardian, { prependOnInsert: true });

          const result = await userService.createGuardian(guardianData);
          if (!result.success) {
            removeGuardianAcrossStores(tempGuardianId);
            throw new Error(result.error || "Failed to create guardian");
          }

          removeGuardianAcrossStores(tempGuardianId);

          const guardian = result.data;

          if (guardian) {
            upsertGuardianAcrossStores(guardian, { prependOnInsert: true });
          }

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
        }
      } else if (
        (activeTab === "system" || activeTab === "admins") &&
        isAdmin
      ) {
        const userData = {
          username: formData.username,
          role_id: parseInt(formData.role_id),
          clinic_id: parseInt(formData.clinic_id),
          contact: formData.contact,
          ...(formData.password && { password: formData.password }),
        };

        if (editingUser) {
          const previousSystemUser = localSystemUsers.find((user) =>
            isSameEntityId(user?.id, editingUser.id),
          );

          const optimisticSystemUser = {
            ...(previousSystemUser || editingUser || {}),
            ...userData,
            id: editingUser.id,
            updated_at: new Date().toISOString(),
          };

          upsertSystemUserAcrossStores(optimisticSystemUser);

          const updateResult = await updateUser(editingUser.id, userData);

          if (!updateResult.success) {
            if (previousSystemUser) {
              upsertSystemUserAcrossStores(previousSystemUser);
            }
            throw new Error(updateResult.error || "Failed to update user");
          }

          if (updateResult.user) {
            upsertSystemUserAcrossStores(updateResult.user);
          }

          success("User updated successfully!");
        } else {
          const tempSystemUserId = `temp-system-${Date.now()}`;
          const optimisticSystemUser = {
            ...userData,
            id: tempSystemUserId,
            role_name: "system",
            display_name: "System User",
            user_type: "system",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
          };

          upsertSystemUserAcrossStores(optimisticSystemUser, {
            prependOnInsert: true,
          });

          const createResult = await createUser(userData);

          if (!createResult.success) {
            removeSystemUserAcrossStores(tempSystemUserId);
            throw new Error(createResult.error || "Failed to create user");
          }

          removeSystemUserAcrossStores(tempSystemUserId);

          if (createResult.user) {
            upsertSystemUserAcrossStores(createResult.user, {
              prependOnInsert: true,
            });
          }

          success("User created successfully!");
        }
      }

      setShowModal(false);
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
        const previousSystemUser = localSystemUsers.find((item) =>
          isSameEntityId(item?.id, user.id),
        );

        removeSystemUserAcrossStores(user.id);

        const deleteResult = await deleteUser(user.id);

        if (!deleteResult.success) {
          if (previousSystemUser) {
            upsertSystemUserAcrossStores(previousSystemUser);
          }

          throw new Error(deleteResult.error || "Failed to delete user");
        }

        success("User deleted successfully!");
      } else {
        const previousGuardian = localGuardians.find((item) =>
          isSameEntityId(item?.id, user.id),
        );

        removeGuardianAcrossStores(user.id);

        const result = await userService.deleteGuardian(user.id, {
          expected_updated_at: toComparableTimestamp(user?.updated_at),
        });

        if (!result.success) {
          if (previousGuardian) {
            upsertGuardianAcrossStores(previousGuardian);
          }

          if (result.status === 409 && result.details?.code === "CONFLICT_STALE_WRITE") {
            const latestServerRecord = result.details?.current;
            if (latestServerRecord) {
              upsertGuardianAcrossStores(latestServerRecord);
            }

            warning(
              result.details?.message ||
                "This guardian record changed remotely before deletion. Latest data has been restored.",
            );
            return;
          }

          throw new Error(result.error || "Failed to delete guardian");
        }
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

    if (passwordFormData.password !== passwordFormData.confirmPassword) {
      warning("Passwords do not match");
      return;
    }

    if (passwordFormData.password.length < 6) {
      warning("Password must be at least 6 characters long");
      return;
    }

    const userType =
      activeTab === "guardians" ||
      selectedUserForPassword?.user_type === "guardian"
        ? "guardian"
        : "system";

    setIsResettingPassword(true);

    try {
      const result = await resetUserPassword(
        selectedUserForPassword.id,
        passwordFormData.password,
        userType,
      );
      if (result.success) {
        success("Password reset successfully!");
        setShowPasswordModal(false);
        setPasswordFormData({ password: "", confirmPassword: "" });
        setSelectedUserForPassword(null);
        // Tab state is preserved - no navigation
      } else {
        notifyError(result.error || "Error resetting password");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      notifyError(error.message || "Error resetting password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData({
        ...formData,
        [name]: value,
      });
      // Clear error when user starts typing
      if (formErrors[name]) {
        setFormErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [formData, formErrors],
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
      if (name === "clinic_id") {
        if (!value) return "Please select a clinic";
      }
    }
    return null;
  }, [activeTab]);

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
      setAdminFormData({
        ...adminFormData,
        [name]: value,
      });
      // Clear error when user starts typing
      if (adminFormErrors[name]) {
        setAdminFormErrors((prev) => ({ ...prev, [name]: null }));
      }
    },
    [adminFormData, adminFormErrors],
  );

  // Handle blur for admin form real-time validation
  const handleAdminBlur = useCallback((e) => {
    const { name, value } = e.target;
    setAdminFormTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateAdminField(name, value);
    if (error) {
      setAdminFormErrors((prev) => ({ ...prev, [name]: error }));
    }
  }, []);

  // Validate admin form field
  const validateAdminField = (name, value) => {
    if (name === "username") {
      if (!value || value.trim() === "") return "Username is required";
      if (value.trim().length < 3) return "Must be at least 3 characters";
    }
    if (name === "role_id") {
      if (!value) return "Please select a role";
    }
    if (name === "clinic_id") {
      if (!value) return "Please select a clinic";
    }
    if (name === "password") {
      if (!value) return "Password is required";
      if (value.length < 6) return "Must be at least 6 characters";
    }
    return null;
  };

  const handleAddAdmin = useCallback(() => {
    setAdminFormData({
      username: "",
      email: "",
      contact: "",
      role_id: "",
      clinic_id: "",
      password: "",
      confirmPassword: "",
    });
    setShowAddAdminModal(true);
  }, []);

  const handleSubmitAdmin = async (e) => {
    e.preventDefault();

    if (adminFormData.password !== adminFormData.confirmPassword) {
      warning("Passwords do not match");
      return;
    }

    if (adminFormData.password.length < 6) {
      warning("Password must be at least 6 characters long");
      return;
    }

    setIsSubmitting(true);

    try {
      const userData = {
        username: adminFormData.username,
        role_id: parseInt(adminFormData.role_id),
        clinic_id: parseInt(adminFormData.clinic_id),
        contact: adminFormData.contact,
        password: adminFormData.password,
      };

      const tempAdminId = `temp-admin-${Date.now()}`;
      const optimisticAdmin = {
        ...userData,
        id: tempAdminId,
        role_name: "admin",
        display_name: "Admin",
        user_type: "system",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
      };

      upsertSystemUserAcrossStores(optimisticAdmin, { prependOnInsert: true });

      const result = await createUser(userData);
      if (result.success) {
        removeSystemUserAcrossStores(tempAdminId);

        if (result.user) {
          upsertSystemUserAcrossStores(result.user, { prependOnInsert: true });
        }

        success("Admin account created successfully!");
        setShowAddAdminModal(false);
      } else {
        removeSystemUserAcrossStores(tempAdminId);
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
        <Badge variant={row.role_id === 1 ? "danger" : "warning"}>
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
        title={row.is_active ? "Disable User" : "Enable User"}
        disabled={isTogglingActive}
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
        onClick={() => {
          setSelectedUserForPassword(row);
          setShowPasswordModal(true);
        }}
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
      {isSuperAdmin && (
        <LoadingButton
          variant="danger"
          size="xs"
          onClick={() => handleDeleteUser(row, "admin")}
          loading={isDeleting}
          className="p-1.5"
          title="Delete User"
          aria-label="Delete user"
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
        onClick={() => {
          setSelectedUserForPassword(row);
          setShowPasswordModal(true);
        }}
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

  if (guardiansLoading || systemUsersLoading) {
    return (
      <div className="space-y-8 p-6">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-8" />
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <SkeletonTable rows={10} columns={5} />
      </div>
    );
  }

  if (guardiansError || systemUsersError) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading users">
          {guardiansError || systemUsersError}
          <div className="mt-4">
            <Button
              onClick={() => {
                refreshGuardians();
                refreshSystemUsers();
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
            {activeTab === "admins" && isSuperAdmin && (
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
            {activeTab === "system" && isAdmin && (
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
            {activeTab === "guardians" && (
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

      {/* Tab Navigation - Sticky at top */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            <button
            onClick={() => handleTabChange("system")}
            className={`py-4 px-1 border-b-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "system"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <span className="text-lg">🛡️</span>
            System Users (
            {normalizedSystemUsers ? normalizedSystemUsers.length : 0})
          </button>
            <button
            onClick={() => handleTabChange("admins")}
            className={`py-4 px-1 border-b-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "admins"
                ? "border-danger-500 text-danger-600 dark:text-danger-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Admins ({admins.length})
          </button>

          <button
            onClick={() => handleTabChange("guardians")}
            className={`py-4 px-1 border-b-2 font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "guardians"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            <span className="text-lg">👥</span>
            Guardians ({normalizedGuardians.length})
          </button>
          </nav>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 min-h-0 flex flex-col animate-fade-in">
        {activeTab === "admins" ? (
          isAdmin ? (
            admins.length === 0 ? (
              <EmptyState
                title="No admin accounts found"
                description="There are no administrator accounts configured. Super admins can create new admin accounts."
                icon="🛡️"
                actionLabel={isSuperAdmin ? "Add New Admin" : null}
                onAction={isSuperAdmin ? handleAddAdmin : null}
                className="py-20"
              />
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                {/* Filter and Search Controls */}
                <div className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-wrap gap-4 items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search admins..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800"
                    />
                  </div>
                  <Select
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: "", label: "All Roles" },
                      { value: "1", label: "Super Admin" },
                      { value: "2", label: "Admin" },
                      { value: "3", label: "System Admin" },
                      { value: "4", label: "Doctor" },
                      { value: "5", label: "Nurse" },
                      { value: "6", label: "Midwife" },
                    ]}
                    className="w-40"
                  />
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    options={[
                      { value: "", label: "All Status" },
                      { value: "active", label: "Active" },
                      { value: "disabled", label: "Disabled" },
                    ]}
                    className="w-40"
                  />
                </div>

                {/* Admin Table */}
                <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex-1 overflow-auto auto-hide-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 relative">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
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
                          filteredAdmins.length,
                        )}{" "}
                        of {filteredAdmins.length} admins
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
            normalizedSystemUsers && normalizedSystemUsers.length > 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto auto-hide-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <SystemUsersTable
                users={normalizedSystemUsers}
                isTogglingActive={isTogglingActive}
                isResettingPassword={isResettingPassword}
                isDeleting={isDeleting}
                onToggleActive={handleToggleUserActive}
                onResetPassword={(row) => {
                  setSelectedUserForPassword(row);
                  setShowPasswordModal(true);
                }}
                onEdit={(row) => handleEditUser(row, "system")}
                onDelete={(row) => handleDeleteUser(row, "system")}
                currentUserId={currentUserId}
              />
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
        ) : normalizedGuardians.length === 0 ? (
          <EmptyState
            title="No guardians registered"
            description="There are no guardians registered in the system yet. Start by adding a new guardian."
            icon="👥"
            actionLabel="Add New Guardian"
            onAction={() => handleAddUser("guardians")}
            className="py-20"
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto auto-hide-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <DataTable
              data={normalizedGuardians}
              columns={guardianColumns}
              actions={guardianActions}
              getRowKey={(row) => `guardian:${String(row?.id)}`}
              actionsHeaderClassName="w-[100px] min-w-[100px]"
              actionsCellClassName="w-[100px] min-w-[100px]"
              emptyMessage="No guardians registered yet."
              emptyIcon={<span className="text-4xl">👥</span>}
            />
          </div>
        )}
      </div>
      </div>

      {/* User Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
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
              onClick={() => setShowModal(false)}
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
                          ...roles.map((role) => ({
                            value: role.id.toString(),
                            label: role.display_name || role.name,
                          })),
                        ]}
                      />
                    </div>
                    <div className="admin-field-group">
                      <Select
                        label="Clinic"
                        name="clinic_id"
                        value={formData.clinic_id}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={formTouched.clinic_id ? formErrors.clinic_id : undefined}
                        required
                        options={[
                          { value: "", label: "Select a clinic" },
                          ...clinics.map((clinic) => ({
                            value: clinic.id.toString(),
                            label: clinic.name,
                          })),
                        ]}
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
        onClose={() => setShowPasswordModal(false)}
        title={`Reset Password`}
        size="md"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => setShowPasswordModal(false)}
              disabled={isResettingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              form="passwordForm"
              disabled={isResettingPassword}
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
          className="admin-form"
        >
          {/* User Info Card */}
          <div className="admin-user-info">
            <div className="admin-user-info-avatar">
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
          >
            <p className="whitespace-normal">
              This will{" "}
              {selectedUserForPassword?.password_hash ? "reset" : "set"} the
              user's password.{" "}
              {selectedUserForPassword?.password_hash
                ? "Make sure to inform the user of their new password."
                : "A temporary password will be generated."}
            </p>
          </Alert>

          {/* Password Fields */}
          <div className="admin-form-card">
            <div className="admin-form-card-body">
              <div className="admin-field-group">
                <PasswordInput
                  label="New Password"
                  name="password"
                  value={passwordFormData.password}
                  onChange={(e) =>
                    setPasswordFormData({
                      ...passwordFormData,
                      password: e.target.value,
                    })
                  }
                  showPasswordAriaLabel="Show reset password"
                  hidePasswordAriaLabel="Hide reset password"
                  required
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="admin-field-group">
                <PasswordInput
                  label="Confirm New Password"
                  name="confirmPassword"
                  value={passwordFormData.confirmPassword}
                  onChange={(e) =>
                    setPasswordFormData({
                      ...passwordFormData,
                      confirmPassword: e.target.value,
                    })
                  }
                  showPasswordAriaLabel="Show reset confirm password"
                  hidePasswordAriaLabel="Hide reset confirm password"
                  required
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Admin Modal */}
      <Modal
        isOpen={showAddAdminModal}
        onClose={() => setShowAddAdminModal(false)}
        title="Create New Admin Account"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              type="button"
              onClick={() => setShowAddAdminModal(false)}
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
                <Select
                  label="Clinic"
                  name="clinic_id"
                  value={adminFormData.clinic_id}
                  onChange={handleAdminChange}
                  onBlur={handleAdminBlur}
                  error={adminFormTouched.clinic_id ? adminFormErrors.clinic_id : undefined}
                  required
                  options={[
                    { value: "", label: "Select a clinic" },
                    ...clinics.map((clinic) => ({
                      value: clinic.id.toString(),
                      label: clinic.name,
                    })),
                  ]}
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
                    placeholder="Enter password (min 6 characters)"
                    minLength={6}
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
