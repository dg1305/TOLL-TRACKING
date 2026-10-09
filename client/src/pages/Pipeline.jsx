import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatINR, qs } from "../api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { Kpi } from "../components/ui.jsx";

const COLS = [
  { id: "I", title: "New / Stage I", short: "Stage I", tint: "#64748B", icon: "fa-seedling" },
  { id: "II", title: "Qualification / II", short: "Stage II", tint: "#0d9488", icon: "fa-search" },
  { id: "III", title: "Negotiation / III", short: "Stage III", tint: "#2079B7", icon: "fa-handshake" },
  { id: "IV", title: "Finalisation / IV", short: "Stage IV", tint: "#0D4574", icon: "fa-file-signature" },
  { id: "booked", title: "Booked", short: "Won", tint: "#8CBC43", icon: "fa-check-circle" },
];
const STAGE_MAP = { I: "new-enquiry", II: "quotation", III: "negotiation", IV: "order", booked: "booked" };

function probClass(p) {
  const n = Number(p) || 0;
  if (n >= 80) return "high";
  if (n >= 45) return "mid";
  return "low";
}

export default function Pipeline({ region }) {
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [over, setOver] = useState("");
  const [dragging, setDragging] = useState("");
  useEffect(() => {
    api.opportunities(qs({ region })).then(setRows).catch(console.error);
  }, [region]);

  let mine = rows;
  if (region === "west") mine = rows.filter((o) => o.owner === "West Sales Team");
  else if (region === "north") mine = rows.filter((o) => o.owner === "Prem Kumar Thakur");
  else if (user?.region_key === "west") mine = rows.filter((o) => o.owner === "West Sales Team");
  else if (user?.region_key === "north") mine = rows.filter((o) => o.owner === "Prem Kumar Thakur");
  else if (!isAdmin) {
    const name = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
    mine = rows.filter((o) => o.owner === name);
  }

  const ownerLabel =
    region === "west" || user?.region_key === "west"
      ? "West Sales Team"
      : region === "north" || user?.region_key === "north"
        ? "Prem Kumar Thakur"
        : isAdmin
          ? "All owners"
          : `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const openRows = mine.filter((o) => o.outcome === "open");
  const bookedRows = mine.filter((o) => o.outcome === "booked");
  const openValue = openRows.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const bookedValue = bookedRows.reduce((s, o) => s + (Number(o.value) || 0), 0);

  async function onDrop(e, colId) {
    e.preventDefault();
    setOver("");
    setDragging("");
    const id = e.dataTransfer.getData("id");
    if (!id) return;
    const updated = await api.stage(id, STAGE_MAP[colId]);
    setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div className="rm-page sf-pipe-page">
      <div className="rm-kpi-row rm-kpi-row--pipe-toolbar">
        <Kpi label="Open deals" value={openRows.length} hint="Active pipeline" icon="fa-layer-group" />
        <Kpi label="Pipeline value" value={formatINR(openValue)} hint="Unweighted open value" icon="fa-rupee-sign" />
        <Kpi label="Booked" value={formatINR(bookedValue)} hint="Won orders" icon="fa-check-circle" tone="green" />
        <Kpi label="Owner filter" value={ownerLabel} hint="Drag cards between columns" icon="fa-user" tone="slate" />
      </div>

      <div className="sf-pipe-banner">
        <i className="fas fa-arrows-alt" aria-hidden="true" />
        <span>Drag cards between columns to update stage</span>
        <span className="sf-pipe-banner__sep">·</span>
        <span>Click a card to open full details</span>
      </div>

      <div className="sf-board">
        {COLS.map((c) => {
          const list = c.id === "booked" ? bookedRows : openRows.filter((o) => o.stage === c.id);
          const value = list.reduce((s, o) => s + (Number(o.value) || 0), 0);
          return (
            <div
              key={c.id}
              className={`sf-col${over === c.id ? " is-over" : ""}`}
              style={{ "--col-tint": c.tint }}
              onDragOver={(e) => { e.preventDefault(); setOver(c.id); }}
              onDragLeave={() => setOver("")}
              onDrop={(e) => onDrop(e, c.id)}
            >
              <div className="sf-col-head">
                <div className="sf-col-head__main">
                  <span className="sf-col-head__icon" aria-hidden="true">
                    <i className={`fas ${c.icon}`} />
                  </span>
                  <div className="sf-col-head__text">
                    <b>{c.title}</b>
                    <em>{list.length} deals · {formatINR(value)}</em>
                  </div>
                </div>
                <span className="sf-col-head__count">{list.length}</span>
              </div>
              <div className="sf-col-body">
                {list.length === 0 ? (
                  <div className="sf-col-empty">
                    <i className="fas fa-inbox" aria-hidden="true" />
                    Drop cards here
                  </div>
                ) : null}
                {list.map((o) => (
                  <article
                    key={o.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("id", o.id);
                      setDragging(o.id);
                    }}
                    onDragEnd={() => setDragging("")}
                    className={`sf-pipe-card${dragging === o.id ? " is-dragging" : ""}`}
                    onClick={() => {
                      if (dragging) return;
                      nav(`/opportunities/${encodeURIComponent(o.id)}`);
                    }}
                  >
                    <header className="sf-pipe-card__head">
                      <h4 className="sf-pipe-card__customer">{o.customer}</h4>
                      <span className="sf-pipe-card__id">{o.id}</span>
                    </header>
                    <div className="sf-pipe-card__value">{formatINR(o.value)}</div>
                    <div className="sf-pipe-card__meta">
                      <span className="sf-pipe-card__chip">{o.product}</span>
                      <span className="sf-pipe-card__chip sf-pipe-card__chip--loc">
                        <i className="fas fa-map-marker-alt" aria-hidden="true" />
                        {o.location || "—"}
                      </span>
                    </div>
                    <footer className="sf-pipe-card__foot">
                      <span className={`sf-pipe-card__prob sf-pipe-card__prob--${probClass(o.probability)}`}>
                        {o.probability}% probability
                      </span>
                    </footer>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
