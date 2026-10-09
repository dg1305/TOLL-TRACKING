import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Box, Field, Select, DateField } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";

function editFrom(item) {
  return {
    customer: item.customer || "",
    location: item.location || "",
    product: item.product || "",
    valueCr: item.value != null && item.value !== "" ? String(Number(item.value) / 100) : "",
    expectedClosure: String(item.expectedClosure || "").slice(0, 10),
    siteStatus: item.siteStatus || "",
    fundingStatus: item.fundingStatus || "",
    owner: item.owner || "",
    customerType: item.customerType || "",
    processStage: item.processStage || "new-enquiry",
  };
}

export default function OpportunityEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    Promise.all([api.opportunity(id), api.meta()])
      .then(([item, m]) => {
        setForm(editFrom(item));
        setMeta(m);
      })
      .catch((e) => setErr(e.message || "Not found"));
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e) {
    e.preventDefault();
    if (!form.customer.trim() || !form.location.trim()) {
      toast.error("Customer name and location are required.");
      return;
    }
    setBusy(true);
    try {
      await api.patch(id, {
        customer: form.customer.trim(),
        location: form.location.trim(),
        product: form.product,
        value: Number(form.valueCr || 0) * 100,
        expectedClosure: form.expectedClosure,
        siteStatus: form.siteStatus,
        fundingStatus: form.fundingStatus,
        owner: form.owner,
        customerType: form.customerType,
      });
      if (form.processStage) await api.stage(id, form.processStage);
      toast.success("Opportunity updated");
      nav(`/opportunities/${encodeURIComponent(id)}`);
    } catch (e2) {
      toast.error(e2.message);
    } finally {
      setBusy(false);
    }
  }

  if (err) return <p className="text-danger">{err}</p>;
  if (!form || !meta) return <p className="text-muted">Loading form…</p>;

  return (
    <form onSubmit={save}>
      <Box
        title="Edit opportunity"
        type="primary"
        footer={(
          <>
            <Link to={`/opportunities/${encodeURIComponent(id)}`} className="btn btn-default">Cancel</Link>
            <button type="submit" className="btn btn-theme" disabled={busy} style={{ marginLeft: "auto" }}>
              <i className="fas fa-check" /> Save changes
            </button>
          </>
        )}
      >
        <div className="rm-form-grid rm-form-grid--2">
          <Field label="Customer name" required>
            <input className="form-control" value={form.customer} onChange={(e) => set("customer", e.target.value)} />
          </Field>
          <Field label="Location" required>
            <input className="form-control" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Product">
            <Select value={form.product} onChange={(v) => set("product", v)} options={meta.products} />
          </Field>
          <Field label="Value (₹ Crore)">
            <input className="form-control" type="number" step="0.01" value={form.valueCr} onChange={(e) => set("valueCr", e.target.value)} />
          </Field>
          <Field label="Expected closure">
            <DateField
              value={form.expectedClosure}
              onChange={(v) => set("expectedClosure", v)}
              placeholder="Select closure date"
            />
          </Field>
          <Field label="Customer type">
            <Select value={form.customerType} onChange={(v) => set("customerType", v)} options={meta.customerTypes} />
          </Field>
          <Field label="Site status">
            <Select value={form.siteStatus} onChange={(v) => set("siteStatus", v)} options={meta.siteStatuses} />
          </Field>
          <Field label="Funding status">
            <Select value={form.fundingStatus} onChange={(v) => set("fundingStatus", v)} options={meta.fundingStatuses} />
          </Field>
          <Field label="Current stage">
            <Select
              value={form.processStage}
              onChange={(v) => set("processStage", v)}
              options={meta.processStages.map((s) => ({ value: s.id, label: s.label }))}
            />
          </Field>
          <Field label="Sales manager">
            <Select value={form.owner} onChange={(v) => set("owner", v)} options={meta.owners} />
          </Field>
        </div>
      </Box>
    </form>
  );
}
