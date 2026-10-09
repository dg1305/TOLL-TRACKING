import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
// import { Activity } from "lucide-react";
import { api, authApi } from "../api.js";
import { Box, Field } from "../components/ui.jsx";
import "../components/login/login-suite.css";

function AuthShell({ title, children }) {
  return (
    <div className="em-page">
      <div className="em-bg" aria-hidden>
        <span className="em-orb em-orb--a" />
        <span className="em-orb em-orb--b" />
        <span className="em-grid" />
      </div>
      <div className="em-shell">
        <section className="em-auth">
          <div className="em-card">
            <div className="em-card-head em-card-head--brand">
              {/* <img className="em-card-logo" src="/3i_logo.png" alt="3i MedTech" /> */}
              <div>
                <h2>{title}</h2>
                {/* <p>3i Sales Funnel</p> */}
              </div>
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const res = await authApi.forgotPassword(email.trim().toLowerCase());
      setOkMsg(Array.isArray(res.messages) ? res.messages.join(" ") : "If that email is registered, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot password">
      <p className="em-card-head" style={{ display: "block", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Enter your work email and we will send a reset link.</span>
      </p>
      {error ? <div className="em-error" role="alert">{error}</div> : null}
      {okMsg ? <div className="em-ok">{okMsg}</div> : null}
      {!okMsg && (
        <form onSubmit={submit}>
          <div className="em-field">
            <label htmlFor="forgot-email">Email</label>
            <div className="em-field-box">
              <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@email.com" />
            </div>
          </div>
          <button type="submit" className="em-submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p style={{ marginTop: 18, textAlign: "center" }}>
        <Link to="/login" className="em-forgot">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      setValid(false);
      setChecking(false);
      return;
    }
    authApi
      .validateResetToken(token)
      .then(() => { setValid(true); setError(""); })
      .catch((e) => {
        setValid(false);
        setError(e.message || "This reset link is invalid or has expired");
      })
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await authApi.resetPassword(token, password, confirm);
      setOkMsg(Array.isArray(res.messages) ? res.messages.join(" ") : "Password has been reset.");
      setValid(false);
      setTimeout(() => navigate("/login"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset password">
      {checking ? <p style={{ color: "#64748b" }}>Checking link…</p> : null}
      {error ? <div className="em-error" role="alert">{error}</div> : null}
      {okMsg ? <div className="em-ok">{okMsg}</div> : null}
      {!checking && valid && !okMsg ? (
        <form onSubmit={submit}>
          <div className="em-field">
            <label htmlFor="reset-pass">New password</label>
            <div className="em-field-box">
              <input id="reset-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <div className="em-field">
            <label htmlFor="reset-confirm">Confirm password</label>
            <div className="em-field-box">
              <input id="reset-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <button type="submit" className="em-submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
        </form>
      ) : null}
      <p style={{ marginTop: 18, textAlign: "center" }}>
        <Link to="/login" className="em-forgot">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

export function AccountProfile() {
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api.profile().then((u) => setForm({ first_name: u.first_name || "", last_name: u.last_name || "", phone: u.phone || "" }));
  }, []);
  async function save(e) {
    e.preventDefault();
    await api.saveProfile(form);
    setMsg("Profile saved");
  }
  return (
    <Box title="Edit profile" type="primary">
      {msg ? <p className="text-success">{msg}</p> : null}
      <form onSubmit={save} className="rm-form-grid rm-form-grid--2">
        <Field label="First name"><input className="form-control" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
        <Field label="Last name"><input className="form-control" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
        <Field label="Phone" full><input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <div className="rm-field--full">
          <button className="btn btn-theme" type="submit">Save</button>
        </div>
      </form>
    </Box>
  );
}

export function AccountPassword() {
  const [form, setForm] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    try {
      await api.changePassword(form);
      setMsg("Password updated");
      setForm({ current_password: "", password: "", password_confirmation: "" });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    }
  }
  return (
    <Box title="Change password" type="primary">
      {msg ? <p className="text-success">{msg}</p> : null}
      {err ? <p className="text-danger">{err}</p> : null}
      <form onSubmit={save}>
        <Field label="Current password"><input type="password" className="form-control" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} /></Field>
        <Field label="New password"><input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Confirm"><input type="password" className="form-control" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} /></Field>
        <button className="btn btn-theme" type="submit">Update password</button>
      </form>
    </Box>
  );
}
