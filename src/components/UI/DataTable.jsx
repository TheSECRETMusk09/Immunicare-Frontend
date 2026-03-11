import React from "react";
import Card from "./Card";
import Button from "./Button";
import LoadingSpinner from "./LoadingSpinner";

/**
 * Normalizes data to ensure it's always an array.
 * Handles cases where API returns wrapped objects like { data: [...] } or { guardians: [...] }
 * @param {any} data - The data to normalize
 * @returns {Array} - Normalized array
 */
const normalizeData = (data) => {
  // Handle null/undefined
  if (data == null) {
    return [];
  }

  // Handle direct arrays
  if (Array.isArray(data)) {
    return data;
  }

  // Handle wrapped objects with common keys
  if (typeof data === "object") {
    // Check for common API response wrapper keys
    const wrapperKeys = [
      "data",
      "results",
      "items",
      "guardians",
      "users",
      "admins",
      "infants",
      "appointments",
      "records",
    ];
    for (const key of wrapperKeys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }

    // If it's an object but not a wrapped array, convert to empty array
    console.warn("DataTable received an object instead of an array:", data);
    return [];
  }

  // Handle other types (string, number, etc.)
  console.warn("DataTable received unexpected data type:", typeof data);
  return [];
};

/**
 * Safe check for empty data (works with arrays and array-like objects)
 * @param {any} data - The data to check
 * @returns {boolean} - True if empty
 */
const isEmptyData = (data) => {
  const normalizedData = normalizeData(data);
  return normalizedData.length === 0;
};

const getHeaderClassName = (column = {}) => {
  const baseClassName =
    "px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)] dark:text-white uppercase tracking-wider";

  return `${baseClassName} ${column.headerClassName || ""}`.trim();
};

const getCellClassName = (column = {}, row, rowIndex) => {
  const wrapClassName = column.nowrap
    ? "whitespace-nowrap"
    : "whitespace-normal break-words";

  const baseClassName = `px-3 py-2.5 text-sm text-[var(--color-text-primary)] align-top ${wrapClassName}`;

  const customClassName =
    typeof column.cellClassName === "function"
      ? column.cellClassName(row, rowIndex)
      : column.cellClassName || "";

  return `${baseClassName} ${customClassName}`.trim();
};

const DataTable = ({
  data = [],
  columns = [],
  actions,
  getRowKey,
  title,
  loading = false,
  emptyMessage = "No data available",
  emptyIcon,
  className = "",
  onDataError,
  actionsHeaderClassName = "",
  actionsCellClassName = "",
}) => {
  // Debug logging
  React.useEffect(() => {
    console.log("[DataTable] Received data:", data);
    console.log("[DataTable] Data type:", typeof data);
    console.log("[DataTable] Is array:", Array.isArray(data));
    if (Array.isArray(data)) {
      console.log("[DataTable] Data length:", data.length);
    }
  }, [data]);

  // Normalize data to ensure it's always an array
  const normalizedData = React.useMemo(() => normalizeData(data), [data]);

  // Debug logging for normalized data
  React.useEffect(() => {
    console.log("[DataTable] Normalized data length:", normalizedData.length);
  }, [normalizedData]);

  // Track if we've encountered an error (for logging/monitoring)
  React.useEffect(() => {
    if (data != null && !Array.isArray(data) && typeof data === "object") {
      const normalized = normalizeData(data);
      if (normalized.length === 0 && onDataError) {
        onDataError(data);
      }
    }
  }, [data, onDataError]);

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  if (isEmptyData(data)) {
    return (
      <Card className={`p-6 text-center py-12 ${className}`}>
        <div className="flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
          {emptyIcon && <div className="text-4xl mb-4">{emptyIcon}</div>}
          <p className="text-lg font-medium">{emptyMessage}</p>
        </div>
      </Card>
    );
  }

  // Export handler
  const handleExport = (format) => {
    // Simple CSV export
    if (format === "csv") {
      const headers = columns.map((col) => col.label).join(",");
      const rows = normalizedData.map((row) =>
        columns.map((col) => JSON.stringify(row[col.key] || "")).join(","),
      );
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "export.csv";
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      {title && (
        <div className="px-6 py-4 border-b border-[var(--color-border-default)] flex justify-between items-center">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            {title}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport("csv")}
            >
              Export CSV
            </Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border-default)] w-full data-table">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key || index}
                  scope="col"
                  data-column="true"
                  className={getHeaderClassName(column)}
                >
                  {column.label}
                </th>
              ))}
              {actions && (
                <th
                  scope="col"
                  data-column="true"
                  className={`px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)] dark:text-white uppercase tracking-wider ${actionsHeaderClassName}`.trim()}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border-default)]">
            {normalizedData.map((row, rowIndex) => (
              <tr
                key={
                  typeof getRowKey === "function"
                    ? getRowKey(row, rowIndex)
                    : row.id || rowIndex
                }
                className="hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key || colIndex}
                    className={getCellClassName(column, row, rowIndex)}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
                {actions && (
                  <td
                    className={`px-3 py-2.5 text-sm font-medium align-top whitespace-nowrap ${actionsCellClassName}`.trim()}
                  >
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default DataTable;
