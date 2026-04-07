import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
} from "react";
import { Search, X, ChevronDown } from "lucide-react";

const normalizeSearchTerm = (value) => String(value || "").trim().toLowerCase();

const formatInfantDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const buildInfantDateSearchTokens = (value) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const year = String(parsed.getFullYear());

  return [
    formatInfantDate(parsed),
    `${year}-${month}-${day}`,
    `${month}/${day}/${year}`,
    `${Number(month)}/${Number(day)}/${year}`,
  ].join(" ");
};

const buildInfantSearchableText = (infant) => {
  const name = [infant.first_name, infant.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || infant.full_name || infant.name || "";

  const controlNumber = infant.control_number || infant.infant_control_number || "";
  const rawDob = infant.dob || infant.date_of_birth || infant.birth_date;
  const dob = formatInfantDate(rawDob);
  const dobSearchTokens = buildInfantDateSearchTokens(rawDob);

  return {
    name,
    controlNumber,
    dob,
    searchText: normalizeSearchTerm(
      `${name} ${controlNumber} ${dob} ${dobSearchTokens} ${String(rawDob || "")}`
    ),
  };
};

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

  const setDropdownOpen = (nextIsOpen) => {
    setIsOpen(nextIsOpen);
    if (typeof onOpenChange === "function") {
      onOpenChange(nextIsOpen);
    }
  };

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
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const infantsWithSearchData = useMemo(
    () =>
      infants.map((infant) => ({
        ...infant,
        ...buildInfantSearchableText(infant),
      })),
    [infants]
  );

  const filteredInfants = useMemo(() => {
    if (!deferredSearchQuery.trim()) return infantsWithSearchData;

    const normalizedQuery = normalizeSearchTerm(deferredSearchQuery);
    return infantsWithSearchData.filter((infant) =>
      infant.searchText.includes(normalizedQuery)
    );
  }, [deferredSearchQuery, infantsWithSearchData]);

  const selectedInfant = useMemo(() => {
    const selectedId = Number(value);
    if (!selectedId) {
      return null;
    }

    const matchedInfant = infantsWithSearchData.find(
      (infant) => infant.id === selectedId,
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
        ...buildInfantSearchableText(selectedInfantOverride),
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
    ? `${selectedInfant.name}${selectedInfant.dob ? ` (${selectedInfant.dob})` : ""}`
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
        hover:bg-gray-50 dark:hover:bg-gray-750
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
                className="w-4 h-4 text-gray-400 hover:text-gray-200"
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
                    bg-gray-600 dark:bg-gray-900
                    border border-gray-500 dark:border-gray-600
                    rounded-lg
                    text-gray-100 dark:text-gray-200
                    placeholder-gray-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    text-sm
                  "
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-80 modern-scrollbar">
              {loading ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Loading infants...
                </div>
              ) : filteredInfants.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
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
                        hover:bg-gray-600 dark:hover:bg-gray-750
                        transition-colors
                        ${
                          infant.id === Number(value)
                            ? "bg-blue-600 dark:bg-blue-700 text-white"
                            : "text-gray-100 dark:text-gray-200"
                        }
                      `}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{infant.name}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {infant.controlNumber && (
                            <span className="font-mono">{infant.controlNumber}</span>
                          )}
                          {infant.dob && (
                            <>
                              {infant.controlNumber && <span>-</span>}
                              <span>{infant.dob}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!loading && filteredInfants.length > 0 && (
              <div className="p-2 border-t border-gray-600 dark:border-gray-700 text-xs text-gray-400 text-center">
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
