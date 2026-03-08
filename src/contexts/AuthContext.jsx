import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import apiClient from "../utils/api";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";
import { normalizeAuthUser } from "../utils/authRedirect";

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
        // Use safe storage access to prevent SecurityError
        const token =
          safeLocalStorage.getItem("token") ||
          safeSessionStorage.getItem("token");
        const storedUser =
          safeLocalStorage.getItem("user") ||
          safeSessionStorage.getItem("user");

        if (token && storedUser) {
          const parsedUser = normalizeAuthUser(JSON.parse(storedUser));

          // Verify session with backend to get fresh user data with correct role_type
          try {
            const verifyResponse = await apiClient.verifySession();
            if (verifyResponse.authenticated && verifyResponse.user) {
              // Use the verified user data from backend (has correct role_type)
              const verifiedUser = normalizeAuthUser(verifyResponse.user);
              if (!mounted) return;
              setUser(verifiedUser);

              // Update stored user data with verified data
              const storage = safeLocalStorage.getItem("token")
                ? safeLocalStorage
                : safeSessionStorage;
              storage.setItem("user", JSON.stringify(verifiedUser));

              // Check if user needs to change password
              if (
                verifiedUser.role_type === CANONICAL_ROLES.GUARDIAN &&
                verifiedUser.forcePasswordChange
              ) {
                if (!mounted) return;
                setForcePasswordChange(true);
              }
            } else {
              // Session invalid, clear storage
              safeLocalStorage.removeItem("token");
              safeLocalStorage.removeItem("user");
              safeSessionStorage.removeItem("token");
              safeSessionStorage.removeItem("user");
            }
          } catch (verifyError) {
            // If verification fails (e.g., token expired), use stored data as fallback
            // but ensure role_type is used
            console.warn(
              "Session verification failed, using stored data:",
              verifyError.message,
            );
            if (!mounted) return;
            setUser(parsedUser);

            // Check if user needs to change password
            if (
              parsedUser.role_type === CANONICAL_ROLES.GUARDIAN &&
              parsedUser.forcePasswordChange
            ) {
              if (!mounted) return;
              setForcePasswordChange(true);
            }
          }
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        // Clear invalid data
        safeLocalStorage.removeItem("token");
        safeLocalStorage.removeItem("user");
        safeSessionStorage.removeItem("token");
        safeSessionStorage.removeItem("user");
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

      const { token, user: rawUserData } = response;
      const userData = normalizeAuthUser(rawUserData);
      console.log("[AuthContext] Token received:", token ? "yes" : "no");
      console.log("[AuthContext] User data:", userData);

      // Store token and user data using safe storage
      const storage = credentials.rememberMe
        ? safeLocalStorage
        : safeSessionStorage;
      storage.setItem("token", token);
      storage.setItem("user", JSON.stringify(userData));

      // Store rememberMe preference for token refresh logic
      if (credentials.rememberMe) {
        safeLocalStorage.setItem("rememberMe", "true");
      }

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
  const logout = useCallback(() => {
    // Clear all auth data using safe storage
    safeLocalStorage.removeItem("token");
    safeLocalStorage.removeItem("user");
    safeSessionStorage.removeItem("token");
    safeSessionStorage.removeItem("user");
    setUser(null);
    setForcePasswordChange(false);
  }, []);

  // Update user data
  const updateUser = useCallback((updatedUserData) => {
    setUser((prevUser) => {
      const newUser = normalizeAuthUser({ ...prevUser, ...updatedUserData });
      const storage = safeLocalStorage.getItem("user")
        ? safeLocalStorage
        : safeSessionStorage;
      storage.setItem("user", JSON.stringify(newUser));
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

  // Context value
  const value = useMemo(
    () => ({
      user,
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
    }),
    [
      user,
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
