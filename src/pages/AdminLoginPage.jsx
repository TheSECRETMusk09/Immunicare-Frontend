import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import {
  getDefaultAuthenticatedRouteFromUser,
  normalizeAuthUser,
  resolveRoleType,
} from "../utils/authRedirect";
import { ShieldCheck, User, Activity, HeartPulse, Stethoscope } from "lucide-react";
import { TextInput, PasswordInput, Alert, Button } from "../components/UI";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [formData, setFormData] = useState({
    admin_user: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      const storedUser = JSON.parse(
        localStorage.getItem("user") || sessionStorage.getItem("user") || "{}",
      );
      const userData = normalizeAuthUser(user || storedUser);
      navigate(getDefaultAuthenticatedRouteFromUser(userData), { replace: true });
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

    if (name === "admin_user") {
      if (!/^[A-Za-z0-9._-]{3,}$/.test(value.trim())) {
        return "Enter a valid username";
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

    const fields = ["admin_user", "password"];
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
        username: formData.admin_user.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe,
        expectedRole: resolveRoleType("SYSTEM_ADMIN"),
      };

      const result = await login(credentials);
      if (!result.success) {
        setServerError(result.error || "Login failed.");
      } else {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <section className="hidden lg:flex rounded-3xl bg-white/90 border border-sky-100 shadow-xl p-10 flex-col justify-between">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 text-white flex items-center justify-center shadow-md mb-6">
              <HeartPulse className="w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ImmuniCare Admin Portal</h1>
            <p className="mt-3 text-slate-600 leading-relaxed">
              Securely manage vaccination workflows, appointments, inventory, and healthcare operations in one dashboard.
            </p>
          </div>

          <div className="space-y-4 mt-8">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-sky-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-700">Role-based access control with session security and token refresh safeguards.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-teal-600">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-700">Monitor operational health with real-time dashboards and consolidated metrics.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-600">
                <Stethoscope className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-700">Designed for healthcare teams with clear hierarchy and responsive workflows.</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white border border-slate-100 shadow-2xl p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="mb-6 text-center lg:text-left">
            <div className="mx-auto lg:mx-0 w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
            <p className="text-slate-600 mt-1">Sign in to continue to the healthcare management console.</p>
          </div>

          {serverError && (
            <Alert variant="error" className="mb-4">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextInput
              name="admin_user"
              label="Username"
              placeholder="Enter admin username"
              value={formData.admin_user}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.admin_user ? errors.admin_user : undefined}
              icon={User}
              theme="admin"
              autoComplete="username"
              className="transition-all duration-200"
            />

            <PasswordInput
              name="password"
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.password ? errors.password : undefined}
              showPasswordAriaLabel="Show admin password"
              hidePasswordAriaLabel="Hide admin password"
              theme="admin"
              autoComplete="current-password"
              className="transition-all duration-200"
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-sky-700 hover:text-sky-800 font-semibold transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="w-full !min-h-[48px] text-base"
            >
              {loading ? "Logging in..." : "System Login"}
            </Button>

            <div className="text-center pt-1">
              <Link
                to="/guardian/login"
                className="text-sm text-teal-700 hover:text-teal-800 font-medium transition-colors"
              >
                Go to Guardian Login
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminLoginPage;
