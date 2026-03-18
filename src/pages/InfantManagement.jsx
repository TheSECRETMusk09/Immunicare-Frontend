import React, { useState, useEffect, useCallback, useRef } from "react";
import infantService from "../services/infantService";
import VaccineScheduleBooklet from "../components/VaccineScheduleBooklet";
import ImmunizationRecordBooklet from "../components/ImmunizationRecordBooklet";
import InfantPersonalRecord from "../components/InfantPersonalRecord";
import ImmunizationChart from "../components/ImmunizationChart";
import AddInfantModal from "../components/AddInfantModal";
import InjectVaccineModal from "../components/InjectVaccineModal";
import useInfantManagementSocket from "../hooks/useInfantManagementSocket";
import { normalizeInfantsResponse } from "../utils/adminDataAdapters";
import {
  Button,
  PageHeader,
  PageContainer,
  Alert,
  DataTable,
  Badge,
  LoadingSpinner,
  Input,
} from "../components/UI";
import {
  ArrowLeft,
  User,
  Calendar,
  BookOpen,
  BarChart2,
  Plus,
  Search,
  Syringe,
  Download,
  Baby,
} from "lucide-react";

const formatControlNumberDisplay = (controlNumber, dateValue) => {
  const base = String(controlNumber || "").trim();
  if (!base) return "Pending";

  const parsedDate = dateValue ? new Date(dateValue) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return base;
  }

  return `${base}-${parsedDate.getMonth() + 1}/${parsedDate.getDate()}/${parsedDate.getFullYear()}`;
};

export default function InfantManagement() {
  const [infants, setInfants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedInfant, setSelectedInfant] = useState(null);
  const [activeView, setActiveView] = useState("list"); // 'list', 'schedule', 'records', 'personal', 'chart'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isMountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchInfants = useCallback(async (isRefresh = false) => {
    const requestId = ++fetchRequestIdRef.current;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const result = await infantService.getAll();
      const infantsData = normalizeInfantsResponse(result?.data ?? result);

      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setInfants(infantsData);
      if (selectedInfant?.id) {
        const refreshedSelected = infantsData.find(
          (entry) => entry.id === selectedInfant.id,
        );
        if (refreshedSelected) {
          setSelectedInfant(refreshedSelected);
        }
      }
    } catch (err) {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      console.error("[InfantManagement] Error fetching infants:", err);
      setError(err.message || "Failed to load infants. Please try again.");
      setInfants([]); // Ensure infants is always an array on error
    } finally {
      if (!isMountedRef.current || requestId !== fetchRequestIdRef.current) {
        return;
      }

      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedInfant?.id]);

  useInfantManagementSocket({
    setInfants,
    onChange: () => {
      void fetchInfants();
    },
  });

  useEffect(() => {
    void fetchInfants();
  }, [fetchInfants]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchInfants(true);
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchInfants]);

  const handleViewBooklet = (infant, viewType) => {
    setSelectedInfant(infant);
    setActiveView(viewType);
  };

  const handleBackToList = () => {
    // Refresh the infants list when returning to list view
    void fetchInfants();
    setSelectedInfant(null);
    setActiveView("list");
  };

  const handlePersonalUpdate = () => {
    // Refresh the infants list when personal info is updated
    void fetchInfants();
  };

  const handleAddSuccess = () => {
    setShowAddModal(false);
    void fetchInfants();
  };

  const filteredInfants = infants.filter(
    (infant) =>
      infant.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      infant.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      infant.guardian_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      infant.mother_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      infant.father_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Export infant data to CSV
  const handleExportInfants = () => {
    const headers = [
      "Name",
      "Date of Birth",
      "Gender",
      "Mother Name",
      "Father Name",
      "Guardian Name",
      "Contact",
    ];
    const rows = filteredInfants.map((infant) => [
      `${infant.first_name} ${infant.last_name}`,
      infant.dob ? new Date(infant.dob).toLocaleDateString() : "",
      infant.sex === "M" || infant.sex === "male"
        ? "Male"
        : infant.sex === "F" || infant.sex === "female"
          ? "Female"
          : "",
      infant.mother_name || "",
      infant.father_name || "",
      infant.guardian_name || "",
      infant.cellphone_number || infant.guardian_phone || "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "infants_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (val, row) => (
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {row.first_name} {row.last_name}
        </div>
      ),
    },
    {
      key: "control_number",
      label: "Infant Control Number",
      render: (val, row) => (
        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
          {formatControlNumberDisplay(val, row.dob)}
        </span>
      ),
    },
    {
      key: "dob",
      label: "Date of Birth",
      type: "date",
    },
    {
      key: "sex",
      label: "Gender",
      render: (val) => {
        // Handle both 'M'/'F' and 'male'/'female' formats
        const isMale =
          val === "male" || val === "M" || val?.toLowerCase() === "male";
        const isFemale =
          val === "female" || val === "F" || val?.toLowerCase() === "female";
        return (
          <Badge variant={isMale ? "info" : "primary"}>
            {isMale ? "Male" : isFemale ? "Female" : "Other"}
          </Badge>
        );
      },
    },
    {
      key: "parents",
      label: "Parents/Guardian",
      render: (val, row) => {
        const parents = [];
        if (row.mother_name) parents.push(`Mother: ${row.mother_name}`);
        if (row.father_name) parents.push(`Father: ${row.father_name}`);
        // If no parents, show guardian name
        if (parents.length === 0 && row.guardian_name) {
          parents.push(row.guardian_name);
        }
        return (
          <div className="text-sm">
            {parents.length > 0 ? (
              parents.map((p, i) => (
                <div key={i} className="text-gray-700 dark:text-gray-300">
                  {p}
                </div>
              ))
            ) : (
              <span className="text-gray-400">Not specified</span>
            )}
          </div>
        );
      },
    },
    {
      key: "contact",
      label: "Contact",
      render: (val, row) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {row.cellphone_number || row.guardian_phone || "Not specified"}
        </div>
      ),
    },
  ];

  const tableActions = (row) => (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="primary"
        size="sm"
        onClick={() => handleViewBooklet(row, "personal")}
        className="gap-1.5"
        title="Personal Information Record"
      >
        <User className="w-4 h-4" /> Personal
      </Button>
      <Button
        variant="success"
        size="sm"
        onClick={() => handleViewBooklet(row, "schedule")}
        className="gap-1.5"
        title="Vaccine Schedule Booklet"
      >
        <Calendar className="w-4 h-4" /> Schedule
      </Button>
      <Button
        variant="info"
        size="sm"
        onClick={() => handleViewBooklet(row, "records")}
        className="gap-1.5"
        title="Immunization Record Booklet"
      >
        <BookOpen className="w-4 h-4" /> Records
      </Button>
      <Button
        variant="warning"
        size="sm"
        onClick={() => handleViewBooklet(row, "chart")}
        className="gap-1.5"
        title="Immunization Chart"
      >
        <BarChart2 className="w-4 h-4" /> Chart
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading infants...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Alert variant="error" title="Error loading infants">
          {error}
          <div className="mt-4">
            <Button onClick={() => fetchInfants(false)} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  if (activeView !== "list" && selectedInfant) {
    return (
      <div className="space-y-8 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBackToList}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to List
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedInfant.first_name} {selectedInfant.last_name}
              </h2>
              <p className="text-xs mt-1 font-mono text-gray-600 dark:text-gray-300">
                Infant Control Number: {formatControlNumberDisplay(selectedInfant.control_number, selectedInfant.dob)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveView("personal")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeView === "personal"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Personal Record
            </button>
            <button
              onClick={() => setActiveView("schedule")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeView === "schedule"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Vaccine Schedule
            </button>
            <button
              onClick={() => setActiveView("records")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeView === "records"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Immunization Records
            </button>
            <button
              onClick={() => setActiveView("chart")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeView === "chart"
                  ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              Immunization Chart
            </button>
          </div>
        </div>

        <PageContainer
          title={
            activeView === "personal"
              ? "Personal Information Record"
              : activeView === "schedule"
                ? "Vaccine Schedule Booklet"
                : activeView === "records"
                  ? "Immunization Record Booklet"
                  : "Immunization Chart"
          }
        >
          <div className="animate-fade-in">
            {activeView === "schedule" && (
              <VaccineScheduleBooklet infantId={selectedInfant.id} />
            )}
            {activeView === "records" && (
              <ImmunizationRecordBooklet infantId={selectedInfant.id} />
            )}
            {activeView === "personal" && (
              <InfantPersonalRecord
                infantId={selectedInfant.id}
                onUpdate={handlePersonalUpdate}
              />
            )}
            {activeView === "chart" && (
              <ImmunizationChart infantId={selectedInfant.id} />
            )}
          </div>
        </PageContainer>

        {/* Inject Vaccine Button */}
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={() => setShowInjectModal(true)}
            variant="primary"
            className="flex items-center gap-2 shadow-lg"
            size="lg"
          >
            <Syringe className="w-5 h-5" /> Record Vaccination
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sticky Header Section - Stays fixed at top while scrolling */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 pb-4 pt-6 px-6">
        <PageHeader
          title="Infant Management"
          subtitle="Digital booklets and records for pediatric patients"
          icon={<Baby className="w-6 h-6" />}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleExportInfants}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export Data
              </Button>
              <Button
                onClick={() => setShowInjectModal(true)}
                variant="success"
                className="flex items-center gap-2"
              >
                <Syringe className="w-4 h-4" /> Record Vaccination
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                variant="primary"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Infant
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 flex flex-col p-4 sm:px-6 sm:pb-6 pt-3 overflow-hidden">
        {/* Search Bar */}
        <div className="flex-shrink-0 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 mb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search infants by name or guardian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              {refreshing && (
                <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing...</span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchInfants(true)}
                disabled={refreshing}
                title="Refresh infant list"
              >
                <span className="mr-1">🔄</span> {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <div className="text-sm text-gray-600 dark:text-gray-400 self-center">
                Showing {filteredInfants.length} of {infants.length} infants
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto auto-hide-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-fade-in">
        <DataTable
          data={filteredInfants}
          columns={columns}
          actions={tableActions}
          emptyMessage="No infants registered yet."
          emptyIcon={<span>👶</span>}
          title="Registered Infants - Click to View Digital Booklets"
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
        </div>
      </div>

      {/* Add Infant Modal */}
      <AddInfantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />

      {/* Inject Vaccine Modal */}
      <InjectVaccineModal
        isOpen={showInjectModal}
        onClose={() => setShowInjectModal(false)}
        infantId={selectedInfant?.id}
        infantName={
          selectedInfant
            ? `${selectedInfant.first_name} ${selectedInfant.last_name}`
            : ""
        }
        onSuccess={() => {
          setShowInjectModal(false);
          if (selectedInfant) {
            fetchInfants();
          }
        }}
      />
    </div>
  );
}
