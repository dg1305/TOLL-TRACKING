import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatINR, qs } from "../api.js";
import { Kpi, Box } from "../components/ui.jsx";
import { CHART_GRID, CHART_TICK, CHART_TICK_SM } from "../lib/chartTheme.js";

const COLORS = ["#2079B7", "#8CBC43", "#EF6A31", "#44467D", "#3F8BA2", "#0D4574"];

export default function Forecast({ region }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.forecast(qs({ region })).then(setData).catch(console.error);
  }, [region]);
  if (!data) return <p className="text-muted">Loading forecast…</p>;
  return (
    <div className="rm-page">
      <div className="rm-kpi-row">
        <Kpi label="Pipeline value" value={formatINR(data.pipeline)} hint="Unweighted open value" icon="fa-layer-group" />
        <Kpi label="Weighted pipeline" value={formatINR(data.weighted)} hint="Value × probability" icon="fa-balance-scale" tone="green" />
        <Kpi label="Booked revenue" value={formatINR(data.booked)} hint="Won orders" icon="fa-check-circle" tone="green" />
        <Kpi label="Lost revenue" value={formatINR(data.lost)} hint="Lost / cancelled" icon="fa-times-circle" tone="rose" />
      </div>
      <div className="row">
        <div className="col-md-6">
          <Box title="Stage-wise value">
            <div className="rm-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byStage} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART_TICK_SM} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => formatINR(v)} />
                  <Bar dataKey="value" fill="#2079B7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Box>
        </div>
        <div className="col-md-6">
          <Box title="Product-wise forecast">
            <div className="rm-chart-box" style={{ height: 240, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byProduct} dataKey="value" nameKey="name" innerRadius={58} outerRadius={96} paddingAngle={2}>
                    {data.byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="sf-chart-legend">
              {data.byProduct.map((p, i) => (
                <span key={p.name}><i style={{ background: COLORS[i % COLORS.length] }} />{p.name} · {formatINR(p.value)}</span>
              ))}
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}
