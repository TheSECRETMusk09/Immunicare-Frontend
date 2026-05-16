import React, { useState } from "react";
import { Card, Button, Modal, Badge, Table } from "../UI";
import { Eye, Calendar,          AlertTriangle } from "lucide-react";
import apiClient from "../../utils/api";

export const InfantVaccinationCard = ({ infant, onRefresh }) => {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vaccinationRecords, setVaccinationRecords] = useState([]);
  const [vaccinationSchedule, setVaccinationSchedule] = useState([]);














  const getNextVaccination = () => {
    if (!vaccinationSchedule.length) return null;

    const pendingVaccinations = vaccinationSchedule.filter(
      (vaccine) => vaccine.status === "pending",
    );

    if (pendingVaccinations.length > 0) {
      return pendingVaccinations.sort(
        (a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date),
      )[0];
    }

    return null;
  };

  const handleViewDetails = async () => {
    try {
      setLoading(true);
      const [records, schedule] = await Promise.all([
        apiClient.getVaccinationRecordsByInfant(infant.id),
        apiClient.getVaccinationSchedulesByInfant(infant.id),
      ]);

      setVaccinationRecords(records);
      setVaccinationSchedule(schedule);
      setShowDetailsModal(true);
    } catch (error) {
      console.error("Error fetching vaccination details:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextVaccination = getNextVaccination();

  return(
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {infant.first_name} {infant.last_name}
            </h3>
            <p className="text-sm text-gray-600">
              Date of Birth:{" "}
              {new Date(infant.date_of_birth).toLocaleDateString()}
            </p>

            <div className="mt-3 space-y-2">
              {nextVaccination ?(
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  <span className="text-sm">
                    Next Vaccination:{" "}
                    {new Date(
                      nextVaccination.scheduled_date,
                    ).toLocaleDateString()}
                  </span>
                  <Badge
                    variant={
                      nextVaccination.status === "pending"
                        ? "warning"
                        : "success"
                    }
                  >
                    {nextVaccination.vaccine_name}
                  </Badge>
                </div>)
                :(
                <div className="flex items-center space-x-2 text-gray-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">No upcoming vaccinations</span>
                </div>)
               }
            </div>
          </div>

          <div className="ml-4 flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetails}
              disabled={loading}
            >
              <Eye className="w-4 h-4 mr-1" />
              {loading ? "Loading..." : "View Details"}
            </Button>
          </div>
        </div>

        {/* Vaccination Progress Indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Vaccination Progress</span>
            <span>
              {
                vaccinationRecords.filter(
                  (record) => record.status === "completed",
                ).length
              }{" "}
              of {vaccinationSchedule.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full"
              style={{
                width: `${(vaccinationRecords.filter((record) => record.status === "completed").length / vaccinationSchedule.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </Card>

      {/* Details Modal */}
      {showDetailsModal &&(
        <Modal
          title={`${infant.first_name} ${infant.last_name} - Vaccination Details`}
          onClose={() => setShowDetailsModal(false)}
          size="lg"
        >
          <div className="space-y-6">
            {/* Personal Information */}
            <Card title="Personal Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <p className="text-gray-900">
                    {infant.first_name} {infant.last_name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <p className="text-gray-900">
                    {new Date(infant.date_of_birth).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <p className="text-gray-900">{infant.gender}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Type
                  </label>
                  <p className="text-gray-900">{infant.blood_type}</p>
                </div>
              </div>
            </Card>

            {/* Vaccination Records */}
            <Card title="Vaccination Records">
              <Table
                columns={[
                  {
                    Header: "Vaccine",
                    accessor: "vaccine_name",
                    Cell: ({ value }) =>(
                      <span className="font-medium">{value}</span>)
                     ,
                  },
                  {
                    Header: "Date Administered",
                    accessor: "date_administered",
                    Cell: ({ value }) =>
                      value
                        ? new Date(value).toLocaleDateString()
                        : "Not administered",
                  },
                  {
                    Header: "Batch Number",
                    accessor: "batch_number",
                  },
                  {
                    Header: "Health Worker",
                    accessor: "health_worker_name",
                  },
                  {
                    Header: "Status",
                    accessor: "status",
                    Cell: ({ value }) =>(
                      <Badge
                        variant={value === "completed" ? "success" : "warning"}
                      >
                        {value}
                      </Badge>)
                     ,
                  },
                ]}
                data={vaccinationRecords}
              />
            </Card>

            {/* Vaccination Schedule */}
            <Card title="Vaccination Schedule">
              <Table
                columns={[
                  {
                    Header: "Vaccine",
                    accessor: "vaccine_name",
                    Cell: ({ value }) =>(
                      <span className="font-medium">{value}</span>)
                     ,
                  },
                  {
                    Header: "Scheduled Date",
                    accessor: "scheduled_date",
                    Cell: ({ value }) => new Date(value).toLocaleDateString(),
                  },
                  {
                    Header: "Age at Vaccination",
                    accessor: "age_months",
                    Cell: ({ value }) => `${value} months`,
                  },
                  {
                    Header: "Status",
                    accessor: "status",
                    Cell: ({ value }) =>(
                      <Badge
                        variant={value === "pending" ? "warning" : "success"}
                      >
                        {value}
                      </Badge>)
                     ,
                  },
                ]}
                data={vaccinationSchedule}
              />
            </Card>

            {/* Medical History */}
            <Card title="Medical History">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {infant.allergies &&(
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Allergies
                    </label>
                    <p className="text-gray-900">{infant.allergies}</p>
                  </div>)
                 }
                {infant.medical_conditions &&(
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Medical Conditions
                    </label>
                    <p className="text-gray-900">{infant.medical_conditions}</p>
                  </div>)
                 }
                {infant.family_medical_history &&(
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Family Medical History
                    </label>
                    <p className="text-gray-900">
                      {infant.family_medical_history}
                    </p>
                  </div>)
                 }
              </div>
            </Card>

            <div className="flex justify-end space-x-3">
              <Button
                variant="cancel"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              <Button variant="primary" onClick={() => onRefresh()}>
                Refresh Data
              </Button>
            </div>
          </div>
        </Modal>)
       }
    </>)
   ;                                                          }
 ;