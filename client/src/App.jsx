import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./api/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import InteractiveLoginPage from "./components/login/InteractiveLoginPage.jsx";
import { ForgotPasswordPage, ResetPasswordPage, AccountProfile, AccountPassword } from "./pages/Account.jsx";
import Shell from "./components/Shell.jsx";
// import Dashboard from "./pages/Dashboard.jsx";
// import Funnel from "./pages/Funnel.jsx";
// import Opportunities from "./pages/Opportunities.jsx";
// import OpportunityView from "./pages/OpportunityView.jsx";
// import OpportunityEdit from "./pages/OpportunityEdit.jsx";
// import AddOpportunity from "./pages/AddOpportunity.jsx";
// import Pipeline from "./pages/Pipeline.jsx";
// import Forecast from "./pages/Forecast.jsx";
// import Lost from "./pages/Lost.jsx";
// import Reports from "./pages/Reports.jsx";
// import Settings from "./pages/Settings.jsx";
// import Users from "./pages/Users.jsx";
import Fastag from "./pages/Fastag.jsx";

function safeAppNext(raw) {
  if (!raw) return null;
  let value = raw;
  try { value = decodeURIComponent(raw); } catch { /* keep */ }
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/forgot") || value.startsWith("/reset")) return null;
  return value;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

function RequirePasswordReady({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (user?.must_change_password && location.pathname !== "/account/password") {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/account/password?next=${next}`} replace />;
  }
  return children;
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (!isAdmin) return <p className="p-10 text-center">Only administrators can access this page.</p>;
  return children;
}

function LoginRoute() {
  const { login } = useAuth();
  const location = useLocation();
  const next = safeAppNext(new URLSearchParams(location.search).get("next"));
  return (
    <InteractiveLoginPage
      onSubmit={async ({ email, password }) => {
        const u = await login(email, password);
        const dest = u?.must_change_password
          ? `/account/password${next ? `?next=${encodeURIComponent(next)}` : ""}`
          : (next || "/fastag");
        window.location.replace(dest);
      }}
    />
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (user?.region_key) setRegion(user.region_key);
  }, [user?.region_key]);
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        element={
          <RequireAuth>
            <RequirePasswordReady>
              <Shell region={region} setRegion={setRegion} onSearch={setSearch} />
            </RequirePasswordReady>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/fastag" replace />} />
        {/* <Route path="/" element={<Dashboard region={region} />} />
        <Route path="/funnel" element={<Funnel region={region} />} />
        <Route path="/opportunities" element={<Opportunities region={region} search={search} />} />
        <Route path="/opportunities/:id/edit" element={<OpportunityEdit />} />
        <Route path="/opportunities/:id" element={<OpportunityView />} />
        <Route path="/add" element={<AddOpportunity />} />
        <Route path="/pipeline" element={<Pipeline region={region} />} />
        <Route path="/forecast" element={<Forecast region={region} />} />
        <Route path="/lost" element={<Lost region={region} />} />
        <Route path="/reports" element={<Reports region={region} />} />
        <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
        <Route path="/users" element={<RequireAdmin><Users /></RequireAdmin>} /> */}
        <Route path="/fastag" element={<Fastag />} />
        <Route path="/account/profile" element={<AccountProfile />} />
        <Route path="/account/password" element={<AccountPassword />} />
        <Route path="*" element={<Navigate to="/fastag" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
