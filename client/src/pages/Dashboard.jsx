import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatINR, qs } from "../api.js";
import { Box, Kpi } from "../components/ui.jsx";
import FunnelBars, { FUNNEL_COLORS } from "../components/FunnelBars.jsx";
import { useAuth } from "../api/AuthContext.jsx";
import { CHART_TICK } from "../lib/chartTheme.js";

export default function Dashboard({ region }) {
  const nav = useNavigate();
  const { user, displayName } = useAuth();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.dashboard(qs({ region })).then(setData).catch(console.error);
  }, [region]);
  if (!data) return <p className="text-muted">Loading dashboard…</p>;
  const k = data.kpis;
  const total = data.stages.reduce((s, x) => s + x.value, 0) || 1;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const who = user?.first_name || displayName;
  const mixMax = Math.max(...data.stages.map((s) => s.value), 1);

  return (
    <div className="rm-page">
      <div className="rm-page-head">
        <div>
          <p className="rm-page-greet">{greet}, {who}</p>
          <p>Here is how the sales pipeline is performing.</p>
        </div>
      </div>

      <div className="rm-kpi-row rm-kpi-row--6">
        <Kpi to="/opportunities" label="Total pipeline" value={formatINR(k.pipeline)} hint="Open value" icon="fa-rupee-sign" />
        <Kpi to="/opportunities" tone="teal" label="Opportunities" value={k.opportunities} hint={`${k.open} open`} icon="fa-briefcase" />
        <Kpi to="/forecast" tone="green" label="Expected revenue" value={formatINR(k.expected)} hint="Weighted pipeline" icon="fa-chart-line" />
        <Kpi to="/pipeline" tone="orange" label="High probability" value={k.highCount} hint={formatINR(k.highValue)} icon="fa-bolt" />
        <Kpi to="/opportunities" tone="green" label="Booked business" value={formatINR(k.booked)} hint={`${k.bookedCount} won`} icon="fa-check-circle" />
        <Kpi to="/lost" tone="rose" label="Lost business" value={formatINR(k.lost)} hint={`${k.lostCount} lost`} icon="fa-times-circle" />
      </div>

      <div className="row">
        <div className="col-md-7">
          <Box title="Sales funnel" type="primary" tools={<span className="text-muted">Click a stage</span>}>
            <FunnelBars
              onSelect={(item) => nav(item.nav || "/funnel")}
              items={[
                ...data.stages.map((s, i) => ({
                  id: s.id,
                  title: `${s.label} · ${s.range}`,
                  subtitle: `${s.count} opportunities · ${Math.round((s.value / total) * 100)}% of pipeline`,
                  value: formatINR(s.value),
                  color: [FUNNEL_COLORS.s1, FUNNEL_COLORS.s2, FUNNEL_COLORS.s3, FUNNEL_COLORS.s4][i],
                  nav: "/funnel",
                })),
                { id: "won", title: "Booked / Won", subtitle: `${k.bookedCount} orders`, value: formatINR(k.booked), color: FUNNEL_COLORS.won, nav: "/opportunities" },
                { id: "lost", title: "Lost / Cancelled", subtitle: `${k.lostCount} opportunities`, value: formatINR(k.lost), color: FUNNEL_COLORS.lost, nav: "/lost" },
              ]}
            />
          </Box>
        </div>
        <div className="col-md-5">
          <Box title="Stage mix">
            <div className="dash-status-bars">
              {data.stages.map((s, i) => (
                <div key={s.id} className="dash-status-row">
                  <div className="dash-status-meta">
                    <span>{s.label}</span>
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
          </Box>
          <Box title="Pipeline by product">
            <div className="rm-chart-box" style={{ height: 220, minHeight: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.products} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} cursor={{ fill: "rgba(32,121,183,0.06)" }} />
                  <Bar dataKey="value" fill="#2079B7" radius={[0, 8, 8, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}
