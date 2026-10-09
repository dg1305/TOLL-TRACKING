import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../api/AuthContext.jsx";
// import { Select } from "./ui.jsx";

const NARROW_MQ = "(max-width: 991px)";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(NARROW_MQ).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

const NAV = [
  // { to: "/", label: "Dashboard", icon: "fa-chart-line", end: true },
  // { to: "/funnel", label: "Sales Funnel", icon: "fa-filter" },
  // { to: "/opportunities", label: "Opportunities", icon: "fa-briefcase" },
  // { to: "/add", label: "Add Opportunity", icon: "fa-plus-circle" },
  // { to: "/pipeline", label: "My Pipeline", icon: "fa-columns" },
  // { to: "/forecast", label: "Forecast", icon: "fa-chart-area" },
  // { to: "/lost", label: "Lost Business", icon: "fa-user-times" },
  // { to: "/reports", label: "Reports", icon: "fa-chart-bar" },
  { to: "/fastag", label: "FASTag", icon: "fa-road" },
];

const TITLES = {
  // "/": ["Dashboard", "Pipeline performance"],
  // "/funnel": ["Sales Funnel", "Enquiry to closure"],
  // "/opportunities": ["Opportunities", "All live records"],
  // "/add": ["Add Opportunity", "Capture a new enquiry"],
  // "/pipeline": ["My Pipeline", "Drag cards to update stage"],
  // "/forecast": ["Forecast", "Weighted pipeline"],
  // "/lost": ["Lost Business", "Lost and cancelled deals"],
  // "/reports": ["Reports", "Pipeline analytics"],
  "/fastag": ["FASTag", "Vehicle toll lookups"],
  // "/settings": ["Settings", "Data quality and app"],
  // "/users": ["App users", "Access to the sales funnel"],
  "/account/profile": ["Profile", "Your account"],
  "/account/password": ["Password", "Update sign-in"],
};

export default function Shell({ region, setRegion, onSearch }) {
  const isNarrow = useIsNarrow();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(NARROW_MQ).matches : false,
  );
  const [userOpen, setUserOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, displayName } = useAuth();
  const path = location.pathname;
  const [title, subtitle] = path.endsWith("/edit") && path.startsWith("/opportunities/")
    ? ["Edit opportunity", "Update record"]
    : /^\/opportunities\/.+/.test(path)
      ? ["Opportunity", "Record details"]
      : (TITLES[path] || ["FASTag", "Vehicle toll lookups"]);
  const drawerOpen = isNarrow && !collapsed;

  useEffect(() => {
    if (isNarrow) setCollapsed(true);
    else setCollapsed(false);
  }, [isNarrow]);

  useEffect(() => {
    if (isNarrow) setCollapsed(true);
    setUserOpen(false);
    setCreateOpen(false);
  }, [location.pathname, isNarrow]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const closeDrawer = () => {
    if (isNarrow) setCollapsed(true);
  };

  const searchSubmit = (e) => {
    e.preventDefault();
    onSearch?.(q.trim());
    navigate("/opportunities");
  };

  const items = [
    ...NAV,
    // ...(isAdmin ? [
    //   { to: "/users", label: "App users", icon: "fa-user-shield" },
    //   { to: "/settings", label: "Settings", icon: "fa-cog" },
    // ] : []),
  ];

  return (
    <div className={`wrapper ${collapsed ? "sidebar-collapse" : ""} ${!collapsed ? "sidebar-open" : ""}${isNarrow ? " is-narrow" : ""}`}>
      {drawerOpen ? (
        <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={closeDrawer} />
      ) : null}
      <header className="main-header">
        {/* <NavLink to="/" className="logo" aria-label="3i MedTech" onClick={closeDrawer}>
          <span className="header-logo">
            <img src="/3i_mark.png?v=5" alt="" />
          </span>
        </NavLink> */}
        <nav className="navbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
          >
            <i className="fas fa-bars" />
          </button>
          {/* <form className="header-search" onSubmit={searchSubmit}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search opportunities, customers…" />
            <button type="submit"><i className="fas fa-search" /></button>
          </form>
          <Select
            className="header-region"
            compact
            value={region}
            onChange={setRegion}
            options={[
              { value: "all", label: "All regions" },
              { value: "north", label: "Prem Territory" },
              { value: "west", label: "West Sales Team" },
            ]}
          /> */}
          <div className="navbar-custom-menu">
            <ul className="navbar-nav">
              {/* <li><NavLink to="/opportunities" title="Opportunities"><i className="fas fa-briefcase" /></NavLink></li>
              <li><NavLink to="/pipeline" title="Pipeline"><i className="fas fa-columns" /></NavLink></li>
              {isAdmin ? <li><NavLink to="/users" title="Users"><i className="fas fa-user-shield" /></NavLink></li> : null}
              <li className={`dropdown ${createOpen ? "open" : ""}`}>
                <button type="button" className="nav-icon-btn" onClick={() => setCreateOpen((o) => !o)}>
                  <i className="fas fa-plus" />
                </button>
                <div className="dropdown-menu">
                  <NavLink to="/add" onClick={() => setCreateOpen(false)}>Opportunity</NavLink>
                  {isAdmin ? <NavLink to="/users" onClick={() => setCreateOpen(false)}>App user</NavLink> : null}
                </div>
              </li>
              {isAdmin ? <li><NavLink to="/settings" title="Settings"><i className="fas fa-cog" /></NavLink></li> : null} */}
              <li className={`dropdown ${userOpen ? "open" : ""}`}>
                <button type="button" className="nav-icon-btn nav-user-btn" onClick={() => setUserOpen((o) => !o)}>
                  <i className="fas fa-user" aria-hidden="true" />
                  <span className="nav-user-name">{displayName}</span>
                </button>
                <div className="dropdown-menu">
                  <NavLink to="/account/profile" onClick={() => setUserOpen(false)}>Edit Profile</NavLink>
                  <NavLink to="/account/password" onClick={() => setUserOpen(false)}>Change Password</NavLink>
                  <div className="divider" />
                  <button type="button" onClick={() => { logout(); navigate("/login"); }}>Logout</button>
                </div>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <aside className="main-sidebar" aria-hidden={isNarrow && collapsed}>
        <ul className="sidebar-menu">
          {items.map((item) => (
            <li key={item.to} className={item.end ? (path === "/" ? "active" : "") : path.startsWith(item.to) ? "active" : ""}>
              <NavLink to={item.to} end={item.end} onClick={closeDrawer}>
                <i className={`fas ${item.icon} fa-fw`} /><span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>

      <div className="content-wrapper">
        <section className="content-header">
          <h1>
            {title}
            {subtitle ? <small>{subtitle}</small> : null}
          </h1>
          <div className="content-header__right">
            <ol className="breadcrumb">
              <li><NavLink to="/fastag">Home</NavLink></li>
              <li>{title}</li>
            </ol>
          </div>
        </section>
        <section className="content">
          <Outlet />
        </section>
      </div>

    </div>
  );
}
