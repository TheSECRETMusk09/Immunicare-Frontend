/**
 * Phone Number Management Component
 * Allows guardians to manage their phone numbers with verification
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import smsService from "../services/smsService";
import {
  Phone,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Shield,
  MessageSquare,
} from "lucide-react";
import { Button, Input, Alert, Modal } from "../components/UI";

const PhoneNumberManagement = () => {
  const { guardianId } = useAuth();
  const [phoneNumbers, setPhoneNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // New phone form
  const [newPhone, setNewPhone] = useState("");
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingPhone, setPendingPhone] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [phoneToDelete, setPhoneToDelete] = useState(null);

  const extractPayload = (response) => {
    if (response && typeof response === "object" && "data" in response) {
      return response.data;
    }
    return response;
  };

  const guardianIdAsNumber = Number.parseInt(guardianId, 10);

  useEffect(() => {
    fetchPhoneNumbers();
  }, [fetchPhoneNumbers]);

  const fetchPhoneNumbers = useCallback(async () => {
    if (Number.isNaN(guardianIdAsNumber) || guardianIdAsNumber <= 0) return;

    try {
      setLoading(true);
      const response = await smsService.getGuardianPhones(guardianIdAsNumber);
      const payload = extractPayload(response);
      setPhoneNumbers(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("Error fetching phone numbers:", err);
      setError("Failed to load phone numbers");
    } finally {
      setLoading(false);
    }
  }, [guardianIdAsNumber]);

  const handleAddPhone = async () => {
    if (Number.isNaN(guardianIdAsNumber) || guardianIdAsNumber <= 0) {
      setError("Guardian account is not properly linked. Please sign in again.");
      return;
    }

    if (!newPhone) {
      setError("Please enter a phone number");
      return;
    }

    if (!smsService.validatePhoneNumber(newPhone)) {
      setError("Please enter a valid phone number");
      return;
    }

    try {
      setError(null);
      setIsAddingPhone(true);

      const response = await smsService.updatePhone(guardianIdAsNumber, newPhone, true);
      const payload = extractPayload(response);

      if (payload?.code === "VERIFICATION_SENT") {
        setPendingPhone(newPhone);
        setSuccess(
          "Verification code sent. Please enter the code to verify your phone number.",
        );
      } else {
        setSuccess("Phone number added successfully");
        await fetchPhoneNumbers();
      }

      setNewPhone("");
    } catch (err) {
      console.error("Error adding phone:", err);
      setError(err?.data?.error || err?.response?.data?.error || "Failed to add phone number");
    } finally {
      setIsAddingPhone(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (Number.isNaN(guardianIdAsNumber) || guardianIdAsNumber <= 0) {
      setError("Guardian account is not properly linked. Please sign in again.");
      return;
    }

    if (!verificationCode) {
      setError("Please enter the verification code");
      return;
    }

    try {
      setError(null);
      setIsVerifying(true);

      await smsService.verifyPhoneChange(
        guardianIdAsNumber,
        pendingPhone,
        verificationCode,
      );

      setSuccess("Phone number verified successfully!");
      setPendingPhone(null);
      setVerificationCode("");
      await fetchPhoneNumbers();
    } catch (err) {
      console.error("Error verifying phone:", err);
      setError(err?.data?.error || err?.response?.data?.error || "Invalid verification code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendNewCode = async () => {
    try {
      setError(null);
      setIsAddingPhone(true);

      await smsService.sendVerificationCode(pendingPhone, "phone_update");

      setSuccess("New verification code sent");
    } catch (err) {
      console.error("Error sending code:", err);
      setError(err?.data?.error || err?.response?.data?.error || "Failed to send verification code");
    } finally {
      setIsAddingPhone(false);
    }
  };

  const handleDeletePhone = async () => {
    if (!phoneToDelete) return;

    try {
      setError(null);
      if (Number.isNaN(guardianIdAsNumber) || guardianIdAsNumber <= 0) {
        setError("Guardian account is not properly linked. Please sign in again.");
        return;
      }

      await smsService.deletePhone(guardianIdAsNumber, phoneToDelete.id);
      setShowDeleteModal(false);
      setPhoneToDelete(null);
      setSuccess("Phone number removed");
      await fetchPhoneNumbers();
    } catch (err) {
      console.error("Error deleting phone:", err);
      setError(err?.data?.error || err?.response?.data?.error || "Failed to delete phone number");
    }
  };

  const cancelVerification = () => {
    setPendingPhone(null);
    setVerificationCode("");
    setSuccess(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Phone Numbers
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your verified phone numbers for SMS notifications
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Verification Form */}
      {pendingPhone && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-emerald-900 dark:text-emerald-100">
                Verify Phone Number
              </h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                Enter the verification code sent to{" "}
                {smsService.formatPhoneForDisplay(pendingPhone)}
              </p>

              <div className="mt-4 space-y-3">
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="text-center tracking-widest font-mono"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={handleVerifyPhone}
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Verify
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSendNewCode}
                    disabled={isAddingPhone}
                  >
                    Resend Code
                  </Button>
                  <Button variant="cancel" onClick={cancelVerification}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phone Numbers List */}
      {!pendingPhone && (
        <>
          <div className="space-y-3">
            {phoneNumbers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No phone numbers added yet</p>
                <p className="text-sm mt-1">
                  Add a phone number to receive SMS notifications
                </p>
              </div>
            ) : (
              phoneNumbers.map((phone) => (
                <div
                  key={phone.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        phone.is_verified
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-gray-100 dark:bg-gray-700"
                      }`}
                    >
                      {phone.is_verified ? (
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {phone.phone_number}
                        {phone.is_primary && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                            Primary
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {phone.is_verified ? "Verified" : "Not verified"}
                      </p>
                    </div>
                  </div>

                  {!phone.is_primary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoneToDelete(phone);
                        setShowDeleteModal(true);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Phone Form */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              Add New Phone Number
            </h4>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Enter phone number (e.g., 09171234567)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAddPhone}
                disabled={isAddingPhone || !newPhone}
              >
                {isAddingPhone ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Enter your mobile number to receive SMS notifications for
              appointments and password resets
            </p>
          </div>
        </>
      )}

      {/* SMS Preferences Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              SMS Notifications
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              You will receive SMS notifications for:
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 list-disc list-inside space-y-1">
              <li>Appointment reminders (24-48 hours before)</li>
              <li>Password reset verification codes</li>
              <li>Account security alerts</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Phone Number"
        onConfirm={handleDeletePhone}
        confirmText="Delete"
        confirmVariant="danger"
      >
        <p className="text-gray-600 dark:text-gray-300">
          Are you sure you want to remove this phone number? You will no longer
          receive SMS notifications on this number.
        </p>
      </Modal>
    </div>
  );
};

export default PhoneNumberManagement;
