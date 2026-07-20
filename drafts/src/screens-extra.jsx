// Pacific Insurance PH — Extra screens
const { useState: useStateX } = React;
const PX = window.PData;

const POLICIES = [
  { id: "POL-2024-11820", client: "John Santos", product: "Blue Royale", type: "Individual", premium: 185000, start: "Mar 2024", status: "Active", or_number: "OR-2026-88055", group_id: null },
  { id: "POL-2023-09241", client: "Ramon Velasco", product: "Premier Health", type: "Individual", premium: 95000, start: "Aug 2023", status: "Active", or_number: null, group_id: null },
  { id: "POL-2022-04417", client: "Sofia Reyes", product: "Family Shield", type: "Family", premium: 148000, start: "Jan 2022", status: "Active", or_number: null, group_id: null },
  { id: "POL-2024-07712", client: "Cristina Flores", product: "AsianLife Care", type: "Individual", premium: 110000, start: "Jun 2024", status: "Active", or_number: "OR-2026-88123", group_id: null },
  { id: "POL-2021-03390", client: "Grace Castillo", product: "Maxicare Plus", type: "Individual", premium: 73000, start: "Nov 2021", status: "Lapsing", or_number: null, group_id: null },
  { id: "POL-2023-08856", client: "Edgar Domingo", product: "Family Shield", type: "Family", premium: 132000, start: "Feb 2023", status: "Active", or_number: null, group_id: null },
  { id: "POL-2024-12003", client: "Patricia Lim", product: "Select", type: "Individual", premium: 88000, start: "May 2026", status: "Active", or_number: null, group_id: null },
  // Group master policies — one per group HMO account (policies.group_id → groups).
  { id: "POL-2025-GRP-0007", client: "Meridian Tech Solutions", product: "BC Flexi HMO", type: "Group", premium: 1860000, start: "Oct 2025", status: "Active", or_number: "OR-2026-88210", group_id: "GRP-0007" },
  { id: "POL-2024-GRP-0004", client: "Craft & Co. Manila", product: "Maxicare Group", type: "Group", premium: 640000, start: "Jul 2024", status: "Lapsing", or_number: null, group_id: "GRP-0004" },
];
// Resolve a policy id → its group id (nullable). Claims inherit group context through this: claim.policyId → policy.group_id.
window.policyGroupId = (policyId) => { const p = POLICIES.find((x) => x.id === policyId); return p ? p.group_id : null; };
window.PoliciesRegister = POLICIES;
// Stamp an OR number onto a client's most recent policy (called from PaymentsStore.verify)
window.setPolicyOR = (clientName, or) => {
  const p = POLICIES.find((x) => x.client === clientName);
  if (p && !p.or_number) p.or_number = or;
};

const DOCS = [
  { name: "Maria Cruz — Valid ID.pdf", type: "Identification", client: "Maria Cruz", size: "1.2 MB", date: "Jun 9, 2026", status: "Verified" },
  { name: "APP-000125 Medical Questionnaire.pdf", type: "Medical", client: "Renato Dizon", size: "840 KB", date: "Jun 10, 2026", status: "Pending" },
  { name: "Blue Royale Policy Contract.pdf", type: "Contract", client: "John Santos", size: "3.4 MB", date: "Jun 8, 2026", status: "Verified" },
  { name: "Andres Bonifacio — TIN ID.jpg", type: "Identification", client: "Andres Bonifacio", size: "—", date: "Requested", status: "Missing" },
  { name: "CLM-00781 Hospital Bill.pdf", type: "Claim", client: "Teresa Mendoza", size: "2.1 MB", date: "Jun 10, 2026", status: "Pending" },
  { name: "Travel Itinerary — Japan.pdf", type: "Travel", client: "Katrina Bautista", size: "560 KB", date: "Jun 9, 2026", status: "Verified" },
];

const DOC_TONE = { Verified: "green", Pending: "amber", Missing: "red" };

function PoliciesScreen() {
  return <window.ListScreen
    title="Policies" icon="shield"
    sub="2,394 active policies under management"
    primaryAction="Issue policy" onPrimary={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "policy" } }))}
    stats={[
      { val: "2,394", label: "Active policies" },
      { val: "1,902", label: "Individual" },
      { val: "492", label: "Family / group" },
      { val: "14", label: "Lapsing soon", color: "var(--red)" },
    ]}
    filters={["Active", "Lapsing", "Group"]}
    filterMatch={(p, f) => f === "Group" ? !!p.group_id : p.status === f}
    rows={POLICIES.map((p) => ({ ...p, _filter: p.status, memberCount: p.group_id ? window.GroupsData.membersOf(p.group_id).length : 0 }))}
    defaultSort={{ key: "start", dir: "desc" }}
    columns={[
      { k: "id", label: "Policy no." }, { k: "client", label: "Client" }, { k: "product", label: "Product" },
      { k: "type", label: "Type" }, { k: "premium", label: "Premium", num: true }, { k: "or_number", label: "OR number" }, { k: "start", label: "Effective" }, { k: "status", label: "Status" },
    ]}
    renderRow={(p) => {
      const openGroup = (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("open-group", { detail: { group: window.GroupsData.get(p.group_id) } })); };
      return (
      <tr key={p.id} style={p.group_id ? { cursor: "pointer" } : null} onClick={p.group_id ? openGroup : undefined} title={p.group_id ? "Open Group Account" : undefined}>
        <td><span className="cell-code">{p.id}</span></td>
        <td>
          {p.group_id ? (
            <div className="client-cell"><span className="ga-glyph sm"><I.building size={16} /></span><div><div className="cc-name">{p.client}</div><div className="cc-sub">{p.memberCount} members</div></div></div>
          ) : (
            <div className="client-cell"><Avatar name={p.client} size={30} /><div className="cc-name">{p.client}</div></div>
          )}
        </td>
        <td className="cell-muted">{p.product}</td>
        <td>{p.group_id ? <button className="group-badge" onClick={openGroup} title="Open Group Account"><I.building size={11} /> Group</button> : <span className="badge slate">{p.type}</span>}</td>
        <td className="num mono" style={{ fontWeight: 600 }}>{PX.peso(p.premium)}</td>
        <td>{p.or_number ? <span className="cell-code">{p.or_number}</span> : <span className="cell-muted">—</span>}</td>
        <td className="cell-muted">{p.start}</td>
        <td><span className={"badge " + (p.status === "Active" ? "green" : "amber")}><span className="b-dot"></span>{p.status}</span></td>
      </tr>
      );
    }}
  />;
}

function DocumentsScreen() {
  return <window.ListScreen
    title="Documents" icon="folder"
    sub="Central repository for client and policy documents"
    primaryAction="Upload" onPrimary={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "document" } }))}
    stats={[
      { val: "4,821", label: "Total documents" },
      { val: "12", label: "Pending review", color: "var(--amber)" },
      { val: "5", label: "Missing / requested", color: "var(--red)" },
      { val: "98%", label: "Verified", color: "var(--accent)" },
    ]}
    filters={["Verified", "Pending", "Missing"]}
    rows={DOCS.map((d) => ({ ...d, _filter: d.status }))}
    defaultSort={{ key: "date", dir: "desc" }}
    columns={[
      { k: "name", label: "Document" }, { k: "type", label: "Type" }, { k: "client", label: "Client" },
      { k: "size", label: "Size" }, { k: "date", label: "Uploaded" }, { k: "status", label: "Status" },
    ]}
    renderRow={(d) => (
      <tr key={d.name}>
        <td><div className="client-cell"><span className="rel-ico" style={{ width: 30, height: 30, background: "var(--surface-3)", color: "var(--text-muted)" }}><I.doc2 size={15} /></span><div className="cc-name" style={{ fontSize: 12.5 }}>{d.name}</div></div></td>
        <td><span className="badge slate">{d.type}</span></td>
        <td className="cell-muted">{d.client}</td>
        <td className="cell-muted mono" style={{ fontSize: 12 }}>{d.size}</td>
        <td className="cell-muted">{d.date}</td>
        <td><span className={"badge " + DOC_TONE[d.status]}><span className="b-dot"></span>{d.status}</span></td>
      </tr>
    )}
  />;
}

/* ---- Tasks full screen ---- */
function TasksScreen() {
  const [tasks, setTasks] = useStateX(window.TasksStore.tasks);
  React.useEffect(() => {
    const sync = () => setTasks([...window.TasksStore.tasks]);
    window.addEventListener("tasks-updated", sync);
    return () => window.removeEventListener("tasks-updated", sync);
  }, []);
  const toggle = (id) => window.TasksStore.toggle(id);
  const openNew = () => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "addTask" } }));
  const tagTone = { Application: "blue", Documents: "amber", Renewal: "violet", Travel: "blue", Claim: "red", Relationship: "green", Commission: "green", General: "slate" };
  const cols = [
    { key: "overdue", label: "Overdue", cls: "red" },
    { key: "today", label: "Due today", cls: "amber" },
    { key: "week", label: "Due this week", cls: "blue" },
  ];
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.checkSquare size={19} /></span>Tasks
          </h1>
          <p className="sub">Your workload across the agency · {tasks.filter((t) => !t.done).length} open</p>
        </div>
        <div className="page-head-actions"><button className="btn primary" onClick={openNew}><I.plus size={15} /> New task</button></div>
      </div>
      <div className="grid12">
        {cols.map((c) => {
          const items = tasks.filter((t) => t.group === c.key);
          return (
            <div className="col-4" key={c.key}>
              <div className="card" style={{ height: "100%" }}>
                <div className="card-head">
                  <h3><span className="b-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${c.cls})`, display: "inline-block" }}></span>{c.label} <span className="count-pill">{items.filter((t) => !t.done).length}</span></h3>
                </div>
                <div style={{ padding: "6px 0 10px" }}>
                  {items.map((t) => (
                    <div key={t.id} className={"task" + (t.done ? " done" : "")} onClick={() => toggle(t.id)}>
                      <div className="task-check">{t.done && <I.check size={13} />}</div>
                      <div className="task-body">
                        <div className="task-title">{t.title}</div>
                        <div className="task-meta"><span className="task-tag" style={{ color: `var(--${tagTone[t.tag]})` }}>{t.tag}</span>{t.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Relationship screen ---- */
function RelationshipScreen() {
  const [campaign, setCampaign] = useStateX(null);
  const cats = [
    { key: "birthday", title: "Upcoming birthdays", icon: "cake", tone: "violet", type: "Birthday" },
    { key: "anniversary", title: "Client anniversaries", icon: "award", tone: "green", type: "Anniversary" },
    { key: "loyalty", title: "Loyalty activities due", icon: "gift", tone: "amber", type: "Loyalty" },
  ];
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.heart size={19} /></span>Relationship Management
          </h1>
          <p className="sub">Nurture client loyalty with timely, personal touchpoints</p>
        </div>
        <div className="page-head-actions"><button className="btn primary" onClick={() => setCampaign({ type: "Birthday" })}><I.send size={15} /> New campaign</button></div>
      </div>
      <div className="grid12">
        {cats.map((cat) => {
          const items = PX.RELATIONSHIPS.filter((r) => r.type === cat.key);
          const Ico = I[cat.icon];
          return (
            <div className="col-4" key={cat.key}>
              <div className="card">
                <div className="card-head">
                  <h3><span className="rel-ico" style={{ width: 28, height: 28, background: `var(--${cat.tone}-soft)`, color: `var(--${cat.tone})` }}><Ico size={15} /></span>{cat.title} <span className="count-pill">{items.length}</span></h3>
                </div>
                <div>
                  {items.map((r) => (
                    <div className="rel-item" key={r.id}>
                      <Avatar name={r.name} size={36} />
                      <div className="rel-body"><div className="rel-name">{r.name}</div><div className="rel-sub">{r.sub}</div></div>
                      <span className={"rel-when" + (r.soon ? " soon" : "")}>{r.when}</span>
                    </div>
                  ))}
                </div>
                <div className="card-foot"><button className="btn sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => setCampaign({ type: cat.type })}>Send greetings</button></div>
              </div>
            </div>
          );
        })}
      </div>
      {campaign && window.NewCampaignModal && <window.NewCampaignModal presetType={campaign.type} onClose={() => setCampaign(null)} />}
    </div>
  );
}

/* ---- Reports screen ---- */
function ReportsScreen() {
  const bars = [
    { m: "Jan", v: 1.8 }, { m: "Feb", v: 2.1 }, { m: "Mar", v: 1.9 }, { m: "Apr", v: 2.4 },
    { m: "May", v: 2.7 }, { m: "Jun", v: 3.1 }, { m: "Jul", v: 2.9 }, { m: "Aug", v: 3.4 },
    { m: "Sep", v: 3.2 }, { m: "Oct", v: 3.8 }, { m: "Nov", v: 4.1 }, { m: "Dec", v: 4.6 },
  ];
  const max = Math.max(...bars.map((b) => b.v));
  const mix = [
    { label: "Health", pct: 46, color: "#059669" },
    { label: "Life", pct: 27, color: "#2563eb" },
    { label: "Family", pct: 18, color: "#7c3aed" },
    { label: "Travel", pct: 9, color: "#d97706" },
  ];
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.chart size={19} /></span>Reports
          </h1>
          <p className="sub">Performance overview · Year to date 2026</p>
        </div>
        <div className="page-head-actions">
          <div className="seg"><button className="on">YTD</button><button>Quarter</button><button>Month</button></div>
          <button className="btn"><I.download size={15} /> Export</button>
        </div>
      </div>
      <div className="stat-strip">
        {[
          { val: "₱34.2M", label: "Premiums YTD", color: "var(--accent)" },
          { val: "+18.4%", label: "vs last year", color: "var(--accent)" },
          { val: "1,248", label: "Active clients" },
          { val: "94.2%", label: "Renewal rate", color: "var(--accent)" },
        ].map((s, i) => <div className="stat-mini" key={i}><div className="sm-val tnum" style={{ color: s.color }}>{s.val}</div><div className="sm-label">{s.label}</div></div>)}
      </div>
      <div className="grid12">
        <div className="col-8">
          <div className="card">
            <div className="card-head"><h3><I.trendUp size={17} style={{ color: "var(--text-muted)" }} /> Monthly premium revenue</h3><span className="card-link">₱ Millions</span></div>
            <div style={{ padding: "26px 22px 18px", display: "flex", alignItems: "flex-end", gap: 10, height: 240 }}>
              {bars.map((b) => (
                <div key={b.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-subtle)" }}>{b.v}</div>
                  <div style={{ width: "100%", maxWidth: 34, height: (b.v / max * 100) + "%", borderRadius: "6px 6px 3px 3px", background: b.m === "Jun" ? "var(--accent)" : "var(--accent-soft-2)", transition: "0.2s" }}></div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", fontWeight: 600 }}>{b.m}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-head"><h3><I.shield size={17} style={{ color: "var(--text-muted)" }} /> Product mix</h3></div>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", marginBottom: 20 }}>
                {mix.map((m) => <div key={m.label} style={{ width: m.pct + "%", background: m.color }}></div>)}
              </div>
              {mix.map((m) => (
                <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }}></span>
                  <span style={{ fontSize: 13, fontWeight: 550, flex: 1 }}>{m.label}</span>
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{m.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ExtraScreens = { PoliciesScreen, DocumentsScreen, TasksScreen, RelationshipScreen };
