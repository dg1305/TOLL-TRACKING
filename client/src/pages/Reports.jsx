import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatINR, qs } from "../api.js";
import { Box } from "../components/ui.jsx";

const REPORTS = [
  { id: "pipeline", title: "Sales pipeline", desc: "Open value by stage" },
  { id: "product", title: "Product performance", desc: "ANAMAYA, MRI, FPD mix" },
  { id: "lost", title: "Lost business", desc: "Reasons and competitors" },
  { id: "conversion", title: "Conversion", desc: "Booked vs all opportunities" },
];

export default function Reports({ region }) {
  const nav = useNavigate();
  const [dash, setDash] = useState(null);
  const [lost, setLost] = useState([]);
  const [active, setActive] = useState("pipeline");
  useEffect(() => {
    api.dashboard(qs({ region })).then(setDash);
    api.lost(qs({ region })).then(setLost);
  }, [region]);
  if (!dash) return <p className="text-muted">Loading reports…</p>;
  const k = dash.kpis;
  const conv = k.opportunities ? Math.round((k.bookedCount / k.opportunities) * 100) : 0;
  const mixMax = Math.max(...dash.stages.map((s) => s.value), 1);

  return (
    <div className="rm-page">
      <div className="rm-chip-row" style={{ paddingTop: 0 }}>
        {REPORTS.map((r) => (
          <button key={r.id} type="button" className={`rm-chip${active === r.id ? " is-active" : ""}`} onClick={() => setActive(r.id)}>
            {r.title}
          </button>
        ))}
      </div>
      <Box title={REPORTS.find((r) => r.id === active)?.title} tools={<span className="text-muted">{REPORTS.find((r) => r.id === active)?.desc}</span>}>
        {active === "pipeline" && (
          <>
            <div className="dash-status-bars" style={{ marginBottom: 18 }}>
              {dash.stages.map((s, i) => (
                <div key={s.id} className="dash-status-row">
                  <div className="dash-status-meta">
                    <span>{s.label} {s.range}</span>
                    <strong>{s.count} · {formatINR(s.value)}</strong>
                  </div>
                  <div className="dash-status-track">
                    <div
                      className={`dash-status-fill ${i < 2 ? "tone-slate" : i === 2 ? "tone-teal" : "tone-amber"}`}
                      style={{ width: `${Math.min(100, Math.round((s.value / mixMax) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead><tr><th>Stage</th><th>Opps</th><th>Value</th></tr></thead>
                <tbody>
                  {dash.stages.map((s) => (
                    <tr key={s.id}><td>{s.label} {s.range}</td><td>{s.count}</td><td>{formatINR(s.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {active === "product" && (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead><tr><th>Product</th><th>Opps</th><th>Value</th></tr></thead>
              <tbody>
                {dash.products.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td>{p.count}</td><td>{formatINR(p.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {active === "lost" && (
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead><tr><th>Customer</th><th>Product</th><th>Value</th><th>Reason</th></tr></thead>
              <tbody>
                {lost.length === 0 ? (
                  <tr><td colSpan={4} className="text-muted">No lost records</td></tr>
                ) : lost.map((o) => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => nav(`/opportunities/${encodeURIComponent(o.id)}`)}>
                    <td><strong>{o.customer}</strong></td>
                    <td>{o.product}</td>
                    <td>{formatINR(o.value)}</td>
                    <td>{o.lostReason || o.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {active === "conversion" && (
          <div className="dash-status-bars">
            <div className="dash-status-row">
              <div className="dash-status-meta">
                <span>Booked</span>
                <strong>{k.bookedCount} · {formatINR(k.booked)}</strong>
              </div>
              <div className="dash-status-track">
                <div className="dash-status-fill tone-teal" style={{ width: `${conv}%` }} />
              </div>
            </div>
            <p className="text-muted" style={{ margin: "12px 0 0" }}>
              Booked {k.bookedCount} of {k.opportunities} opportunities ({conv}%).
            </p>
          </div>
        )}
      </Box>
    </div>
  );
}
