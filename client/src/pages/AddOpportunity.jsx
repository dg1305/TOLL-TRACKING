import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Field, Select, DateField } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

const empty = {
  customer: "",
  location: "",
  regionKey: "north",
  customerType: "Diagnostic Centre",
  product: "ANAMAYA",
  valueCr: "",
  expectedClosure: "",
  siteStatus: "To Be Identified",
  fundingStatus: "Not Yet Approached Bank",
  processStage: "new-enquiry",
  owner: "Prem Kumar Thakur",
  remark: "",
};

function FormCard({ title, icon, children, columns = 2 }) {
  const gridClass = columns === 3 ? "sf-add-form-grid sf-add-form-grid--3" : "sf-add-form-grid";
  return (
    <section className="sf-opp-card sf-add-card">
      <h3 className="sf-opp-card__title">
        <i className={`fas ${icon}`} aria-hidden="true" />
        {title}
      </h3>
      <div className={gridClass}>{children}</div>
    </section>
  );
}

function SummaryGroup({ title, children }) {
  return (
    <div className="sf-add-summary__group">
      <h4 className="sf-add-summary__group-title">{title}</h4>
      <dl className="sf-add-summary__dl">{children}</dl>
    </div>
  );
}

function SummaryItem({ label, value }) {
  const empty = !value || value === "—";
  return (
    <div className={`sf-add-summary__item${empty ? " is-empty" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export default function AddOpportunity() {
  const nav = useNavigate();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.meta().then(setMeta); }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e?.preventDefault();
    if (!form.customer.trim() || !form.location.trim()) {
      toast.error("Customer name and location are required.");
      return;
    }
    setBusy(true);
    try {
      await api.create({ ...form, value: Number(form.valueCr || 0) * 100 });
      toast.success("Opportunity created");
      nav("/opportunities");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!meta) return <p className="text-muted">Loading form…</p>;

  const stageLabel = meta.processStages.find((s) => s.id === form.processStage)?.label || form.processStage;
  const regionLabel = form.regionKey === "west" ? "West" : "North";
  const valueDisplay = form.valueCr ? `₹${form.valueCr} Cr` : "—";
  const closureDisplay = form.expectedClosure
    ? new Date(form.expectedClosure + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="rm-page sf-add-opp">
      <form onSubmit={submit} className="sf-add-opp__form">
        <div className="sf-add-opp__layout">
          <div className="sf-add-opp__main">
            <FormCard title="Customer & location" icon="fa-building">
              <Field label="Customer name" required>
                <input
                  className="form-control"
                  value={form.customer}
                  onChange={(e) => set("customer", e.target.value)}
                  placeholder="Hospital or diagnostic centre name"
                  autoComplete="organization"
                />
              </Field>
              <Field label="Location" required>
                <input
                  className="form-control"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="City / state"
                />
              </Field>
              <Field label="Region">
                <Select
                  value={form.regionKey}
                  onChange={(v) => set("regionKey", v)}
                  options={[
                    { value: "north", label: "North" },
                    { value: "west", label: "West" },
                  ]}
                />
              </Field>
              <Field label="Customer type">
                <Select
                  value={form.customerType}
                  onChange={(v) => set("customerType", v)}
                  options={meta.customerTypes}
                />
              </Field>
            </FormCard>

            <FormCard title="Product & commercials" icon="fa-box-open" columns={3}>
              <Field label="Product">
                <Select
                  value={form.product}
                  onChange={(v) => set("product", v)}
                  options={meta.products}
                />
              </Field>
              <Field label="Opportunity value (₹ Crore)">
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valueCr}
                  onChange={(e) => set("valueCr", e.target.value)}
                  placeholder="e.g. 3.5"
                />
              </Field>
              <Field label="Expected closure">
                <DateField
                  value={form.expectedClosure}
                  onChange={(v) => set("expectedClosure", v)}
                  placeholder="Select closure date"
                />
              </Field>
            </FormCard>

            <FormCard title="Site & funding readiness" icon="fa-clipboard-check">
              <Field label="Site status">
                <Select
                  value={form.siteStatus}
                  onChange={(v) => set("siteStatus", v)}
                  options={meta.siteStatuses}
                />
              </Field>
              <Field label="Funding status">
                <Select
                  value={form.fundingStatus}
                  onChange={(v) => set("fundingStatus", v)}
                  options={meta.fundingStatuses}
                />
              </Field>
            </FormCard>

            <FormCard title="Pipeline assignment" icon="fa-user-tie">
              <Field label="Current stage">
                <Select
                  value={form.processStage}
                  onChange={(v) => set("processStage", v)}
                  options={meta.processStages
                    .filter((s) => s.id !== "booked")
                    .map((s) => ({ value: s.id, label: s.label }))}
                />
              </Field>
              <Field label="Sales manager">
                <Select
                  value={form.owner}
                  onChange={(v) => set("owner", v)}
                  options={meta.owners}
                />
              </Field>
            </FormCard>

            <FormCard title="Additional notes" icon="fa-sticky-note">
              <Field label="Remarks" full>
                <textarea
                  className="form-control"
                  rows={4}
                  value={form.remark}
                  onChange={(e) => set("remark", e.target.value)}
                  placeholder="Context, next steps, or special requirements…"
                />
              </Field>
            </FormCard>

            <div className="sf-add-opp__actions">
              <p className="sf-add-opp__actions-hint">
                <i className="fas fa-info-circle" aria-hidden="true" />
                Required fields are marked with an asterisk. You can edit everything after creation.
              </p>
              <div className="sf-add-opp__actions-btns">
                <Link to="/opportunities" className="btn btn-default">Cancel</Link>
                <button type="submit" className="btn btn-theme" disabled={busy}>
                  <i className="fas fa-check" aria-hidden="true" />
                  Create opportunity
                </button>
              </div>
            </div>
          </div>

          <aside className="sf-add-opp__aside" aria-label="Record preview">
            <div className="sf-add-summary">
              <div className="sf-add-summary__head">
                <span className="sf-add-summary__badge">Live preview</span>
                <h2 className="sf-add-summary__title">
                  {form.customer.trim() || "New opportunity"}
                </h2>
                <p className="sf-add-summary__subtitle">
                  {form.location.trim() || "Add customer location to preview the record"}
                </p>
                <div className="sf-add-summary__chips">
                  <span className="sf-opp-chip">
                    <i className="fas fa-map-marker-alt" aria-hidden="true" />
                    {regionLabel}
                  </span>
                  <span className="sf-opp-chip">
                    <i className="fas fa-hospital" aria-hidden="true" />
                    {form.customerType}
                  </span>
                  <span className="sf-opp-chip">
                    <i className="fas fa-box" aria-hidden="true" />
                    {form.product}
                  </span>
                </div>
              </div>

              <div className="sf-add-summary__stats">
                <div className="sf-add-summary__stat">
                  <span className="sf-add-summary__stat-label">Deal value</span>
                  <span className="sf-add-summary__stat-value">{valueDisplay}</span>
                </div>
                <div className="sf-add-summary__stat">
                  <span className="sf-add-summary__stat-label">Stage</span>
                  <span className="sf-add-summary__stat-value">{stageLabel}</span>
                </div>
                <div className="sf-add-summary__stat">
                  <span className="sf-add-summary__stat-label">Closure</span>
                  <span className="sf-add-summary__stat-value">{closureDisplay}</span>
                </div>
              </div>

              <SummaryGroup title="Readiness">
                <SummaryItem label="Site" value={form.siteStatus} />
                <SummaryItem label="Funding" value={form.fundingStatus} />
              </SummaryGroup>

              <SummaryGroup title="Assignment">
                <SummaryItem label="Owner" value={form.owner} />
              </SummaryGroup>

              {form.remark.trim() ? (
                <div className="sf-add-summary__notes">
                  <h4 className="sf-add-summary__group-title">Notes</h4>
                  <p>{form.remark.trim()}</p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
