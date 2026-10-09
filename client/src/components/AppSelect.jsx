import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function normalizeOptions(options) {
  return (options || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className = "",
  compact,
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({});
  const listId = useId();
  const opts = normalizeOptions(options);
  const selected = opts.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxH = Math.min(280, openUp ? spaceAbove - 8 : spaceBelow - 8);
      setMenuStyle({
        position: "fixed",
        top: openUp ? rect.top - 8 : rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        minWidth: rect.width,
        maxWidth: rect.width,
        right: "auto",
        maxHeight: Math.max(140, maxH),
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
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
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
  }, [open]);

  useEffect(() => {
    if (!open) setActiveIdx(-1);
    else setActiveIdx(Math.max(0, opts.findIndex((o) => o.value === value)));
  }, [open, value, opts]);

  function pick(opt) {
    onChange?.(opt.value);
    setOpen(false);
  }

  function onTriggerKeyDown(e) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIdx((i) => Math.min(i + 1, opts.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && activeIdx >= 0) {
      e.preventDefault();
      pick(opts[activeIdx]);
    }
  }

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      className="app-select-menu app-select-menu--portal"
      style={menuStyle}
      role="listbox"
      id={listId}
    >
      <ul className="app-select-options">
        {opts.length === 0 ? (
          <li className="app-select-empty">No options</li>
        ) : opts.map((opt, i) => (
          <li key={String(opt.value)}>
            <button
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`app-select-option${opt.value === value ? " is-selected" : ""}${i === activeIdx ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => pick(opt)}
            >
              <span>{opt.label}</span>
              {opt.value === value ? <i className="fas fa-check" aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  ) : null;

  const rootClass = [
    "app-select",
    open ? "is-open" : "",
    disabled ? "is-disabled" : "",
    compact ? "app-select--compact" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <>
      <div ref={rootRef} className={rootClass}>
        <button
          ref={triggerRef}
          type="button"
          className="app-select-trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={`app-select-value${!selected ? " is-placeholder" : ""}`}>{display}</span>
          <i className="fas fa-chevron-down app-select-chevron" aria-hidden="true" />
        </button>
      </div>
      {menu}
    </>
  );
}
