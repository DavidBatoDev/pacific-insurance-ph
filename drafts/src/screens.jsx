// Pacific Insurance PH — Secondary screens (routing targets)
const { useState: useStateScr, useEffect: useEffectScr, useRef: useRefScr } = React;
const PS = window.PData;

/* Generic filterable + sortable list screen */
function ListScreen({ title, sub, icon, stats, columns, rows, defaultSort, filters, filterKey, filterMatch, filters2, filter2Key, filters2Label, renderRow, primaryAction, onPrimary, headerControl, emptyText, initialFilter, initialFilter2, scopeBanner, onExport, hideHead }) {
  const [q, setQ] = useStateScr("");
  const [activeFilter, setActiveFilter] = useStateScr(initialFilter || "All");
  const [activeFilter2, setActiveFilter2] = useStateScr(initialFilter2 || "All");
  const [filterOpen, setFilterOpen] = useStateScr(false);
  const filterRef = useRefScr(null);
  useEffectScr(() => {
    if (!filterOpen) return;
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [filterOpen]);
  // Global search "jump": when a command-palette result navigates here, pre-fill the search so the row surfaces at top.
  useEffectScr(() => {
    if (window.__pendingListQuery) { setQ(window.__pendingListQuery); window.__pendingListQuery = null; }
  }, []);
  const fKey = filterKey || "_filter";
  const Ico = I[icon];

  let view = rows;
  if (filters && activeFilter !== "All") view = filterMatch ? view.filter((r) => filterMatch(r, activeFilter)) : view.filter((r) => r[fKey] === activeFilter);
  if (filters2 && activeFilter2 !== "All") view = view.filter((r) => r[filter2Key] === activeFilter2);
  if (q.trim()) {
    const ql = q.toLowerCase();
    view = view.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(ql)));
  }
  const { sorted, sort, toggle } = useSort(view, defaultSort.key, defaultSort.dir);

  return (
    <div className="fade-in">
      {!hideHead && <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><Ico size={19} /></span>{title}
          </h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="page-head-actions">
          {headerControl}
          <button className="btn" onClick={onExport}><I.download size={15} /> Export</button>
          {primaryAction && <button className="btn primary" onClick={onPrimary}><I.plus size={15} /> {primaryAction}</button>}
        </div>
      </div>}

      {scopeBanner}

      {stats && (
        <div className="stat-strip">
          {stats.map((s, i) => (
            <div className="stat-mini" key={i}>
              <div className="sm-val tnum" style={{ color: s.color }}>{s.val}</div>
              <div className="sm-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="filter-bar" style={{ margin: 0, padding: "13px 16px", borderBottom: "1px solid var(--border-soft)" }}>
          <div className="filter-search">
            <I.search size={16} />
            <input placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            {(filters || filters2) && (() => {
              const activeCount = (filters && activeFilter !== "All" ? 1 : 0) + (filters2 && activeFilter2 !== "All" ? 1 : 0);
              return (
                <div className="filter-pop-wrap" ref={filterRef}>
                  <button className={"chip" + (filterOpen || activeCount ? " on" : "")} onClick={() => setFilterOpen((o) => !o)}>
                    <I.filter size={15} /> Filters{activeCount ? <span className="filter-count">{activeCount}</span> : null}
                  </button>
                  {filterOpen && (
                    <div className="filter-pop">
                      {filters && (
                        <div className="filter-pop-group">
                          <div className="filter-pop-label">{filters2Label && !filters2 ? filters2Label : "Filter"}</div>
                          <div className="filter-pop-chips">
                            {["All", ...filters].map((f) => (
                              <button key={f} className={"chip" + (activeFilter === f ? " on" : "")} onClick={() => setActiveFilter(f)}>{f}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {filters2 && (
                        <div className="filter-pop-group">
                          <div className="filter-pop-label">{filters2Label || "Status"}</div>
                          <div className="filter-pop-chips">
                            {["All", ...filters2].map((f) => (
                              <button key={f} className={"chip" + (activeFilter2 === f ? " on" : "")} onClick={() => setActiveFilter2(f)}>{f === "All" ? (filters2Label || "All") : f}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeCount > 0 && (
                        <button className="filter-pop-clear" onClick={() => { setActiveFilter("All"); setActiveFilter2("All"); }}>Clear filters</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <span style={{ fontSize: 12.5, color: "var(--text-subtle)", alignSelf: "center", fontWeight: 600 }}>{sorted.length} of {rows.length}</span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              {columns.map((c) => <Th key={c.k} label={c.label} k={c.k} sort={sort} toggle={toggle} num={c.num} />)}
            </tr></thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={columns.length} style={{ textAlign: "center", padding: "34px 0", color: "var(--text-subtle)" }}>{emptyText || "No matching records."}</td></tr>
                : sorted.map((r, i) => renderRow(r, i))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Clients ---- */
function ClientsScreen() {
  const [view, setView] = useStateScr("Individuals");
  const openWiz = () => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "client" } }));
  const seg = (
    <div className="seg-ctrl">
      <button className={"seg" + (view === "Individuals" ? " on" : "")} onClick={() => setView("Individuals")}>Individuals</button>
      <button className={"seg" + (view === "Group Accounts" ? " on" : "")} onClick={() => setView("Group Accounts")}>Group Accounts</button>
    </div>
  );
  if (view === "Group Accounts" && window.GroupAccountsList) return <window.GroupAccountsList headerControl={seg} />;
  return <ListScreen
    title="Clients" icon="users"
    sub="1,248 active clients · 86 added this quarter"
    headerControl={seg}
    primaryAction="Add client" onPrimary={openWiz}
    stats={[
      { val: "1,248", label: "Active clients" },
      { val: "312", label: "Gold tier", color: "var(--amber)" },
      { val: "86", label: "New this quarter", color: "var(--accent)" },
      { val: "9", label: "At risk", color: "var(--red)" },
    ]}
    filters={["Active", "At Risk", "New"]}
    rows={PS.CLIENTS.map((c) => ({ ...c, ltv: PS.clientLTV(c), dtier: PS.clientTier(c), _filter: c.status }))}
    defaultSort={{ key: "ltv", dir: "desc" }}
    columns={[
      { k: "name", label: "Client" }, { k: "record_id", label: "Record ID" }, { k: "city", label: "Location" }, { k: "policies", label: "Policies", num: true },
      { k: "dtier", label: "Tier" }, { k: "since", label: "Client since" }, { k: "ltv", label: "Lifetime value", num: true }, { k: "status", label: "Status" },
    ]}
    renderRow={(c) => (
      <tr key={c.email} style={{ cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", record_id: c.record_id, name: c.name, email: c.email, city: c.city, tier: c.dtier, value: c.ltv, status: c.status, since: c.since } } }))}>
        <td>
          <div className="client-cell">
            <Avatar name={c.name} size={30} />
            <div>
              <div className="cc-name">{c.name}{(() => { const gm = window.GroupsData && window.GroupsData.membershipOf(c.name); return gm ? <button className="group-chip" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-group", { detail: { group: window.GroupsData.get(gm.groupId) } })); }} title={"Group member — " + gm.group}><I.building size={10} /> Group</button> : null; })()}</div>
              <div className="cc-sub">{c.email}</div>
            </div>
          </div>
        </td>
        <td><span className="cell-code">#{c.record_id}</span></td>
        <td className="cell-muted">{c.city}</td>
        <td className="num tnum" style={{ fontWeight: 600 }}>{c.policies}</td>
        <td><TierBadge tier={c.dtier} />{c.tierOverride && <span className="cell-muted" style={{ fontSize: 11, marginLeft: 6 }}>override</span>}</td>
        <td className="cell-muted">{c.since}</td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(c.ltv)}</td>
        <td><StatusBadge status={c.status} /></td>
      </tr>
    )}
  />;
}

/* ---- Applications ---- */
function ApplicationsScreen() {
  const openWiz = () => window.dispatchEvent(new Event("open-new-application"));
  return <ListScreen
    title="Applications" icon="fileText"
    sub="41 applications in progress · 14 awaiting payment"
    primaryAction="New application" onPrimary={openWiz}
    stats={[
      { val: "41", label: "In progress" },
      { val: "14", label: "Awaiting payment", color: "var(--amber)" },
      { val: "2", label: "Missing requirements", color: "var(--red)" },
      { val: PS.pesoShort(1250000), label: "Pipeline value", color: "var(--accent)" },
    ]}
    filters={["Awaiting Payment", "Missing Documents", "Under Review", "Approved"]}
    rows={PS.APPLICATIONS.map((a) => ({ ...a, _filter: a.status }))}
    defaultSort={{ key: "due", dir: "asc" }}
    columns={[
      { k: "id", label: "Application" }, { k: "client", label: "Client" }, { k: "product", label: "Product" },
      { k: "status", label: "Status" }, { k: "staff", label: "Assigned" }, { k: "amount", label: "Premium", num: true }, { k: "due", label: "Due" },
    ]}
    renderRow={(a) => (
      <tr key={a.id}>
        <td><span className="cell-code">{a.id}</span></td>
        <td><div className="client-cell"><Avatar name={a.client} size={30} /><div><div className="cc-name">{a.client}</div><div className="cc-sub">{a.city}</div></div></div></td>
        <td className="cell-muted">{a.product}</td>
        <td><StatusBadge status={a.status} /></td>
        <td><div className="client-cell"><Avatar name={PS.STAFF[a.staff].name} size={24} /><span className="cell-muted" style={{ fontSize: 12.5 }}>{PS.STAFF[a.staff].name.split(" ")[0]}</span></div></td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(a.amount)}</td>
        <td><DueCell days={a.due} /></td>
      </tr>
    )}
  />;
}

/* ---- Renewals ---- */
function RenewalsScreen() {
  return <ListScreen
    title="Renewals" icon="refresh"
    sub="72 upcoming renewals · 8 due within 30 days"
    primaryAction="Send notices" onPrimary={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "renewal" } }))}
    stats={[
      { val: "72", label: "Upcoming (90 days)" },
      { val: "8", label: "Due in 30 days", color: "var(--amber)" },
      { val: "1", label: "Overdue", color: "var(--red)" },
      { val: PS.pesoShort(860000), label: "Awaiting payment", color: "var(--accent)" },
    ]}
    filters={["Awaiting Payment", "Notice Sent", "In Progress", "Overdue"]}
    rows={PS.RENEWALS.map((r) => ({ ...r, _filter: r.status }))}
    defaultSort={{ key: "due", dir: "asc" }}
    columns={[
      { k: "client", label: "Client" }, { k: "policy", label: "Policy" }, { k: "date", label: "Renewal date" },
      { k: "due", label: "Due in" }, { k: "status", label: "Status" }, { k: "amount", label: "Premium", num: true },
    ]}
    renderRow={(r) => (
      <tr key={r.id}>
        <td><div className="client-cell"><Avatar name={r.client} size={30} /><div><div className="cc-name">{r.client}</div><div className="cc-sub">{r.city}</div></div></div></td>
        <td className="cell-muted">{r.policy}</td>
        <td className="cell-muted">{r.date}</td>
        <td><DueCell days={r.due} /></td>
        <td><StatusBadge status={r.status} /></td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(r.amount)}</td>
      </tr>
    )}
  />;
}

/* ---- Claims ---- */
function ClaimsScreen() {
  return <ListScreen
    title="Claims" icon="clipboard"
    sub="18 open claims · 3 awaiting documents"
    primaryAction="File claim" onPrimary={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "claim" } }))}
    stats={[
      { val: "18", label: "Open claims" },
      { val: "3", label: "Awaiting documents", color: "var(--red)" },
      { val: "7", label: "Under review", color: "var(--blue)" },
      { val: PS.pesoShort(416000), label: "Total claimed", color: "var(--accent)" },
    ]}
    filters={["Additional Documents Required", "Under Review", "Awaiting Response", "Approved", "Group"]}
    filterMatch={(c, f) => f === "Group" ? !!(window.policyGroupId && window.policyGroupId(c.policyId)) : c.status === f}
    rows={PS.CLAIMS.map((c) => ({ ...c, _filter: c.status }))}
    defaultSort={{ key: "updated", dir: "asc" }}
    columns={[
      { k: "id", label: "Claim" }, { k: "client", label: "Claimant" }, { k: "policy", label: "Policy" },
      { k: "status", label: "Status" }, { k: "amount", label: "Amount", num: true }, { k: "updated", label: "Last updated" },
    ]}
    renderRow={(c) => {
      const gid = window.policyGroupId ? window.policyGroupId(c.policyId) : null;
      const g = gid && window.GroupsData ? window.GroupsData.get(gid) : null;
      const openGroup = (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-group", { detail: { group: g } })); };
      return (
      <tr key={c.id}>
        <td><span className="cell-code">{c.id}</span></td>
        <td>
          <div className="client-cell" style={{ cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", name: c.client } } }))} title="Open claimant profile">
            <Avatar name={c.client} size={30} />
            <div>
              <div className="cc-name">{c.client}</div>
              {g && <button className="group-sub-link" onClick={openGroup} title="Open Group Account"><I.building size={11} /> member under {g.name}</button>}
            </div>
          </div>
        </td>
        <td className="cell-muted">{c.policy}{g && <button className="group-badge" style={{ marginLeft: 7 }} onClick={openGroup} title="Open Group Account"><I.building size={11} /> Group</button>}</td>
        <td><StatusBadge status={c.status} /></td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(c.amount)}</td>
        <td className="cell-muted">{c.updated}</td>
      </tr>
      );
    }}
  />;
}

/* ---- Travel ---- */
function TravelScreen() {
  return <ListScreen
    title="Travel Insurance" icon="plane"
    sub="15 open travel requests · 5 awaiting payment"
    primaryAction="New travel quote" onPrimary={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "travel" } }))}
    stats={[
      { val: "15", label: "Open requests" },
      { val: "5", label: "Awaiting payment", color: "var(--amber)" },
      { val: "3", label: "Issued today", color: "var(--accent)" },
      { val: PS.pesoShort(78000), label: "Awaiting payment", color: "var(--accent)" },
    ]}
    filters={["Awaiting Payment", "Under Review", "Policy Issued"]}
    rows={PS.TRAVEL.map((t) => ({ ...t, _filter: t.status }))}
    defaultSort={{ key: "status", dir: "asc" }}
    columns={[
      { k: "id", label: "Travel no." }, { k: "client", label: "Client" }, { k: "dest", label: "Destination" },
      { k: "date", label: "Travel dates" }, { k: "status", label: "Status" }, { k: "amount", label: "Premium", num: true }, { k: "next", label: "Next step" },
    ]}
    renderRow={(t) => (
      <tr key={t.id}>
        <td><span className="cell-code">{t.id}</span></td>
        <td><div className="client-cell"><Avatar name={t.client} size={30} /><div className="cc-name">{t.client}</div></div></td>
        <td><span style={{ fontWeight: 550 }}>{t.flag} {t.dest}</span></td>
        <td className="cell-muted">{t.date}</td>
        <td><StatusBadge status={t.status} /></td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(t.amount)}</td>
        <td className="cell-muted">{t.next}</td>
      </tr>
    )}
  />;
}

window.Screens = { ClientsScreen, ApplicationsScreen, RenewalsScreen, ClaimsScreen, TravelScreen };
window.ListScreen = ListScreen;
