import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../utils/api";
import {
  Card,
  Button,

  PageHeader,
  Alert     ,
  LoadingSpinner,
  Input         ,
  Badge,
} from "../../components/UI";
import {

  Search,
  RefreshCw,

  Download ,
  ArrowUpCircle,
  ArrowDownCircle,
  Package      ,
  X,
} from "lucide-react";

const StockTransactions = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [        , setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(
    searchParams.get("type") || "all",
  );

  useEffect(() => {
    fetchData();
  }, [typeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [transactionsData, vaccinesData] = await Promise.all([
        apiClient.getInventoryTransactions(),
        apiClient.getVaccines(),
      ]);
      setTransactions(transactionsData || []);
      setVaccines(vaccinesData || []);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(err.message);
      // Fallback to mock data
      setTransactions([
        {
          id: 1,
          date: "2026-02-09",
          type: "RECEIVE",
          vaccine_name: "BCG",
          quantity: 50,
          status: "Completed",
          lot_number: "LOT12345",
          reference: "PO-2026-001",
        },
        {
          id: 2,
          date: "2026-02-08",
          type: "ISSUE",
          vaccine_name: "Hepatitis B",
          quantity: 10,
          status: "Completed",
          lot_number: "LOT12344",
          reference: "REQ-2026-001",
        },
        {
          id: 3,
          date: "2026-02-07",
          type: "TRANSFER_IN",
          vaccine_name: "Pentavalent",
          quantity: 30,
          status: "Completed",
          lot_number: "LOT12343",
          reference: "TRF-2026-001",
        },
        {
          id: 4,
          date: "2026-02-06",
          type: "TRANSFER_OUT",
          vaccine_name: "OPV",
          quantity: 20,
          status: "Completed",
          lot_number: "LOT12342",
          reference: "TRF-2026-002",
        },
        {
          id: 5,
          date: "2026-02-05",
          type: "EXPIRE",
          vaccine_name: "Measles",
          quantity: 5,
          status: "Completed",
          lot_number: "LOT12341",
          reference: "EXP-2026-001",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      transaction.vaccine_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      transaction.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type) => {
    switch (type) {
      case "RECEIVE":
        return <ArrowDownCircle className="w-4 h-4 text-green-500" />;
      case "ISSUE":
        return <ArrowUpCircle className="w-4 h-4 text-blue-500" />;
      case "TRANSFER_IN":
        return <ArrowDownCircle className="w-4 h-4 text-purple-500" />;
      case "TRANSFER_OUT":
        return <ArrowUpCircle className="w-4 h-4 text-orange-500" />;
      case "EXPIRE":
      case "WASTE":
        return <Package className="w-4 h-4 text-red-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case "RECEIVE":
        return "success";
      case "ISSUE":
        return "info";
      case "TRANSFER_IN":
        return "primary";
      case "TRANSFER_OUT":
        return "warning";
      case "EXPIRE":
      case "WASTE":
        return "danger";
      default:
        return "secondary";
    }
  };






















































  const stats = {
    total: filteredTransactions.length,
    received: filteredTransactions.filter((t) => t.type === "RECEIVE").length,
    issued: filteredTransactions.filter((t) => t.type === "ISSUE").length,
    transferred: filteredTransactions.filter((t) =>
      t.type?.includes("TRANSFER"),
    ).length,
  };

  if (loading) {
    return(
      <div className="flex flex-col items-center justify-center py-24">
        <LoadingSpinner size="lg" />
        <span className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
          Loading stock transactions...
        </span>
      </div>)
     ;
  }

  if (error) {
    return(
      <div className="text-center py-8">
        <Alert variant="error" title="Error loading transactions">
          {error}
          <div className="mt-4">
            <Button onClick={fetchData} size="sm">
              Retry
            </Button>
          </div>
        </Alert>
      </div>)
     ;
  }

  return(
    <div className="p-6 space-y-6">
      <PageHeader
        title="Stock Transactions"
        subtitle="Track all vaccine inventory movements and transactions"
        icon={<Package className="w-6 h-6" />}
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate("/inventory?tab=stock_movements")}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.total}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total Transactions
          </p>
        </Card>
        <Card className="p-4 text-center border-l-4 border-l-green-500">
          <p className="text-2xl font-bold text-green-600">{stats.received}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Received</p>
        </Card>
        <Card className="p-4 text-center border-l-4 border-l-blue-500">
          <p className="text-2xl font-bold text-blue-600">{stats.issued}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Issued</p>
        </Card>
        <Card className="p-4 text-center border-l-4 border-l-purple-500">
          <p className="text-2xl font-bold text-purple-600">
            {stats.transferred}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Transferred
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-9"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All" },
            { value: "RECEIVE", label: "Received" },
            { value: "ISSUE", label: "Issued" },
            { value: "TRANSFER_IN", label: "Transfer In" },
            { value: "TRANSFER_OUT", label: "Transfer Out" },
            { value: "EXPIRE", label: "Expired" },
          ].map((filter) =>(
            <button
              key={filter.value}
              onClick={() => setTypeFilter(filter.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                typeFilter === filter.value
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {filter.label}
            </button>)
           )}
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vaccine
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Lot Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length > 0 ?
                                        (filteredTransactions.map((transaction)=>(
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {transaction.date}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(transaction.type)}
                        <Badge variant={getTypeBadgeVariant(transaction.type)}>
                          {transaction.type?.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {transaction.vaccine_name}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium">
                        {transaction.quantity} doses
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {transaction.lot_number || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {transaction.reference || "-"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          transaction.status === "Completed"
                            ? "success"
                            : "warning"
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </td>
                  </tr>)
                 ))
                :(
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No transactions found matching your criteria.
                  </td>
                </tr>)
               }
            </tbody>
          </table>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="secondary"
          onClick={() => navigate("/inventory?tab=items")}
        >
          ← Back to Inventory
        </Button>
        <Button
          variant="primary"
          onClick={() => navigate("/inventory?tab=reports")}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> View Reports
        </Button>
      </div>
    </div>)
   ;}
 ;

export default StockTransactions;