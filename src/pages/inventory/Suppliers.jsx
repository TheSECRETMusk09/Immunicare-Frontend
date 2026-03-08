import React from "react";
import AdminLayout from "../../components/AdminLayout";
import { Card, Button, DataTable } from "../../components/UI";

const Suppliers = () => {
  const columns = [
    { Header: "Name", accessor: "name" },
    { Header: "Contact", accessor: "contact" },
    { Header: "Email", accessor: "email" },
    { Header: "Status", accessor: "status" },
  ];

  const data = [
    {
      name: "PharmaCorp",
      contact: "John Smith",
      email: "john@pharmacorp.com",
      status: "Active",
    },
    {
      name: "MedSupply Inc",
      contact: "Jane Doe",
      email: "jane@medsupply.com",
      status: "Active",
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Suppliers
        </h1>
        <div className="flex justify-end mb-6">
          <Button variant="primary">Add Supplier</Button>
        </div>
        <Card title="Registered Suppliers">
          <DataTable columns={columns} data={data} pagination />
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Suppliers;
