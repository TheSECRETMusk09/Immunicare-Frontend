import React, { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Modal, Input, Select, DataTable } from "../UI";
import {
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Upload,
  Search,
} from "lucide-react";
import apiClient from "../../utils/api";
import { formatDate } from "../../utils/dateUtils";

export const VaccineInventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClinic, setFilterClinic] = useState("");
  const [clinics, setClinics] = useState([]);
  const [formData, setFormData] = useState({
    vaccine_name: "",
    beginning_balance: "",
    received_during_period: "",
    lot_batch_number: "",
    transferred_in: "",
    transferred_out: "",
    expired_wasted: "",
    issuance: "",
    clinic_id: "",
    period_start: "",
    period_end: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = filterClinic
        ? await apiClient.getVaccineInventoryByClinic(filterClinic)
        : await apiClient.getVaccineInventory();
      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterClinic]);

  useEffect(() => {
    fetchData();
    fetchClinics();
  }, [fetchData]);

  const fetchClinics = async () => {
    try {
      const clinicsData = await apiClient.getClinics();
      setClinics(clinicsData);
    } catch (err) {
      console.error("Error fetching clinics:", err);
    }
  };

  const handleAddItem = () => {
    setIsEditing(false);
    setSelectedItem(null);
    setFormData({
      vaccine_name: "",
      beginning_balance: "",
      received_during_period: "",
      lot_batch_number: "",
      transferred_in: "",
      transferred_out: "",
      expired_wasted: "",
      issuance: "",
      clinic_id: filterClinic || "",
      period_start: new Date().toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  };

  const handleEditItem = (item) => {
    setIsEditing(true);
    setSelectedItem(item);
    setFormData({
      vaccine_name: item.vaccine_name,
      beginning_balance: item.beginning_balance.toString(),
      received_during_period: item.received_during_period.toString(),
      lot_batch_number: item.lot_batch_number,
      transferred_in: item.transferred_in.toString(),
      transferred_out: item.transferred_out.toString(),
      expired_wasted: item.expired_wasted.toString(),
      issuance: item.issuance.toString(),
      clinic_id: item.clinic_id.toString(),
      period_start: item.period_start.split("T")[0],
      period_end: item.period_end.split("T")[0],
    });
    setShowModal(true);
  };

  const handleDeleteItem = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this vaccine inventory record?",
      )
    ) {
      try {
        await apiClient.deleteVaccineInventory(id);
        fetchData();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleSaveItem = async () => {
    try {
      const data = {
        ...formData,
        beginning_balance: parseInt(formData.beginning_balance),
        received_during_period: parseInt(formData.received_during_period),
        transferred_in: parseInt(formData.transferred_in),
        transferred_out: parseInt(formData.transferred_out),
        expired_wasted: parseInt(formData.expired_wasted),
        issuance: parseInt(formData.issuance),
        clinic_id: parseInt(formData.clinic_id),
      };

      if (isEditing) {
        await apiClient.updateVaccineInventory(selectedItem.id, data);
      } else {
        await apiClient.createVaccineInventory(data);
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterClinic = (e) => {
    setFilterClinic(e.target.value);
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.vaccine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lot_batch_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClinic =
      !filterClinic || item.clinic_id.toString() === filterClinic;

    return matchesSearch && matchesClinic;
  });

  const columns = [
    {
      Header: "Vaccine",
      accessor: "vaccine_name",
      Cell: ({ value }) => <span className="font-medium">{value}</span>,
    },
    {
      Header: "Beginning Balance",
      accessor: "beginning_balance",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Received",
      accessor: "received_during_period",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Lot/Batch",
      accessor: "lot_batch_number",
    },
    {
      Header: "Transferred In",
      accessor: "transferred_in",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Transferred Out",
      accessor: "transferred_out",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Expired/Wasted",
      accessor: "expired_wasted",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Total Available",
      accessor: "total_available",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Issuance",
      accessor: "issuance",
      Cell: ({ value }) => `${value} vials`,
    },
    {
      Header: "Stock on Hand",
      accessor: "stock_on_hand",
      Cell: ({ value, row }) => {
        const status =
          value <= 10 ? "danger" : value <= 20 ? "warning" : "success";
        return <Badge variant={status}>{value} vials</Badge>;
      },
    },
    {
      Header: "Period",
      accessor: "period_start",
      Cell: ({ value, row }) =>
        `${formatDate(value)} - ${formatDate(row.original.period_end)}`,
    },
    {
      Header: "Actions",
      accessor: "id",
      Cell: ({ value, row }) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditItem(row.original)}
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDeleteItem(value)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <div>Loading vaccine inventory...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div className="vaccine-inventory-management space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Vaccine Inventory Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage vaccine inventory records with detailed tracking
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={fetchData}>
            <Upload className="w-5 h-5 mr-2" />
            Refresh Data
          </Button>
          <Button variant="primary" onClick={handleAddItem}>
            <Plus className="w-5 h-5 mr-2" />
            Add Inventory Record
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search vaccine or lot number..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>
        </div>
        <div className="w-full md:w-64">
          <Select
            value={filterClinic}
            onChange={handleFilterClinic}
            placeholder="Filter by clinic..."
          >
            <option value="">All Clinics</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Inventory Table */}
      <Card title="Vaccine Inventory Records">
        <DataTable columns={columns} data={filteredInventory} />
      </Card>

      {/* Stock Alerts */}
      <Card title="Stock Alerts">
        <div className="space-y-4">
          {filteredInventory
            .filter((item) => item.stock_on_hand <= 10)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
              >
                <div className="flex items-center space-x-4">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                  <div>
                    <h4 className="font-semibold text-red-900">
                      {item.vaccine_name}
                    </h4>
                    <p className="text-sm text-red-600">
                      Current: {item.stock_on_hand} vials |{" "}
                      {item.clinic_id
                        ? clinics.find((c) => c.id === item.clinic_id)?.name
                        : "All Clinics"}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="danger" size="sm">
                    Order Now
                  </Button>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          {filteredInventory.filter((item) => item.stock_on_hand <= 10)
            .length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No low stock alerts at this time
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <Modal
          title={isEditing ? "Edit Vaccine Inventory" : "Add Vaccine Inventory"}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Vaccine Name"
                value={formData.vaccine_name}
                onChange={(e) =>
                  setFormData({ ...formData, vaccine_name: e.target.value })
                }
                required
              />
              <Input
                label="Lot/Batch Number"
                value={formData.lot_batch_number}
                onChange={(e) =>
                  setFormData({ ...formData, lot_batch_number: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Beginning Balance"
                type="number"
                value={formData.beginning_balance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    beginning_balance: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Received During Period"
                type="number"
                value={formData.received_during_period}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    received_during_period: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Issuance"
                type="number"
                value={formData.issuance}
                onChange={(e) =>
                  setFormData({ ...formData, issuance: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Transferred In"
                type="number"
                value={formData.transferred_in}
                onChange={(e) =>
                  setFormData({ ...formData, transferred_in: e.target.value })
                }
                required
              />
              <Input
                label="Transferred Out"
                type="number"
                value={formData.transferred_out}
                onChange={(e) =>
                  setFormData({ ...formData, transferred_out: e.target.value })
                }
                required
              />
              <Input
                label="Expired/Wasted"
                type="number"
                value={formData.expired_wasted}
                onChange={(e) =>
                  setFormData({ ...formData, expired_wasted: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Clinic"
                value={formData.clinic_id}
                onChange={(e) =>
                  setFormData({ ...formData, clinic_id: e.target.value })
                }
                required
              >
                <option value="">Select Clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Period Start"
                type="date"
                value={formData.period_start}
                onChange={(e) =>
                  setFormData({ ...formData, period_start: e.target.value })
                }
                required
              />
              <Input
                label="Period End"
                type="date"
                value={formData.period_end}
                onChange={(e) =>
                  setFormData({ ...formData, period_end: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="cancel"
              actionRole="cancel"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" actionRole="primary" onClick={handleSaveItem}>
              {isEditing ? "Update Inventory" : "Add Inventory"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
