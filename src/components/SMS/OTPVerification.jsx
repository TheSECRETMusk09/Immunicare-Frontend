/**
 * OTP Verification Component for Immunicare Guardian Dashboard
 *
 * Mobile-optimized OTP input with:
 * - Auto-focus between inputs
 * - Paste support
 * - Resend functionality
 * - Timer countdown
 * - Accessibility support
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield,
  Smartphone,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import "./OTPVerification.css";

const OTPVerification = ({
  phoneNumber,
  purpose = "verification",
  onVerify,
  onResend,
  onCancel,
  length = 6,
  expiresIn = 300,
  loading = false,
  error = null,
}) => {
  const [otp, setOtp] = useState(Array(length).fill(""));
  const [timeRemaining, setTimeRemaining] = useState(expiresIn);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const inputRefs = useRef([]);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Handle verify
  const handleVerify = useCallback(
    async (code) => {
      if (onVerify) {
        try {
          await onVerify(code);
          setVerifySuccess(true);
        } catch (err) {
          // Error is handled by parent component
          setOtp(Array(length).fill(""));
          inputRefs.current[0]?.focus();
        }
      }
    },
    [onVerify, length],
  );

  // Handle input change
  const handleChange = useCallback(
    (index, value) => {
      // Only allow digits
      if (value && !/^\d$/.test(value)) return;

      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all digits entered
      if (
        newOtp.every((digit) => digit !== "") &&
        newOtp.join("").length === length
      ) {
        handleVerify(newOtp.join(""));
      }
    },
    [otp, length, handleVerify],
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace" && !otp[index] && index > 0) {
        // Focus previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp, length],
  );

  // Handle paste
  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, length);

      if (pastedData) {
        const newOtp = Array(length).fill("");
        pastedData.split("").forEach((char, idx) => {
          newOtp[idx] = char;
        });
        setOtp(newOtp);

        // Focus the next empty input or the last input
        const nextEmptyIndex = newOtp.findIndex((digit) => digit === "");
        const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
        inputRefs.current[focusIndex]?.focus();

        // Auto-submit if complete
        if (newOtp.every((digit) => digit !== "")) {
          handleVerify(newOtp.join(""));
        }
      }
    },
    [length, handleVerify],
  );

  // Handle resend
  const handleResend = useCallback(async () => {
    if (!canResend || resendCooldown > 0) return;

    try {
      if (onResend) {
        const result = await onResend();
        if (result?.expiresIn) {
          setTimeRemaining(result.expiresIn);
        }
        setCanResend(false);
        setResendCooldown(60); // 60 second cooldown
        setOtp(Array(length).fill(""));
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error("Resend failed:", err);
    }
  }, [canResend, resendCooldown, onResend, length]);

  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Mask phone number
  const maskPhoneNumber = (phone) => {
    if (!phone) return "";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 4) return phone;
    return `****${cleaned.slice(-4)}`;
  };

  if (verifySuccess) {
    return (
      <div className="otp-verification otp-verification--success">
        <div className="otp-verification__icon-wrapper otp-verification__icon-wrapper--success">
          <CheckCircle className="otp-verification__icon" />
        </div>
        <h2 className="otp-verification__title">Verified!</h2>
        <p className="otp-verification__subtitle">
          Your phone number has been successfully verified.
        </p>
      </div>
    );
  }

  return (
    <div className="otp-verification">
      {/* Header */}
      <div className="otp-verification__header">
        <div className="otp-verification__icon-wrapper">
          <Shield className="otp-verification__icon" />
        </div>
        <h2 className="otp-verification__title">
          {purpose === "password_reset" ? "Reset Password" : "Verify Phone"}
        </h2>
        <p className="otp-verification__subtitle">
          Enter the {length}-digit code sent to
        </p>
        <p className="otp-verification__phone">
          <Smartphone className="otp-verification__phone-icon" />
          {maskPhoneNumber(phoneNumber)}
        </p>
      </div>

      {/* OTP Input */}
      <div
        className="otp-verification__input-group"
        role="group"
        aria-label="OTP input"
      >
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            className={`otp-verification__input ${
              error ? "otp-verification__input--error" : ""
            }`}
            aria-label={`Digit ${index + 1} of ${length}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="otp-verification__error" role="alert">
          <AlertCircle className="otp-verification__error-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* Timer */}
      <div className="otp-verification__timer">
        {timeRemaining > 0 ? (
          <span>
            Code expires in <strong>{formatTime(timeRemaining)}</strong>
          </span>
        ) : (
          <span className="otp-verification__expired">Code has expired</span>
        )}
      </div>

      {/* Resend */}
      <div className="otp-verification__resend">
        <button
          type="button"
          onClick={handleResend}
          disabled={!canResend || resendCooldown > 0 || loading}
          className="otp-verification__resend-btn"
        >
          {resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : loading ? (
            <>
              <RefreshCw className="otp-verification__resend-icon otp-verification__resend-icon--spinning" />
              Sending...
            </>
          ) : (
            <>
              <RefreshCw className="otp-verification__resend-icon" />
              Resend Code
            </>
          )}
        </button>
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="otp-verification__cancel-btn"
          disabled={loading}
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default OTPVerification;
