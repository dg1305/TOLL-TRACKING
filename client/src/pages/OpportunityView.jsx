import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatINR } from "../api.js";
import { Box, Field } from "../components/ui.jsx";
import StageTracker from "../components/StageTracker.jsx";
import { STAGE_LABELS, statusTone, trackerSteps } from "../lib/stages.js";
import { useToast } from "../components/Toast.jsx";

function DetailField({ label, value, wide }) {
  return (
    <div className={`sf-opp-field${wide ? " sf-opp-field--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

function DetailCard({ title, icon, children }) {
  return (
    <section className="sf-opp-card">
      <h3 className="sf-opp-card__title">
        <i className={`fas ${icon}`} aria-hidden="true" />
        {title}
      </h3>
      <dl className="sf-opp-dl">{children}</dl>
    </section>
  );
}

export default function OpportunityView() {
  const { id } = useParams();
  const toast = useToast();
  const [item, setItem] = useState(null);
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    api.opportunity(id).then(setItem).catch((e) => setErr(e.message || "Not found"));
  }, [id]);

  async function moveStage(processStage) {
    setBusy(true);
    try {
      const updated = await api.stage(id, processStage);
      setItem(updated);
      toast.success(`Moved to ${STAGE_LABELS[processStage] || processStage}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addRemark() {
    if (!remark.trim()) return;
    setBusy(true);
    try {
      const updated = await api.remark(id, remark.trim());
      setRemark("");
      setItem(updated);
      toast.success("Remark added");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <p className="text-danger">{err}</p>;
  if (!item) return <p className="text-muted">Loading opportunity…</p>;

  const stageLabel = STAGE_LABELS[item.processStage] || item.processStage;

  return (
    <div className="detail-layout rm-page">
      <header className="sf-opp-hero">
        <div className="sf-opp-hero__main">
          <p className="sf-opp-hero__eyebrow">{item.id} · {item.region}</p>
          <h1 className="sf-opp-hero__title">{item.customer}</h1>
          <p className="sf-opp-hero__subtitle">{item.product} · {item.location}</p>
          <div className="sf-opp-hero__chips">
            <span className={`detail-chip ${statusTone(item.salesStatus)}`}>
              <span className={`label ${statusTone(item.salesStatus)}`}>{item.salesStatus}</span>
            </span>
            <span className="sf-opp-chip"><i className="fas fa-layer-group" /> {stageLabel}</span>
            <span className="sf-opp-chip"><i className="fas fa-user" /> {item.owner}</span>
          </div>
        </div>
        <div className="sf-opp-hero__aside">
          <div className="sf-opp-stat">
            <span className="sf-opp-stat__label">Deal value</span>
            <strong className="sf-opp-stat__value">{formatINR(item.value)}</strong>
          </div>
          <div className="sf-opp-stat">
            <span className="sf-opp-stat__label">Probability</span>
            <strong className="sf-opp-stat__value">{item.probability}%</strong>
          </div>
          <div className="sf-opp-stat">
            <span className="sf-opp-stat__label">Expected closure</span>
            <strong className="sf-opp-stat__value">{item.expectedClosureLabel || item.expectedClosure || "—"}</strong>
          </div>
          <div className="detail-actions sf-opp-hero__actions">
            <Link to="/opportunities" className="btn btn-default btn-sm">
              <i className="fas fa-arrow-left" /> Back
            </Link>
            <Link to={`/opportunities/${encodeURIComponent(item.id)}/edit`} className="btn btn-theme btn-sm">
              <i className="fas fa-pencil-alt" /> Edit
            </Link>
          </div>
        </div>
      </header>

      <StageTracker steps={trackerSteps(item)} onSelect={moveStage} busy={busy} />

      <div className="sf-opp-grid">
        <DetailCard title="Customer & location" icon="fa-building">
          <DetailField label="Customer" value={item.customer} />
          <DetailField label="Location" value={item.location} />
          <DetailField label="Region" value={item.region} />
          <DetailField label="Customer type" value={item.customerType} />
        </DetailCard>

        <DetailCard title="Deal information" icon="fa-briefcase">
          <DetailField label="Product" value={item.product} />
          <DetailField label="Value" value={formatINR(item.value)} />
          <DetailField label="Owner" value={item.owner} />
          <DetailField label="Modality" value={item.modality} />
        </DetailCard>

        <DetailCard title="Pipeline status" icon="fa-chart-line">
          <DetailField label="Process stage" value={stageLabel} />
          <DetailField label="Sales stage" value={`Stage ${item.stage}`} />
          <DetailField label="Probability" value={`${item.probability}%`} />
          <DetailField label="Site readiness" value={item.siteStatus} />
          <DetailField label="Funding status" value={item.fundingStatus} />
          <DetailField label="Expected closure" value={item.expectedClosureLabel || item.expectedClosure} wide />
        </DetailCard>
      </div>

      <Box title="Remarks & field updates">
        {(item.remarks || []).length === 0 ? (
          <p className="sf-opp-remarks-empty">No remarks yet. Add a field update below.</p>
        ) : (
          <ul className="sf-remarks sf-remarks--timeline">
            {(item.remarks || []).map((r, i) => (
              <li key={i}>
                <span className="sf-remark-dot" aria-hidden="true" />
                <span className="sf-remark-text">{r}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="sf-opp-remark-form">
          <Field label="New remark">
            <textarea
              className="form-control"
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Capture a site visit, customer call, or commercial update…"
            />
          </Field>
          <button type="button" className="btn btn-theme btn-sm" disabled={busy} onClick={addRemark}>
            <i className="fas fa-plus" /> Add remark
          </button>
        </div>
      </Box>
    </div>
  );
}
