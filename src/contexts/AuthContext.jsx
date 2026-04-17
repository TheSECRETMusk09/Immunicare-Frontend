import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import apiClient, {
  clearAuthStorage,
  getRememberMePreference,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUserJson,
  persistAuthSession,
  persistStoredUser,
} from "../utils/api";
import { normalizeAuthUser } from "../utils/authRedirect";
import {
  buildPermissionCapabilities,
  hasAnyPermission as checkAnyPermission,
  hasPermission as checkPermission,
  normalizePermissions,
} from "../utils/authPermissions";

// Create the AuthContext
const AuthContext = createContext(null);

const CANONICAL_ROLES = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  GUARDIAN: "GUARDIAN",
};

const HEALTHCARE_WORKER_ALIASES = new Set([
  "clinic_manager",
  "public_health_nurse",
  "inventory_manager",
  "physician",
  "doctor",
  "health_worker",
  "healthcare_worker",
  "nurse",
  "midwife",
  "nutritionist",
  "dentist",
  "staff",
]);

let authBootstrapPromise = null;
let authBootstrapResult = null;

const readStoredAuthUser = () => {
  const storedUser = getStoredUserJson();
  if (!storedUser) {
    return {
      user: null,
      invalid: false,
    };
  }

  try {
    return {
      user: normalizeAuthUser(JSON.parse(storedUser)),
      invalid: false,
    };
  } catch {
    return {
      user: null,
      invalid: true,
    };
  }
};

const isTerminalAuthFailure = (error) => {
  const status = error?.status || error?.response?.status || null;
  const code =
    error?.code ||
    error?.data?.code ||
    error?.response?.data?.code ||
    null;

  return (
    status === 401 ||
    status === 403 ||
    code === "SESSION_EXPIRED" ||
    code === "NO_TOKEN" ||
    code === "TOKEN_EXPIRED" ||
    code === "INVALID_TOKEN" ||
    code === "NO_REFRESH_TOKEN" ||
    code === "USER_NOT_FOUND"
  );
};

const resetAuthBootstrapCache = () => {
  authBootstrapPromise = null;
  authBootstrapResult = null;
};

const resolveInitialAuthState = async () => {
  if (authBootstrapResult) {
    return authBootstrapResult;
  }

  if (!authBootstrapPromise) {
    authBootstrapPromise = (async () => {
      const token = getStoredAccessToken();
      const refreshToken = getStoredRefreshToken();
      const { user: hydratedUser, invalid } = readStoredAuthUser();

      if (!token && !refreshToken && !hydratedUser && !invalid) {
        return {
          user: null,
          forcePasswordChange: false,
        };
      }

      try {
        const verifyResponse = await apiClient.verifySession();

        if (verifyResponse.authenticated && verifyResponse.user) {
          const verifiedUser = normalizeAuthUser(verifyResponse.user);
          persistStoredUser(verifiedUser);

          return {
            user: verifiedUser,
            forcePasswordChange: Boolean(verifiedUser.forcePasswordChange),
          };
        }

        if (token || hydratedUser || invalid) {
          clearAuthStorage();
        }

        return {
          user: null,
          forcePasswordChange: false,
        };
      } catch (error) {
        if (isTerminalAuthFailure(error)) {
          try {
            const refreshResponse = await apiClient.refreshSession();
            const refreshedUser = normalizeAuthUser(
              refreshResponse?.user || refreshResponse?.data?.user || null,
            );
            const accessToken =
              refreshResponse?.accessToken ||
              refreshResponse?.token ||
              refreshResponse?.data?.accessToken ||
              refreshResponse?.data?.token ||
              null;
            const refreshToken =
              refreshResponse?.refreshToken ||
              refreshResponse?.data?.refreshToken ||
              null;

            if (accessToken && refreshedUser?.id) {
              persistAuthSession({
                accessToken,
                refreshToken,
                user: refreshedUser,
                rememberMe:
                  refreshedUser.role_type === CANONICAL_ROLES.SYSTEM_ADMIN
                    ? true
                    : getRememberMePreference(),
              });
              persistStoredUser(refreshedUser);

              return {
                user: refreshedUser,
                forcePasswordChange: Boolean(refreshedUser.forcePasswordChange),
              };
            }
          } catch (refreshError) {
            if (!isTerminalAuthFailure(refreshError)) {
              const { user: refreshedStoredUser } = readStoredAuthUser();
              console.warn(
                "Auth refresh unavailable during reload, preserving stored session:",
                refreshError?.message || refreshError,
              );

              return {
                user: refreshedStoredUser || null,
                forcePasswordChange: Boolean(
                  refreshedStoredUser?.forcePasswordChange,
                ),
              };
            }
          }

          clearAuthStorage();
          return {
            user: null,
            forcePasswordChange: false,
          };
        }

        console.warn(
          "Auth verification unavailable, preserving stored session:",
          error?.message || error,
        );

        return {
          user: hydratedUser || null,
          forcePasswordChange: Boolean(hydratedUser?.forcePasswordChange),
        };
      }
    })()
      .then((result) => {
        authBootstrapResult = result;
        return result;
      })
      .finally(() => {
        authBootstrapPromise = null;
      });
  }

  return authBootstrapPromise;
};

export const __resetAuthBootstrapCacheForTests = () => {
  resetAuthBootstrapCache();
};

// AuthProvider component
export function AuthProvider({ children }) {
  const initialStoredAuthState = useMemo(() => readStoredAuthUser(), []);
  const [user, setUser] = useState(initialStoredAuthState.user);
  const [loading, setLoading] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(() =>
    Boolean(initialStoredAuthState.user?.forcePasswordChange),
  );

  // Check if user is authenticated on mount
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { user: hydratedUser, invalid } = readStoredAuthUser();

        if (invalid) {
          if (mounted) {
            setUser(null);
            setForcePasswordChange(false);
          }
        }

        if (hydratedUser && mounted) {
          setUser(hydratedUser);
          setForcePasswordChange(Boolean(hydratedUser.forcePasswordChange));
        }

        const resolvedAuthState = await resolveInitialAuthState();

        if (!mounted) {
          return;
        }

        setUser(resolvedAuthState.user || null);
        setForcePasswordChange(Boolean(resolvedAuthState.forcePasswordChange));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // Login function
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      resetAuthBootstrapCache();
      console.log("[AuthContext] Starting login for:", credentials.username);

      // Use the apiClient login method which handles the proper endpoint
      const response = await apiClient.login(credentials);
      console.log("[AuthContext] Login response:", response);

      const accessToken = response.accessToken || response.token || null;
      const refreshToken = response.refreshToken || null;
      const { user: rawUserData } = response;
      const userData = normalizeAuthUser(rawUserData);
      console.log("[AuthContext] Token received:", accessToken ? "yes" : "no");
      console.log("[AuthContext] User data:", userData);

      if (!accessToken) {
        throw new Error("Login succeeded without an access token");
      }

      persistAuthSession({
        accessToken,
        refreshToken,
        user: userData,
        rememberMe:
          userData.role_type === CANONICAL_ROLES.SYSTEM_ADMIN
            ? true
            : credentials.rememberMe,
      });

      setUser(userData);
      console.log("[AuthContext] User set, isAuthenticated should be true");

      // Check if password change is required
      if (
        userData.role_type === CANONICAL_ROLES.GUARDIAN &&
        userData.forcePasswordChange
      ) {
        setForcePasswordChange(true);
      }

      return { success: true, user: userData };
    } catch (error) {
      console.error("[AuthContext] Login error:", error);
      const errorMessage = error.message || "Login failed";
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.warn("Logout request failed, clearing local auth state anyway:", error.message);
    } finally {
      resetAuthBootstrapCache();
      clearAuthStorage();
      setUser(null);
      setForcePasswordChange(false);
    }
  }, []);

  // Update user data
  const updateUser = useCallback((updatedUserData) => {
    setUser((prevUser) => {
      const newUser = normalizeAuthUser({ ...prevUser, ...updatedUserData });
      persistStoredUser(newUser);
      return newUser;
    });
  }, []);

  // Update password status
  const updateUserPasswordStatus = useCallback(
    (needsChange) => {
      setForcePasswordChange(needsChange);
      if (!needsChange) {
        updateUser({ forcePasswordChange: false });
      }
    },
    [updateUser],
  );

  // Check if user has specific role
  const hasRole = useCallback(
    (role) => {
      return user?.role_type === role || user?.role === role;
    },
    [user],
  );

  // Computed properties - use role_type from backend response
  const normalizedRoleType = user?.role_type || null;
  const normalizedLegacyRole = String(user?.legacy_role || "").toLowerCase();

  const isAuthenticated = !!user && !!user.id;
  const isAdmin = normalizedRoleType === CANONICAL_ROLES.SYSTEM_ADMIN;
  const isGuardian = normalizedRoleType === CANONICAL_ROLES.GUARDIAN;
  const isSuperAdmin = normalizedLegacyRole === "super_admin";
  const isRoleAdmin = normalizedLegacyRole === "admin";
  const isAdminOrSuperAdmin = isSuperAdmin || isRoleAdmin;
  const isHealthcareWorker =
    normalizedRoleType === CANONICAL_ROLES.SYSTEM_ADMIN ||
    HEALTHCARE_WORKER_ALIASES.has(normalizedLegacyRole);
  const guardianId = user?.guardian_id || user?.id;
  const permissions = useMemo(() => normalizePermissions(user?.permissions), [user]);
  const permissionCapabilities = useMemo(
    () => buildPermissionCapabilities(permissions),
    [permissions],
  );
  const hasPermission = useCallback(
    (permission) => checkPermission(permissions, permission),
    [permissions],
  );
  const hasAnyPermission = useCallback(
    (requiredPermissions) => checkAnyPermission(permissions, requiredPermissions),
    [permissions],
  );

  // Context value
  const value = useMemo(
    () => ({
      user,
      permissions,
      permissionCapabilities,
      loading,
      isAuthenticated,
      isAdmin,
      isGuardian,
      isSuperAdmin,
      isAdminOrSuperAdmin,
      isHealthcareWorker,
      guardianId,
      forcePasswordChange,
      login,
      logout,
      updateUser,
      updateUserPasswordStatus,
      hasRole,
      hasPermission,
      hasAnyPermission,
    }),
    [
      user,
      permissions,
      permissionCapabilities,
      loading,
      isAuthenticated,
      isAdmin,
      isGuardian,
      isSuperAdmin,
      isAdminOrSuperAdmin,
      isHealthcareWorker,
      guardianId,
      forcePasswordChange,
      login,
      logout,
      updateUser,
      updateUserPasswordStatus,
      hasRole,
      hasPermission,
      hasAnyPermission,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Export both the provider and hook
export default AuthContext;
