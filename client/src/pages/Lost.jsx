import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatINR, qs } from "../api.js";
import { statusTone } from "../lib/stages.js";

export default function Lost({ region }) {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.lost(qs({ region })).then(setRows).catch(console.error);
  }, [region]);
  const total = rows.reduce((s, o) => s + (o.value || 0), 0);
  return (
    <div className="rm-page">
      <div className="rm-panel">
        <div className="rm-panel__bar">
          <h2>Lost / cancelled <span>{rows.length} records · {formatINR(total)}</span></h2>
        </div>
        <div className="table-responsive data-table-desktop">
          <table className="table table-striped table-hover data-list-table">
            <thead>
              <tr>
                {["Customer", "Location", "Product", "Value", "Reason", "Competitor", "Owner"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="text-muted">No lost records</td></tr>
              ) : rows.map((o) => (
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => nav(`/opportunities/${encodeURIComponent(o.id)}`)}>
                  <td><strong>{o.customer}</strong></td>
                  <td>{o.location}</td>
                  <td>{o.product}</td>
                  <td>{formatINR(o.value)}</td>
                  <td><span className={`label ${statusTone(o.outcome)}`}>{o.lostReason || o.outcome}</span></td>
                  <td>{o.competitor || "—"}</td>
                  <td>{o.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="data-table-mobile">
          {rows.map((o) => (
            <article key={o.id} className="data-card" onClick={() => nav(`/opportunities/${encodeURIComponent(o.id)}`)}>
              <div className="data-card-title">{o.customer}</div>
              <dl className="data-card-fields">
                <div className="data-card-field"><dt>Product</dt><dd>{o.product}</dd></div>
                <div className="data-card-field"><dt>Value</dt><dd>{formatINR(o.value)}</dd></div>
                <div className="data-card-field"><dt>Reason</dt><dd>{o.lostReason || o.outcome}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
