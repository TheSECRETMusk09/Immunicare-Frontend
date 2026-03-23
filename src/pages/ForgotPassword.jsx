/**
 * Forgot Password Page
 * Password reset request page for users who forgot their password
 *
 * Features:
 * - Email input to request password reset
 * - Option to receive OTP via Email or SMS
 * - Connected to /api/auth/forgot-password/otp endpoint
 * - WCAG 2.1 AA compliant
 */

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import apiClient from "../utils/api";
import { Button, TextInput, PasswordInput, Alert } from "../components/UI";
import {
  Mail,
  ArrowLeft,
  Home,
  CheckCircle,
  WifiOff,
  MessageSquare,
  Phone,
  Lock,
} from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [method, setMethod] = useState("email"); // 'email' or 'sms'
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const { isOnline, isBackendReachable } = useNetworkStatus();
  const navigate = useNavigate();

  // Check network status
  useEffect(() => {
    setIsOffline(!isOnline);
  }, [isOnline]);

  const validateEmail = (email) => {
    if (!email || email.trim() === "") {
      return "Email is required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Please enter a valid email address";
    }
    return null;
  };

  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

  const normalizePhoneNumber = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return hasPlus ? `+${digits}` : digits;
  };

  const validatePhoneNumber = (value) => {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      return "Phone number is required";
    }

    const digitsOnly = normalized.replace(/^\+/, "");
    if (!/^\d{10,15}$/.test(digitsOnly)) {
      return "Please enter a valid phone number";
    }

    return null;
  };

  const validateRequestByMethod = () => {
    if (method === "email") {
      return validateEmail(email);
    }

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      return phoneError;
    }

    return null;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);

    const requestValidationError = validateRequestByMethod();
    if (requestValidationError) {
      setError(requestValidationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!isOnline) {
        setError(
          "You are currently offline. Please check your internet connection and try again.",
        );
        setLoading(false);
        return;
      }

      if (isBackendReachable === false) {
        setError(
          "Unable to connect to the server. Please check your connection or try again later.",
        );
        setLoading(false);
        return;
      }

      // Call the OTP endpoint with normalized identifier
      if (method === "email") {
        const normalizedEmail = normalizeEmail(email);
        await apiClient.forgotPasswordOtp({ email: normalizedEmail, method });
      } else {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        await apiClient.forgotPasswordOtp({ phone: normalizedPhone, method });
      }
      setOtpSent(true);
    } catch (err) {
      console.error("Send OTP error:", err);
      setError(
        err.message || "An unexpected error occurred. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.verifyResetOtp(
        method === "email"
          ? { email: normalizeEmail(email), otp, method }
          : { phone: normalizePhoneNumber(phoneNumber), otp, method }
      );

      const token = response?.resetToken || response?.data?.resetToken;
      if (token) {
        setResetToken(token);
        setOtpVerified(true);
      } else {
        throw new Error("Reset token missing from verification response");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError(err.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiClient.resetPasswordWithToken(resetToken, newPassword);
      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      if (method === "email") {
        const normalizedEmail = normalizeEmail(email);
        await apiClient.forgotPasswordOtp({ email: normalizedEmail, method });
      } else {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        await apiClient.forgotPasswordOtp({ phone: normalizedPhone, method });
      }
      setOtpSent(true);
    } catch (err) {
      setError(err.message || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Offline state UI
  if (isOffline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 px-4 py-8 sm:py-12">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-[2rem] shadow-2xl p-10 border border-white/20">
            <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-full bg-danger-100/30 backdrop-blur-sm mb-4 sm:mb-6">
              <WifiOff className="h-8 w-8 sm:h-10 sm:w-10 text-red-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
              You're Offline
            </h1>
            <p className="text-white/70 mb-6 sm:mb-8">
              Please check your internet connection and try again.
            </p>
            <Button
              onClick={() => window.location.reload()}
              size="lg"
              className="w-full py-3 sm:py-4 bg-white text-primary-700 hover:bg-gray-100"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state - password reset complete
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 overflow-hidden">
        <main id="main-content" className="w-full max-w-md">
          <div className="text-center mb-6 sm:mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-2xl mb-3 sm:mb-4 shadow-xl border border-white/30">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-green-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Immunicare
            </h1>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-[2rem] shadow-2xl p-5 sm:p-8 md:p-10 border border-white/20 w-full max-w-sm sm:max-w-md">
            <div className="text-center py-3 sm:py-4">
              <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center rounded-full bg-success-100/30 backdrop-blur-sm mb-4 sm:mb-6">
                <Lock className="h-8 w-8 sm:h-10 sm:w-10 text-green-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                Password Reset Complete!
              </h2>
              <p className="text-white/70 mb-4 sm:mb-6">
                Your password has been successfully reset.
              </p>
              <Button
                onClick={() => navigate("/login")}
                size="lg"
                className="w-full py-3 sm:py-4 bg-white text-primary-700 hover:bg-gray-100"
              >
                Back to Login
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-gray-900 focus:rounded-lg focus:font-medium"
      >
        Skip to main content
      </a>

      <Link
        to="/"
        className="absolute top-3 sm:top-4 left-3 sm:left-4 inline-flex items-center px-3 sm:px-4 py-2 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white border border-white/20 text-sm sm:text-base"
        aria-label="Go to home page"
      >
        <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-white" />
        <span className="text-white hidden sm:inline">Home</span>
      </Link>

      <main id="main-content" className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-2xl mb-3 sm:mb-4 shadow-xl border border-white/30">
            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Immunicare
          </h1>
          <p className="text-primary-100 text-xs sm:text-sm mt-1 sm:mt-2 font-medium uppercase tracking-widest">
            Password Recovery
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-[2rem] shadow-2xl p-5 sm:p-8 md:p-10 border border-white/20 w-full max-w-sm sm:max-w-md">
          {/* Step 1: Enter Email and Choose Method */}
          {!otpSent && !otpVerified && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Reset Your Password
              </h2>
              <p className="text-white/70 text-sm mb-6 sm:mb-8">
                {method === "email"
                  ? "Enter your email and choose how you want to receive the verification code."
                  : "Enter the mobile number linked to your account so we can send your SMS verification code."}
              </p>

              {error && (
                <Alert
                  variant="danger"
                  className="mb-6 bg-red-500/20 backdrop-blur-sm border-red-500/30 text-white"
                >
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSendOtp} className="space-y-5 sm:space-y-6">
                <TextInput
                  label={method === "email" ? "Email Address" : "Phone Number"}
                  id={method === "email" ? "email" : "phoneNumber"}
                  name={method === "email" ? "email" : "phoneNumber"}
                  type={method === "email" ? "email" : "tel"}
                  value={method === "email" ? email : phoneNumber}
                  onChange={(e) => {
                    if (method === "email") {
                      setEmail(e.target.value);
                    } else {
                      // For SMS method, only allow digits
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setPhoneNumber(digitsOnly);
                    }
                    if (error) setError(null);
                  }}
                  placeholder={
                    method === "email"
                      ? "Enter your email address"
                      : "Enter your mobile number (e.g., 09123456789)"
                  }
                  icon={method === "email" ? Mail : Phone}
                  disabled={loading}
                  required
                  autoComplete={method === "email" ? "email" : "tel"}
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                  inputMode={method === "sms" ? "numeric" : undefined}
                  pattern={method === "sms" ? "[0-9]*" : undefined}
                  maxLength={method === "sms" ? 11 : undefined}
                />

                {/* Method Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-white/80">
                    Send verification code via:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setMethod("email")}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        method === "email"
                          ? "border-green-500 bg-green-500/20 text-white"
                          : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
                      }`}
                    >
                      <Mail className="w-6 h-6 mb-2" />
                      <span className="font-medium">Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod("sms")}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        method === "sms"
                          ? "border-green-500 bg-green-500/20 text-white"
                          : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
                      }`}
                    >
                      <Phone className="w-6 h-6 mb-2" />
                      <span className="font-medium">SMS</span>
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  size="lg"
                  className="w-full py-3 sm:py-4 text-base sm:text-lg font-bold shadow-lg bg-green-600 text-white hover:bg-green-400"
                >
                  Send Verification Code
                </Button>
              </form>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </button>
                <p className="text-sm text-white/70">
                  Remembered?{" "}
                  <Link
                    to="/login"
                    className="font-bold text-white hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </>
          )}

          {/* Step 2: Enter OTP */}
          {otpSent && !otpVerified && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Enter Verification Code
              </h2>
              <p className="text-white/70 text-sm mb-6 sm:mb-8">
                We sent a 6-digit code to your{" "}
                {method === "email" ? "email" : "phone number"}.
              </p>

              {error && (
                <Alert
                  variant="danger"
                  className="mb-6 bg-red-500/20 backdrop-blur-sm border-red-500/30 text-white"
                >
                  {error}
                </Alert>
              )}

              <form
                onSubmit={handleVerifyOtp}
                className="space-y-5 sm:space-y-6"
              >
                <TextInput
                  label="Verification Code"
                  id="otp"
                  name="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtp(val);
                    if (error) setError(null);
                  }}
                  placeholder="Enter 6-digit code"
                  icon={MessageSquare}
                  disabled={loading}
                  required
                  autoComplete="one-time-code"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50 text-center text-2xl tracking-widest font-mono"
                />

                <Button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  loading={loading}
                  size="lg"
                  className="w-full py-3 sm:py-4 text-base sm:text-lg font-bold shadow-lg bg-green-600 text-white hover:bg-green-400"
                >
                  Verify Code
                </Button>

                <div className="text-center">
                  <p className="text-white/60 text-sm">
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={resendOtp}
                      className="text-green-400 hover:text-green-300 font-medium"
                    >
                      Resend
                    </button>
                  </p>
                </div>
              </form>

              <div className="mt-6 sm:mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setError(null);
                  }}
                  className="inline-flex items-center text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Change identifier or method
                </button>
              </div>
            </>
          )}

          {/* Step 3: Set New Password */}
          {otpVerified && !success && (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                Create New Password
              </h2>
              <p className="text-white/70 text-sm mb-6 sm:mb-8">
                Enter your new password below.
              </p>

              {error && (
                <Alert
                  variant="danger"
                  className="mb-6 bg-red-500/20 backdrop-blur-sm border-red-500/30 text-white"
                >
                  {error}
                </Alert>
              )}

              <form
                onSubmit={handleResetPassword}
                className="space-y-5 sm:space-y-6"
              >
                <PasswordInput
                  label="New Password"
                  id="newPassword"
                  name="newPassword"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter new password"
                  icon={Lock}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  showPasswordAriaLabel="Show new password"
                  hidePasswordAriaLabel="Hide new password"
                  theme="admin"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />

                <PasswordInput
                  label="Confirm New Password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Confirm new password"
                  icon={Lock}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  showPasswordAriaLabel="Show confirm password"
                  hidePasswordAriaLabel="Hide confirm password"
                  theme="admin"
                  className="bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder-white/50"
                />

                <Button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  loading={loading}
                  size="lg"
                  className="w-full py-3 sm:py-4 text-base sm:text-lg font-bold shadow-lg bg-green-600 text-white hover:bg-green-400"
                >
                  Reset Password
                </Button>
              </form>
            </>
          )}
        </div>

        <footer className="mt-6 sm:mt-10 text-center">
          <p className="text-white/60 text-xs font-medium uppercase tracking-widest">
            © {new Date().getFullYear()} Immunicare System
          </p>
        </footer>
      </main>
    </div>
  );
};

export default ForgotPassword;
