import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatINR, qs } from "../api.js";
import { statusTone } from "../lib/stages.js";

export default function Opportunities({ region, search }) {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.opportunities(qs({ region, search })).then(setRows).catch(console.error);
  }, [region, search]);

  const open = (id) => nav(`/opportunities/${encodeURIComponent(id)}`);

  return (
    <div className="rm-page">
      <div className="rm-panel">
        <div className="rm-panel__bar">
          <h2>
            Opportunities <span>{rows.length} records</span>
          </h2>
          <div className="rm-page-actions">
            <Link className="btn btn-theme btn-sm" to="/add">
              <i className="fas fa-plus" /> Add opportunity
            </Link>
          </div>
        </div>
        <div className="table-responsive data-table-desktop">
          <table className="table table-striped table-hover data-list-table">
            <thead>
              <tr>
                {["ID", "Customer", "Location", "Product", "Value", "Stage", "Prob.", "Status", "Owner", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} className="text-muted">No matching records found</td></tr>
              ) : rows.map((o) => (
                <tr key={o.id} onClick={() => open(o.id)} style={{ cursor: "pointer" }}>
                  <td className="text-muted text-mono">{o.id}</td>
                  <td><strong>{o.customer}</strong></td>
                  <td>{o.location}</td>
                  <td>{o.product}</td>
                  <td><strong>{formatINR(o.value)}</strong></td>
                  <td>Stage {o.stage}</td>
                  <td>{o.probability}%</td>
                  <td><span className={`label ${statusTone(o.salesStatus)}`}>{o.salesStatus}</span></td>
                  <td>{o.owner}</td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/opportunities/${encodeURIComponent(o.id)}`} className="icon-btn icon-btn-view" title="View">
                      <i className="fas fa-eye" />
                    </Link>
                    <Link to={`/opportunities/${encodeURIComponent(o.id)}/edit`} className="icon-btn icon-btn-edit" title="Edit">
                      <i className="fas fa-pencil-alt" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="data-table-mobile">
          {rows.map((o) => (
            <article key={o.id} className="data-card" onClick={() => open(o.id)}>
              <div className="data-card-title">{o.customer}</div>
              <dl className="data-card-fields">
                <div className="data-card-field"><dt>ID</dt><dd>{o.id}</dd></div>
                <div className="data-card-field"><dt>Product</dt><dd>{o.product}</dd></div>
                <div className="data-card-field"><dt>Value</dt><dd>{formatINR(o.value)}</dd></div>
                <div className="data-card-field"><dt>Status</dt><dd><span className={`label ${statusTone(o.salesStatus)}`}>{o.salesStatus}</span></dd></div>
              </dl>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
