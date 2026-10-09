import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { useToast } from "../components/Toast.jsx";
import { Box, DateField, Kpi } from "../components/ui.jsx";
import TollMap, { formatCoord, mapsHref, parseGeocode } from "../components/TollMap.jsx";

function readDay(row) {
  const raw = String(row.reader_read_time || row.fetched_at || row.created_at || "");
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function VehicleFilter({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    function onDoc(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = options.filter((plate) => plate.includes(query.trim().toUpperCase()));
  const label = !value.length ? "All vehicles" : value.length === 1 ? value[0] : `${value.length} vehicles`;

  function toggle(plate) {
    onChange(value.includes(plate) ? value.filter((item) => item !== plate) : [...value, plate]);
  }

  return (
    <div className={`ft-multi${open ? " is-open" : ""}`} ref={rootRef}>
      <button type="button" className="form-control ft-multi-btn" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{label}</span>
        <i className="fas fa-chevron-down" aria-hidden="true" />
      </button>
      {open ? (
        <div className="ft-multi-menu">
          <input
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value.toUpperCase())}
            placeholder="Search vehicle"
            aria-label="Search vehicle"
          />
          <button type="button" className="ft-multi-all" onClick={() => onChange([])}>All vehicles</button>
          <div className="ft-multi-list">
            {shown.map((plate) => (
              <label key={plate}>
                <input type="checkbox" checked={value.includes(plate)} onChange={() => toggle(plate)} />
                {plate}
              </label>
            ))}
            {!shown.length ? <p className="text-muted">No vehicles</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusLabel(status) {
  if (status === "ok") return { text: "Stored", cls: "label label-success" };
  if (status === "empty") return { text: "No reads", cls: "label label-warning" };
  if (status === "error") return { text: "Failed", cls: "label label-danger" };
  if (status === "running") return { text: "Fetching", cls: "label label-info" };
  if (status === "done") return { text: "Done", cls: "label label-success" };
  if (status === "failed") return { text: "Failed", cls: "label label-danger" };
  if (status === "pending") return { text: "Waiting", cls: "label label-default" };
  return { text: "Ready", cls: "label label-primary" };
}

export default function Fastag() {
  const toast = useToast();
  const [batches, setBatches] = useState([]);
  const [detail, setDetail] = useState(null);
  const [activity, setActivity] = useState([]);
  const [plate, setPlate] = useState("");
  const [file, setFile] = useState(null);
  const [filter, setFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState("");
  const mapRef = useRef(null);

  async function loadActivity() {
    const data = await api.fastagActivity();
    setActivity(data.rows || []);
  }

  async function loadList() {
    const data = await api.fastagBatches();
    const rows = data.rows || [];
    setBatches(rows);
    return rows;
  }

  async function openBatch(id) {
    const data = await api.fastagBatch(id);
    setDetail(data);
    return data;
  }

  useEffect(() => {
    loadList()
      .then((rows) => { if (rows[0]) return openBatch(rows[0].id); })
      .catch((error) => toast.error(error.message));
    loadActivity().catch((error) => toast.error(error.message));
  }, []);

  const batch = detail?.batch;
  const running = batch?.status === "running" || busy === "fetch";

  useEffect(() => {
    if (!batch || batch.status !== "running") return undefined;
    const timer = window.setInterval(() => {
      openBatch(batch.id)
        .then((data) => {
          if (data.batch.status !== "running") {
            loadActivity().catch(() => undefined);
            return loadList();
          }
        })
        .catch((error) => toast.error(error.message));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [batch?.id, batch?.status]);

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose an Excel or CSV file");
      return;
    }
    setBusy("upload");
    try {
      const data = await api.fastagUpload(file);
      setDetail(data);
      setFile(null);
      event.target.reset();
      await loadList();
      await loadActivity();
      toast.success(`${data.batch.vehicle_count} vehicle numbers ready`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  async function retryFailed() {
    if (!batch) return;
    setBusy("retry");
    try {
      const data = await api.fastagRetryFailed(batch.id);
      await openBatch(batch.id);
      toast.info(`Re-running ${data.count} failed vehicle${data.count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  async function fetchBatch() {
    if (!batch) return;
    setBusy("fetch");
    try {
      await api.fastagFetch(batch.id);
      await openBatch(batch.id);
      toast.info("Fetching toll data");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  async function lookup(event) {
    event.preventDefault();
    setBusy("lookup");
    try {
      const data = await api.fastagLookup(plate.trim());
      setDetail(data);
      setPlate("");
      await loadList();
      const vehicle = data.vehicles?.[0];
      if (vehicle?.status === "error") toast.error(vehicle.error_message || "Lookup failed");
      else if (vehicle?.status === "empty") toast.info("No toll reads returned");
      else toast.success(`Stored ${data.batch.read_count} toll read${data.batch.read_count === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy("");
    }
  }

  const query = filter.trim().toUpperCase();
  const vehicles = detail?.vehicles || [];
  const reads = detail?.reads || [];
  const vehicleOptions = useMemo(
    () => [...new Set(vehicles.map((row) => row.vehicle_reg_no))].sort(),
    [vehicles],
  );
  const vehicleSet = useMemo(() => new Set(vehicleFilter), [vehicleFilter]);
  const dateActive = Boolean(dateFrom || dateTo);
  function inDateRange(row) {
    const day = readDay(row);
    if (dateFrom && (!day || day < dateFrom)) return false;
    if (dateTo && (!day || day > dateTo)) return false;
    return true;
  }
  const platesInRange = useMemo(() => {
    if (!dateActive) return null;
    return new Set(reads.filter(inDateRange).map((row) => row.vehicle_reg_no));
  }, [reads, dateFrom, dateTo, dateActive]);
  const shownVehicles = useMemo(
    () => vehicles.filter((row) => {
      if (vehicleSet.size && !vehicleSet.has(row.vehicle_reg_no)) return false;
      if (platesInRange && !platesInRange.has(row.vehicle_reg_no)) return false;
      if (!query) return true;
      return row.vehicle_reg_no.includes(query) || (row.error_message || "").toUpperCase().includes(query);
    }),
    [vehicles, vehicleSet, platesInRange, query],
  );
  const shownReads = useMemo(
    () => reads.filter((row) => {
      if (vehicleSet.size && !vehicleSet.has(row.vehicle_reg_no)) return false;
      if (!inDateRange(row)) return false;
      if (!query) return true;
      return [row.vehicle_reg_no, row.toll_plaza_name, row.seq_no, row.vehicle_type, row.toll_plaza_geocode]
        .join(" ")
        .toUpperCase()
        .includes(query);
    }),
    [reads, vehicleSet, dateFrom, dateTo, query],
  );
  const mapPoints = useMemo(() => {
    const groups = new Map();
    for (const row of shownReads) {
      const geo = parseGeocode(row.toll_plaza_geocode);
      if (!geo) continue;
      const key = `${geo.lat.toFixed(5)},${geo.lng.toFixed(5)}`;
      const current = groups.get(key) || {
        key,
        lat: geo.lat,
        lng: geo.lng,
        name: row.toll_plaza_name || "Toll plaza",
        count: 0,
        vehicles: new Set(),
      };
      current.count += 1;
      current.vehicles.add(row.vehicle_reg_no);
      if (row.toll_plaza_name) current.name = row.toll_plaza_name;
      groups.set(key, current);
    }
    return [...groups.values()].map((group) => ({ ...group, vehicles: [...group.vehicles] }));
  }, [shownReads]);

  function clearFilters() {
    setFilter("");
    setVehicleFilter([]);
    setDateFrom("");
    setDateTo("");
    setPicked(null);
  }

  function pickLocation(location) {
    setPicked(location);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function pickRead(row) {
    const geo = parseGeocode(row.toll_plaza_geocode);
    if (!geo) return;
    pickLocation({
      ...geo,
      label: row.toll_plaza_name || row.vehicle_reg_no,
      name: row.toll_plaza_name || "Toll plaza",
      vehicle: row.vehicle_reg_no,
    });
  }
  const failedCount = vehicles.filter((row) => row.status === "error").length;
  const finished = vehicles.filter((row) => row.status !== "pending").length;
  const progress = batch?.vehicle_count ? Math.round((finished / batch.vehicle_count) * 100) : 0;

  return (
    <div className="rm-page">
      <div className="rm-kpi-row">
        <Kpi label="Vehicles" value={batch ? batch.vehicle_count : "—"} hint="In the selected sheet" icon="fa-truck" />
        <Kpi label="Stored" value={batch ? batch.ok_count : "—"} hint="Lookups with a response" icon="fa-check" tone="green" />
        <Kpi label="Toll reads" value={batch ? batch.read_count : "—"} hint="Rows saved from the API" icon="fa-road" tone="teal" />
        <Kpi label="Needs attention" value={batch ? batch.error_count : "—"} hint="Failed or empty lookups" icon="fa-exclamation-triangle" tone="orange" />
      </div>

      <div className="ft-grid">
        <Box title="One vehicle" tools={<span className="text-muted">Calls the API immediately</span>}>
          <form onSubmit={lookup} className="ft-form">
            <input
              className="form-control"
              value={plate}
              onChange={(event) => setPlate(event.target.value.toUpperCase())}
              placeholder="CG13BF6032"
              aria-label="Vehicle number"
            />
            <button className="btn btn-theme" type="submit" disabled={busy === "lookup" || running}>
              {busy === "lookup" ? "Fetching…" : "Fetch"}
            </button>
          </form>
        </Box>

        <Box title="Vehicle sheet" tools={<span className="text-muted">Excel or CSV, two or three times a day</span>}>
          <form onSubmit={upload} className="ft-form">
            <input
              className="form-control"
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              aria-label="Vehicle sheet"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button className="btn btn-theme" type="submit" disabled={busy === "upload"}>
              {busy === "upload" ? "Reading…" : "Upload"}
            </button>
          </form>
          <p className="text-muted ft-note">
            Numbers such as CG13BF6032 are picked up from the sheet. Upload first, then fetch.
          </p>
        </Box>
      </div>

      <Box
        title={batch ? batch.filename : "Toll responses"}
        tools={batch ? (
          <div className="ft-tools">
            <span className={statusLabel(batch.status).cls}>{statusLabel(batch.status).text}</span>
            <button type="button" className="btn btn-theme btn-sm" disabled={running || busy === "lookup"} onClick={fetchBatch}>
              {running ? "Fetching…" : "Fetch toll data"}
            </button>
            {failedCount > 0 ? (
              <button type="button" className="btn btn-default btn-sm" disabled={running || busy === "retry"} onClick={retryFailed}>
                {busy === "retry" ? "Re-running…" : `Re-run failed (${failedCount})`}
              </button>
            ) : null}
          </div>
        ) : null}
      >
        {!batch ? <p className="text-muted">Upload a sheet or fetch one vehicle number.</p> : null}
        {batch ? (
          <>
            <div className="ft-batch-row">
              <label>
                Sheet
                <select
                  className="form-control"
                  value={batch.id}
                  onChange={(event) => openBatch(event.target.value).catch((error) => toast.error(error.message))}
                >
                  {batches.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.filename} · {row.vehicle_count} vehicles · {row.created_at}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input
                  className="form-control"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Vehicle, plaza, seq"
                />
              </label>
            </div>
            <div className="ft-filter-row">
              <div className="ft-field">
                <span>Vehicles</span>
                <VehicleFilter
                  options={vehicleOptions}
                  value={vehicleFilter}
                  onChange={(next) => {
                    setVehicleFilter(next);
                    setPicked(null);
                  }}
                />
              </div>
              <div className="ft-field">
                <span>From date</span>
                <DateField value={dateFrom} onChange={(value) => { setDateFrom(value); setPicked(null); }} placeholder="Read from" />
              </div>
              <div className="ft-field">
                <span>To date</span>
                <DateField value={dateTo} onChange={(value) => { setDateTo(value); setPicked(null); }} placeholder="Read to" />
              </div>
              <div className="ft-field ft-field-action">
                <span className="ft-field-spacer">Clear</span>
                <button type="button" className="btn btn-default" onClick={clearFilters}>Clear filters</button>
              </div>
            </div>
            <p className="text-muted ft-note">From date and To date stay on with the vehicle filter. They limit the vehicle list, the map, and the stored reads by toll read time.</p>
            {batch.status === "running" ? (
              <div className="ft-progress" aria-label="Fetch progress">
                <div style={{ width: `${progress}%` }} />
                <span>{finished} of {batch.vehicle_count}</span>
              </div>
            ) : null}
            {batch.error_message ? <p className="text-danger">{batch.error_message}</p> : null}
          </>
        ) : null}

        {batch ? (
          <div className="table-responsive ft-table">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Reads</th>
                  <th>Fetched</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {shownVehicles.map((row) => {
                  const badge = statusLabel(row.status);
                  return (
                    <tr key={row.id}>
                      <td>{row.vehicle_reg_no}</td>
                      <td><span className={badge.cls}>{badge.text}</span></td>
                      <td>{row.read_count}</td>
                      <td>{row.fetched_at || "—"}</td>
                      <td>{row.error_message || "—"}</td>
                    </tr>
                  );
                })}
                {!shownVehicles.length ? (
                  <tr><td colSpan={5} className="text-muted">No vehicles match this filter.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </Box>

      {batch ? (
        <Box title="Toll map" tools={<span className="text-muted">{mapPoints.length} plaza{mapPoints.length === 1 ? "" : "s"}</span>}>
          <div ref={mapRef}>
            <TollMap points={mapPoints} picked={picked} onPick={pickLocation} />
          </div>
        </Box>
      ) : null}

      {batch ? (
        <Box
          title="Stored responses"
          tools={(
            <div className="ft-tools">
              <span className="text-muted">{shownReads.length} shown</span>
              <button
                type="button"
                className="btn btn-theme btn-sm"
                disabled={!reads.length || busy === "export"}
                onClick={async () => {
                  setBusy("export");
                  try {
                    const file = await api.fastagExport(batch.id);
                    toast.success(`Exported ${file.filename}`);
                  } catch (error) {
                    toast.error(error.message);
                  } finally {
                    setBusy("");
                  }
                }}
              >
                {busy === "export" ? "Exporting…" : "Export Excel"}
              </button>
            </div>
          )}
        >
          <p className="text-muted ft-note">Every fetch is kept with its date and time in server/data/fastag.json. Earlier pulls are not replaced.</p>
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Read time</th>
                  <th>Seq no</th>
                  <th>Direction</th>
                  <th>Toll plaza</th>
                  <th>Geocode</th>
                  <th>Type</th>
                  <th>Fetched at</th>
                </tr>
              </thead>
              <tbody>
                {shownReads.map((row) => {
                  const geo = parseGeocode(row.toll_plaza_geocode);
                  return (
                    <tr key={row.id}>
                      <td>{row.vehicle_reg_no}</td>
                      <td>{row.reader_read_time || "—"}</td>
                      <td>{row.seq_no || "—"}</td>
                      <td>{row.lane_direction || "—"}</td>
                      <td>{row.toll_plaza_name || "—"}</td>
                      <td>
                        {geo ? (
                          <span className="ft-geo-cell">
                            <button type="button" className="ft-geo-link" onClick={() => pickRead(row)}>
                              {formatCoord(geo.lat)}, {formatCoord(geo.lng)}
                            </button>
                            <a
                              className="ft-geo-ext"
                              href={mapsHref(geo.lat, geo.lng)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${row.toll_plaza_name || "coordinates"} in Google Maps`}
                            >
                              <i className="fas fa-external-link-alt" aria-hidden="true" />
                            </a>
                          </span>
                        ) : "—"}
                      </td>
                      <td>{row.vehicle_type || "—"}</td>
                      <td>{row.fetched_at || row.created_at || "—"}</td>
                    </tr>
                  );
                })}
                {!shownReads.length ? (
                  <tr><td colSpan={8} className="text-muted">{reads.length ? "No toll reads match these filters." : "No stored toll reads yet. Click Fetch toll data."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Box>
      ) : null}

      <Box title="Activity log" tools={<span className="text-muted">server/data/activity.json</span>}>
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={row.id}>
                  <td>{row.at}</td>
                  <td>{row.email || "—"}</td>
                  <td>{row.action}</td>
                  <td>{row.note || "—"}</td>
                </tr>
              ))}
              {!activity.length ? (
                <tr><td colSpan={4} className="text-muted">No activity yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Box>
    </div>
  );
}
