import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  getDefaultAuthenticatedRouteFromUser,
  normalizeAuthUser,
  resolveRoleType,
} from "../utils/authRedirect";
import { WifiOff, Home } from "lucide-react";
import { Button, Alert, PasswordInput, RememberMeCheckbox } from "../components/UI";

// Mobile Detection Hook
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

// Branding Panel - Left side with nurse holding baby image and overlay content
const BrandingPanel = () => {
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#e8f4f8]">
      <img
        src="/nurse-holding-baby.png"
        alt="Nurse holding a baby"
        className="w-full h-full object-cover object-center"
        onError={(e) => {
          console.error('Failed to load nurse image:', e);
          e.target.style.display = 'none';
        }}
      />
      {/* Overlay Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-8 bg-gradient-to-b from-black/30 via-transparent to-black/40">
        {/* Header Section */}
        <div className="text-white mt-4">
          <h1 className="text-2xl font-bold leading-tight drop-shadow-lg">
            YOUR INFANT'S FIRST<br />APPOINTMENTS.
          </h1>
          <p className="text-sm text-white/90 mt-3 drop-shadow-md max-w-[280px]">
            Schedule and track vital health check-ups and vaccinations.
          </p>
        </div>

        {/* Bottom Icons Section */}
        <div className="flex justify-center gap-6 mb-4">
          {/* Appointments */}
          <div className="flex flex-col items-center text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs font-medium drop-shadow-md">Appointments</span>
          </div>

          {/* Immunizations */}
          <div className="flex flex-col items-center text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium drop-shadow-md">Immunizations</span>
          </div>

          {/* Privacy & Security */}
          <div className="flex flex-col items-center text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-xs font-medium drop-shadow-md text-center leading-tight">Privacy &<br/>Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Guardian Login Form - Right side with dark purple background
const GuardianLoginForm = ({
  formData,
  errors,
  serverError,
  loading,
  handleChange,
  onSubmit,
  touched,
  handleBlur,
  showInlineHomeButton = true,
}) => {
  return (
    <div className="w-full h-full bg-[#2d2b5c] flex flex-col justify-center text-white px-10 py-8 relative">
      {showInlineHomeButton && (
        <Link
          to="/"
          className="absolute top-4 left-4 inline-flex items-center px-3.5 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white border border-white/20 text-sm sm:text-base"
          aria-label="Go to home page"
        >
          <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" aria-hidden="true" />
          Home
        </Link>
      )}

      <div className="max-w-sm mx-auto w-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold mb-2 tracking-wide">GUARDIAN ACCESS PORTAL</h2>
          <p className="text-white/70 text-sm">
            Manage your infant's vaccination schedule and appointments.
          </p>
        </div>

        {serverError && (
          <Alert variant="error" className="mb-4 animate-shake">
            {serverError}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email or Patient ID Input */}
          <div>
            <input
              type="text"
              name="guardian_id"
              placeholder="Email or Patient ID"
              value={formData.guardian_id}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full bg-white rounded-lg py-3 px-4 text-gray-800 placeholder-gray-500 border-0 focus:ring-2 focus:ring-purple-400 focus:outline-none"
            />
            {touched.guardian_id && errors.guardian_id && (
              <p className="text-red-300 text-xs mt-1">{errors.guardian_id}</p>
            )}
          </div>

          {/* Password Input */}
          <PasswordInput
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.password ? errors.password : undefined}
            showPasswordAriaLabel="Show guardian password"
            hidePasswordAriaLabel="Hide guardian password"
            autoComplete="current-password"
            theme="guardian"
            className="w-full bg-white rounded-lg py-3 px-4 pr-12 text-gray-800 placeholder-gray-500 border-0 focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors font-medium"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Remember Me */}
          <div className="flex items-start">
            <RememberMeCheckbox
              id="guardian-remember-me"
              checked={formData.rememberMe}
              onChange={(checked) =>
                handleChange({
                  target: {
                    name: "rememberMe",
                    type: "checkbox",
                    checked,
                  },
                })
              }
              disabled={loading}
              label="Remember me"
              description="Keep me signed in on this device"
              theme="guardian"
              className="min-w-0"
            />
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-gray-900 py-3 rounded-lg text-base font-bold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

        </form>

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-white/70 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-yellow-400 font-semibold hover:text-yellow-300 transition-colors"
            >
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const GuardianLoginPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  const [formData, setFormData] = useState({
    guardian_id: "",
    password: "",
    rememberMe: false,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const { login, isAuthenticated, user } = useAuth();
  const { isOnline } = useNetworkStatus();

  // Redirect if logged in
  useEffect(() => {
    if (isAuthenticated) {
      const storedUser = JSON.parse(
        localStorage.getItem("user") || sessionStorage.getItem("user") || "{}"
      );
      const userData = normalizeAuthUser(user || storedUser);
      navigate(getDefaultAuthenticatedRouteFromUser(userData), { replace: true });
    }
  }, [isAuthenticated, navigate, user]);

  // Auto-clear server error
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
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  // Handle blur for real-time validation
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fields = ["guardian_id", "password"];
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
      const credentials = {
        username: formData.guardian_id.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe,
        expectedRole: resolveRoleType("GUARDIAN"),
      };

      const result = await login(credentials);
      if (!result.success) {
        setServerError(result.error || "Login failed.");
      } else {
        // Redirect based on normalized role immediately after successful login
        navigate(getDefaultAuthenticatedRouteFromUser(result.user), {
          replace: true,
        });
      }
    } catch {
      setServerError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // OFFLINE SCREEN
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

  // MOBILE VIEW
  if (isMobile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#2d2b5c] px-4 py-8 relative"
        data-theme="light"
      >
        <Link
          to="/"
          className="absolute top-4 left-4 inline-flex items-center px-3.5 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white border border-white/20 text-sm"
          aria-label="Go to home page"
        >
          <Home className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Home
        </Link>

        <div className="w-full max-w-sm">
          <GuardianLoginForm
            formData={formData}
            errors={errors}
            serverError={serverError}
            loading={loading}
            handleChange={handleChange}
            onSubmit={handleSubmit}
            touched={touched}
            handleBlur={handleBlur}
            showInlineHomeButton={false}
          />
        </div>

        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <p className="text-xs text-white/40">
            © 2026 Immunicare. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  // DESKTOP VIEW - Split panel design
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-100 p-4"
      data-theme="light"
    >
      {/* Main Container - Card with rounded corners */}
      <div className="w-[900px] h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden flex">
        {/* Left panel - Nurse image only */}
        <div className="w-1/2 h-full">
          <BrandingPanel />
        </div>

        {/* Right panel - Login form */}
        <div className="w-1/2 h-full">
          <GuardianLoginForm
            formData={formData}
            errors={errors}
            serverError={serverError}
            loading={loading}
            handleChange={handleChange}
            onSubmit={handleSubmit}
            touched={touched}
            handleBlur={handleBlur}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <p className="text-xs text-gray-400">
          © 2026 Immunicare. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default GuardianLoginPage;
