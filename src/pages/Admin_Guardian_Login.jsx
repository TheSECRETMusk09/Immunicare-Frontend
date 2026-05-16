 import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  getDefaultAuthenticatedRouteFromUser,
  normalizeAuthUser,
  resolveRoleType,
} from "../utils/authRedirect";
import {
  Mail,
  User,
  WifiOff,
} from "lucide-react";
import { Button, TextInput, PasswordInput, Alert } from "../components/UI";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent, identifyUser } from "../utils/telemetry";

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isSmallScreen = window.innerWidth < breakpoint;
      setIsMobile(isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
};

const BrandingPanel = ({ currentRole, onSwitch, isMobile }) => {
  const isGuardianMode = currentRole === "guardian";

  return (
    <div
      className="w-full h-full bg-cover bg-center flex flex-col justify-between py-8 px-8 text-white relative"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(79, 70, 229, 0.85), rgba(91, 63, 211, 0.85), rgba(75, 20, 139, 0.9)), url('/nurse-holding-baby.png')`,
        backgroundColor: "#4F46E5",
      }}
    >
      <div className="max-w-md mx-auto text-center relative z-10">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/95 border-4 border-white/30 flex items-center justify-center shadow-xl">
            <span className="text-[#4F46E5] font-bold text-2xl">+</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-wide">
            IMMUNICARE
          </h1>
          <p className="text-white/80 mb-5 text-sm italic">
            Infant Vaccination & Inventory
          </p>
        </div>

        <div className="h-1.5 w-14 bg-red-400 rounded-full mb-5 mx-auto"></div>

        <h2 className="text-xl font-semibold mb-3">
          {isGuardianMode ? "Guardian Portal" : "Admin Portal"}
        </h2>

        <p className="text-white/85 mb-4 text-center text-sm leading-relaxed">
          {isGuardianMode
            ? "Track vaccination schedules, manage appointments, and receive timely reminders for your child."
            : "Monitor operations, manage inventory, and oversee immunization workflows with secure access."}
        </p>
      </div>

      {!isMobile && (
        <div className="text-center relative z-10">
          <button
            type="button"
            onClick={onSwitch}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-[#4F46E5] hover:text-[#4B148B] font-semibold transition-all duration-200 shadow-md hover:shadow-xl"
          >
            {isGuardianMode ? "Switch to Admin Portal" : "Back to Guardian Login"}
          </button>
        </div>
      )}
    </div>
  );
};

const GuardianLoginForm = ({
  formData,
  errors,
  serverError,
  loading,
  handleChange,
  onSubmit,
}) => {
  return (
    <div className="w-full h-full bg-[#4F46E5] flex flex-col justify-center text-white rounded-r-3xl">
      <div className="max-w-md mx-auto px-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-lg">
            <User size={32} className="text-[#4F46E5]" />
          </div>
          <h2 className="text-xl font-bold mb-1">Guardian Login</h2>
          <p className="text-white/80 mb-6 text-sm">
            Access your infant's vaccination records
          </p>
        </div>

        {serverError && (
          <Alert variant="error" className="mb-4 animate-shake">
            {serverError}
          </Alert>
        )}

        <form onSubmit={(e) => onSubmit(e, "guardian")} className="space-y-4">
          <div className="login-input-container">
            <TextInput
              name="guardian_id"
              placeholder="Email, Username, or Guardian ID"
              value={formData.guardian_id}
              onChange={handleChange}
              error={errors.guardian_id}
              icon={Mail}
              theme="guardian"
              className="w-full bg-white rounded-lg py-3 pl-10 pr-3 text-gray-900 border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/50 login-input"
            />
          </div>

          <div className="login-input-container">
            <PasswordInput
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              showPasswordAriaLabel="Show guardian password"
              hidePasswordAriaLabel="Hide guardian password"
              theme="guardian"
              className="w-full bg-white rounded-lg py-3 pl-10 pr-3 text-gray-900 border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/50 login-input"
            />
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-red-400 hover:text-red-300 font-bold transition-colors login-forgot-password"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            variant="primary"
            className="w-full py-3 rounded-lg text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Sign in
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-white font-bold hover:underline login-register-link"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const AdminLoginForm = ({
  formData,
  errors,
  serverError,
  loading,
  handleChange,
  onSubmit,
}) => {
  return (
    <div className="w-full h-full bg-[#4B148B] flex flex-col justify-center text-white rounded-l-3xl">
      <div className="max-w-md mx-auto px-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-lg">
            <User size={32} className="text-[#4B148B]" />
          </div>
          <h2 className="text-xl font-bold mb-1">Admin Login</h2>
          <p className="text-white/80 mb-6 text-sm">
            Health Center Management Portal
          </p>
        </div>

        {serverError && (
          <Alert variant="error" className="mb-4 animate-shake">
            {serverError}
          </Alert>
        )}

        <form onSubmit={(e) => onSubmit(e, "admin")} className="space-y-4">
          <div className="login-input-container">
            <TextInput
              name="admin_user"
              placeholder="Username"
              value={formData.admin_user}
              onChange={handleChange}
              error={errors.admin_user}
              icon={User}
              theme="admin"
              className="w-full bg-white rounded-lg py-3 pl-10 pr-3 text-gray-900 border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/50 login-input"
            />
          </div>

          <div className="login-input-container">
            <PasswordInput
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              showPasswordAriaLabel="Show admin password"
              hidePasswordAriaLabel="Hide admin password"
              theme="admin"
              className="w-full bg-white rounded-lg py-3 pl-10 pr-3 text-gray-900 border border-white/30 shadow-sm focus:border-white focus:ring-2 focus:ring-white/50 login-input"
            />
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-blue-300 hover:text-blue-200 font-bold transition-colors login-forgot-password"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            loading={loading}
            variant="primary"
            className="w-full py-3 rounded-lg text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            System Login
          </Button>
        </form>
      </div>
    </div>
  );
};

const formMotionVariants = {
  initial: (xDirection) => ({ opacity: 0, x: xDirection, scale: 0.985 }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.28, ease: "easeOut" },
  },
  exit: (xDirection) => ({
    opacity: 0,
    x: xDirection * -0.8,
    scale: 0.985,
    transition: { duration: 0.22, ease: "easeIn" },
  }),
};

const panelSpringTransition = {
  type: "spring",
  stiffness: 140,
  damping: 22,
  mass: 0.9,
};

const AdminGuardianLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isMobile = useIsMobile(768);

  const [role, setRole] = useState("guardian");

  const [formData, setFormData] = useState({
    guardian_id: "",
    admin_user: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const { login, isAuthenticated, user } = useAuth();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    if (isMobile) {
      setRole("guardian");
      if (location.pathname.includes("admin")) {
        navigate("/", { replace: true });
      }
    } else if (location.pathname.includes("admin")) {
      setRole("admin");
    } else {
      setRole("guardian");
    }
  }, [location.pathname, isMobile, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      const storedUser = JSON.parse(
        localStorage.getItem("user") || sessionStorage.getItem("user") || "{}",
      );
      const userData = normalizeAuthUser(user || storedUser);
        const isGuardian = resolveRoleType(userData.role) === "GUARDIAN";

        if (isGuardian && userData.has_completed_onboarding === false) {
          navigate('/guardian/introduction', { replace: true });
        } else {
          navigate(getDefaultAuthenticatedRouteFromUser(userData), { replace: true });
        }
    }
  }, [isAuthenticated, navigate, user]);

  useEffect(() => {
    if (serverError) {
      const timer = setTimeout(() => setServerError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [serverError]);

  const validateField = (name, value) => {
    if (!value || value.trim() === "") return "This field is required";

    if (name === "guardian_id") {
      const trimmed = value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const guardianIdRegex = /^GD-\d{4,}$/;
      const usernameRegex = /^[A-Za-z0-9._-]{3,}$/;

      if (
        !emailRegex.test(trimmed) &&
        !guardianIdRegex.test(trimmed) &&
        !usernameRegex.test(trimmed)
      ) {
        return "Enter a valid email, username, or Guardian ID (GD-XXXX)";
      }
    }
    return null;
  };

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => {
      if (prev[name]) {
        return { ...prev, [name]: null };
      }
      return prev;
    });
  }, []);

  const handleRoleChange = (newRole) => {
    setRole(newRole);

    const targetUrl = newRole === "admin" ? "/admin/login" : "/guardian/login";
    navigate(targetUrl, { replace: true });

    setFormData({
      guardian_id: "",
      admin_user: "",
      password: "",
      rememberMe: false,
    });
    setErrors({});
    setServerError(null);
  };

  const handleSubmit = async (e, loginType) => {
    e.preventDefault();

    const fields =
      loginType === "admin"
        ? ["admin_user", "password"]
        : ["guardian_id", "password"];

    const newErrors = {};
    fields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isOnline) {
      setServerError("You are currently offline.");
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      const credentials =
        loginType === "admin"
          ? {
              username: formData.admin_user.trim(),
              password: formData.password,
              rememberMe: formData.rememberMe,
              expectedRole: resolveRoleType("SYSTEM_ADMIN"),
            }
          : {
              username: formData.guardian_id.trim(),
              password: formData.password,
              rememberMe: formData.rememberMe,
              expectedRole: resolveRoleType("GUARDIAN"),
            };

      const result = await login(credentials);
      if (!result.success) {
        setServerError(result.error || "Login failed.");
      } else {
        const userData = normalizeAuthUser(result.user);
        identifyUser(userData.id, { role: userData.role });
        trackEvent("login_success", { role: userData.role, loginType });

        const isGuardian = resolveRoleType(userData.role) === "GUARDIAN";
        if (isGuardian && userData.has_completed_onboarding === false) {
          trackEvent("intro_started");
          navigate('/guardian/introduction', { replace: true });
        } else {
          navigate(getDefaultAuthenticatedRouteFromUser(userData), { replace: true });
        }
      }
    } catch {
      setServerError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
          <WifiOff className="mx-auto mb-4 text-red-600" size={48} />
          <h1 className="text-xl font-bold mb-2">You're Offline</h1>
          <p className="text-gray-600 mb-4">
            Please check your internet connection.
          </p>
          <Button onClick={() => window.location.reload()} className="w-full">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <>
        <style>{`
            .login-page-container input[type="password"],
            .login-page-container input[type="text"] {
              background-color: #ffffff !important;
              color: #111827 !important;
            }

            .login-button {
              transition: all 0.2s ease;
            }

            .login-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
            }

            .login-button:active {
              transform: translateY(0);
            }

            .login-input {
              transition: all 0.2s ease;
            }

            .login-input:hover {
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .login-input:focus {
              box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
            }

            .login-page-container {
              position: relative;
              min-height: 100vh;
            }

            .login-copyright {
              position: absolute;
              bottom: 24px;
              left: 50%;
              transform: translateX(-50%);
            }

            .login-register-link {
              color: #ffffff !important;
              font-weight: 700 !important;
              text-decoration: none;
              transition: all 0.3s ease;
            }

            .login-register-link:hover {
              text-decoration: underline;
            }

            .login-forgot-password {
              color: #fca5a5 !important;
              font-weight: 700 !important;
              text-decoration: none;
              transition: all 0.3s ease;
            }

            .login-forgot-password:hover {
              color: #fecaca !important;
            }

            .login-input-container .lucide {
              margin-right: 4px;
            }

            .login-input-container input {
              padding-left: 2.5rem !important;
            }
          `}</style>

        <div
          className="min-h-screen flex items-center justify-center bg-[#eef2f6] px-4 py-8 login-page-container"
          data-theme="light"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl shadow-2xl">
            <GuardianLoginForm
              formData={formData}
              errors={errors}
              serverError={serverError}
              loading={loading}
              handleChange={handleChange}
              onSubmit={handleSubmit}
              onSwitchToAdmin={() => handleRoleChange("admin")}
            />
          </div>

          <div className="absolute bottom-6 login-copyright">
            <p className="text-xs text-gray-400">
              © 2026 Immunicare. All rights reserved.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
          .login-page-container input[type="password"],
          .login-page-container input[type="text"] {
            background-color: #ffffff !important;
            color: #111827 !important;
          }

          .login-button {
            transition: all 0.2s ease;
          }

          .login-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
          }

          .login-button:active {
            transform: translateY(0);
          }

          .login-input {
            transition: all 0.2s ease;
          }

          .login-input:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }

          .login-input:focus {
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
          }

          .login-page-container {
            position: relative;
            min-height: 100vh;
          }

          .login-copyright {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
          }

          .login-register-link {
            color: #ffffff !important;
            font-weight: 700 !important;
            text-decoration: none;
            transition: all 0.3s ease;
          }

          .login-register-link:hover {
            text-decoration: underline;
          }

          .login-forgot-password {
            color: #fca5a5 !important;
            font-weight: 700 !important;
            text-decoration: none;
            transition: all 0.3s ease;
          }

          .login-forgot-password:hover {
            color: #fecaca !important;
          }

          .login-input-container .lucide {
            margin-right: 4px;
          }

          .login-input-container input {
            padding-left: 2.5rem !important;
          }

          .switch-portal-btn {
            transition: all 0.2s ease;
            cursor: pointer;
          }

          .switch-portal-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
          }

          .switch-portal-btn:active {
            transform: translateY(0);
          }

          .auth-shell {
            position: relative;
            overflow: hidden;
            background: #ffffff;
          }

          .auth-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(120deg, rgba(79, 70, 229, 0.06), rgba(75, 20, 139, 0.06));
            pointer-events: none;
          }

          .auth-form-layer {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 50%;
            z-index: 20;
          }

          .auth-brand-layer {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 50%;
            z-index: 10;
          }
        `}</style>

      <div
        className="min-h-screen flex items-center justify-center bg-[#eef2f6] login-page-container"
        data-theme="light"
      >
        <div className="w-[960px] h-[620px] rounded-3xl shadow-2xl auth-shell">
          <motion.div
            className="auth-brand-layer"
            animate={{ x: role === "guardian" ? "0%" : "100%" }}
            transition={panelSpringTransition}
            aria-live="polite"
          >
            <div
              className={`h-full ${role === "guardian" ? "rounded-l-3xl" : "rounded-r-3xl"}`}
            >
              <BrandingPanel
                currentRole={role}
                onSwitch={() =>
                  handleRoleChange(role === "guardian" ? "admin" : "guardian")
                }
                isMobile={isMobile}
              />
            </div>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {role === "guardian" ? (
              <motion.div
                key="guardian-form"
                custom={28}
                variants={formMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="auth-form-layer right-0"
              >
                <GuardianLoginForm
                  formData={formData}
                  errors={errors}
                  serverError={serverError}
                  loading={loading}
                  handleChange={handleChange}
                  onSubmit={handleSubmit}
                />
              </motion.div>
            ) : (
              <motion.div
                key="admin-form"
                custom={-28}
                variants={formMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="auth-form-layer left-0"
              >
                <AdminLoginForm
                  formData={formData}
                  errors={errors}
                  serverError={serverError}
                  loading={loading}
                  handleChange={handleChange}
                  onSubmit={handleSubmit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 login-copyright">
          <p className="text-xs text-gray-400">
            © 2026 Immunicare. All rights reserved.
          </p>
        </div>
      </div>
    </>
  );
};

export default AdminGuardianLogin;
