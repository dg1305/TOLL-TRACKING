import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export { default as Select } from "./AppSelect.jsx";
export { default as DateField } from "./DateField.jsx";

export function Box({ title, children, tools, type = "default", footer }) {
  return (
    <div className={`box box-${type}`}>
      {(title || tools) ? (
        <div className="box-header">
          {title ? <h3 className="box-title">{title}</h3> : <span />}
          {tools ? <div className="box-tools">{tools}</div> : null}
        </div>
      ) : null}
      <div className="box-body">{children}</div>
      {footer ? <div className="box-footer">{footer}</div> : null}
    </div>
  );
}

export function Field({ label, children, required, wide, full }) {
  const cls = ["rm-field", wide ? "rm-field--wide" : "", full ? "rm-field--full" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <label className={required ? "required" : undefined}>{label}</label>
      {children}
    </div>
  );
}

export function SmallBox({ to, count, label, tone = "blue", icon, footer }) {
  const toneMap = { blue: "", cyan: "teal", green: "green", lime: "green", orange: "orange", rose: "rose" };
  const iconClass = icon?.replace(/^fas\s+/, "") || "fa-chart-line";
  const value = typeof count === "number" ? count.toLocaleString("en-IN") : count;
  return (
    <Kpi
      to={to}
      label={label}
      value={value}
      hint={footer}
      icon={iconClass}
      tone={toneMap[tone] || ""}
    />
  );
}

export function Kpi({ label, value, hint, icon, tone, active, onClick, to }) {
  const className = `rm-kpi${tone ? ` rm-kpi--${tone}` : ""}${active ? " is-active" : ""}${onClick || to ? "" : " is-static"}`;
  const card = (
    <div className={className}>
      <span className="rm-kpi__label">{label}</span>
      <span className="rm-kpi__value">{value}</span>
      <span className="rm-kpi__hint">{hint}</span>
      <span className="rm-kpi__icon" aria-hidden><i className={`fas ${icon}`} /></span>
    </div>
  );
  if (to) return <Link to={to} className="rm-kpi-link">{card}</Link>;
  if (!onClick) return card;
  return (
    <button type="button" className="rm-kpi-btn" onClick={onClick}>
      {card}
    </button>
  );
}

function useEscape(onClose) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

export function Modal({ title, onClose, children, wide, footer }) {
  useEscape(onClose);
  return createPortal(
    <div className="rm-modal-overlay" onClick={onClose}>
      <div className={`rm-modal${wide ? " rm-modal--wide" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="rm-modal__head">
          <h3>{title}</h3>
          <button type="button" className="rm-modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="rm-modal__body">{children}</div>
        {footer ? <div className="rm-modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
