// Pacific Insurance PH — Prospect Pipeline screen
const { useState: useStatePP } = React;
const PPD = window.PPData;
const peso = window.PData.peso;
const pesoShort = window.PData.pesoShort;

/* ---------- KPIs ---------- */
function ProspectKpis() {
  const dirIco = { up: <I.arrowUp size={12} />, down: <I.arrowDown size={12} />, flat: <I.clock size={12} /> };
  return (
    <div className="kpi-row" style={{ marginBottom: 16 }}>
      {PPD.PP_KPIS.map((k) => {
        const Ico = I[k.icon];
        const tone = k.tone === "amber" ? "var(--amber)" : k.dir === "down" ? "var(--red)" : k.dir === "flat" ? "var(--text-subtle)" : "var(--accent)";
        return (
          <div key={k.id} className="kpi">
            <div className="kpi-top">
              <span className="kpi-ico"><Ico size={17} /></span>
              <span className={"kpi-delta " + (k.tone === "amber" ? "flat" : k.dir)} style={k.tone === "amber" ? { color: "var(--amber)" } : null}>{dirIco[k.dir]}{k.delta}</span>
            </div>
            <div className="kpi-val tnum">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Quick actions ---------- */
function QuickActions() {
  return (
    <div className="qa-row">
      {PPD.PP_QUICK.map((q) => {
        const Ico = I[q.icon];
        if (q.primary) return <button key={q.label} className="btn primary" style={{ height: 38 }}><Ico size={16} /> {q.label}</button>;
        return <button key={q.label} className="qa-btn"><span className="qa-ico"><Ico size={16} /></span>{q.label}</button>;
      })}
    </div>
  );
}

/* ---------- Pipeline overview ---------- */
function PipelineOverview() {
  const healthTone = { good: "var(--green)", watch: "var(--amber)", risk: "var(--red)" };
  const healthLabel = { good: "Healthy", watch: "Watch", risk: "At risk" };
  const stageColor = (s) => s.name === "Lost" ? "var(--red)" : s.name === "Converted" ? "var(--accent)" : "var(--blue)";
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3><I.chart size={17} style={{ color: "var(--text-muted)" }} /> Pipeline overview</h3>
        <span className="card-link">42 active · {peso(9930000)} weighted</span>
      </div>
      <div className="pipeline">
        {PPD.PP_PIPELINE.map((s, i) => (
          <React.Fragment key={s.name}>
            <div className="pipe-stage">
              <div className="ps-bar" style={{ background: stageColor(s) }}></div>
              <div className="ps-count tnum">{s.count}</div>
              <div className="ps-name">{s.name}</div>
              <div className="ps-val">{s.value ? pesoShort(s.value) : "—"}</div>
              <div className="ps-health" style={{ color: healthTone[s.health] }}><span className="h-dot"></span>{healthLabel[s.health]}</div>
            </div>
            {i < PPD.PP_PIPELINE.length - 1 && <I.chevRight size={15} className="pipe-arrow" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---------- Kanban board (drag + drop) ---------- */
function FollowPill({ days }) {
  if (days === 99) return <span className="pcard-follow ok"><I.check size={12} /> Won</span>;
  if (days < 0) return <span className="pcard-follow over"><I.clock size={12} /> {Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="pcard-follow soon"><I.clock size={12} /> Due today</span>;
  if (days === 1) return <span className="pcard-follow soon"><I.clock size={12} /> Tomorrow</span>;
  return <span className="pcard-follow ok"><I.clock size={12} /> In {days}d</span>;
}

function ProspectCard({ p, onDragStart }) {
  const color = PPD.PP_PRODUCTS[p.product] || "var(--slate)";
  const prioCls = p.prio === "high" ? "high" : p.prio === "med" ? "med" : "low";
  return (
    <div className={"pcard prio-" + (p.prio === "med" ? "med" : p.prio)} draggable onDragStart={(e) => onDragStart(e, p.id)}>
      <div className="pcard-top">
        <span className="pcard-name">{p.name}</span>
        <span className={"pcard-prio " + prioCls}>{p.prio}</span>
      </div>
      <div className="pcard-product"><span className="pp-dot" style={{ background: color }}></span>{p.product}</div>
      <div className="pcard-meta"><I.clock size={11} /> {p.last}</div>
      <div className="pcard-foot">
        <div className="client-cell"><Avatar name={PPD.PP_STAFF[p.staff]} size={20} /><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>{PPD.PP_STAFF[p.staff].split(" ")[0]}</span></div>
        <FollowPill days={p.follow} />
      </div>
    </div>
  );
}

function KanbanBoard() {
  const [prospects, setProspects] = useStatePP(PPD.PP_PROSPECTS);
  const [dragId, setDragId] = useStatePP(null);
  const [overCol, setOverCol] = useStatePP(null);

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
  const onDrop = (stage) => {
    if (dragId != null) setProspects((ps) => ps.map((p) => p.id === dragId ? { ...p, stage } : p));
    setDragId(null); setOverCol(null);
  };

  return (
    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
      <div className="card-head">
        <h3><I.grid size={17} style={{ color: "var(--text-muted)" }} /> Prospect board <span className="count-pill">{prospects.filter((p) => p.stage !== "Converted").length}</span></h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-subtle)", fontWeight: 600 }}>Drag cards to move stage</span>
          <button className="btn sm"><I.filter size={14} /> Filter</button>
        </div>
      </div>
      <div className="kanban-wrap" style={{ padding: "14px 16px 16px" }}>
        <div className="kanban">
          {PPD.PP_COLUMNS.map((col) => {
            const items = prospects.filter((p) => p.stage === col.key);
            const val = items.reduce((a, p) => a + p.value, 0);
            return (
              <div className="kan-col" key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDrop={() => onDrop(col.key)}>
                <div className="kan-col-head">
                  <span className="kch-dot" style={{ background: col.color }}></span>
                  <span className="kch-name">{col.key}</span>
                  <span className="kch-count">{items.length}</span>
                  <span className="kch-val">{val ? pesoShort(val) : ""}</span>
                </div>
                <div className="kan-col-body" style={overCol === col.key && dragId != null ? { outline: "2px dashed var(--accent)", outlineOffset: 3, borderRadius: 10, minHeight: 80 } : null}>
                  {items.map((p) => <ProspectCard key={p.id} p={p} onDragStart={onDragStart} />)}
                  <div className="kan-add"><I.plus size={13} style={{ verticalAlign: "-2px" }} /> Add prospect</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Proposal tracking ---------- */
function ProposalTracking() {
  const steps = ["Requested", "Received", "Sent", "Decision"];
  const statusTone = { "Awaiting Decision": "amber", "Proposal Received": "blue", "Proposal Requested": "slate", "Negotiating": "violet" };
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.fileText size={17} style={{ color: "var(--text-muted)" }} /> Proposal tracking <span className="count-pill">{PPD.PP_PROPOSALS.length}</span></h3>
        <button className="card-link">View all <I.chevRight size={13} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr auto", gap: 14, padding: "9px 18px", borderBottom: "1px solid var(--border-soft)" }}>
        {["Prospect", "Stage", "Progress", "Status"].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-subtle)" }}>{h}</div>)}
      </div>
      {PPD.PP_PROPOSALS.map((p) => (
        <div className="prop-row" key={p.name}>
          <div className="client-cell">
            <Avatar name={p.name} size={30} />
            <div><div className="cc-name">{p.name}</div><div className="cc-sub">{p.product}</div></div>
          </div>
          <div className="cell-muted" style={{ fontSize: 12 }}>{p.days}</div>
          <div className="prop-stage-track">
            {steps.map((s, i) => <span key={s} className={"prop-step" + (i < p.step ? " done" : i === p.step ? " active" : "")}></span>)}
          </div>
          <div><span className={"badge " + statusTone[p.status]}><span className="b-dot"></span>{p.status}</span></div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Product interest ---------- */
function ProductInterest() {
  return (
    <div className="card">
      <div className="card-head"><h3><I.shield size={17} style={{ color: "var(--text-muted)" }} /> Product interest</h3></div>
      <div style={{ padding: "16px 0 12px" }}>
        <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", margin: "0 18px 18px" }}>
          {PPD.PP_PRODUCT_INTEREST.map((p) => <div key={p.name} style={{ width: p.pct + "%", background: p.color }} title={p.name}></div>)}
        </div>
        {PPD.PP_PRODUCT_INTEREST.map((p) => (
          <div className="prod-row" key={p.name}>
            <span className="pr-label"><span style={{ width: 9, height: 9, borderRadius: 2, background: p.color }}></span>{p.name}</span>
            <span className="pr-track"><span className="pr-fill" style={{ width: p.pct + "%", background: p.color }}></span></span>
            <span className="pr-pct tnum">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Intake forms ---------- */
function IntakeForms() {
  const { sent, completed, awaiting, recent } = PPD.PP_INTAKE;
  const pct = Math.round(completed / sent * 100);
  const C = 2 * Math.PI * 26;
  return (
    <div className="card">
      <div className="card-head"><h3><I.clipboard size={17} style={{ color: "var(--text-muted)" }} /> Intake forms</h3><button className="card-link">Manage <I.chevRight size={13} /></button></div>
      <div className="intake-top">
        <svg width="68" height="68" viewBox="0 0 68 68" style={{ flex: "0 0 auto" }}>
          <circle cx="34" cy="34" r="26" fill="none" stroke="var(--surface-3)" strokeWidth="8" />
          <circle cx="34" cy="34" r="26" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform="rotate(-90 34 34)" />
          <text x="34" y="34" textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="750" fill="var(--text)">{pct}%</text>
        </svg>
        <div className="intake-stats">
          <div className="intake-stat"><span className="is-sw" style={{ background: "var(--blue)" }}></span><span className="is-num tnum">{sent}</span> Forms sent</div>
          <div className="intake-stat"><span className="is-sw" style={{ background: "var(--accent)" }}></span><span className="is-num tnum">{completed}</span> Completed</div>
          <div className="intake-stat"><span className="is-sw" style={{ background: "var(--amber)" }}></span><span className="is-num tnum">{awaiting}</span> Awaiting completion</div>
        </div>
      </div>
      <div style={{ padding: "0 18px 6px", borderTop: "1px solid var(--border-soft)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-subtle)", padding: "11px 0 7px" }}>Recent responses</div>
        {recent.map((r) => (
          <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
            <Avatar name={r.name} size={24} />
            <span style={{ fontSize: 12.5, fontWeight: 550, flex: 1 }}>{r.name}</span>
            <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>{r.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Follow-up queue ---------- */
function FollowUpQueue() {
  const tone = { phone: "green", mail: "blue", fileText: "violet", clipboard: "amber" };
  return (
    <div className="card">
      <div className="card-head"><h3><I.phone size={17} style={{ color: "var(--text-muted)" }} /> Follow-up queue <span className="count-pill">{PPD.PP_FOLLOWUPS.length}</span></h3><button className="card-link">View all <I.chevRight size={13} /></button></div>
      <div>
        {PPD.PP_FOLLOWUPS.map((f, i) => {
          const Ico = I[f.icon]; const t = tone[f.icon];
          return (
            <div className="fq-item" key={i}>
              <div className="fq-ico" style={{ background: `var(--${t}-soft)`, color: `var(--${t})` }}><Ico size={15} /></div>
              <div className="fq-body">
                <div className="fq-title">{f.action}</div>
                <div className="fq-sub"><span style={{ color: PPD.PP_PRODUCTS[f.product], fontWeight: 600 }}>{f.product}</span> · {f.sub}</div>
              </div>
              <span className={"fq-when " + f.urg}>{f.when}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Activity ---------- */
function ProspectActivity() {
  const tone = { convert: "green", proposal_sent: "violet", discovery: "blue", brochure: "blue", proposal_req: "amber", inquiry: "slate", intake: "green" };
  const ico = { convert: "award", proposal_sent: "send", discovery: "phone", brochure: "mail", proposal_req: "fileText", inquiry: "user", intake: "clipboard" };
  return (
    <div className="card">
      <div className="card-head"><h3><I.clock size={17} style={{ color: "var(--text-muted)" }} /> Recent prospect activity</h3><button className="card-link">View log <I.chevRight size={13} /></button></div>
      <div className="feed">
        {PPD.PP_ACTIVITY.map((a, i) => {
          const Ico = I[ico[a.type]]; const t = tone[a.type];
          return (
            <div className="feed-item" key={i}>
              <div className="feed-rail"><div className="feed-ico" style={{ background: `var(--${t}-soft)`, color: `var(--${t})` }}><Ico size={15} /></div><div className="feed-line"></div></div>
              <div className="feed-body">
                <div className="feed-text"><b>{a.who}</b> <span dangerouslySetInnerHTML={{ __html: a.text }} /></div>
                <div className="feed-time">{a.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Assembly ---------- */
function ProspectPipeline() {
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            Prospect Pipeline <span className="module-tag"><I.users size={12} /> Pre-application</span>
          </h1>
          <p className="sub">Move prospects from first inquiry to a started application. Prospects become clients only after a policy is issued.</p>
        </div>
        <div className="page-head-actions">
          <div className="seg"><button className="on">Board</button><button>List</button><button>Forecast</button></div>
        </div>
      </div>

      <QuickActions />
      <ProspectKpis />
      <PipelineOverview />
      <KanbanBoard />

      <div className="grid12">
        <div className="col-8 stack">
          <ProposalTracking />
          <FollowUpQueue />
        </div>
        <div className="col-4 stack">
          <ProductInterest />
          <IntakeForms />
          <ProspectActivity />
        </div>
      </div>
    </div>
  );
}

window.ProspectPipeline = ProspectPipeline;
