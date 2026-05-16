import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useDeferredValue,
} from "react";
import { Search, X, ChevronDown } from "lucide-react";
import {
  buildInfantSearchText,
  formatInfantDate,
  getInfantDateOfBirthValue,
  getInfantControlNumber,
  getInfantDisplayLabel,
  getInfantFullName,
  matchesTokenizedTextSearch,
} from "../utils/infantIdentity";

const SearchableInfantSelect = ({
  infants = [],
  value = "",
  onChange,
  label = "Select Infant",
  required = false,
  placeholder = "Search by name, control number, or date of birth...",
  disabled = false,
  error = "",
  id,
  name,
  ariaDescribedBy,
  loading = false,
  emptyMessage = "No infants available",
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  onOpenChange,
  selectedInfant: selectedInfantOverride = null,
  hasMore = false,
  onLoadMore,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchQuery =
    controlledSearchQuery !== undefined
      ? controlledSearchQuery
      : internalSearchQuery;
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const setDropdownOpen = useCallback(
    (nextIsOpen) => {
      setIsOpen(nextIsOpen);
      if (typeof onOpenChange === "function") {
        onOpenChange(nextIsOpen);
      }
    },
    [onOpenChange],
  );

  const updateSearchQuery = (nextValue) => {
    if (controlledSearchQuery === undefined) {
      setInternalSearchQuery(nextValue);
    }

    if (typeof onSearchQueryChange === "function") {
      onSearchQueryChange(nextValue);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }

    return undefined;
  }, [isOpen, setDropdownOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, setDropdownOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, setDropdownOpen]);

  const infantsWithSearchData = useMemo(
    () =>
      infants.map((infant) => ({
        ...infant,
        displayName: getInfantDisplayLabel(infant),
        fullName: getInfantFullName(infant),
        controlNumber: getInfantControlNumber(infant),
        dobDisplay: formatInfantDate(getInfantDateOfBirthValue(infant)),
        searchText: infant.search_text || buildInfantSearchText(infant),
      })),
    [infants]
  );

  const filteredInfants = useMemo(() => {
    if (!deferredSearchQuery.trim()) return infantsWithSearchData;

    return infantsWithSearchData.filter((infant) =>
      matchesTokenizedTextSearch(infant.searchText, deferredSearchQuery)
    );
  }, [deferredSearchQuery, infantsWithSearchData]);

  const selectedInfant = useMemo(() => {
    const selectedId = Number(value);
    if (!selectedId) {
      return null;
    }

    const matchedInfant = infantsWithSearchData.find(
      (infant) => Number(infant.id) === selectedId,
    );
    if (matchedInfant) {
      return matchedInfant;
    }

    if (
      selectedInfantOverride &&
      Number(selectedInfantOverride.id) === selectedId
    ) {
      return {
        ...selectedInfantOverride,
        displayName: getInfantDisplayLabel(selectedInfantOverride),
        fullName: getInfantFullName(selectedInfantOverride),
        controlNumber: getInfantControlNumber(selectedInfantOverride),
        dobDisplay: formatInfantDate(getInfantDateOfBirthValue(selectedInfantOverride)),
        searchText:
          selectedInfantOverride.searchText ||
          selectedInfantOverride.search_text ||
          buildInfantSearchText(selectedInfantOverride),
      };
    }

    return null;
  }, [infantsWithSearchData, selectedInfantOverride, value]);

  const handleSelect = (infant) => {
    onChange({ target: { value: String(infant.id) } });
    setDropdownOpen(false);
    updateSearchQuery("");
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange({ target: { value: "" } });
    updateSearchQuery("");
  };

  const displayText = selectedInfant
    ? `${selectedInfant.displayName || selectedInfant.fullName || selectedInfant.name || "Infant record"}${selectedInfant.dobDisplay ? ` (${selectedInfant.dobDisplay})` : ""}`
    : "Select Infant";

  return (
    <div className="admin-field-group" ref={containerRef}>
      {label && (
        <label className={`admin-field-label${required ? " required" : ""}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setDropdownOpen(!isOpen)}
          disabled={disabled}
          id={id}
          name={name}
          aria-haspopup="listbox"
          aria-expanded={isOpen ? "true" : "false"}
          aria-describedby={ariaDescribedBy}
      className={`
        w-full px-4 py-2.5 text-left
        bg-white dark:bg-gray-800
        border ${error ? "border-red-500 dark:border-red-400" : "border-gray-300 dark:border-gray-700"}
        rounded-lg
        text-gray-900 dark:text-gray-100
        hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 ${error ? "focus:ring-red-500" : "focus:ring-blue-500"}
        transition-colors
        flex items-center justify-between
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
        >
          <span className={!selectedInfant ? "text-gray-400" : ""}>
            {displayText}
          </span>
          <div className="flex items-center gap-2">
            {selectedInfant && !disabled && (
              <X
                className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={handleClear}
              />
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl max-h-96 flex flex-col"
          >
            <div className="p-3 border-b border-gray-300 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => updateSearchQuery(event.target.value)}
                  placeholder={placeholder}
                  className="
                    w-full pl-10 pr-4 py-2
                    bg-white dark:bg-gray-900
                    border border-gray-300 dark:border-gray-600
                    rounded-lg
                    text-gray-900 dark:text-gray-100
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                    text-sm
                  "
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-80 modern-scrollbar">
              {loading && filteredInfants.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Loading infants...
                </div>
              ) : filteredInfants.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {searchQuery ? "No matching infant found" : emptyMessage}
                </div>
              ) : (
                <div className="py-1">
                  {filteredInfants.map((infant) => (
                    <button
                      key={infant.id}
                      type="button"
                      onClick={() => handleSelect(infant)}
                      className={`
                        w-full px-4 py-2.5 text-left
                        hover:bg-gray-50 dark:hover:bg-gray-700
                        transition-colors
                        ${
                          Number(infant.id) === Number(value)
                            ? "bg-blue-600 dark:bg-blue-700 text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }
                      `}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {infant.displayName || infant.fullName || infant.name || "Infant record"}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {infant.controlNumber && (
                            <span className="font-mono">{infant.controlNumber}</span>
                          )}
                          {infant.dobDisplay && (
                            <>
                              {infant.controlNumber && <span>-</span>}
                              <span>{infant.dobDisplay}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadMore && onLoadMore();
                      }}
                      className="w-full py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors border-t border-gray-200 dark:border-gray-700 disabled:opacity-50"
                    >
                      {loading ? "Loading more..." : "Load more infants..."}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!loading && filteredInfants.length > 0 && (
              <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 text-center">
                {filteredInfants.length} infant{filteredInfants.length !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default SearchableInfantSelect;
