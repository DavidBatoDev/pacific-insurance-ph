// Pacific Insurance PH — Sidebar + Topbar
const { useEffect: useEffectChrome, useRef: useRefChrome, useState: useStateChrome } = React;

const NAV_MAIN = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "prospects", label: "Prospects", icon: "trendUp", badge: "42" },
  { id: "clients", label: "Clients", icon: "users", badge: "1.2k" },
  { id: "applications", label: "Applications", icon: "fileText", badge: "41" },
  { id: "policies", label: "Policies", icon: "shield" },
  { id: "renewals", label: "Renewals", icon: "refresh", badge: "8", alert: true },
  { id: "claims", label: "Claims", icon: "clipboard", badge: "18" },
  { id: "travel", label: "Travel Insurance", icon: "plane", badge: "15" },
];
const NAV_WORK = [
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "tasks", label: "Tasks", icon: "checkSquare", badge: "6" },
  { id: "relationship", label: "Relationship Mgmt", icon: "heart" },
];
const NAV_SYS = [
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "settings", label: "Settings", icon: "settings" },
];

function NavItem({ item, active, onClick }) {
  const Ico = I[item.icon];
  return (
    <button className={"nav-item" + (active ? " active" : "")} onClick={onClick}>
      <span className="ni-icon"><Ico size={18} /></span>
      {item.label}
      {item.badge && <span className={"ni-badge" + (item.alert && !active ? " alert" : "")}>{item.badge}</span>}
    </button>
  );
}

function Sidebar({ screen, setScreen }) {
  return (
    <aside className="sidebar">
      {NAV_MAIN.map((it) => <NavItem key={it.id} item={it} active={screen === it.id} onClick={() => setScreen(it.id)} />)}
      <div className="nav-section-label">Workspace</div>
      {NAV_WORK.map((it) => <NavItem key={it.id} item={it} active={screen === it.id} onClick={() => setScreen(it.id)} />)}
      <div className="nav-section-label">System</div>
      {NAV_SYS.map((it) => <NavItem key={it.id} item={it} active={screen === it.id} onClick={() => setScreen(it.id)} />)}

      <div className="sidebar-foot">
        <div className="upgrade-card">
          <h5>June close-out</h5>
          <p>23 renewals and 14 applications still awaiting payment this cycle.</p>
          <button className="btn primary sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setScreen("renewals")}>
            Review queue
          </button>
        </div>
      </div>
    </aside>
  );
}

function BrandGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 15c2.5 0 2.5-2.2 5-2.2S11.5 15 14 15s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
      <path d="M4 19c2.5 0 2.5-2.2 5-2.2S11.5 19 14 19s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
      <path d="M12 4.2 6.8 6.3v3.1c0 3.2 5.2 5 5.2 5s5.2-1.8 5.2-5V6.3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.18)"/>
    </svg>
  );
}

function Topbar({ dark, setDark, screen, setScreen, search, setSearch }) {
  const [open, setOpen] = useStateChrome(null); // 'notif' | 'profile'
  const wrapRef = useRefChrome(null);
  useEffectChrome(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const { NOTIFICATIONS } = window.PData;
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  const notifTone = { payment: "green", claim: "red", renewal: "amber", travel: "blue", doc: "slate" };
  const notifIco = { payment: "peso", claim: "clipboard", renewal: "refresh", travel: "plane", doc: "doc2" };

  return (
    <header className="topbar" ref={wrapRef}>
      <div className="search">
        <I.search size={17} />
        <input
          placeholder="Search clients, policies, applications…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>⌘K</kbd>
      </div>
      <div className="topbar-spacer"></div>

      <button className="btn primary sm" onClick={() => setScreen("applications")} style={{ height: 36, padding: "0 13px" }}>
        <I.plus size={16} /> New application
      </button>

      <button className="icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">
        {dark ? <I.sun size={19} /> : <I.moon size={19} />}
      </button>

      <div style={{ position: "relative" }}>
        <button className="icon-btn" onClick={() => setOpen(open === "notif" ? null : "notif")}>
          <I.bell size={19} />
          {unread > 0 && <span className="dot"></span>}
        </button>
        {open === "notif" && (
          <div className="pop fade-in" style={{ top: 46, right: 0, width: 360 }}>
            <div className="pop-head">
              <h4>Notifications</h4>
              <span className="card-link">Mark all read</span>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {NOTIFICATIONS.map((n) => {
                const Ico = I[notifIco[n.type]];
                const tone = notifTone[n.type];
                return (
                  <div key={n.id} className={"notif" + (n.unread ? " unread" : "")} onClick={() => setOpen(null)}>
                    <div className="notif-ico" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }}>
                      <Ico size={16} />
                    </div>
                    <div className="notif-body">
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-time">{n.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <button className="profile-btn" onClick={() => setOpen(open === "profile" ? null : "profile")}>
          <Avatar name="Matt Nassr" size={30} color="#047857" />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }} className="hide-sm">Matt</span>
          <span className="chev"><I.chevDown size={15} /></span>
        </button>
        {open === "profile" && (
          <div className="pop fade-in" style={{ top: 50, right: 0, width: 244 }}>
            <div style={{ padding: "13px 15px", borderBottom: "1px solid var(--border-soft)", display: "flex", gap: 11, alignItems: "center" }}>
              <Avatar name="Matt Nassr" size={38} color="#047857" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>Matt Nassr</div>
                <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>Agency Owner</div>
              </div>
            </div>
            <div style={{ padding: "6px 0" }}>
              <div className="menu-item"><span className="mi-ico"><I.user size={16} /></span>My profile</div>
              <div className="menu-item"><span className="mi-ico"><I.building size={16} /></span>Agency settings</div>
              <div className="menu-item" onClick={() => { setScreen("settings"); setOpen(null); }}><span className="mi-ico"><I.settings size={16} /></span>Preferences</div>
              <div className="menu-item"><span className="mi-ico"><I.help size={16} /></span>Help &amp; support</div>
              <div className="menu-sep"></div>
              <div className="menu-item danger"><span className="mi-ico"><I.logout size={16} /></span>Sign out</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

Object.assign(window, { Sidebar, Topbar, BrandGlyph, NAV_MAIN });
