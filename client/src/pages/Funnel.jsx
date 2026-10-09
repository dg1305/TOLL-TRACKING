import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatINR, qs } from "../api.js";
import FunnelBars, { FUNNEL_COLORS } from "../components/FunnelBars.jsx";
import { Box, Modal } from "../components/ui.jsx";
import { CHART_TICK, CHART_TICK_SM } from "../lib/chartTheme.js";

export default function Funnel({ region }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    api.funnel(qs({ region })).then(setData).catch(console.error);
  }, [region]);
  if (!data) return <p className="text-muted">Loading funnel…</p>;
  const colors = [FUNNEL_COLORS.s1, FUNNEL_COLORS.s1, FUNNEL_COLORS.s1, FUNNEL_COLORS.s2, FUNNEL_COLORS.s3, FUNNEL_COLORS.s3, FUNNEL_COLORS.s4, FUNNEL_COLORS.won];

  async function openStage(processStage, title) {
    const rows = await api.opportunities(qs({
      region,
      processStage: processStage === "booked" ? undefined : processStage,
      outcome: processStage === "booked" ? "booked" : processStage === "lost" ? "lost" : processStage === "cancelled" ? "cancelled" : undefined,
    }));
    setModal({ title, rows });
  }

  return (
    <div className="rm-page">
      <Box title="Process funnel" tools={<span className="text-muted">Click a stage to inspect records</span>}>
        <FunnelBars
          onSelect={(item) => openStage(item.id, item.title)}
          items={[
            ...data.stages.map((s, i) => ({
              id: s.id,
              title: `${i + 1}. ${s.label}`,
              subtitle: `Stage ${s.stage} · ${s.probability}% probability`,
              value: `${s.count} opps`,
              meta: formatINR(s.value),
              color: colors[i],
            })),
            { id: "booked", title: "Booked / Won", subtitle: "Closed business", value: `${data.booked.count} opps`, meta: formatINR(data.booked.value), color: FUNNEL_COLORS.won },
          ]}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <div className="col-sm-6">
            <FunnelBars
              onSelect={(item) => openStage(item.id, item.title)}
              items={[{ id: "lost", title: "Lost", subtitle: "Competitive / commercial losses", value: `${data.lost.count} opps`, meta: formatINR(data.lost.value), color: FUNNEL_COLORS.lost }]}
            />
          </div>
          <div className="col-sm-6">
            <FunnelBars
              onSelect={(item) => openStage(item.id, item.title)}
              items={[{ id: "cancelled", title: "Cancelled", subtitle: "Project cancelled or on hold", value: `${data.cancelled.count} opps`, meta: formatINR(data.cancelled.value), color: FUNNEL_COLORS.cancelled }]}
            />
          </div>
        </div>
      </Box>
      <Box title="Stage-wise opportunity count">
        <div className="rm-chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stages} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="label" tick={CHART_TICK_SM} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_TICK_SM} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2079B7" radius={[8, 8, 0, 0]} name="Opportunities" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Box>
      {modal ? (
        <Modal title={`${modal.title} · ${modal.rows.length}`} onClose={() => setModal(null)} wide>
          <div className="table-responsive">
            <table className="table table-striped table-hover data-list-table">
              <thead>
                <tr><th>Customer</th><th>Product</th><th>Value</th><th>Owner</th></tr>
              </thead>
              <tbody>
                {modal.rows.length === 0 ? (
                  <tr><td colSpan={4} className="text-muted">No matching records</td></tr>
                ) : modal.rows.map((o) => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => nav(`/opportunities/${encodeURIComponent(o.id)}`)}>
                    <td>
                      <strong>{o.customer}</strong>
                      <div className="text-muted text-sm">{o.location}</div>
                    </td>
                    <td>{o.product}</td>
                    <td>{formatINR(o.value)}</td>
                    <td>{o.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
