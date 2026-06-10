// Pacific Insurance PH — Secondary screens (routing targets)
const { useState: useStateScr } = React;
const PS = window.PData;

/* Generic filterable + sortable list screen */
function ListScreen({ title, sub, icon, stats, columns, rows, defaultSort, filters, renderRow, primaryAction }) {
  const [q, setQ] = useStateScr("");
  const [activeFilter, setActiveFilter] = useStateScr("All");
  const Ico = I[icon];

  let view = rows;
  if (filters && activeFilter !== "All") view = view.filter((r) => r._filter === activeFilter);
  if (q.trim()) {
    const ql = q.toLowerCase();
    view = view.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(ql)));
  }
  const { sorted, sort, toggle } = useSort(view, defaultSort.key, defaultSort.dir);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><Ico size={19} /></span>{title}
          </h1>
          <p className="sub">{sub}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><I.download size={15} /> Export</button>
          {primaryAction && <button className="btn primary"><I.plus size={15} /> {primaryAction}</button>}
        </div>
      </div>

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
          {filters && (
            <div style={{ display: "flex", gap: 8 }}>
              {["All", ...filters].map((f) => (
                <button key={f} className={"chip" + (activeFilter === f ? " on" : "")} onClick={() => setActiveFilter(f)}>{f}</button>
              ))}
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="chip"><I.filter size={15} /> Filters</button>
            <span style={{ fontSize: 12.5, color: "var(--text-subtle)", alignSelf: "center", fontWeight: 600 }}>{sorted.length} of {rows.length}</span>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              {columns.map((c) => <Th key={c.k} label={c.label} k={c.k} sort={sort} toggle={toggle} num={c.num} />)}
            </tr></thead>
            <tbody>
              {sorted.map((r, i) => renderRow(r, i))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Clients ---- */
function ClientsScreen() {
  return <ListScreen
    title="Clients" icon="users"
    sub="1,248 active clients · 86 added this quarter"
    primaryAction="Add client"
    stats={[
      { val: "1,248", label: "Active clients" },
      { val: "312", label: "Gold tier", color: "var(--amber)" },
      { val: "86", label: "New this quarter", color: "var(--accent)" },
      { val: "9", label: "At risk", color: "var(--red)" },
    ]}
    filters={["Active", "At Risk", "New"]}
    rows={PS.CLIENTS.map((c) => ({ ...c, _filter: c.status }))}
    defaultSort={{ key: "value", dir: "desc" }}
    columns={[
      { k: "name", label: "Client" }, { k: "city", label: "Location" }, { k: "policies", label: "Policies", num: true },
      { k: "tier", label: "Tier" }, { k: "since", label: "Client since" }, { k: "value", label: "Lifetime value", num: true }, { k: "status", label: "Status" },
    ]}
    renderRow={(c) => (
      <tr key={c.email}>
        <td>
          <div className="client-cell">
            <Avatar name={c.name} size={30} />
            <div><div className="cc-name">{c.name}</div><div className="cc-sub">{c.email}</div></div>
          </div>
        </td>
        <td className="cell-muted">{c.city}</td>
        <td className="num tnum" style={{ fontWeight: 600 }}>{c.policies}</td>
        <td><TierBadge tier={c.tier} /></td>
        <td className="cell-muted">{c.since}</td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(c.value)}</td>
        <td><StatusBadge status={c.status} /></td>
      </tr>
    )}
  />;
}

/* ---- Applications ---- */
function ApplicationsScreen() {
  return <ListScreen
    title="Applications" icon="fileText"
    sub="41 applications in progress · 14 awaiting payment"
    primaryAction="New application"
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
    primaryAction="Send notices"
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
    primaryAction="File claim"
    stats={[
      { val: "18", label: "Open claims" },
      { val: "3", label: "Awaiting documents", color: "var(--red)" },
      { val: "7", label: "Under review", color: "var(--blue)" },
      { val: PS.pesoShort(416000), label: "Total claimed", color: "var(--accent)" },
    ]}
    filters={["Additional Documents Required", "Under Review", "Awaiting Response", "Approved"]}
    rows={PS.CLAIMS.map((c) => ({ ...c, _filter: c.status }))}
    defaultSort={{ key: "updated", dir: "asc" }}
    columns={[
      { k: "id", label: "Claim" }, { k: "client", label: "Client" }, { k: "policy", label: "Policy" },
      { k: "status", label: "Status" }, { k: "amount", label: "Amount", num: true }, { k: "updated", label: "Last updated" },
    ]}
    renderRow={(c) => (
      <tr key={c.id}>
        <td><span className="cell-code">{c.id}</span></td>
        <td><div className="client-cell"><Avatar name={c.client} size={30} /><div><div className="cc-name">{c.client}</div><div className="cc-sub">{c.city}</div></div></div></td>
        <td className="cell-muted">{c.policy}</td>
        <td><StatusBadge status={c.status} /></td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PS.peso(c.amount)}</td>
        <td className="cell-muted">{c.updated}</td>
      </tr>
    )}
  />;
}

/* ---- Travel ---- */
function TravelScreen() {
  return <ListScreen
    title="Travel Insurance" icon="plane"
    sub="15 open travel requests · 5 awaiting payment"
    primaryAction="New travel quote"
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
