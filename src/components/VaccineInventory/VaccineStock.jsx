import React, { useState, useEffect } from "react";
import { DataTable, Button, Modal, Input, Select, Alert, Badge } from "../UI";
import apiClient from "../../utils/api";

export const VaccineStock = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({
    vaccineId: "",
    batchNumber: "",
    quantity: "",
    expiryDate: "",
    manufacturer: "",
    minLevel: "",
    supplier: "",
  });
  const [vaccines, setVaccines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const columns = [
    { Header: "Vaccine", accessor: "vaccineName" },
    { Header: "Batch", accessor: "batchNumber" },
    { Header: "Current Stock", accessor: "quantity" },
    { Header: "Min Level", accessor: "minLevel" },
    {
      Header: "Status",
      Cell: ({ row }) => {
        const stock = row.original.quantity;
        const minLevel = row.original.minLevel;
        const status = stock < minLevel ? "Low" : "Good";
        const variant = stock < minLevel ? "danger" : "success";
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    { Header: "Expiry Date", accessor: "expiryDate" },
    { Header: "Manufacturer", accessor: "manufacturer" },
    {
      Header: "Actions",
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleEditItem(row.original)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleReceiveStock(row.original)}
          >
            Receive
          </Button>
        </div>
      ),
    },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch data in parallel
      const [inventoryData, vaccinesData, suppliersData] = await Promise.all([
        apiClient.getVaccineInventory(),
        apiClient.getVaccines(),
        apiClient.getSuppliers(),
      ]);

      // Transform inventory data
      const transformedInventory = inventoryData.map((item) => ({
        id: item.id,
        vaccineId: item.vaccine_id,
        vaccineName:
          vaccinesData.find((v) => v.id === item.vaccine_id)?.name || "Unknown",
        batchNumber: item.batch_number || "N/A",
        quantity: item.quantity || 0,
        minLevel: item.min_level || 0,
        expiryDate: item.expiry_date
          ? new Date(item.expiry_date).toLocaleDateString()
          : "N/A",
        manufacturer: item.manufacturer || "N/A",
        supplier: item.supplier || "N/A",
        ...item,
      }));

      setInventory(transformedInventory);
      setVaccines(vaccinesData);
      setSuppliers(suppliersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleAddItem = () => {
    setCurrentItem(null);
    setFormData({
      vaccineId: "",
      batchNumber: "",
      quantity: "",
      expiryDate: "",
      manufacturer: "",
      minLevel: "",
      supplier: "",
    });
    setIsModalOpen(true);
  };

  const handleEditItem = (item) => {
    setCurrentItem(item);
    setFormData({
      vaccineId: item.vaccineId || "",
      batchNumber: item.batchNumber || "",
      quantity: item.quantity || "",
      expiryDate: item.expiryDate
        ? new Date(item.expiryDate).toISOString().substr(0, 10)
        : "",
      manufacturer: item.manufacturer || "",
      minLevel: item.minLevel || "",
      supplier: item.supplier || "",
    });
    setIsModalOpen(true);
  };

  const handleReceiveStock = (item) => {
    // This would open a different modal for receiving stock
    console.log("Receive stock for:", item);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    try {
      const inventoryData = {
        vaccine_id: formData.vaccineId,
        batch_number: formData.batchNumber,
        quantity: parseInt(formData.quantity),
        expiry_date: formData.expiryDate,
        manufacturer: formData.manufacturer,
        min_level: parseInt(formData.minLevel),
        supplier: formData.supplier,
      };

      if (currentItem) {
        // Update existing item
        await apiClient.updateVaccineInventory(currentItem.id, inventoryData);
      } else {
        // Create new item
        await apiClient.createVaccineInventory(inventoryData);
      }

      setIsModalOpen(false);
      fetchData(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.vaccineName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculate stock alerts
  const stockAlerts = {
    critical: inventory.filter((item) => item.quantity < item.minLevel).length,
    warning: inventory.filter((item) => item.quantity < item.minLevel * 1.5)
      .length,
    normal: inventory.filter((item) => item.quantity >= item.minLevel * 1.5)
      .length,
  };

  if (loading) return <div>Loading inventory...</div>;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="vaccine-inventory">
      <h1 className="text-2xl font-bold mb-6">Vaccine Inventory Management</h1>

      {/* Stock Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Alert type="danger" className="text-center">
          <div className="text-2xl font-bold">{stockAlerts.critical}</div>
          <div>Critical Low Stock</div>
        </Alert>
        <Alert type="warning" className="text-center">
          <div className="text-2xl font-bold">{stockAlerts.warning}</div>
          <div>Warning Low Stock</div>
        </Alert>
        <Alert type="success" className="text-center">
          <div className="text-2xl font-bold">{stockAlerts.normal}</div>
          <div>Normal Stock Levels</div>
        </Alert>
      </div>

      {/* Search and Add controls */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="w-full md:w-1/3">
          <Input
            type="text"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full"
          />
        </div>
        <Button onClick={handleAddItem} className="whitespace-nowrap">
          + Add Inventory Item
        </Button>
      </div>

      {/* Inventory Table */}
      <DataTable
        columns={columns}
        data={filteredInventory}
        pagination
        pageSize={10}
      />

      {/* Inventory Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={currentItem ? "Edit Inventory Item" : "Add Inventory Item"}
        size="lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Vaccine"
              name="vaccineId"
              value={formData.vaccineId}
              onChange={handleFormChange}
              required
            >
              <option value="">Select Vaccine</option>
              {vaccines.map((vaccine) => (
                <option key={vaccine.id} value={vaccine.id}>
                  {vaccine.name}
                </option>
              ))}
            </Select>

            <Input
              label="Batch Number"
              name="batchNumber"
              value={formData.batchNumber}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Quantity"
              name="quantity"
              type="number"
              value={formData.quantity}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Minimum Level"
              name="minLevel"
              type="number"
              value={formData.minLevel}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Expiry Date"
              name="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={handleFormChange}
              required
            />

            <Input
              label="Manufacturer"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleFormChange}
              required
            />

            <Select
              label="Supplier"
              name="supplier"
              value={formData.supplier}
              onChange={handleFormChange}
              required
            >
              <option value="">Select Supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="cancel"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {currentItem ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
