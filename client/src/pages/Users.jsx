import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { Field, Modal, Select } from "../components/ui.jsx";

const empty = {
  first_name: "",
  last_name: "",
  email: "",
  jobtitle: "Sales",
  region_key: "north",
  password: "Sales@3i",
};

export default function Users() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);

  const load = () => api.users().then((r) => setRows(r.rows || r)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.createUser(form);
      toast.success("User created");
      setForm(empty);
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function deactivate(id) {
    if (!confirm("Deactivate this user?")) return;
    try {
      await api.deleteUser(id);
      toast.success("User deactivated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="rm-page">
      <div className="rm-panel">
        <div className="rm-panel__bar">
          <h2>App users <span>{rows.length} accounts</span></h2>
          <button type="button" className="btn btn-theme btn-sm" onClick={() => setOpen(true)}>
            <i className="fas fa-plus" /> Add user
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-striped table-hover data-list-table">
            <thead>
              <tr>
                {["Name", "Email", "Role", "Region", "Status", ""].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name || `${u.first_name} ${u.last_name}`}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.jobtitle || (u.is_admin ? "Admin" : "Sales")}</td>
                  <td>{u.region_key || "all"}</td>
                  <td><span className={`label ${u.activated ? "label-success" : "label-danger"}`}>{u.activated ? "Active" : "Off"}</span></td>
                  <td className="actions">
                    <button type="button" className="btn btn-danger btn-xs" onClick={() => deactivate(u.id)}>Deactivate</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open ? (
        <Modal title="New user" onClose={() => setOpen(false)}>
          <form onSubmit={create}>
            {[
              ["first_name", "First name", "text"],
              ["last_name", "Last name", "text"],
              ["email", "Email", "email"],
              ["jobtitle", "Role / title", "text"],
              ["password", "Password", "password"],
            ].map(([k, label, type]) => (
              <Field key={k} label={label}>
                <input type={type} className="form-control" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </Field>
            ))}
            <Field label="Region">
              <Select
                value={form.region_key}
                onChange={(v) => setForm({ ...form, region_key: v })}
                options={[
                  { value: "north", label: "North" },
                  { value: "west", label: "West" },
                  { value: "", label: "All" },
                ]}
              />
            </Field>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-default" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-theme" type="submit">Create</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
