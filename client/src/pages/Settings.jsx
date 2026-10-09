import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { useAuth } from "../api/AuthContext.jsx";
import { Box } from "../components/ui.jsx";

export default function Settings() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState(null);
  useEffect(() => { api.quality().then(setQ); }, []);
  async function reset() {
    if (!confirm("Restore all opportunities from the Excel seed? Current pipeline edits will be replaced.")) return;
    await api.reset();
    setQ(await api.quality());
    toast.success("Pipeline restored from Excel seed.");
  }
  if (!q) return <p className="text-muted">Loading…</p>;
  return (
    <div className="rm-page">
      <Box title="Data quality score" type="primary">
        <div className="rm-stat-row">
          <div className="rm-score">{q.score}%</div>
          <div className="rm-dl rm-dl--inline">
            <div><dt>Issues</dt><dd>{q.issuesFound}</dd></div>
            <div><dt>Missing</dt><dd>{q.missing}</dd></div>
            <div><dt>Inconsistent</dt><dd>{q.inconsistent}</dd></div>
          </div>
        </div>
        {isAdmin ? (
          <button type="button" className="btn btn-default rm-mt-4" onClick={reset}>
            Reset data to Excel seed
          </button>
        ) : null}
      </Box>
      <Box title="Application">
        <p className="text-muted rm-m-0">
          Database <code>3i_Sales_funnel</code> · JWT session · client build served from Express when <code>SERVE_CLIENT=true</code>.
        </p>
      </Box>
    </div>
  );
}
