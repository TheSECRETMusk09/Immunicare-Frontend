import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiClient from "../utils/api";
import GuardianTopHeader from "../components/GuardianTopHeader";
import GuardianModuleHeader from "../components/GuardianModuleHeader";
import {
  Button,
  Alert,
  Input,
  Modal,
} from "../components/UI";
import {
  Baby,
  Calendar,
  FileText,
  Plus,
  Loader2,
  Edit2,
  Trash2,
  User,
  AlertTriangle,
  RefreshCw,
  Bell,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
  triggerGuardianInfantRegistered,
} from "../components/QuickActionFAB";

const getErrorFieldMap = (error) => {
  if (!error || !error.response || !error.response.data) {
    return {};
  }

  const fields = error.response.data.fields;
  if (!fields || typeof fields !== "object") {
    return {};
  }

  const normalized = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      normalized[key] = value;
      return;
    }

    if (Array.isArray(value) && value.length > 0) {
      normalized[key] = String(value[0]);
    }
  });

  return normalized;
};

const mapInfantFieldErrors = (fields = {}) => {
  const mapped = {};

  if (fields.first_name) {
    mapped.first_name = fields.first_name;
  }
  if (fields.last_name) {
    mapped.last_name = fields.last_name;
  }
  if (fields.dob) {
    mapped.dob = fields.dob;
  }
  if (fields.sex) {
    mapped.sex = fields.sex;
  }
  if (fields.birth_weight) {
    mapped.birth_weight = fields.birth_weight;
  }
  if (fields.birth_height) {
    mapped.birth_length = fields.birth_height;
  }
  if (fields.place_of_birth) {
    mapped.birthplace = fields.place_of_birth;
  }

  return mapped;
};

const hasFieldErrors = (errors = {}) => Object.keys(errors).length > 0;

const getActionErrorMessage = (error, fallback) => {
  if (error?.response?.data?.error && typeof error.response.data.error === "string") {
    return error.response.data.error;
  }

  if (error?.response?.data?.message && typeof error.response.data.message === "string") {
    return error.response.data.message;
  }

  return error?.message || fallback;
};

export default function MyChildren() {
  const { guardianId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState(null);
  const [registerSuccess, setRegisterSuccess] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [registerFieldErrors, setRegisterFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});

  // Check if we're on the "new" route
  const isNewRoute = location.pathname.endsWith("/new");

  // Show modal on mount if on new route
  useEffect(() => {
    if (isNewRoute) {
      setShowRegisterModal(true);
    }
  }, [isNewRoute]);

  useEffect(() => {
    const handleOpenAddChildModal = (event) => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }

      setRegisterError(null);
      setRegisterSuccess(null);
      setRegisterFieldErrors({});
      setShowRegisterModal(true);
    };

    window.addEventListener(
      GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
      handleOpenAddChildModal,
    );

    return () => {
      window.removeEventListener(
        GUARDIAN_OPEN_ADD_CHILD_MODAL_EVENT,
        handleOpenAddChildModal,
      );
    };
  }, []);

  const fetchChildren = useCallback(async () => {
    if (!guardianId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.getInfantsByGuardian(guardianId);
      // Handle both direct array response and wrapped response
      const childrenData = Array.isArray(response)
        ? response
        : response?.data || response || [];
      setChildren(childrenData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guardianId]);

  useEffect(() => {
    if (guardianId) {
      fetchChildren();
    }
  }, [guardianId, fetchChildren]);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    sex: "M",
    birth_weight: "",
    birth_length: "",
    birthplace: "",
  });

  // Normalize sex value for display (handles both "M"/"F" and "male"/"female" from backend)
  const normalizeSexForDisplay = (sex) => {
    if (!sex) return 'M'; // Default to Male
    const normalized = String(sex).toUpperCase().charAt(0);
    return normalized === 'M' || normalized === 'F' ? normalized : 'M';
  };

  // Normalize sex for form submission (converts "M"/"F" to "male"/"female" for backend)
  const normalizeSexForSubmission = (sex) => {
    const normalized = normalizeSexForDisplay(sex);
    return normalized === 'M' ? 'male' : 'female';
  };

  // Handle edit form changes
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (editFieldErrors[name]) {
      setEditFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    dob: "",
    sex: "M",
    birth_weight: "",
    birth_length: "",
    birthplace: "",
  });

  // Handle Edit Child Click
  const handleEditChild = (child) => {
    setSelectedChild(child);
    setEditFormData({
      first_name: child.first_name || "",
      last_name: child.last_name || "",
      dob: child.dob ? child.dob.split("T")[0] : "",
      sex: normalizeSexForDisplay(child.sex),
      birth_weight: child.birth_weight || "",
      birth_length: child.birth_height || "",
      birthplace: child.place_of_birth || "",
    });
    setEditError(null);
    setEditSuccess(null);
    setShowEditModal(true);
  };

  // Handle Update Child
  const handleUpdateChild = async (e) => {
    e.preventDefault();
    if (!selectedChild) return;

    // Validate required fields
    if (
      !editFormData.first_name ||
      !editFormData.last_name ||
      !editFormData.dob
    ) {
      setEditError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setEditError(null);
    setEditSuccess(null);
    setEditFieldErrors({});

    try {
      const infantData = {
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        dob: editFormData.dob,
        sex: normalizeSexForSubmission(editFormData.sex),
        birth_weight: editFormData.birth_weight || null,
        birth_height: editFormData.birth_length || null,
        place_of_birth: editFormData.birthplace || null,
      };

      await apiClient.updateGuardianInfant(selectedChild.id, infantData);
      setEditSuccess("Child information updated successfully!");

      // Refresh children list
      fetchChildren();

      // Close modal after delay
      setTimeout(() => {
        setShowEditModal(false);
        setSelectedChild(null);
        setEditSuccess(null);
      }, 1500);
    } catch (err) {
      const backendFields = getErrorFieldMap(err);
      const mappedFields = mapInfantFieldErrors(backendFields);
      if (hasFieldErrors(mappedFields)) {
        setEditFieldErrors(mappedFields);
      }

      setEditError(
        getActionErrorMessage(err, "Failed to update child. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Child Click
  const handleDeleteChildClick = (child) => {
    setSelectedChild(child);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  // Handle Confirm Delete Child
  const handleConfirmDeleteChild = async () => {
    if (!selectedChild) return;

    setIsSubmitting(true);
    setDeleteError(null);

    try {
      await apiClient.deleteGuardianInfant(selectedChild.id);

      // Optimistic UI update - remove child from list immediately
      setChildren(children.filter((c) => c.id !== selectedChild.id));

      setShowDeleteModal(false);
      setSelectedChild(null);
    } catch (err) {
      setDeleteError(
        getActionErrorMessage(err, "Failed to delete child. Please try again."),
      );
      // Refresh list on error to ensure consistency
      fetchChildren();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (registerFieldErrors[name]) {
      setRegisterFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  // Handle child registration
  const handleRegisterChild = async (e) => {
    e.preventDefault();
    if (!guardianId) {
      setRegisterError("You must be logged in to register a child");
      return;
    }

    setIsSubmitting(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    setRegisterFieldErrors({});

    try {
      const infantData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: formData.dob,
        sex: normalizeSexForSubmission(formData.sex),
        guardian_id: guardianId,
        birth_weight: formData.birth_weight || null,
        birth_height: formData.birth_length || null,
        place_of_birth: formData.birthplace || null,
      };

      await apiClient.createGuardianInfant(infantData);
      setRegisterSuccess("Child registered successfully!");

      triggerGuardianInfantRegistered(infantData);

      // Refresh children list immediately for instant UI sync
      await fetchChildren();

      // Close modal and reset form after delay
      setTimeout(() => {
        setShowRegisterModal(false);
        setFormData({
          first_name: "",
          last_name: "",
          dob: "",
          sex: "M",
          birth_weight: "",
          birth_length: "",
          birthplace: "",
        });
        setRegisterSuccess(null);
        // Navigate away from /new route if we're there
        if (isNewRoute) {
          navigate("/guardian/children");
        }
      }, 1500);
    } catch (err) {
      const backendFields = getErrorFieldMap(err);
      const mappedFields = mapInfantFieldErrors(backendFields);
      if (hasFieldErrors(mappedFields)) {
        setRegisterFieldErrors(mappedFields);
      }

      setRegisterError(
        getActionErrorMessage(err, "Failed to register child. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="guardian-page-wrapper min-h-screen bg-theme-bg-primary transition-colors duration-200">
      <div className="lg:hidden sticky top-0 z-30 w-full bg-theme-bg-primary border-b border-theme-border-primary shadow-sm transition-colors duration-200">
        <GuardianTopHeader
          title=""
          onRefresh={fetchChildren}
          isRefreshing={loading}
        />
      </div>

      <GuardianModuleHeader
        title="My Children"
        subtitle="Manage your children’s health records and vaccination schedules"
        icon={<Baby className="w-8 h-8 text-white" />}
        actions={(
          <>
            <Button
              onClick={() => setShowRegisterModal(true)}
              className="guardian-module-hero__primary-btn lg:hidden"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Child
            </Button>
            <div className="hidden lg:flex guardian-desktop-pageheader-actions guardian-desktop-pageheader-actions--with-primary">
              <button
                type="button"
                onClick={fetchChildren}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Refresh My Children"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/notifications")}
                className="guardian-desktop-pageheader-icon-btn guardian-desktop-pageheader-icon-btn--notif"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="guardian-desktop-pageheader-notif-dot" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/guardian/profile")}
                className="guardian-desktop-pageheader-icon-btn"
                aria-label="Open profile"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      />

      <main className="guardian-page-content space-y-4 md:space-y-5 lg:space-y-6">

        {error && (
          <Alert variant="danger" className="mb-2">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="bg-theme-bg-card rounded-2xl p-8 sm:p-12 border border-theme-border-primary text-center shadow-sm transition-all duration-300">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
            <p className="mt-4 text-theme-secondary font-medium">
              Loading children records...
            </p>
          </div>
        ) : children.length === 0 ? (
          <div className="bg-theme-bg-card rounded-2xl p-8 sm:p-12 border border-theme-border-primary text-center shadow-sm transition-all duration-300">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 transition-colors duration-300">
              <Baby className="w-12 h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-theme-primary mb-2 transition-colors duration-300">
              No Children Registered
            </h3>
            <p className="text-theme-secondary max-w-md mx-auto mb-8 transition-colors duration-300">
              You haven't registered any children yet. Add your first child to
              get started with tracking their health journey.
            </p>
            <Button size="lg" onClick={() => setShowRegisterModal(true)}>
              Register Your First Child
            </Button>
          </div>
        ) : (
          <div className="guardian-children-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6">
            {children.map((child) => (
              <div
                key={child.id}
                className="guardian-child-card guardian-theme-card glassmorphism-card rounded-xl border border-transparent backdrop-blur-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group overflow-hidden bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-400/30 to-purple-500/30 backdrop-blur-sm rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {normalizeSexForDisplay(child.sex) === "M" ? (
                        <User className="w-8 h-8 guardian-card-icon-accent guardian-card-icon-accent--blue" />
                      ) : (
                        <User className="w-8 h-8 guardian-card-icon-accent guardian-card-icon-accent--pink" />
                      )}
                    </div>
                    <span className="guardian-status-pill guardian-status-pill--active px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider">
                      Active
                    </span>
                  </div>

                  <h3 className="text-xl font-bold guardian-card-text-primary mb-4">
                    {child.first_name} {child.last_name}
                  </h3>

                  {child.control_number && (
                    <div className="mb-4 inline-block px-3 py-1 rounded guardian-card-chip">
                      <span className="text-xs guardian-card-text-secondary font-mono tracking-wider">
                        Infant Control Number: {child.control_number}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-theme-border-primary">
                      <span className="guardian-card-text-secondary">
                        Date of Birth
                      </span>
                      <span className="font-semibold guardian-card-text-primary">
                        {formatDate(child.dob)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-theme-border-primary">
                      <span className="guardian-card-text-secondary">Age</span>
                      <span className="font-semibold guardian-card-text-primary">
                        {Math.floor(
                          (new Date() - new Date(child.dob)) /
                            (1000 * 60 * 60 * 24 * 365),
                        )}{" "}
                        years
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-theme-border-primary">
                      <span className="guardian-card-text-secondary">Sex</span>
                      <span className="font-semibold guardian-card-text-primary">
                        {normalizeSexForDisplay(child.sex) === "M" ? "Male" : "Female"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="guardian-card-text-secondary">
                        Health Center
                      </span>
                      <span className="font-semibold guardian-card-text-primary truncate max-w-[150px]">
                        {child.health_center || "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="guardian-child-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 justify-center guardian-card-action guardian-card-action--neutral"
                    onClick={() =>
                      navigate(`/guardian/vaccination-records/${child.id}`)
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Records
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 justify-center guardian-card-action guardian-card-action--neutral"
                    onClick={() =>
                      navigate(`/guardian/appointments/new?childId=${child.id}`)
                    }
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                </div>
                <div className="guardian-child-actions border-t-0 pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-center guardian-card-action guardian-card-action--edit"
                    onClick={() => handleEditChild(child)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-center guardian-card-action guardian-card-action--delete"
                    onClick={() => handleDeleteChildClick(child)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {children.length > 0 && (
          <section className="bg-theme-bg-card rounded-2xl p-4 sm:p-5 border border-theme-border-primary shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-bold text-theme-primary">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="secondary"
                className="p-6 h-auto flex-col items-center text-center guardian-quick-action-card guardian-quick-action-card--blue"
                onClick={() => navigate("/guardian/vaccination-records")}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400/30 to-purple-500/30 backdrop-blur-sm flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 guardian-card-icon-accent guardian-card-icon-accent--blue" />
                </div>
                <span className="font-bold guardian-quick-action-title">
                  View All Records
                </span>
                <span className="text-xs guardian-quick-action-description mt-1">
                  Complete history for all children
                </span>
              </Button>

              <Button
                variant="secondary"
                className="p-6 h-auto flex-col items-center text-center guardian-quick-action-card guardian-quick-action-card--emerald"
                onClick={() => navigate("/guardian/appointments/new")}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-500/30 backdrop-blur-sm flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 guardian-card-icon-accent guardian-card-icon-accent--emerald" />
                </div>
                <span className="font-bold guardian-quick-action-title">
                  Book Appointment
                </span>
                <span className="text-xs guardian-quick-action-description mt-1">
                  Schedule a new vaccination visit
                </span>
              </Button>

              <Button
                variant="secondary"
                className="p-6 h-auto flex-col items-center text-center guardian-quick-action-card guardian-quick-action-card--purple"
                onClick={() => navigate("/guardian/vaccination-records")}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-500/30 backdrop-blur-sm flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 guardian-card-icon-accent guardian-card-icon-accent--purple" />
                </div>
                <span className="font-bold guardian-quick-action-title">
                  Download Documents
                </span>
                <span className="text-xs guardian-quick-action-description mt-1">
                  Get PDF certificates and records
                </span>
              </Button>
            </div>
          </section>
        )}

        {/* Registration Modal */}
        <Modal
          isOpen={showRegisterModal}
          onClose={() => {
            setShowRegisterModal(false);
            setRegisterError(null);
            setRegisterSuccess(null);
            // Navigate away from /new route if we're there
            if (isNewRoute) {
              navigate("/guardian/children");
            }
          }}
          title="Register New Child"
          size="md"
          footer={
            <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowRegisterModal(false);
                  setRegisterError(null);
                  setRegisterSuccess(null);
                  if (isNewRoute) {
                    navigate("/guardian/children");
                  }
                }}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                actionRole="primary"
                form="registerChildForm"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--primary"
              >
                {isSubmitting ? "Registering..." : "Register Child"}
              </Button>
            </div>
          }
        >
          {registerError && (
            <Alert
              variant="danger"
              className="mb-4"
              onClose={() => setRegisterError(null)}
            >
              {registerError}
            </Alert>
          )}

          {registerSuccess && (
            <Alert
              variant="success"
              className="mb-4"
              onClose={() => setRegisterSuccess(null)}
            >
              {registerSuccess}
            </Alert>
          )}

          <form
            id="registerChildForm"
            onSubmit={handleRegisterChild}
            className="space-y-4"
          >
            {/* Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                name="first_name"
                value={formData.first_name}
                onChange={handleRegisterChange}
                error={registerFieldErrors.first_name}
                required
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                name="last_name"
                value={formData.last_name}
                onChange={handleRegisterChange}
                error={registerFieldErrors.last_name}
                required
                placeholder="Enter last name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                name="dob"
                type="date"
                value={formData.dob}
                onChange={handleRegisterChange}
                error={registerFieldErrors.dob}
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-theme-secondary">
                  Gender *
                </label>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleRegisterChange}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-theme-bg-input text-theme-primary ${
                    registerFieldErrors.sex ? "border-red-400" : "border-theme-border-primary"
                  }`}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                {registerFieldErrors.sex && (
                  <p className="text-xs text-red-300 mt-1">{registerFieldErrors.sex}</p>
                )}
              </div>
            </div>

            {/* Birth Information */}
            <div className="border-t border-theme-border-primary pt-4 mt-4">
              <h4 className="text-sm font-medium text-theme-secondary mb-3">
                Birth Information (Optional)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Birth Weight (kg)"
                  name="birth_weight"
                  type="number"
                  step="0.01"
                  value={formData.birth_weight}
                  onChange={handleRegisterChange}
                  error={registerFieldErrors.birth_weight}
                  placeholder="e.g., 3.2"
                />
                <Input
                  label="Birth Length (cm)"
                  name="birth_length"
                  type="number"
                  step="0.1"
                  value={formData.birth_length}
                  onChange={handleRegisterChange}
                  error={registerFieldErrors.birth_length}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Place of Birth"
                  name="birthplace"
                  value={formData.birthplace}
                  onChange={handleRegisterChange}
                  error={registerFieldErrors.birthplace}
                  placeholder="Hospital or address"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Edit Child Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedChild(null);
            setEditError(null);
            setEditSuccess(null);
          }}
          title="Edit Child Information"
          size="md"
          footer={
            <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedChild(null);
                  setEditError(null);
                  setEditSuccess(null);
                }}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--secondary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                actionRole="primary"
                form="editChildForm"
                disabled={isSubmitting}
                loading={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--primary"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          }
        >
          {editError && (
            <Alert
              variant="danger"
              className="mb-4"
              onClose={() => setEditError(null)}
            >
              {editError}
            </Alert>
          )}

          {editSuccess && (
            <Alert
              variant="success"
              className="mb-4"
              onClose={() => setEditSuccess(null)}
            >
              {editSuccess}
            </Alert>
          )}

          <form
            id="editChildForm"
            onSubmit={handleUpdateChild}
            className="space-y-4"
          >
            {/* Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                name="first_name"
                value={editFormData.first_name}
                onChange={handleEditChange}
                error={editFieldErrors.first_name}
                required
                placeholder="Enter first name"
              />
              <Input
                label="Last Name"
                name="last_name"
                value={editFormData.last_name}
                onChange={handleEditChange}
                error={editFieldErrors.last_name}
                required
                placeholder="Enter last name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                name="dob"
                type="date"
                value={editFormData.dob}
                onChange={handleEditChange}
                error={editFieldErrors.dob}
                required
              />
              <div className="space-y-2">
                <label className="block text-sm font-medium text-theme-secondary">
                  Gender *
                </label>
                <select
                  name="sex"
                  value={editFormData.sex}
                  onChange={handleEditChange}
                  required
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-theme-bg-input text-theme-primary ${
                    editFieldErrors.sex ? "border-red-400" : "border-theme-border-primary"
                  }`}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
                {editFieldErrors.sex && (
                  <p className="text-xs text-red-300 mt-1">{editFieldErrors.sex}</p>
                )}
              </div>
            </div>

            {/* Birth Information */}
            <div className="border-t border-theme-border-primary pt-4 mt-4">
              <h4 className="text-sm font-medium text-theme-secondary mb-3">
                Birth Information (Optional)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Birth Weight (kg)"
                  name="birth_weight"
                  type="number"
                  step="0.01"
                  value={editFormData.birth_weight}
                  onChange={handleEditChange}
                  error={editFieldErrors.birth_weight}
                  placeholder="e.g., 3.2"
                />
                <Input
                  label="Birth Length (cm)"
                  name="birth_length"
                  type="number"
                  step="0.1"
                  value={editFormData.birth_length}
                  onChange={handleEditChange}
                  error={editFieldErrors.birth_length}
                  placeholder="e.g., 50"
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Place of Birth"
                  name="birthplace"
                  value={editFormData.birthplace}
                  onChange={handleEditChange}
                  error={editFieldErrors.birthplace}
                  placeholder="Hospital or address"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedChild(null);
            setDeleteError(null);
          }}
          title="Delete Child"
          size="md"
          footer={
            <div className="form-actions-modern ui-form-actions ui-form-actions--stack-mobile">
              <Button
                variant="cancel"
                actionRole="cancel"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChild(null);
                  setDeleteError(null);
                }}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--secondary"
              >
                No, Keep Child
              </Button>
              <Button
                variant="danger"
                actionRole="primary"
                onClick={handleConfirmDeleteChild}
                loading={isSubmitting}
                disabled={isSubmitting}
                className="ui-form-action-btn ui-form-action-btn--primary"
              >
                {isSubmitting ? "Deleting..." : "Yes, Delete"}
              </Button>
            </div>
          }
        >
          {deleteError && (
            <Alert
              variant="danger"
              className="mb-4"
              onClose={() => setDeleteError(null)}
            >
              {deleteError}
            </Alert>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-red-400/30 to-pink-500/30 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-300" />
            </div>
            <h3 className="text-lg font-semibold text-theme-primary mb-2">
              Are you sure you want to delete this child?
            </h3>
            <p className="text-theme-secondary">
              This action cannot be undone. All records associated with this child
              will be permanently removed.
            </p>
          </div>

          {selectedChild && (
            <div className="bg-theme-bg-tertiary rounded-lg p-4">
              <div className="text-center flex items-center justify-center">
                {normalizeSexForDisplay(selectedChild.sex) === "M" ? (
                  <User className="w-6 h-6 text-blue-300 mr-2" />
                ) : (
                  <User className="w-6 h-6 text-pink-300 mr-2" />
                )}
                <span className="font-semibold text-theme-primary">
                  {selectedChild.first_name} {selectedChild.last_name}
                </span>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
