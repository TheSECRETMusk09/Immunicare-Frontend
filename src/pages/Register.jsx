/**
 * Guardian Registration Page
 * Registration form for parents/guardians to create an account
 *
 * Features:
 * - Complete registration form
 * - Form validation
 * - Password strength indicator
 * - Connected to /api/auth/register/guardian endpoint
 * - WCAG 2.1 AA compliant
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import apiClient from "../utils/api";
import OTPVerification from "../components/SMS/OTPVerification";
import {
  Button,
  TextInput,
  Select,
  Alert,
  PasswordInput,
} from "../components/UI";
import {
  Plus,
  ArrowLeft,
  Home,
  CheckCircle,
  WifiOff,
  User,
  Mail,
  Baby,
  Shield,
} from "lucide-react";

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    address: "",
    infantName: "",
    infantDob: "",
    relationship: "parent",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [registrationPayload, setRegistrationPayload] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  // Calculate maximum date (today) for infantDob - birth date cannot be in the future
  const today = new Date();
  const maxDate = today.toISOString().split("T")[0];

  const { isAuthenticated } = useAuth();
  const { isOnline, isBackendReachable } = useNetworkStatus();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/guardian/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check network status
  useEffect(() => {
    setIsOffline(!isOnline);
  }, [isOnline]);

  // Password strength calculation
  const calculatePasswordStrength = useCallback((password) => {
    let strength = 0;
    const checks = [
      { regex: /.{8,}/, message: "At least 8 characters" },
      { regex: /[A-Z]/, message: "One uppercase letter" },
      { regex: /[a-z]/, message: "One lowercase letter" },
      { regex: /[0-9]/, message: "One number" },
      { regex: /[^A-Za-z0-9]/, message: "One special character" },
    ];

    const results = checks.map((check) => ({
      ...check,
      passed: check.regex.test(password),
    }));

    strength = results.filter((r) => r.passed).length;

    return { strength, results };
  }, []);

  const passwordStrength = calculatePasswordStrength(formData.password);

  const backendFieldToFrontendField = {
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    phone: "phone",
    password: "password",
    confirmPassword: "confirmPassword",
    address: "address",
    relationship: "relationship",
    infantName: "infantName",
    infantDob: "infantDob",
  };

  const parseBackendFieldErrors = (error) => {
    const fields = error?.response?.data?.fields;
    if (!fields || typeof fields !== "object") {
      return {};
    }

    return Object.entries(fields).reduce((acc, [backendField, message]) => {
      const frontendField = backendFieldToFrontendField[backendField];
      if (!frontendField) {
        return acc;
      }

      if (typeof message === "string" && message.trim()) {
        acc[frontendField] = message;
      } else if (Array.isArray(message) && message.length > 0) {
        acc[frontendField] = String(message[0]);
      }

      return acc;
    }, {});
  };

  const normalizePhoneForVerification = useCallback((phoneValue) => {
    return String(phoneValue || "")
      .replace(/[\s\-()]/g, "")
      .trim();
  }, []);

  const validateField = (name, value) => {
    switch (name) {
      case "firstName":
        if (!value || value.trim() === "") {
          return "First name is required";
        }
        if (value.length < 2) {
          return "First name must be at least 2 characters";
        }
        if (!/^[a-zA-Z\s'-]+$/.test(value)) {
          return "First name can only contain letters, spaces, hyphens, and apostrophes";
        }
        return null;
      case "lastName":
        if (!value || value.trim() === "") {
          return "Last name is required";
        }
        if (value.length < 2) {
          return "Last name must be at least 2 characters";
        }
        if (!/^[a-zA-Z\s'-]+$/.test(value)) {
          return "Last name can only contain letters, spaces, hyphens, and apostrophes";
        }
        return null;
      case "email":
        if (!value || value.trim() === "") {
          return "Email is required";
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return "Please enter a valid email address";
        }
        return null;
      case "phone":
        if (!value || value.trim() === "") {
          return "Phone number is required";
        }
        if (!/^[\d\s\-+()]{10,}$/.test(value)) {
          return "Please enter a valid phone number";
        }
        return null;
      case "password":
        if (!value || value.trim() === "") {
          return "Password is required";
        }
        if (passwordStrength.strength < 4) {
          return "Password must meet all strength requirements";
        }
        return null;
      case "confirmPassword":
        if (!value || value.trim() === "") {
          return "Please confirm your password";
        }
        if (value !== formData.password) {
          return "Passwords do not match";
        }
        return null;
      case "infantName":
        if (value && value.trim() !== "" && value.length < 2) {
          return "Infant name must be at least 2 characters";
        }
        return null;
      case "infantDob":
        if (!value || value.trim() === "") {
          return "Date of birth is required";
        }
        const dob = new Date(value);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        dob.setHours(0, 0, 0, 0);
        if (dob > now) {
          return "Date of birth cannot be in the future. Please select today or an earlier date.";
        }
        return null;
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const newErrors = {};
    const fieldsToValidate = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "password",
      "confirmPassword",
      "relationship",
    ];

    if (formData.infantName || formData.infantDob) {
      fieldsToValidate.push("infantName", "infantDob");
    }

    fieldsToValidate.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setServerError(null);
    setOtpError(null);

    try {
      // Check network connectivity
      if (!isOnline) {
        setServerError(
          "You are currently offline. Please check your internet connection and try again.",
        );
        setLoading(false);
        return;
      }

      if (isBackendReachable === false) {
        setServerError(
          "Unable to connect to the server. Please check your connection or try again later.",
        );
        setLoading(false);
        return;
      }

      // Prepare data for API
      const registrationData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        address: formData.address.trim() || undefined,
        infantName: formData.infantName.trim() || undefined,
        infantDob: formData.infantDob || undefined,
        relationship: formData.relationship,
      };

      // Make API call using centralized apiClient
      const response = await apiClient.register(registrationData);

      const verificationPhone = normalizePhoneForVerification(
        response?.data?.phone || registrationData.phone,
      );

      setRegistrationPayload(registrationData);
      setPendingVerification({
        phone: verificationPhone,
        expiresIn:
          Number.parseInt(response?.data?.expiresInSeconds, 10) || 10 * 60,
      });

      setSuccess(false);
    } catch (error) {
      console.error("Registration error:", error);

      const backendFieldErrors = parseBackendFieldErrors(error);
      if (Object.keys(backendFieldErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...backendFieldErrors }));
      }

      const responseStatus = error?.response?.status;
      const responseCode = error?.response?.data?.code;
      const retryAfterSeconds =
        Number.parseInt(error?.response?.headers?.["retry-after"], 10) ||
        error?.response?.data?.retryAfter;

      if (responseStatus === 409 && responseCode === "EMAIL_EXISTS") {
        setErrors((prev) => ({
          ...prev,
          email:
            error?.response?.data?.error ||
            "Email already registered. Please use another email.",
        }));
        setServerError("This email is already registered. Please sign in instead.");
        return;
      }

      if (responseStatus === 429) {
        const waitSuffix = Number.isFinite(retryAfterSeconds)
          ? ` Please wait about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s) before trying again.`
          : " Please wait a moment before trying again.";

        setServerError(
          `Too many registration attempts from this network.${waitSuffix}`,
        );
      } else {
        setServerError(
          error.message ||
            "An unexpected error occurred. Please try again later.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = useCallback(
    async (otpCode) => {
      const verificationPhone = normalizePhoneForVerification(
        pendingVerification?.phone || formData.phone,
      );

      if (!verificationPhone) {
        const missingPhoneError = new Error("Missing phone number for OTP verification.");
        setOtpError(missingPhoneError.message);
        throw missingPhoneError;
      }

      setOtpLoading(true);
      setOtpError(null);

      try {
        await apiClient.verifyGuardianRegistration(verificationPhone, otpCode);
        setPendingVerification(null);
        setSuccess(true);
      } catch (error) {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          "Invalid or expired OTP. Please try again.";
        setOtpError(message);
        throw error;
      } finally {
        setOtpLoading(false);
      }
    },
    [formData.phone, normalizePhoneForVerification, pendingVerification?.phone],
  );

  const handleResendOtp = useCallback(async () => {
    if (!registrationPayload) {
      const payloadError = new Error("Registration session expired. Please register again.");
      setOtpError(payloadError.message);
      throw payloadError;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const response = await apiClient.register(registrationPayload);
      const verificationPhone = normalizePhoneForVerification(
        response?.data?.phone || registrationPayload.phone,
      );
      const expiresIn =
        Number.parseInt(response?.data?.expiresInSeconds, 10) || 10 * 60;

      setPendingVerification({ phone: verificationPhone, expiresIn });
      return { expiresIn };
    } catch (error) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to resend OTP. Please try again.";
      setOtpError(message);
      throw error;
    } finally {
      setOtpLoading(false);
    }
  }, [normalizePhoneForVerification, registrationPayload]);

  // Offline state UI
  if (isOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-[2rem] shadow-2xl p-10 border border-white/20">
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-danger-100/30 backdrop-blur-sm mb-6">
              <WifiOff className="h-10 w-10 text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">
              You're Offline
            </h1>
            <p className="text-white/70 mb-8">
              Please check your internet connection and try again.
            </p>
            <Button
              onClick={() => window.location.reload()}
              size="lg"
              className="w-full py-4 text-lg font-bold shadow-lg bg-white text-primary-700 hover:bg-gray-100"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // OTP verification state
  if (pendingVerification && !success) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-3 sm:px-4 py-3 sm:py-6 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="bg-white/95 text-slate-900 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-4 sm:p-6 border border-white/30 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto mobile-scrollbar">
            <OTPVerification
              phoneNumber={pendingVerification.phone}
              purpose="verification"
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onCancel={() => {
                setPendingVerification(null);
                setOtpError(null);
              }}
              expiresIn={pendingVerification.expiresIn}
              loading={otpLoading}
              error={otpError}
            />
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-lg rounded-[2rem] shadow-2xl p-10 text-center border border-white/20">
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-success-100/30 backdrop-blur-sm mb-6">
              <CheckCircle className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Verification Successful!
            </h2>
            <p className="text-white/70 mb-6 leading-relaxed">
              Your guardian account has been successfully verified and activated.
              You can now sign in and manage your child immunization records.
            </p>
            <p className="text-sm text-white/50 mb-10">
              Thank you for completing the registration process.
            </p>
            <Button
              onClick={() => navigate("/login")}
              size="lg"
              className="w-full py-4 text-lg font-bold shadow-lg bg-white text-primary-700 hover:bg-gray-100"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start sm:items-center justify-center px-4 py-4 sm:py-12 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 register-page relative">
      {/* Skip Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Home Button */}
      <Link
        to="/"
        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white border border-white/20 text-sm sm:text-base touch-manipulation home-button"
        aria-label="Go to home page"
      >
        <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
        Home
      </Link>

      <main id="main-content" className="w-full max-w-2xl mt-12 sm:mt-0 register-main">
        {/* Logo / Brand Header */}
        <div className="text-center mb-7 sm:mb-10 register-brand-header">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-3 sm:mb-4 shadow-xl border border-white/30">
            <Plus className="w-7 h-7 sm:w-10 sm:h-10 text-white" strokeWidth={3} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            IMMUNICARE
          </h1>
          <p className="text-primary-100 text-xs sm:text-sm mt-1.5 sm:mt-2 font-medium uppercase tracking-[0.16em] sm:tracking-widest register-brand-subtitle">
            Parent/Guardian Registration
          </p>
        </div>

        {/* Registration Form Card - Glassmorphism Style */}
        <div className="bg-white/10 backdrop-blur-lg rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl p-5 sm:p-8 md:p-12 border border-white/20 register-card">
          <h2 id="register-form-title" className="text-xl sm:text-2xl font-bold text-white mb-2">
            Create Your Account
          </h2>
          <p id="register-form-description" className="text-white/70 text-sm mb-6 sm:mb-10">
            Fill in the form below to register for Immunicare
          </p>

          {/* Server Error */}
          {serverError && (
            <Alert
              variant="danger"
              className="mb-8 bg-red-500/20 backdrop-blur-sm border-red-500/30 text-white"
            >
              {serverError}
            </Alert>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-7 sm:space-y-10 register-form"
            aria-labelledby="register-form-title"
            aria-describedby="register-form-description"
          >
            {/* Personal Information */}
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-2 border-b border-white/20">
                <User className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Personal Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <TextInput
                  label="First Name"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter first name"
                  error={errors.firstName}
                  disabled={loading}
                  required
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />
                <TextInput
                  label="Last Name"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter last name"
                  error={errors.lastName}
                  disabled={loading}
                  required
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />
              </div>
            </section>

            {/* Contact Information */}
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-2 border-b border-white/20">
                <Mail className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Contact Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <TextInput
                  label="Email Address"
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter email address"
                  error={errors.email}
                  disabled={loading}
                  required
                  autoComplete="email"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />
                <TextInput
                  label="Phone Number"
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter phone number"
                  error={errors.phone}
                  disabled={loading}
                  required
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />
              </div>
              <div className="mt-4 sm:mt-6">
                <label
                  htmlFor="address"
                  className="block text-sm font-bold text-white mb-2"
                >
                  Home Address{" "}
                  <span className="text-white/60 font-normal">(optional)</span>
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter your full address"
                  rows={2}
                  className="block w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </section>

            {/* Security */}
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-2 border-b border-white/20">
                <Shield className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold text-white">Security</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <PasswordInput
                  label="Password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Create a password"
                  error={errors.password}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  showStrengthIndicator
                  theme="admin"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white"
                />
                <PasswordInput
                  label="Confirm Password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Confirm your password"
                  error={errors.confirmPassword}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  theme="admin"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white"
                />
              </div>

              {/* Password Strength Indicators */}
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 register-password-requirements">
                <p className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider mb-2.5 sm:mb-3">
                  Password Requirements
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1.5 sm:gap-y-2">
                  {passwordStrength.results.map((check, index) => (
                    <div
                      key={index}
                      className={`flex items-center text-[11px] sm:text-xs font-medium ${
                        check.passed ? "text-green-400" : "text-white/50"
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle className="w-3.5 h-3.5 mr-2" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-white/30 mr-2" />
                      )}
                      {check.message}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Child Information */}
            <section>
              <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-2 border-b border-white/20">
                <Baby className="w-5 h-5 text-white" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Child Information{" "}
                  <span className="text-white/60 font-normal text-sm inline-block mt-0.5 sm:mt-0">
                    (optional)
                  </span>
                </h3>
              </div>
              <p className="text-sm text-white/70 mb-4 sm:mb-6">
                Add your child's information to link their immunization records
                to your account.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <TextInput
                  label="Child's Name"
                  id="infantName"
                  name="infantName"
                  value={formData.infantName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter child's full name"
                  error={errors.infantName}
                  disabled={loading}
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />
                <TextInput
                  label="Date of Birth"
                  id="infantDob"
                  name="infantDob"
                  type="date"
                  value={formData.infantDob}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.infantDob}
                  disabled={loading}
                  max={maxDate}
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white"
                />
                <div className="md:col-span-2">
                  <Select
                    label="Relationship to Child"
                    id="relationship"
                    name="relationship"
                    value={formData.relationship}
                    onChange={handleChange}
                    disabled={loading}
                    required
                    error={errors.relationship}
                    className="bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-xl shadow-lg"
                  >
                    <option value="">Select relationship</option>
                    <option value="parent">Parent</option>
                    <option value="mother">Mother</option>
                    <option value="father">Father</option>
                    <option value="guardian">Guardian</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              </div>
            </section>

            {/* Submit Button */}
            <div className="pt-4 sm:pt-6 text-center register-submit-row">
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                size="lg"
                className="w-full sm:w-auto px-6 sm:px-12 py-3 sm:py-4 text-base sm:text-xl font-bold shadow-xl bg-green-600 text-white hover:bg-green-400"
              >
                Create Account
              </Button>
            </div>

            {/* Login Link */}
            <div className="text-center pt-6 sm:pt-8 border-t border-white/20 register-login-row">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 register-login-actions">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <p className="text-sm text-white/70">
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    className="font-bold text-white hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-6 sm:mt-10 text-center">
          <p className="text-white/60 text-[11px] sm:text-xs font-medium uppercase tracking-[0.12em] sm:tracking-widest">
            © {new Date().getFullYear()} Immunicare System
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Register;
