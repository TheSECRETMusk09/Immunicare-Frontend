import React, { useState, useEffect } from "react";
import {
  Button,
  PageHeader,
  Card,
  Alert,
  LoadingSpinner,
} from "../../components/UI";
import VaccineInventory from "../../components/VaccineInventory";
import { useAuth } from "../../contexts/AuthContext";
import { Package, FileBarChart, Printer } from "lucide-react";

export default function VaccineInventoryPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for initial render
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    alert(
      "Export to Excel functionality - integrate with Excel generation library",
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="xl" text="Loading inventory data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <PageHeader
        title="Vaccine Inventory Logbook"
        subtitle="Stock monitoring and management for vaccines"
        icon={<Package className="w-6 h-6" />}
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button onClick={handleExport} variant="secondary">
                <FileBarChart className="w-4 h-4 mr-2" /> Export Excel
              </Button>
              <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print</Button>
            </div>
          )
        }
      />

      {/* Admin Access Notice */}
      {!isAdmin && (
        <Alert variant="warning">
          <p className="font-medium">Read-Only Access</p>
          <p className="mt-1">
            You have read-only access to the vaccine inventory. Only healthcare
            administrators can modify inventory records.
          </p>
        </Alert>
      )}

      {/* Vaccine Inventory Component */}
      <VaccineInventory />

      {/* Information Card */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-800">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          📋 About This Inventory Logbook
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Tracking Columns
            </p>
            <p>
              A - Beginning Balance • B - Received • C - Lot/Batch Number • D/E
              - Transfers • G - Expired/Wasted • H - Available • I - Issuance •
              J - Stock on Hand
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              Vaccines Tracked
            </p>
            <p>
              BCG, Hepa B, Pentavalent, OPV, PCV, MR, MMR, IPV, and related
              diluents.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              For Health Center Use
            </p>
            <p>
              This form is used by Barangay San Nicolas Health Center to track
              vaccine stock.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
