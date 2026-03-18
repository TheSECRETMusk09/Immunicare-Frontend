import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import api from "../utils/api";
import {
  Button,
  PageHeader,
  PageContainer,
  Alert,
  DataTable,
  Badge,
  LoadingSpinner,
  Input,
  Modal,
  AdminModalActions,
  TextArea,
  Select,
  Checkbox,
} from "../components/UI";
import { Search, CheckCircle, XCircle, Eye, Clock, FileText, Download, Trash2 } from "lucide-react";

const TRANSFER_STATUS = {
  PENDING: "pending",
  VALIDATED: "validated",
  REJECTED: "rejected",
  IN_PROGRESS: "in_progress",
};

const STATUS_LABELS = {
  [TRANSFER_STATUS.PENDING]: { label: "Pending", variant: "warning" },
  [TRANSFER_STATUS.VALIDATED]: { label: "Validated", variant: "success" },
  [TRANSFER_STATUS.REJECTED]: { label: "Rejected", variant: "danger" },
  [TRANSFER_STATUS.IN_PROGRESS]: { label: "In Progress", variant: "info" },
};

const VALIDATION_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
};

const PRIORITY_LABELS = {
  [VALIDATION_PRIORITY.LOW]: { label: "Low", variant: "secondary" },
  [VALIDATION_PRIORITY.NORMAL]: { label: "Normal", variant: "warning" },
  [VALIDATION_PRIORITY.HIGH]: { label: "High", variant: "danger" },
};

const TRIAGE_CATEGORIES = [
  "ready_for_scheduling",
  "needs_record_verification",
  "needs_missing_information",
  "not_yet_due",
  "overdue_priority_followup",
];

const TRIAGE_LABELS = {
  ready_for_scheduling: { label: "Ready for Scheduling", variant: "success" },
  needs_record_verification: { label: "Needs Record Verification", variant: "warning" },
  needs_missing_information: { label: "Needs Missing Information", variant: "danger" },
  not_yet_due: { label: "Not Yet Due", variant: "secondary" },
  overdue_priority_followup: { label: "Overdue Priority Follow-up", variant: "danger" },
};

export default function TransferInCases() {
  const { isAdmin } = useAuth();
  const { success, error, warning } = useNotification();

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorState, setErrorState] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [triageFilter, setTriageFilter] = useState("");

  const [selectedCase, setSelectedCase] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showVaccineImportModal, setShowVaccineImportModal] = useState(false);
  const [validationNotes, setValidationNotes] = useState("");
  const [validationStatus, setValidationStatus] = useState("");

  // State for vaccine approval
  const [selectedVaccines, setSelectedVaccines] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  const [isValidating, setIsValidating] = useState(false);

  const fetchCases = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorState(null);

      const response = await api.getTransferInCases();

      if (response.success) {
        setCases(response.data || []);
      } else {
        setErrorState(response.error || "Failed to fetch transfer-in cases");
        setCases([]);
      }
    } catch (err) {
      console.error("Error fetching transfer-in cases:", err);
      setErrorState(err.message || "Failed to fetch transfer-in cases");
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchCases();
    }
  }, [isAdmin, fetchCases]);

  useEffect(() => {
    let result = [...cases];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (caseItem) =>
          caseItem.guardian_name?.toLowerCase().includes(query) ||
          caseItem.source_facility?.toLowerCase().includes(query) ||
          caseItem.auto_computed_next_vaccine?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((caseItem) => caseItem.validation_status === statusFilter);
    }

    if (priorityFilter) {
      result = result.filter((caseItem) => caseItem.validation_priority === priorityFilter);
    }

    if (triageFilter) {
      result = result.filter((caseItem) => caseItem.triage_category === triageFilter);
    }

    setFilteredCases(result);
  }, [cases, searchQuery, statusFilter, priorityFilter, triageFilter]);

  const handleViewDetails = (caseItem) => {
    setSelectedCase(caseItem);
    setShowDetailsModal(true);
  };

  const handleStartValidation = (caseItem) => {
    setSelectedCase(caseItem);
    setValidationNotes("");
    setValidationStatus("");
    setShowValidationModal(true);
  };

  const handleOpenVaccineImport = (caseItem) => {
    setSelectedCase(caseItem);
    // Initialize all vaccines as selected by default
    const initialSelected = {};
    if (caseItem.submitted_vaccines && Array.isArray(caseItem.submitted_vaccines)) {
      caseItem.submitted_vaccines.forEach((vaccine, index) => {
        initialSelected[index] = true;
      });
    }
    setSelectedVaccines(initialSelected);
    setShowVaccineImportModal(true);
  };

  const handleToggleVaccine = (index) => {
    setSelectedVaccines(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const handleSelectAll = (select) => {
    const newSelection = {};
    if (selectedCase?.submitted_vaccines) {
      selectedCase.submitted_vaccines.forEach((_, index) => {
        newSelection[index] = select;
      });
    }
    setSelectedVaccines(newSelection);
  };

  const handleImportVaccines = async () => {
    if (!selectedCase) return;

    const vaccinesToImport = selectedCase.submitted_vaccines
      .filter((_, index) => selectedVaccines[index])
      .map(v => ({
        vaccine_name: v.vaccine_name,
        dose_number: v.dose_number,
        date_administered: v.date_administered,
        batch_number: v.batch_number,
      }));

    if (vaccinesToImport.length === 0) {
      warning("Please select at least one vaccine to import");
      return;
    }

    setIsImporting(true);

    try {
      const response = await api.approveTransferCaseVaccines(selectedCase.id, {
        approvedVaccines: vaccinesToImport,
        importToRecords: true,
      });

      if (response.success) {
        success(`Successfully imported ${response.data?.summary?.success || 0} vaccines`);
        setShowVaccineImportModal(false);
        fetchCases();
      } else {
        error(response.error || "Failed to import vaccines");
      }
    } catch (err) {
      console.error("Error importing vaccines:", err);
      error(err.message || "Failed to import vaccines");
    } finally {
      setIsImporting(false);
    }
  };

  const handleValidate = async () => {
    if (!validationStatus) {
      warning("Please select a validation status");
      return;
    }

    setIsValidating(true);

    try {
      const response = await api.updateTransferInCase(selectedCase.id, {
        validation_status: validationStatus,
        validation_notes: validationNotes,
        validated_at: new Date().toISOString(),
      });

      if (response.success) {
        success("Transfer-in case validated successfully");
        setShowValidationModal(false);
        fetchCases();
      } else {
        error(response.error || "Failed to validate transfer-in case");
      }
    } catch (err) {
      console.error("Error validating transfer-in case:", err);
      error(err.message || "Failed to validate transfer-in case");
    } finally {
      setIsValidating(false);
    }
  };

  const columns = [
    {
      key: "guardian_name",
      label: "Guardian",
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {val || "N/A"}
        </div>
      ),
    },
    {
      key: "source_facility",
      label: "Source Facility",
    },
    {
      key: "submitted_vaccines_count",
      label: "Vaccines Submitted",
      render: (val, row) => {
        const count = row.submitted_vaccines ? row.submitted_vaccines.length : 0;
        return <Badge variant="info">{count}</Badge>;
      },
    },
    {
      key: "auto_computed_next_vaccine",
      label: "Next Vaccine",
      render: (val) => (
        <div className="max-w-xs truncate" title={val || "N/A"}>
          {val || "N/A"}
        </div>
      ),
    },
    {
      key: "triage_category",
      label: "Triage Category",
      render: (val) => {
        const triage = TRIAGE_LABELS[val] || { label: val, variant: "secondary" };
        return <Badge variant={triage.variant}>{triage.label}</Badge>;
      },
    },
    {
      key: "validation_status",
      label: "Validation Status",
      render: (val) => {
        const status = STATUS_LABELS[val] || { label: val, variant: "secondary" };
        return (
          <div className="flex items-center gap-2">
            {val === TRANSFER_STATUS.REJECTED && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            {val === TRANSFER_STATUS.PENDING && (
              <Clock className="w-4 h-4 text-yellow-500" />
            )}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        );
      },
    },
    {
      key: "validation_priority",
      label: "Priority",
      render: (val) => {
        const priority = PRIORITY_LABELS[val] || { label: val, variant: "secondary" };
        return <Badge variant={priority.variant}>{priority.label}</Badge>;
      },
    },
    {
      key: "created_at",
      label: "Submitted Date",
      type: "date",
    },
  ];

  const tableActions = (row) => (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="info"
        size="sm"
        onClick={() => handleViewDetails(row)}
        className="gap-1.5"
        title="View Details"
      >
        <Eye className="w-4 h-4" /> View
      </Button>
      {row.validation_status === TRANSFER_STATUS.PENDING && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleStartValidation(row)}
            className="gap-1.5"
            title="Validate"
          >
            <CheckCircle className="w-4 h-4" /> Validate
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleOpenVaccineImport(row)}
            className="gap-1.5"
            title="Import Vaccines"
          >
            <Download className="w-4 h-4" /> Import
          </Button>
        </>
      )}
    </div>
  );

  if (!isAdmin) {
    return (
      <PageContainer>
        <Alert variant="error" title="Access Denied">
          You do not have permission to view this section.
        </Alert>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading transfer-in cases...
        </span>
      </div>
    );
  }

  if (errorState) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading transfer-in cases">
          {errorState}
          <div className="mt-4">
            <Button onClick={() => fetchCases(false)} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <div className="space-y-8 px-6">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6 -mx-6 -mt-6">
        <PageHeader
          title="Transfer-In Cases Validation"
          subtitle="Review and validate transfer-in cases from other health centers"
          icon={<FileText className="w-6 h-6" />}
          actions={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => fetchCases(true)}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <span className="mr-1">🔄</span>{" "}
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          }
        />
      </div>

      {/* Filters - Sticky below header */}
      <div className="sticky top-[88px] z-20 bg-white dark:bg-gray-900 -mx-6 px-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search by guardian name, facility, or vaccine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            placeholder="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Statuses" },
              { value: TRANSFER_STATUS.PENDING, label: "Pending" },
              { value: TRANSFER_STATUS.VALIDATED, label: "Validated" },
              { value: TRANSFER_STATUS.REJECTED, label: "Rejected" },
              { value: TRANSFER_STATUS.IN_PROGRESS, label: "In Progress" },
            ]}
            className="w-48"
          />

          <Select
            placeholder="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={[
              { value: "", label: "All Priorities" },
              { value: VALIDATION_PRIORITY.LOW, label: "Low" },
              { value: VALIDATION_PRIORITY.NORMAL, label: "Normal" },
              { value: VALIDATION_PRIORITY.HIGH, label: "High" },
            ]}
            className="w-48"
          />

          <Select
            placeholder="Filter by triage"
            value={triageFilter}
            onChange={(e) => setTriageFilter(e.target.value)}
            options={[
              { value: "", label: "All Categories" },
              ...TRIAGE_CATEGORIES.map((category) => ({
                value: category,
                label: TRIAGE_LABELS[category].label,
              })),
            ]}
            className="w-48"
          />
        </div>
        </div>
      </div>

      <div className="animate-fade-in px-6 -mx-6">
        <DataTable
          data={filteredCases}
          columns={columns}
          actions={tableActions}
          emptyMessage="No transfer-in cases found."
          emptyIcon={<span>📄</span>}
          title="Transfer-In Cases - Click to View Details"
        />
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Transfer-In Case Details"
        size="lg"
        footer={
          <AdminModalActions>
            <Button variant="cancel" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            {selectedCase?.validation_status === TRANSFER_STATUS.PENDING && (
              <Button
                variant="primary"
                onClick={() => handleStartValidation(selectedCase)}
              >
                Validate Case
              </Button>
            )}
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Guardian Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Name:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Email:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_email || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Phone:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_phone || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Case Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Source Facility:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.source_facility || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Status:{" "}
                    </span>
                    <span className="font-medium">
                      {STATUS_LABELS[selectedCase.validation_status]?.label ||
                        selectedCase.validation_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Priority:{" "}
                    </span>
                    <span className="font-medium">
                      {PRIORITY_LABELS[selectedCase.validation_priority]?.label ||
                        selectedCase.validation_priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Triage Category:{" "}
                    </span>
                    <span className="font-medium">
                      {TRIAGE_LABELS[selectedCase.triage_category]?.label ||
                        selectedCase.triage_category}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Submitted Vaccines
              </h4>
              {selectedCase.submitted_vaccines &&
              selectedCase.submitted_vaccines.length > 0 ? (
                <ul className="space-y-2">
                  {selectedCase.submitted_vaccines.map((vaccine, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-sm font-medium">
                        {vaccine.vaccine_name}
                      </span>
                      {vaccine.dose_number && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          (Dose {vaccine.dose_number})
                        </span>
                      )}
                      {vaccine.administration_date && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          - {new Date(vaccine.administration_date).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No vaccines submitted
                </p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Auto-Computed Next Vaccine
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {selectedCase.auto_computed_next_vaccine || "N/A"}
              </p>
            </div>

            {selectedCase.remarks && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Remarks
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.remarks}
                </p>
              </div>
            )}

            {selectedCase.validation_notes && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Validation Notes
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.validation_notes}
                </p>
                {selectedCase.validated_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Validated on{" "}
                    {new Date(selectedCase.validated_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Validation Modal */}
      <Modal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Validate Transfer-In Case"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              onClick={() => setShowValidationModal(false)}
              disabled={isValidating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleValidate}
              disabled={isValidating || !validationStatus}
            >
              {isValidating ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Validating...
                </span>
              ) : (
                "Validate"
              )}
            </Button>
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <Alert variant="warning" title="Validation Warning">
              This action will validate the transfer-in case and update the
              infant's vaccination record. Please review the information
              carefully before proceeding.
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Guardian Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Name:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.guardian_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Source Facility:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedCase.source_facility || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                  Next Vaccine
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedCase.auto_computed_next_vaccine || "N/A"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Validation Status"
                value={validationStatus}
                onChange={(e) => setValidationStatus(e.target.value)}
                required
                options={[
                  { value: TRANSFER_STATUS.VALIDATED, label: "Validate" },
                  { value: TRANSFER_STATUS.REJECTED, label: "Reject" },
                ]}
              />

              <TextArea
                label="Validation Notes"
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Add notes about the validation (required if rejecting)..."
                rows={4}
                required
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Vaccine Import Modal */}
      <Modal
        isOpen={showVaccineImportModal}
        onClose={() => setShowVaccineImportModal(false)}
        title="Import Vaccines to Records"
        size="lg"
        footer={
          <AdminModalActions>
            <Button
              variant="cancel"
              onClick={() => setShowVaccineImportModal(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleImportVaccines}
              disabled={isImporting}
            >
              {isImporting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" /> Importing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4" /> Import Selected
                </span>
              )}
            </Button>
          </AdminModalActions>
        }
      >
        {selectedCase && (
          <div className="space-y-6">
            <Alert variant="info" title="Vaccine Import">
              Select the vaccines you want to import into the infant's vaccination records.
              Duplicate vaccines will be skipped automatically.
            </Alert>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
                Case Information
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Infant:</span>{" "}
                  <span className="font-medium">
                    {selectedCase.infant_first_name} {selectedCase.infant_last_name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Source Facility:</span>{" "}
                  <span className="font-medium">{selectedCase.source_facility}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-900 dark:text-gray-100">
                  Submitted Vaccines
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(true)}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectAll(false)}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              {selectedCase.submitted_vaccines && selectedCase.submitted_vaccines.length > 0 ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedCase.submitted_vaccines.map((vaccine, index) => (
                    <div
                      key={index}
                      className={`p-3 flex items-center gap-3 ${
                        selectedVaccines[index]
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <Checkbox
                        checked={!!selectedVaccines[index]}
                        onChange={() => handleToggleVaccine(index)}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {vaccine.vaccine_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Dose {vaccine.dose_number}
                          {vaccine.date_administered && (
                            <> • {new Date(vaccine.date_administered).toLocaleDateString()}</>
                          )}
                          {vaccine.batch_number && (
                            <> • Batch: {vaccine.batch_number}</>
                          )}
                        </div>
                      </div>
                      {selectedVaccines[index] && (
                        <Badge variant="success">Selected</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No vaccines submitted
                </p>
              )}

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Selected: {Object.values(selectedVaccines).filter(Boolean).length} of{" "}
                {selectedCase.submitted_vaccines?.length || 0} vaccines
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
