import { STAGE_LABELS } from "../lib/stages.js";

export default function StageTracker({ steps, onSelect, busy }) {
  const done = steps.filter((s) => s.status === "completed").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const active = steps.findIndex((s) => s.status === "inprogress");

  return (
    <div className="sf-tracker">
      <div className="sf-tracker__head">
        <div>
          <p>Status tracker</p>
          <span>{pct}% complete</span>
        </div>
      </div>
      <div className="sf-tracker__scroller">
        <ol className="sf-tracker__row">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isActive = idx === active;
            const doneStep = step.status === "completed";
            const lost = step.id === "lost" || step.id === "cancelled";
            return (
              <li key={step.id} className={`sf-tracker__step is-${step.status}${isActive ? " is-current" : ""}`}>
                <div className="sf-tracker__line">
                  <span className={`sf-tracker__rail ${idx === 0 ? "is-hidden" : doneStep || isActive ? "is-on" : ""}`} />
                  <button
                    type="button"
                    className={`sf-tracker__dot${lost ? " is-lost" : ""}`}
                    disabled={busy}
                    title={STAGE_LABELS[step.id]}
                    onClick={() => onSelect?.(step.id)}
                  >
                    {doneStep ? <i className="fas fa-check" /> : isActive ? <span /> : idx + 1}
                  </button>
                  <span className={`sf-tracker__rail ${isLast ? "is-hidden" : doneStep ? "is-on" : ""}`} />
                </div>
                <div className="sf-tracker__label">{STAGE_LABELS[step.id]}</div>
                <div className="sf-tracker__state">
                  {doneStep ? "Completed" : isActive ? "In progress" : "Pending"}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
