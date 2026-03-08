import React, { useState, useEffect } from "react";
import { Button, Card, Input, PageHeader } from "../components/UI";
import InfantCard from "../components/VaccineTracking/InfantCard";
import DetailedViewModal from "../components/VaccineTracking/DetailedViewModal";
import AddVaccineModal from "../components/VaccineTracking/AddVaccineModal";
import ComplianceMonitor from "../components/VaccineTracking/ComplianceMonitor";
import apiClient from "../utils/api";
import { Syringe } from "lucide-react";

export default function VaccineTrackingDashboard() {
  const [infants, setInfants] = useState([]);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedules, setVaccinationSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInfant, setSelectedInfant] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [infantsData, recordsData, schedulesData] = await Promise.all([
        apiClient.getInfants(),
        apiClient.getVaccinationRecords(),
        apiClient.getVaccinationSchedules(),
      ]);
      setInfants(infantsData);
      setVaccinationRecords(recordsData);
      setVaccinationSchedules(schedulesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVaccine = (infant) => {
    setSelectedInfant(infant);
    setShowAddVaccineModal(true);
  };

  const handleViewDetails = (infant) => {
    setSelectedInfant(infant);
    setShowDetailModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.createVaccinationRecord({
        infant_id: selectedInfant.id,
        vaccine_id: "",
        dose_no: 1,
        admin_date: "",
        healthcare_worker: "",
        batch_number: "",
        notes: "",
      });
      await fetchData();
      setShowAddVaccineModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredInfants = infants.filter((infant) => {
    return (
      infant.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      infant.last_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">Error: {error}</div>
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <PageHeader
        title="Pediatric Vaccine Tracking System"
        subtitle="Comprehensive monitoring and tracking of vaccine administration for infants"
        icon={Syringe}
      />

      {/* Compliance Monitor */}
      <ComplianceMonitor
        infants={infants}
        vaccinationRecords={vaccinationRecords}
        vaccinationSchedules={vaccinationSchedules}
      />

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="w-full md:w-1/3">
          <Input
            placeholder="Search children..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon="🔍"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <span className="mr-2">📄</span> Export Report
          </Button>
          <Button variant="secondary">
            <span className="mr-2">📊</span> Generate Statistics
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {infants.length}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Children Tracked
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {vaccinationRecords.filter((v) => v.admin_date).length}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Vaccines Administered
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {vaccinationRecords.filter((v) => !v.admin_date).length}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Vaccines Pending
          </p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(
              (vaccinationRecords.filter((v) => v.admin_date).length /
                (vaccinationRecords.length || 1)) *
                100,
            )}
            %
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Overall Compliance
          </p>
        </Card>
      </div>

      {/* Tracking Dashboard */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Vaccine Tracking Dashboard
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring of pediatric vaccination progress
          </p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInfants.map((infant) => (
              <InfantCard
                key={infant.id}
                infant={infant}
                vaccinationRecords={vaccinationRecords}
                vaccinationSchedules={vaccinationSchedules}
                onAddVaccine={handleAddVaccine}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Detailed View Modal */}
      {selectedInfant && (
        <DetailedViewModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          infant={selectedInfant}
          vaccinationRecords={vaccinationRecords}
          vaccinationSchedules={vaccinationSchedules}
        />
      )}

      {/* Add Vaccine Modal */}
      <AddVaccineModal
        isOpen={showAddVaccineModal}
        onClose={() => setShowAddVaccineModal(false)}
        infant={selectedInfant}
        vaccinationSchedules={vaccinationSchedules}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
