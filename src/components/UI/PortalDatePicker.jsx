import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import "./PortalDatePicker.css";
import { useTheme } from "../../contexts/ThemeContext";

const parseYMD = (str) => {
  if (!str) return null;
  const parts = String(str).split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m, d);
  if (isNaN(date.getTime())) return null;
  return date;
};

const toYMD = (date) => {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toDisplayMDY = (date) => {
  if (!date) return "";
  return (
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0") +
    "/" +
    date.getFullYear()
  );
};

/**
 * PortalDatePicker
 *
 * Drop-in replacement for <Input type="date"> and <TextField type="date">.
 * Renders its calendar popup via React.createPortal to document.body so it is
 * never clipped by overflow:hidden / overflow:auto on ancestor elements.
 *
 * value / onChange use YYYY-MM-DD strings (same as native date inputs).
 * onChange is called with a synthetic { target: { value, name } } event.
 *
 * variants:
 *   "default"  – Tailwind-based, matches the custom <Input> component style
 *   "outlined" – MUI-like outlined box (use in MUI-heavy layouts)
 */
const PortalDatePicker = ({
  value = "",
  onChange,
  label,
  error,
  helpText,
  className = "",
  containerClassName = "",
  disabled = false,
  min,
  max,
  placeholder = "mm/dd/yyyy",
  required = false,
  id,
  name,
  size,
  fullWidth,
  variant = "default",
  "aria-label": ariaLabel,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [CalendarComponent, setCalendarComponent] = useState(null);

  const triggerRef = useRef(null);
  const popupRef = useRef(null);

  const inputId =
    id || (label ? `pdp-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  const dateValue = parseYMD(value);
  const minDate = parseYMD(min) ?? undefined;
  const maxDate = parseYMD(max) ?? undefined;
  const displayValue = toDisplayMDY(dateValue);
  const isSmall = size === "small";
  const isOutlined = variant === "outlined";

  const computePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPUP_H = 240;
    const POPUP_W = 280;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // position:fixed — coordinates are viewport-relative (no scrollY/scrollX needed)
    let top = rect.bottom + 6;
    if (rect.bottom + POPUP_H > vh) {
      top = rect.top - POPUP_H - 6;
    }
    // clamp so popup never leaves the viewport
    top = Math.max(4, Math.min(top, vh - POPUP_H - 4));

    let left = rect.left;
    if (left + POPUP_W > vw) {
      left = rect.right - POPUP_W;
    }
    left = Math.max(4, Math.min(left, vw - POPUP_W - 4));

    setPos({ top, left });
  }, []);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    computePos();
    setOpen(true);
  }, [disabled, computePos]);

  const handleSelect = useCallback(
    (date) => {
      onChange?.({ target: { value: toYMD(date), name: name || id } });
      setOpen(false);
    },
    [onChange, name, id],
  );

  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      onChange?.({ target: { value: "", name: name || id } });
      setOpen(false);
    },
    [onChange, name, id],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    // react-calendar ships ESM; load it only when the popup opens so Jest/node
    // environments that never open the picker don't try to parse it.
    if (!CalendarComponent) {
      import("react-calendar")
        .then((mod) => {
          const Loaded = mod?.Calendar || mod?.default || null;
          if (!cancelled) setCalendarComponent(() => Loaded);
        })
        .catch(() => {
          if (!cancelled) setCalendarComponent(() => null);
        });
    }

    const onDown = (e) => {
      if (
        !popupRef.current?.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", computePos, true);
    window.addEventListener("resize", computePos);
    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", computePos, true);
      window.removeEventListener("resize", computePos);
    };
  }, [open, computePos, CalendarComponent]);

  const triggerClass = [
    "pdp-trigger",
    isOutlined ? "pdp-outlined" : "",
    isSmall ? "pdp-small" : "",
    isDark ? "pdp-dark" : "",
    error ? "pdp-has-error" : "",
    disabled ? "pdp-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const labelClass = [
    "pdp-label",
    isDark ? "pdp-label-dark" : "",
    required ? "pdp-required" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const floatClass = [
    "pdp-floating-label",
    isOutlined || open || displayValue ? "pdp-float-active" : "",
    isDark ? "pdp-float-dark" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div
        className={[
          "pdp-container",
          fullWidth ? "pdp-full-width" : "",
          containerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label && !isOutlined && (
          <label htmlFor={inputId} className={labelClass}>
            {label}
          </label>
        )}

        <div
          ref={triggerRef}
          id={inputId}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel || label || "Select date"}
          aria-expanded={open}
          aria-haspopup="grid"
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
          className={triggerClass}
        >
          {label && isOutlined && (
            <span className={floatClass}>{label}</span>
          )}

          <span className={displayValue ? "pdp-display-value" : "pdp-display-placeholder"}>
            {displayValue || placeholder}
          </span>

          <span className="pdp-icon-row">
            {displayValue && !disabled && (
              <button
                type="button"
                className="pdp-clear-btn"
                onClick={handleClear}
                aria-label="Clear date"
                tabIndex={-1}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="2" y1="2" x2="10" y2="10" />
                  <line x1="10" y1="2" x2="2" y2="10" />
                </svg>
              </button>
            )}
            <svg
              className="pdp-cal-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
        </div>

        {helpText && !error && (
          <p className={`pdp-help-text${isDark ? " pdp-help-dark" : ""}`}>
            {helpText}
          </p>
        )}
        {error && (
          <p className="pdp-error-text" role="alert">
            {error}
          </p>
        )}
      </div>

      {open &&
        ReactDOM.createPortal(
          <div
            ref={popupRef}
            aria-label="Date picker calendar"
            className={`pdp-popup${isDark ? " pdp-popup-dark" : ""}`}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 99999, width: "280px" }}
          >
            {CalendarComponent ? (
              <CalendarComponent
                onChange={handleSelect}
                value={dateValue}
                minDate={minDate}
                maxDate={maxDate}
                locale="en-US"
                showFixedNumberOfWeeks={false}
              />
            ) : (
              <div className="pdp-calendar-loading" aria-live="polite">
                Loading…
              </div>
            )}
            {displayValue && (
              <div className="pdp-popup-footer">
                <button
                  type="button"
                  className="pdp-popup-clear-btn"
                  onClick={handleClear}
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
};

export default PortalDatePicker;
