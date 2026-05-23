import React, { useEffect, useState } from "react";
import { Button } from "./index";

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const TablePagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  summaryText,
  hasNext,
  hasPrev,
  onPageChange,
  onPageSizeChange,
  idPrefix = "table",
  disabled = false,
}) => {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeCurrentPage = Math.min(
    Math.max(1, Number(currentPage) || 1),
    safeTotalPages,
  );
  const computedHasPrev =
    typeof hasPrev === "boolean" ? hasPrev : safeCurrentPage > 1;
  const computedHasNext =
    typeof hasNext === "boolean" ? hasNext : safeCurrentPage < safeTotalPages;

  const [pageInputValue, setPageInputValue] = useState(String(safeCurrentPage));

  useEffect(() => {
    setPageInputValue(String(safeCurrentPage));
  }, [safeCurrentPage]);

  const handlePageJumpSubmit = () => {
    const trimmed = String(pageInputValue || "").trim();
    if (!trimmed) return;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      setPageInputValue(String(safeCurrentPage));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), safeTotalPages);
    onPageChange?.(clamped);
    setPageInputValue(String(clamped));
  };

  const rowsId = `${idPrefix}-rows-per-page`;
  const jumpId = `${idPrefix}-page-jump`;

  return (
    <div className="flex flex-shrink-0 flex-col gap-3 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm text-gray-500">{summaryText}</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div className="flex items-center gap-2">
          <label
            htmlFor={rowsId}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Rows
          </label>
          <select
            id={rowsId}
            value={itemsPerPage}
            onChange={(event) => {
              const next = Number(event.target.value) || pageSizeOptions[0];
              onPageSizeChange?.(next);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Rows per page"
            disabled={disabled}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange?.(Math.max(1, safeCurrentPage - 1))}
            disabled={disabled || !computedHasPrev || safeCurrentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Page {safeCurrentPage} of {safeTotalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onPageChange?.(Math.min(safeTotalPages, safeCurrentPage + 1))
            }
            disabled={
              disabled || !computedHasNext || safeCurrentPage === safeTotalPages
            }
          >
            Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={jumpId}
            className="text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Go to page
          </label>
          <input
            id={jumpId}
            type="number"
            min="1"
            max={safeTotalPages}
            value={pageInputValue}
            onChange={(event) => setPageInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handlePageJumpSubmit();
              }
            }}
            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            aria-label="Go to page"
            disabled={disabled}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePageJumpSubmit}
            disabled={disabled || safeTotalPages <= 1}
          >
            Go
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TablePagination;
