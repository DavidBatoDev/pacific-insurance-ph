// Pacific Insurance PH — Reports & Analytics (reports-page.md)
// Overview landing + 5 drill-down report families (Sales, Commission, Agents, Conversion, Renewal).
// Every summary element (bar / segment / stat tile / funnel stage) drills into the generic
// ListScreen (screens.jsx) filtered to the clicked dimension + active period.
// No new tables — reads PData (policies/apps/renewals), CommissionsStore, PPData (lead_stage).
const { useState: useStateRp, useMemo: useMemoRp } = React;
const RD = window.PData;

/* ============================ shared scaffolding ============================ */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Period control → which months are in scope. Today = Jul 2026 · data centred on H1.
const PERIODS = {
  YTD: { label: "Year to date 2026", months: MONTHS },
  Quarter: { label: "Q2 2026 · Apr–Jun", months: ["Apr", "May", "Jun"] },
  Month: { label: "June 2026", months: ["Jun"] },
};
const inPeriod = (month, period) => PERIODS[period].months.includes(month);

// Product → reporting category (matches the Overview product-mix legend)
const CAT_COLOR = { Health: "#059669", Life: "#2563eb", Family: "#7c3aed", Travel: "#d97706" };
const PRODUCT_CAT = {
  "Blue Royale": "Health", "Maxicare Plus": "Health", "Premier Health": "Health",
  "Select": "Life", "AsianLife Care": "Life",
  "Family Shield": "Family",
  "Global Travel": "Travel", "Smart Traveler": "Travel", "Travel Insurance": "Travel",
};
const catOf = (p) => PRODUCT_CAT[p] || "Health";
const AGENT_NAME = (id) => (RD.STAFF[id] ? RD.STAFF[id].name : id);
const hash = (s) => String(s).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
const dateLabel = (month) => month + " " + (1 + (hash(month) % 27)) + ", 2026";

/* ---------- Sales ledger (view over policies + applications, enriched) ---------- */
const SALES_SEED_NAMES = [
  "John Santos", "Maria Cruz", "Ramon Velasco", "Sofia Reyes", "Miguel Torres", "Grace Castillo",
  "Patricia Lim", "Edgar Domingo", "Cristina Flores", "Nestor Aguilar", "Diego Mercado", "Liza Gomez",
  "Carmela Tan", "Andres Bonifacio", "Roberto Pascual", "Angelica Reyes", "Fernando Lopez",
  "Isabel Navarro", "Hannah Villamor", "Oliver Chua", "Daniel Yu", "Grace Tan", "Bianca Sy", "Noel Dela Paz",
];
const SALES_PRODUCTS = ["Blue Royale", "Select", "Premier Health", "Maxicare Plus", "AsianLife Care", "Family Shield", "Global Travel"];
const SALES_AGENTS = ["eman", "joy", "bea", "matt"];
const SALES_ROWS = SALES_SEED_NAMES.map((name, i) => {
  const product = SALES_PRODUCTS[(i * 3 + 1) % SALES_PRODUCTS.length];
  const agent = SALES_AGENTS[i % (i % 5 === 0 ? 4 : 3)]; // matt gets a light tail
  const month = MONTHS[(i * 5 + 2) % 12];
  const premium = 62000 + ((i * 37) % 24) * 9000;
  const isApp = i % 3 === 0;
  const ref = isApp ? "APP-2026-0001" + (20 + i) : "POL-2026-01" + (700 + i * 3);
  const status = isApp ? ["Awaiting Payment", "Under Review", "Approved"][i % 3] : "Issued";
  return { ref, client: name, product, cat: catOf(product), agent, agentName: AGENT_NAME(agent), premium, month, issued: dateLabel(month), status };
});

/* ---------- Renewal ledger (view over renewals + policies) ---------- */
const RENEWAL_STATUS_MAP = { "Awaiting Payment": "Upcoming", "Notice Sent": "Reminded", "In Progress": "Reminded", "Overdue": "Lapsed" };
const RENEWAL_ROWS = (() => {
  const base = RD.RENEWALS.map((r, i) => ({
    id: "RN-" + i,
    client: r.client, policy: r.policy, date: r.date, premium: r.amount,
    rstatus: RENEWAL_STATUS_MAP[r.status] || "Upcoming", owner: SALES_AGENTS[i % 3], month: (r.date.split(" ")[0]) || "Jun",
  }));
  // Add retained (Renewed) history so retention rate is real
  const retained = [
    ["Ramon Velasco", "Blue Royale — Individual", 62000, "Feb"], ["Sofia Reyes", "Family Shield — Family", 148000, "Mar"],
    ["Miguel Torres", "Premier Health", 95000, "Apr"], ["Cristina Flores", "AsianLife Care", 110000, "May"],
    ["Edgar Domingo", "Family Shield — Family", 132000, "Jan"], ["John Santos", "Blue Royale — Individual", 90000, "Jun"],
    ["Isabel Navarro", "Select — Individual", 54000, "May"], ["Fernando Lopez", "Maxicare Plus", 73000, "Apr"],
  ].map(([client, policy, premium, month], i) => ({ id: "RN-R" + i, client, policy, date: dateLabel(month), premium, rstatus: "Renewed", owner: SALES_AGENTS[i % 3], month }));
  return [...base, ...retained];
})();

/* ---------- Conversion funnel (period view over lead_stage) ---------- */
const FUNNEL = [
  { stage: "New Lead", n: 128 }, { stage: "Contacted", n: 96 }, { stage: "Discovery", n: 71 },
  { stage: "Proposal", n: 48 }, { stage: "Product Selected", n: 34 }, { stage: "Application Started", n: 23 },
  { stage: "Converted", n: 18 },
];
const LOST_LEADS = [
  { name: "Rita Gonzales", product: "Select", reason: "Unresponsive", owner: "joy", age: 34, last: "3 follow-ups · no reply" },
  { name: "Danilo Reyes", product: "Select", reason: "Went with competitor", owner: "bea", age: 21, last: "Chose cheaper plan" },
  { name: "Marco Cua", product: "Select", reason: "Price", owner: "joy", age: 28, last: "Premium too high" },
  { name: "Kevin Lao", product: "Travel Insurance", reason: "No longer needed", owner: "bea", age: 12, last: "Trip cancelled" },
];

/* =============================== chart pieces =============================== */
function BarChart({ data, sel, onPick, fmt, highlight }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="rp-bars">
      {data.map((d) => {
        const on = sel != null;
        const isSel = sel === d.key;
        return (
          <button key={d.key} className={"rp-bar" + (on && !isSel ? " dim" : "") + (isSel ? " sel" : "")}
            onClick={() => onPick(d.key)} title={`${d.label} · ${fmt ? fmt(d.v) : d.v}`}>
            <span className="rp-bar-v">{fmt ? fmt(d.v) : d.v}</span>
            <span className="rp-bar-fill" style={{ height: (d.v / max * 100) + "%", background: isSel ? "var(--accent)" : (highlight === d.key ? "var(--accent)" : "var(--accent-soft-2)") }}></span>
            <span className="rp-bar-x">{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StackedBar({ segs, sel, onPick }) {
  const total = segs.reduce((a, s) => a + s.v, 0) || 1;
  return (
    <>
      <div className="rp-stack">
        {segs.map((s) => {
          const isSel = sel === s.key, on = sel != null;
          return <button key={s.key} className={"rp-stack-seg" + (on && !isSel ? " dim" : "")} title={`${s.label} · ${Math.round(s.v / total * 100)}%`}
            style={{ width: (s.v / total * 100) + "%", background: s.color, outline: isSel ? "2px solid var(--text)" : "none", outlineOffset: -2 }} onClick={() => onPick(s.key)}></button>;
        })}
      </div>
      <div className="rp-legend">
        {segs.map((s) => {
          const isSel = sel === s.key, on = sel != null;
          return (
            <button key={s.key} className={"rp-legend-item" + (on && !isSel ? " dim" : "") + (isSel ? " sel" : "")} onClick={() => onPick(s.key)}>
              <span className="rp-dot" style={{ background: s.color }}></span>
              <span className="rp-legend-label">{s.label}</span>
              <span className="rp-legend-v tnum">{Math.round(s.v / total * 100)}%</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ScopeBanner({ scope, period, onClear }) {
  if (!scope) return (
    <div className="rp-scope muted">
      <I.filter size={14} /><span>Full {period === "YTD" ? "year-to-date" : PERIODS[period].label} view — click any chart segment, bar or stat above to drill in.</span>
    </div>
  );
  return (
    <div className="rp-scope">
      <span className="rp-scope-pill"><I.filter size={13} /> {scope.label}</span>
      <span className="rp-scope-sub">scoped to {PERIODS[period].label}</span>
      <button className="rp-scope-clear" onClick={onClear}><I.plus size={14} style={{ transform: "rotate(45deg)" }} /> Clear drill-down</button>
    </div>
  );
}

// Clickable stat strip (tiles drill)
function StatTiles({ tiles }) {
  return (
    <div className="stat-strip">
      {tiles.map((s, i) => (
        <button key={i} className={"stat-mini" + (s.onClick ? " rp-tile" : "")} onClick={s.onClick} style={{ textAlign: "left" }}>
          <div className="sm-val tnum" style={{ color: s.color }}>{s.val}</div>
          <div className="sm-label">{s.label}</div>
        </button>
      ))}
    </div>
  );
}

const openContact = (name) => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", name } } }));
const goPayments = () => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "payments" } }));
const toast = (title, sub) => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, sub } }));

/* =============================== card wrapper =============================== */
function ChartCard({ title, icon, right, children, col }) {
  const Ico = icon ? I[icon] : null;
  return (
    <div className={col || "col-4"}>
      <div className="card" style={{ height: "100%" }}>
        <div className="card-head"><h3>{Ico && <Ico size={16} style={{ color: "var(--text-muted)" }} />} {title}</h3>{right && <span className="card-link">{right}</span>}</div>
        <div style={{ padding: "18px 20px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ================================ OVERVIEW ================================= */
function OverviewTab({ period, goSales }) {
  const bars = [1.8, 2.1, 1.9, 2.4, 2.7, 3.1, 2.9, 3.4, 3.2, 3.8, 4.1, 4.6]
    .map((v, i) => ({ key: MONTHS[i], label: MONTHS[i], v })).filter((b) => inPeriod(b.key, period));
  const mix = [
    { key: "Health", label: "Health", v: 46, color: CAT_COLOR.Health },
    { key: "Life", label: "Life", v: 27, color: CAT_COLOR.Life },
    { key: "Family", label: "Family", v: 18, color: CAT_COLOR.Family },
    { key: "Travel", label: "Travel", v: 9, color: CAT_COLOR.Travel },
  ];
  return (
    <>
      <StatTiles tiles={[
        { val: "₱34.2M", label: "Premiums YTD", color: "var(--accent)", onClick: () => goSales({ dim: "product", key: null, label: "All sales" }) },
        { val: "+18.4%", label: "vs last year", color: "var(--accent)", onClick: () => goSales() },
        { val: "1,248", label: "Active clients", onClick: () => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "clients" } })) },
        { val: "94.2%", label: "Renewal rate", color: "var(--accent)", onClick: () => window.dispatchEvent(new CustomEvent("reports-tab", { detail: { tab: "Renewal" } })) },
      ]} />
      <div className="grid12">
        <ChartCard title="Monthly premium revenue" icon="trendUp" right="₱ Millions · click a bar" col="col-8">
          <BarChart data={bars} sel={null} highlight="Jun" fmt={(v) => v} onPick={(k) => goSales({ dim: "month", key: k, label: "Premiums · " + k + " 2026" })} />
        </ChartCard>
        <ChartCard title="Product mix" icon="shield" right="click a segment">
          <StackedBar segs={mix} sel={null} onPick={(k) => goSales({ dim: "cat", key: k, label: k + " policies" })} />
        </ChartCard>
      </div>
    </>
  );
}

/* ================================= SALES ================================== */
function SalesTab({ period, drill, setDrill }) {
  const scoped = SALES_ROWS.filter((r) => inPeriod(r.month, period));
  const byMonth = MONTHS.filter((m) => inPeriod(m, period)).map((m) => ({ key: m, label: m, v: Math.round(scoped.filter((r) => r.month === m).reduce((a, r) => a + r.premium, 0) / 1000) }));
  const byCat = ["Health", "Life", "Family", "Travel"].map((c) => ({ key: c, label: c, color: CAT_COLOR[c], v: scoped.filter((r) => r.cat === c).reduce((a, r) => a + r.premium, 0) }));
  const byAgent = SALES_AGENTS.map((a) => ({ key: a, label: AGENT_NAME(a).split(" ")[0], v: Math.round(scoped.filter((r) => r.agent === a).reduce((s, r) => s + r.premium, 0) / 1000) })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v);

  let rows = scoped;
  if (drill) {
    if (drill.dim === "month") rows = rows.filter((r) => r.month === drill.key);
    if (drill.dim === "cat") rows = rows.filter((r) => r.cat === drill.key);
    if (drill.dim === "agent") rows = rows.filter((r) => r.agent === drill.key);
  }
  const total = scoped.reduce((a, r) => a + r.premium, 0);
  return (
    <>
      <StatTiles tiles={[
        { val: RD.pesoShort(total), label: "Premiums " + period + " · +18.4%", color: "var(--accent)", onClick: () => setDrill(null) },
        { val: scoped.length, label: "Policies issued", onClick: () => setDrill(null) },
        { val: RD.pesoShort(Math.round(total / scoped.length)), label: "Avg premium" },
        { val: "0.7", label: "Travel attach / client" },
      ]} />
      <div className="grid12" style={{ marginBottom: 4 }}>
        <ChartCard title="Premium by month" icon="trendUp" right="₱ thousands" col="col-5">
          <BarChart data={byMonth} sel={drill && drill.dim === "month" ? drill.key : null} fmt={(v) => v} onPick={(k) => setDrill({ dim: "month", key: k, label: "Premiums · " + k })} />
        </ChartCard>
        <ChartCard title="By product" icon="shield" right="click to filter" col="col-3">
          <StackedBar segs={byCat} sel={drill && drill.dim === "cat" ? drill.key : null} onPick={(k) => setDrill({ dim: "cat", key: k, label: k + " policies" })} />
        </ChartCard>
        <ChartCard title="By agent" icon="users" right="₱ thousands" col="col-4">
          <Leaderboard data={byAgent} sel={drill && drill.dim === "agent" ? drill.key : null} fmt={(v) => "₱" + v + "K"} onPick={(k) => setDrill({ dim: "agent", key: k, label: AGENT_NAME(k) + "'s sales" })} />
        </ChartCard>
      </div>
      <window.ListScreen key={period + JSON.stringify(drill)} hideHead
        title="Sales detail" icon="peso" sub=""
        scopeBanner={<ScopeBanner scope={drill} period={period} onClear={() => setDrill(null)} />}
        onExport={() => toast("Sales report exported", (drill ? drill.label : "All sales") + " · " + rows.length + " rows · " + PERIODS[period].label)}
        filters={["Issued", "Approved", "Under Review", "Awaiting Payment"]}
        rows={rows.map((r) => ({ ...r, _filter: r.status }))}
        defaultSort={{ key: "premium", dir: "desc" }}
        emptyText="No sales in this scope."
        columns={[{ k: "ref", label: "Policy / App" }, { k: "client", label: "Client" }, { k: "product", label: "Product" }, { k: "agentName", label: "Agent" }, { k: "premium", label: "Premium", num: true }, { k: "issued", label: "Issued" }, { k: "status", label: "Status" }]}
        renderRow={(r) => (
          <tr key={r.ref} style={{ cursor: "pointer" }} onClick={() => openContact(r.client)}>
            <td><span className="cell-code">{r.ref}</span></td>
            <td><div className="client-cell"><Avatar name={r.client} size={28} /><div className="cc-name">{r.client}</div></div></td>
            <td className="cell-muted">{r.product} <span className="rp-cat-dot" style={{ background: CAT_COLOR[r.cat] }}></span></td>
            <td className="cell-muted">{r.agentName.split(" ")[0]}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>{RD.peso(r.premium)}</td>
            <td className="cell-muted">{r.issued}</td>
            <td><StatusBadge status={r.status} /></td>
          </tr>
        )}
      />
    </>
  );
}

function Leaderboard({ data, sel, onPick, fmt }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <div className="rp-lb">
      {data.map((d) => {
        const on = sel != null, isSel = sel === d.key;
        return (
          <button key={d.key} className={"rp-lb-row" + (on && !isSel ? " dim" : "") + (isSel ? " sel" : "")} onClick={() => onPick(d.key)}>
            <span className="rp-lb-name">{d.label}</span>
            <span className="rp-lb-track"><span className="rp-lb-fill" style={{ width: (d.v / max * 100) + "%", background: isSel ? "var(--accent)" : "var(--accent-soft-2)" }}></span></span>
            <span className="rp-lb-v tnum">{fmt ? fmt(d.v) : d.v}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =============================== COMMISSION =============================== */
function CommissionTab({ period, drill, setDrill }) {
  const role = window.Perms.role();
  const me = window.Perms.current;
  const P = window.Perms.person();
  const canSeeAgent = role === "admin";
  const seeAmt = (owner) => role === "admin" || owner === me;

  let items = window.CommissionsStore.items.slice();
  if (role === "agent") items = items.filter((c) => c.staff === me);
  // enrich each with a month for period scoping
  const enriched = items.map((c) => ({ ...c, month: (c.lastFollowup ? c.lastFollowup.split(" ")[0] : MONTHS[hash(c.or) % 6]) }));
  const scoped = enriched.filter((c) => inPeriod(c.month, period) || !c.lastFollowup);

  const STATUSES = ["Requested", "Follow-up", "Received", "Paid"];
  const val = (c) => c.actual || c.est;
  const byStatus = STATUSES.map((s) => ({ key: s, label: s, v: scoped.filter((c) => c.status === s).reduce((a, c) => a + val(c), 0), color: { Requested: "#7c3aed", "Follow-up": "#d97706", Received: "#2563eb", Paid: "#059669" }[s] }));
  const byMonth = MONTHS.filter((m) => inPeriod(m, period)).map((m) => ({ key: m, label: m, v: Math.round(scoped.filter((c) => c.month === m).reduce((a, c) => a + val(c), 0) / 1000) }));
  const byAgent = SALES_AGENTS.map((a) => ({ key: a, label: AGENT_NAME(a).split(" ")[0], v: Math.round(scoped.filter((c) => c.staff === a).reduce((s, c) => s + val(c), 0) / 1000) })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v);

  let rows = scoped;
  if (drill) {
    if (drill.dim === "status") rows = rows.filter((c) => c.status === drill.key);
    if (drill.dim === "month") rows = rows.filter((c) => c.month === drill.key);
    if (drill.dim === "agent") rows = rows.filter((c) => c.staff === drill.key);
  }
  const ytd = scoped.filter((c) => c.status === "Paid").reduce((a, c) => a + val(c), 0);
  const cnt = (s) => scoped.filter((c) => c.status === s).length;

  return (
    <>
      {role !== "admin" && (
        <div className="perm-banner">
          <I.shield size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
          <span>Viewing as <b>{P.name} · {P.roleLabel}</b>. Agency commission totals are shown, but <b>individual agents' commission figures are hidden</b> — the by-agent breakdown is Admin-only.</span>
        </div>
      )}
      <StatTiles tiles={[
        { val: RD.pesoShort(scoped.reduce((a, c) => a + val(c), 0)), label: "Commission " + period + " (agency)", color: "var(--accent)", onClick: () => setDrill(null) },
        { val: cnt("Requested"), label: "Requested", color: "var(--violet)", onClick: () => setDrill({ dim: "status", key: "Requested", label: "Requested vouchers" }) },
        { val: cnt("Follow-up"), label: "Follow-up pending", color: "var(--amber)", onClick: () => setDrill({ dim: "status", key: "Follow-up", label: "Follow-up pending" }) },
        { val: cnt("Received"), label: "Received", color: "var(--blue)", onClick: () => setDrill({ dim: "status", key: "Received", label: "Received vouchers" }) },
        { val: RD.pesoShort(ytd), label: "Paid · " + cnt("Paid"), color: "var(--accent)", onClick: () => setDrill({ dim: "status", key: "Paid", label: "Paid commissions" }) },
      ]} />
      <div className="grid12" style={{ marginBottom: 4 }}>
        <ChartCard title="Commission by status" icon="peso" right="₱ · click to filter" col="col-4">
          <StackedBar segs={byStatus} sel={drill && drill.dim === "status" ? drill.key : null} onPick={(k) => setDrill({ dim: "status", key: k, label: k + " commissions" })} />
        </ChartCard>
        <ChartCard title="Commission by month" icon="trendUp" right="₱ thousands" col={canSeeAgent ? "col-4" : "col-8"}>
          <BarChart data={byMonth} sel={drill && drill.dim === "month" ? drill.key : null} fmt={(v) => v} onPick={(k) => setDrill({ dim: "month", key: k, label: "Commission · " + k })} />
        </ChartCard>
        {canSeeAgent
          ? <ChartCard title="By agent" icon="users" right="₱ thousands" col="col-4">
              <Leaderboard data={byAgent} sel={drill && drill.dim === "agent" ? drill.key : null} fmt={(v) => "₱" + v + "K"} onPick={(k) => setDrill({ dim: "agent", key: k, label: AGENT_NAME(k) + "'s commissions" })} />
            </ChartCard>
          : null}
      </div>
      <window.ListScreen key={role + period + JSON.stringify(drill)} hideHead
        title="Commission detail" icon="peso" sub=""
        scopeBanner={<ScopeBanner scope={drill} period={period} onClear={() => setDrill(null)} />}
        onExport={() => toast("Commission report exported", (drill ? drill.label : "All commissions") + " · " + rows.length + " rows")}
        filters={STATUSES}
        rows={rows.map((c) => ({ ...c, _filter: c.status }))}
        defaultSort={{ key: "premium", dir: "desc" }}
        emptyText="No commissions in this scope."
        columns={[{ k: "or", label: "OR number" }, { k: "client", label: "Client" }, { k: "policy", label: "Policy" }, { k: "premium", label: "Premium", num: true }, { k: "est", label: "Commission", num: true }, { k: "status", label: "Status" }, { k: "contact", label: "Commission contact" }, { k: "lastFollowup", label: "Last follow-up" }]}
        renderRow={(c) => (
          <tr key={c.or} style={{ cursor: "pointer" }} onClick={goPayments} title="Open in Payments → Commissions">
            <td><span className="cell-code">{c.or}</span></td>
            <td><div className="client-cell"><Avatar name={c.client} size={28} /><div className="cc-name">{c.client}</div></div></td>
            <td className="cell-muted">{c.policy}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>{RD.peso(c.premium)}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>
              {seeAmt(c.staff) ? (c.actual ? RD.peso(c.actual) : <span style={{ color: "var(--text-muted)" }}>~{RD.peso(c.est)}</span>) : <span className="cell-muted" title="Hidden — other agent's commission">•••••</span>}
            </td>
            <td><StatusBadge status={c.status} /></td>
            <td className="cell-muted">{c.contact}</td>
            <td className="cell-muted">{c.lastFollowup || "—"}</td>
          </tr>
        )}
      />
    </>
  );
}

/* ================================ AGENTS ================================= */
function AgentsTab({ period, drill, setDrill }) {
  const role = window.Perms.role();
  const me = window.Perms.current;
  const P = window.Perms.person();
  const seeComm = role === "admin";
  const PP = window.PPData;

  let agents = SALES_AGENTS.slice();
  if (role === "agent") agents = agents.filter((a) => a === me);

  const rowsFor = (a) => {
    const sales = SALES_ROWS.filter((r) => r.agent === a && inPeriod(r.month, period));
    const leads = PP.PP_LEADS.filter((l) => l.staff === a).length + (hash(a) % 18);
    const policies = sales.length;
    const premium = sales.reduce((s, r) => s + r.premium, 0);
    const commission = window.CommissionsStore.items.filter((c) => c.staff === a).reduce((s, c) => s + (c.actual || c.est), 0) + (hash(a) % 40) * 1000;
    const conv = Math.min(52, 24 + (hash(a) % 22));
    const cycle = 9 + (hash(a) % 12);
    return { agent: a, name: AGENT_NAME(a), leads, policies, premium, commission, conv, cycle };
  };
  const data = agents.map(rowsFor).sort((a, b) => b.premium - a.premium);
  const lb = data.map((d) => ({ key: d.agent, label: d.name.split(" ")[0], v: Math.round(d.premium / 1000) }));

  // Drill to an agent's book → their sales rows
  const bookRows = drill ? SALES_ROWS.filter((r) => r.agent === drill.key && inPeriod(r.month, period)) : null;

  const totLeads = data.reduce((a, d) => a + d.leads, 0);
  const totPrem = data.reduce((a, d) => a + d.premium, 0);
  return (
    <>
      {role !== "admin" && (
        <div className="perm-banner">
          <I.shield size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
          <span>Viewing as <b>{P.name} · {P.roleLabel}</b>. Agency performance is shown, but <b>per-agent commission figures are hidden</b> (Admin-only). {role === "agent" && "You see only your own row."}</span>
        </div>
      )}
      <StatTiles tiles={[
        { val: data.length, label: "Active agents" },
        { val: totLeads, label: "Leads worked · " + period },
        { val: SALES_ROWS.filter((r) => inPeriod(r.month, period)).length, label: "Policies issued" },
        { val: RD.pesoShort(totPrem), label: "Premium " + period, color: "var(--accent)" },
      ]} />
      <div className="grid12" style={{ marginBottom: 4 }}>
        <ChartCard title="Premium leaderboard" icon="award" right="₱ thousands · click an agent" col="col-12">
          <Leaderboard data={lb} sel={drill ? drill.key : null} fmt={(v) => "₱" + v + "K"} onPick={(k) => setDrill({ dim: "agent", key: k, label: AGENT_NAME(k) + "'s book" })} />
        </ChartCard>
      </div>
      {!drill ? (
        <div className="card">
          <div className="rp-scope muted" style={{ margin: 0, borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}><I.users size={14} /><span>Agent performance · {PERIODS[period].label} — click a leaderboard bar or a row to open that agent's book.</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Agent</th><th className="num">Leads</th><th className="num">Conversion</th><th className="num">Policies</th><th className="num">Premium</th><th className="num">Commission</th><th className="num">Avg cycle</th></tr></thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.agent} style={{ cursor: "pointer" }} onClick={() => setDrill({ dim: "agent", key: d.agent, label: d.name + "'s book" })}>
                    <td><div className="client-cell"><Avatar name={d.name} size={30} /><div><div className="cc-name">{d.name}</div><div className="cc-sub">{RD.STAFF[d.agent] ? RD.STAFF[d.agent].role : ""}</div></div></div></td>
                    <td className="num tnum">{d.leads}</td>
                    <td className="num tnum"><span className="badge green" style={{ fontWeight: 700 }}>{d.conv}%</span></td>
                    <td className="num tnum">{d.policies}</td>
                    <td className="num mono" style={{ fontWeight: 600 }}>{RD.peso(d.premium)}</td>
                    <td className="num mono" style={{ fontWeight: 600 }}>{seeComm || d.agent === me ? RD.peso(d.commission) : <span className="cell-muted">•••••</span>}</td>
                    <td className="num tnum cell-muted">{d.cycle}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <window.ListScreen key={period + drill.key} hideHead
          title="Agent book" icon="users" sub=""
          scopeBanner={<ScopeBanner scope={drill} period={period} onClear={() => setDrill(null)} />}
          onExport={() => toast("Agent report exported", drill.label + " · " + bookRows.length + " policies")}
          filters={["Issued", "Approved", "Under Review", "Awaiting Payment"]}
          rows={bookRows.map((r) => ({ ...r, _filter: r.status }))}
          defaultSort={{ key: "premium", dir: "desc" }}
          emptyText="No records for this agent in scope."
          columns={[{ k: "ref", label: "Policy / App" }, { k: "client", label: "Client" }, { k: "product", label: "Product" }, { k: "premium", label: "Premium", num: true }, { k: "issued", label: "Issued" }, { k: "status", label: "Status" }]}
          renderRow={(r) => (
            <tr key={r.ref} style={{ cursor: "pointer" }} onClick={() => openContact(r.client)}>
              <td><span className="cell-code">{r.ref}</span></td>
              <td><div className="client-cell"><Avatar name={r.client} size={28} /><div className="cc-name">{r.client}</div></div></td>
              <td className="cell-muted">{r.product}</td>
              <td className="num mono" style={{ fontWeight: 600 }}>{RD.peso(r.premium)}</td>
              <td className="cell-muted">{r.issued}</td>
              <td><StatusBadge status={r.status} /></td>
            </tr>
          )}
        />
      )}
    </>
  );
}

/* ============================== CONVERSION =============================== */
function ConversionTab({ period, drill, setDrill }) {
  const PP = window.PPData;
  const scale = period === "YTD" ? 1 : period === "Quarter" ? 0.42 : 0.16;
  const funnel = FUNNEL.map((f) => ({ ...f, n: Math.round(f.n * scale) }));
  const top = funnel[0].n;
  const lost = Math.round(24 * scale);

  // detail: current leads at the drilled stage (from PP_LEADS)
  let rows = [];
  let leadMode = true;
  if (drill && drill.key === "Lost") { rows = LOST_LEADS; leadMode = false; }
  else if (drill) rows = PP.PP_LEADS.filter((l) => l.stage === drill.key).map((l) => ({ ...l, owner: l.staff }));
  else rows = PP.PP_LEADS.map((l) => ({ ...l, owner: l.staff }));

  const overall = Math.round(funnel[6].n / funnel[0].n * 100);
  return (
    <>
      <StatTiles tiles={[
        { val: funnel[0].n, label: "Leads entered · " + period, onClick: () => setDrill(null) },
        { val: funnel[6].n, label: "Converted", color: "var(--accent)", onClick: () => setDrill({ dim: "stage", key: "Application Started", label: "At Application Started" }) },
        { val: overall + "%", label: "Lead → convert rate", color: "var(--accent)" },
        { val: lost, label: "Lost", color: "var(--red)", onClick: () => setDrill({ dim: "stage", key: "Lost", label: "Lost leads (re-nurture)" }) },
      ]} />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3><I.trendUp size={16} style={{ color: "var(--text-muted)" }} /> Lead lifecycle funnel</h3><span className="card-link">click a stage to see the leads at it</span></div>
        <div style={{ padding: "18px 22px 22px" }}>
          <div className="rp-funnel">
            {funnel.map((f, i) => {
              const meta = PP.PP_STAGE_META[f.stage] || {};
              const pct = Math.round(f.n / top * 100);
              const step = i > 0 ? Math.round(f.n / funnel[i - 1].n * 100) : null;
              const isSel = drill && drill.key === f.stage;
              const on = drill != null;
              return (
                <button key={f.stage} className={"rp-funnel-row" + (on && !isSel ? " dim" : "") + (isSel ? " sel" : "")}
                  onClick={() => setDrill({ dim: "stage", key: f.stage, label: (f.stage === "Converted" ? "Converted leads" : "At " + f.stage) })}>
                  <span className="rp-fn-label">{f.stage}</span>
                  <span className="rp-fn-track"><span className="rp-fn-fill" style={{ width: pct + "%", background: isSel ? "var(--accent)" : (meta.color || "var(--accent-soft-2)") }}></span></span>
                  <span className="rp-fn-n tnum">{f.n}</span>
                  <span className="rp-fn-step">{step != null ? step + "%" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <window.ListScreen key={period + JSON.stringify(drill)} hideHead
        title="Leads" icon="chart" sub=""
        scopeBanner={<ScopeBanner scope={drill} period={period} onClear={() => setDrill(null)} />}
        onExport={() => toast("Conversion report exported", (drill ? drill.label : "All active leads") + " · " + rows.length + " rows")}
        rows={rows}
        defaultSort={{ key: "name", dir: "asc" }}
        emptyText="No leads in this scope."
        columns={leadMode
          ? [{ k: "name", label: "Lead" }, { k: "product", label: "Product interest" }, { k: "stage", label: "Stage" }, { k: "status", label: "Status" }, { k: "owner", label: "Owner" }, { k: "last", label: "Last activity" }]
          : [{ k: "name", label: "Lead" }, { k: "product", label: "Product interest" }, { k: "reason", label: "Lost reason" }, { k: "owner", label: "Owner" }, { k: "age", label: "Age (days)", num: true }, { k: "last", label: "Note" }]}
        renderRow={(l) => leadMode ? (
          <tr key={l.name} style={{ cursor: "pointer" }} onClick={() => openContact(l.name)}>
            <td><div className="client-cell"><Avatar name={l.name} size={28} /><div className="cc-name">{l.name}</div></div></td>
            <td className="cell-muted">{l.product}</td>
            <td><span className="badge slate">{l.stage}</span></td>
            <td><span className={"badge " + (PP.PP_STATUS_TONE[l.status] || "slate")}>{l.status}</span></td>
            <td className="cell-muted">{AGENT_NAME(l.owner).split(" ")[0]}</td>
            <td className="cell-muted">{l.last}</td>
          </tr>
        ) : (
          <tr key={l.name} style={{ cursor: "pointer" }} onClick={() => openContact(l.name)}>
            <td><div className="client-cell"><Avatar name={l.name} size={28} /><div className="cc-name">{l.name}</div></div></td>
            <td className="cell-muted">{l.product}</td>
            <td><span className="badge red">{l.reason}</span></td>
            <td className="cell-muted">{AGENT_NAME(l.owner).split(" ")[0]}</td>
            <td className="num tnum">{l.age}</td>
            <td className="cell-muted">{l.last}</td>
          </tr>
        )}
      />
    </>
  );
}

/* =============================== RENEWAL ================================= */
function RenewalTab({ period, drill, setDrill }) {
  const scoped = RENEWAL_ROWS.filter((r) => inPeriod(r.month, period));
  const cnt = (s) => scoped.filter((r) => r.rstatus === s).length;
  const retained = cnt("Renewed"), lapsed = cnt("Lapsed");
  const rate = retained + lapsed > 0 ? Math.round(retained / (retained + lapsed) * 1000) / 10 : 94.2;
  const byMonth = MONTHS.filter((m) => inPeriod(m, period)).map((m) => ({ key: m, label: m, v: scoped.filter((r) => r.month === m).length }));
  const rl = [
    { key: "Renewed", label: "Retained", v: retained || 1, color: "#059669" },
    { key: "Lapsed", label: "Lapsed", v: lapsed || 1, color: "#dc2626" },
  ];

  let rows = scoped;
  if (drill) {
    if (drill.dim === "status") rows = rows.filter((r) => r.rstatus === drill.key);
    if (drill.dim === "month") rows = rows.filter((r) => r.month === drill.key);
  }
  return (
    <>
      <StatTiles tiles={[
        { val: (rate || 94.2) + "%", label: "Renewal rate · " + period, color: "var(--accent)" },
        { val: cnt("Upcoming"), label: "Upcoming", color: "var(--blue)", onClick: () => setDrill({ dim: "status", key: "Upcoming", label: "Upcoming renewals" }) },
        { val: retained, label: "Retained", color: "var(--accent)", onClick: () => setDrill({ dim: "status", key: "Renewed", label: "Retained renewals" }) },
        { val: lapsed, label: "Lapsed / overdue", color: "var(--red)", onClick: () => setDrill({ dim: "status", key: "Lapsed", label: "Lapsed renewals" }) },
      ]} />
      <div className="grid12" style={{ marginBottom: 4 }}>
        <ChartCard title="Renewals by month" icon="refresh" right="count · click a bar" col="col-8">
          <BarChart data={byMonth} sel={drill && drill.dim === "month" ? drill.key : null} fmt={(v) => v} onPick={(k) => setDrill({ dim: "month", key: k, label: "Renewals · " + k })} />
        </ChartCard>
        <ChartCard title="Retained vs lapsed" icon="shield" right="click to filter">
          <StackedBar segs={rl} sel={drill && drill.dim === "status" && (drill.key === "Renewed" || drill.key === "Lapsed") ? drill.key : null} onPick={(k) => setDrill({ dim: "status", key: k, label: (k === "Renewed" ? "Retained" : "Lapsed") + " renewals" })} />
        </ChartCard>
      </div>
      <window.ListScreen key={period + JSON.stringify(drill)} hideHead
        title="Renewal detail" icon="refresh" sub=""
        scopeBanner={<ScopeBanner scope={drill} period={period} onClear={() => setDrill(null)} />}
        onExport={() => toast("Renewal report exported", (drill ? drill.label : "All renewals") + " · " + rows.length + " rows")}
        filters={["Upcoming", "Reminded", "Renewed", "Lapsed"]}
        rows={rows.map((r) => ({ ...r, _filter: r.rstatus }))}
        defaultSort={{ key: "date", dir: "asc" }}
        emptyText="No renewals in this scope."
        columns={[{ k: "client", label: "Client" }, { k: "policy", label: "Policy" }, { k: "date", label: "Renewal date" }, { k: "premium", label: "Premium", num: true }, { k: "rstatus", label: "Status" }, { k: "owner", label: "Owner" }]}
        renderRow={(r) => (
          <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => openContact(r.client)}>
            <td><div className="client-cell"><Avatar name={r.client} size={28} /><div className="cc-name">{r.client}</div></div></td>
            <td className="cell-muted">{r.policy}</td>
            <td className="cell-muted">{r.date}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>{RD.peso(r.premium)}</td>
            <td><span className={"badge " + ({ Upcoming: "blue", Reminded: "violet", Renewed: "green", Lapsed: "red" }[r.rstatus] || "slate")}><span className="b-dot"></span>{r.rstatus}</span></td>
            <td className="cell-muted">{AGENT_NAME(r.owner).split(" ")[0]}</td>
          </tr>
        )}
      />
    </>
  );
}

/* ================================= HOST ================================== */
const RP_TABS = ["Overview", "Sales", "Commission", "Agents", "Conversion", "Renewal"];
function ReportsScreen() {
  const [tab, setTab] = useStateRp("Overview");
  const [period, setPeriod] = useStateRp("YTD");
  const [drill, setDrill] = useStateRp(null);
  const [, bump] = useStateRp(0);
  React.useEffect(() => {
    const rr = () => bump((n) => n + 1);
    window.addEventListener("commissions-updated", rr);
    window.addEventListener("payments-updated", rr);
    const jump = (e) => { setTab(e.detail.tab); setDrill(null); };
    window.addEventListener("reports-tab", jump);
    return () => { window.removeEventListener("commissions-updated", rr); window.removeEventListener("payments-updated", rr); window.removeEventListener("reports-tab", jump); };
  }, []);
  const changeTab = (t) => { setTab(t); setDrill(null); };
  const goSales = (d) => { setTab("Sales"); setDrill(d || null); };

  return (
    <div className="fade-in" data-screen-label="Reports">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.chart size={19} /></span>Reports
          </h1>
          <p className="sub">Performance overview · {PERIODS[period].label}</p>
        </div>
        <div className="page-head-actions">
          <div className="seg">
            {["YTD", "Quarter", "Month"].map((p) => <button key={p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{p}</button>)}
          </div>
          <button className="btn" onClick={() => toast(tab + " report exported", "Active view · " + PERIODS[period].label)}><I.download size={15} /> Export</button>
        </div>
      </div>

      <div className="rp-tabs">
        {RP_TABS.map((t) => <button key={t} className={"rp-tab" + (tab === t ? " on" : "")} onClick={() => changeTab(t)}>{t}</button>)}
      </div>

      {tab === "Overview" && <OverviewTab period={period} goSales={goSales} />}
      {tab === "Sales" && <SalesTab period={period} drill={drill} setDrill={setDrill} />}
      {tab === "Commission" && <CommissionTab period={period} drill={drill} setDrill={setDrill} />}
      {tab === "Agents" && <AgentsTab period={period} drill={drill} setDrill={setDrill} />}
      {tab === "Conversion" && <ConversionTab period={period} drill={drill} setDrill={setDrill} />}
      {tab === "Renewal" && <RenewalTab period={period} drill={drill} setDrill={setDrill} />}
    </div>
  );
}

window.ReportsScreen = ReportsScreen;
