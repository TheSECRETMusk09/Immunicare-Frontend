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
  getStoredAccessToken,
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

// AuthProvider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  // Check if user is authenticated on mount
  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const token = getStoredAccessToken();
        const storedUser = getStoredUserJson();

        if (!token) {
          return;
        }

        if (storedUser) {
          try {
            JSON.parse(storedUser);
          } catch {
            clearAuthStorage();
            return;
          }
        }

        const verifyResponse = await apiClient.verifySession();

        if (verifyResponse.authenticated && verifyResponse.user) {
          const verifiedUser = normalizeAuthUser(verifyResponse.user);
          if (!mounted) return;
          setUser(verifiedUser);
          persistStoredUser(verifiedUser);

          if (
            verifiedUser.role_type === CANONICAL_ROLES.GUARDIAN &&
            verifiedUser.forcePasswordChange
          ) {
            if (!mounted) return;
            setForcePasswordChange(true);
          }
        } else {
          clearAuthStorage();
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        clearAuthStorage();
        if (mounted) {
          setUser(null);
          setForcePasswordChange(false);
        }
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
      console.log("[AuthContext] Starting login for:", credentials.username);

      // Use the apiClient login method which handles the proper endpoint
      const response = await apiClient.login(credentials);
      console.log("[AuthContext] Login response:", response);

      const accessToken = response.accessToken || response.token || null;
      const { user: rawUserData } = response;
      const userData = normalizeAuthUser(rawUserData);
      console.log("[AuthContext] Token received:", accessToken ? "yes" : "no");
      console.log("[AuthContext] User data:", userData);

      if (!accessToken) {
        throw new Error("Login succeeded without an access token");
      }

      persistAuthSession({
        accessToken,
        user: userData,
        rememberMe: credentials.rememberMe,
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
