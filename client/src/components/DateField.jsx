import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PICKER_WIDTH = 268;

function parseISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDisplay(iso) {
  const date = parseISO(iso);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildMonthGrid(viewYear, viewMonth) {
  const first = new Date(viewYear, viewMonth, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const cells = [];

  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const day = daysInPrev - i;
    cells.push({ day, outside: true, date: new Date(viewYear, viewMonth - 1, day) });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, outside: false, date: new Date(viewYear, viewMonth, d) });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: next, outside: true, date: new Date(viewYear, viewMonth + 1, next) });
    next += 1;
  }
  while (cells.length < 42) {
    cells.push({ day: next, outside: true, date: new Date(viewYear, viewMonth + 1, next) });
    next += 1;
  }
  return cells;
}

export default function DateField({
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISO(value) || new Date());
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const pickerRef = useRef(null);
  const [pickerStyle, setPickerStyle] = useState({});
  const pickerId = useId();

  const selected = parseISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const cells = buildMonthGrid(viewYear, viewMonth);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const pickerHeight = 320;
      const openUp = spaceBelow < pickerHeight && spaceAbove > spaceBelow;
      let left = rect.left;
      if (left + PICKER_WIDTH > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - PICKER_WIDTH - 8);
      }
      setPickerStyle({
        position: "fixed",
        top: openUp ? rect.top - 8 : rect.bottom + 8,
        left,
        width: PICKER_WIDTH,
        minWidth: PICKER_WIDTH,
        maxWidth: PICKER_WIDTH,
        right: "auto",
        zIndex: 30100,
        transform: openUp ? "translateY(-100%)" : undefined,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setViewDate(parseISO(value) || new Date());
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || pickerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, value]);

  function pick(date) {
    onChange?.(toISO(date));
    setOpen(false);
  }

  function clear(e) {
    e?.stopPropagation();
    onChange?.("");
    setOpen(false);
  }

  function goToday() {
    const now = new Date();
    setViewDate(now);
    pick(now);
  }

  function shiftMonth(delta) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  const picker = open ? createPortal(
    <div
      ref={pickerRef}
      id={pickerId}
      className="date-picker date-picker--portal"
      style={pickerStyle}
      role="dialog"
      aria-label="Choose date"
    >
      <div className="date-picker-header">
        <button type="button" className="date-picker-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <i className="fas fa-chevron-left" aria-hidden="true" />
        </button>
        <div className="date-picker-title">
          <span>{MONTHS[viewMonth]}</span>
          <span className="date-picker-year">{viewYear}</span>
        </div>
        <button type="button" className="date-picker-nav" aria-label="Next month" onClick={() => shiftMonth(1)}>
          <i className="fas fa-chevron-right" aria-hidden="true" />
        </button>
      </div>
      <div className="date-picker-weekdays">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="date-picker-grid">
        {cells.map((cell, i) => {
          const iso = toISO(cell.date);
          const isSelected = selected && sameDay(cell.date, selected);
          const isToday = sameDay(cell.date, today);
          const cls = [
            "date-picker-cell",
            cell.outside ? "is-outside" : "",
            isSelected ? "is-selected" : "",
            isToday ? "is-today" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={`${iso}-${i}`}
              type="button"
              className={cls}
              onClick={() => pick(cell.date)}
              aria-label={cell.date.toLocaleDateString("en-IN")}
              aria-pressed={isSelected}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      <div className="date-picker-footer">
        <button type="button" className="date-picker-clear" onClick={clear}>Clear</button>
        <button type="button" className="date-picker-today" onClick={goToday}>Today</button>
      </div>
    </div>,
    document.body,
  ) : null;

  const rootClass = [
    "date-field",
    open ? "is-open" : "",
    disabled ? "is-disabled" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <>
      <div ref={rootRef} className={rootClass}>
        <button
          ref={triggerRef}
          type="button"
          className="date-field-trigger"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={pickerId}
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <span className="date-field-icon" aria-hidden="true">
            <i className="fas fa-calendar-alt" />
          </span>
          <span className={`date-field-value${!value ? " is-placeholder" : ""}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
        {value && !disabled ? (
          <button type="button" className="date-field-clear" aria-label="Clear date" onClick={clear}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {picker}
    </>
  );
}
