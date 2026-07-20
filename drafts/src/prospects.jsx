// Pacific Insurance PH — Lead Lifecycle screen (two axes: lead_stage + lead_status)
const { useState: useStatePP, useMemo: useMemoPP, useEffect: useEffectPP, useRef: useRefPP } = React;
const PPD = window.PPData;
const peso = window.PData.peso;
const pesoShort = window.PData.pesoShort;

// Lead-stage → badge tone (shared with the Advance-Lead modal + Contact Profile)
const STAGE_TONE_LEAD = {
  "New Lead": "slate", "Contacted": "blue", "Discovery": "blue",
  "Proposal": "violet", "Product Selected": "amber", "Application Started": "green",
  "Converted": "green", "Lost": "red",
};
window.STAGE_TONE_LEAD = STAGE_TONE_LEAD;
const AGENT_KEY_PP = { "Matt Nassr": "matt", "Eman Bondoc": "eman", "Joy Mercado": "joy", "Bea Lim": "bea", "Paolo Aquino": "paolo" };

/* ---------- KPIs (derived) ---------- */
function LeadKpis({ kpis }) {
  const dirIco = { up: <I.arrowUp size={12} />, down: <I.arrowDown size={12} />, flat: <I.clock size={12} /> };
  return (
    <div className="kpi-row" style={{ marginBottom: 16 }}>
      {kpis.map((k) => {
        const Ico = I[k.icon];
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
        if (q.primary) return <button key={q.label} className="btn primary" style={{ height: 38 }} onClick={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "prospect" } }))}><Ico size={16} /> {q.label}</button>;
        return <button key={q.label} className="qa-btn" onClick={() => window.dispatchEvent(new CustomEvent("open-engage", { detail: { action: q.action } }))}><span className="qa-ico"><Ico size={16} /></span>{q.label}</button>;
      })}
    </div>
  );
}

/* ---------- Pipeline overview (funnel from the SAME 6-stage list + exits) ---------- */
function PipelineOverview({ funnel, totalActive, weighted }) {
  const healthTone = { good: "var(--green)", watch: "var(--amber)", risk: "var(--red)" };
  const healthLabel = { good: "Healthy", watch: "Watch", risk: "At risk" };
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3><I.chart size={17} style={{ color: "var(--text-muted)" }} /> Pipeline overview <span className="count-pill">same 6 stages as board</span></h3>
        <span className="card-link">{totalActive} active · {peso(weighted)} weighted</span>
      </div>
      <div className="pipeline">
        {funnel.map((s, i) => (
          <React.Fragment key={s.name}>
            <div className="pipe-stage">
              <div className="ps-bar" style={{ background: PPD.PP_STAGE_META[s.name].color }}></div>
              <div className="ps-count tnum">{s.count}</div>
              <div className="ps-name">{s.name}</div>
              <div className="ps-val">{s.value ? pesoShort(s.value) : "—"}</div>
              <div className="ps-health" style={{ color: healthTone[PPD.PP_STAGE_META[s.name].health] }}><span className="h-dot"></span>{healthLabel[PPD.PP_STAGE_META[s.name].health]}</div>
            </div>
            {i < funnel.length - 1 && <I.chevRight size={15} className="pipe-arrow" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---------- Status distribution (mini-widget) ---------- */
function StatusDistribution({ counts, filter, setFilter }) {
  const total = PPD.PP_STATUSES.reduce((a, s) => a + (counts[s] || 0), 0) || 1;
  const tonecss = (s) => `var(--${PPD.PP_STATUS_TONE[s]})`;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3><I.users size={17} style={{ color: "var(--text-muted)" }} /> Status distribution</h3>
        <span className="card-link">how many did we reach · is discovery done</span>
      </div>
      <div style={{ padding: "14px 18px 16px" }}>
        <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", marginBottom: 14, border: "1px solid var(--border-soft)" }}>
          {PPD.PP_STATUSES.map((s) => {
            const c = counts[s] || 0;
            if (!c) return null;
            return <div key={s} style={{ width: (c / total * 100) + "%", background: tonecss(s), opacity: filter === "All" || filter === s ? 1 : 0.28 }} title={`${s}: ${c}`}></div>;
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PPD.PP_STATUSES.map((s) => {
            const c = counts[s] || 0;
            const on = filter === s;
            return (
              <button key={s} className={"sd-pill" + (on ? " on" : "")} onClick={() => setFilter(on ? "All" : s)} title={PPD.PP_STATUS_HINT[s]}>
                <span className="sd-dot" style={{ background: tonecss(s) }}></span>
                <span className="sd-name">{s}</span>
                <span className="sd-num tnum">{c}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Kanban board (drag → Advance-Lead popup) ---------- */
function FollowPill({ days }) {
  if (days === 99) return <span className="pcard-follow ok"><I.check size={12} /> Won</span>;
  if (days < 0) return <span className="pcard-follow over"><I.clock size={12} /> {Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="pcard-follow soon"><I.clock size={12} /> Due today</span>;
  if (days === 1) return <span className="pcard-follow soon"><I.clock size={12} /> Tomorrow</span>;
  return <span className="pcard-follow ok"><I.clock size={12} /> In {days}d</span>;
}

function LeadCard({ p, onDragStart, dim, onResume, onProposalReceived }) {
  const color = PPD.PP_PRODUCTS[p.product] || "var(--slate)";
  const prioCls = p.prio === "med" ? "med" : p.prio;
  const stTone = PPD.PP_STATUS_TONE[p.status] || "slate";
  const propState = p.proposal_decision || p.proposal_status;
  const openProfile = () => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "prospect", record_id: p.rid, name: p.name, product: p.product, owner: p.staff, pipeStage: p.stage, leadStatus: p.status, value: p.value, last: p.last, source: "Referral", proposalStatus: p.proposal_status || null, proposalDecision: p.proposal_decision || null } } }));
  return (
    <div className={"pcard prio-" + prioCls + (p.converting ? " converting" : "")} draggable onDragStart={(e) => onDragStart(e, p.id)} onClick={openProfile} style={{ cursor: "pointer", opacity: dim ? 0.32 : 1 }}>
      {p.converting && (
        <div className="pcard-wizbar">
          <span className="pcard-wiztag"><span className="pcard-wizdot"></span> Wizard in progress</span>
          <button className="pcard-resume" onClick={(e) => { e.stopPropagation(); onResume && onResume(p); }}>Resume</button>
        </div>
      )}
      <div className="pcard-top">
        <span className="pcard-name">{p.name}</span>
        <span className={"badge " + stTone + " pcard-status"}><span className="b-dot"></span>{p.status}</span>
      </div>
      <div className="pcard-product"><span className="pp-dot" style={{ background: color }}></span>{p.product}</div>
      {propState && (
        <button className="pcard-proposal" title={p.proposal_status === "Requested" ? "Click to mark received" : "Proposal " + propState}
          onClick={(e) => { e.stopPropagation(); if (p.proposal_status === "Requested" && onProposalReceived) onProposalReceived(p); }}>
          <I.clipboard size={11} /> Proposal · {propState}
        </button>
      )}
      <div className="pcard-meta"><I.clock size={11} /> {p.last}</div>
      <div className="pcard-foot">
        <div className="client-cell"><Avatar name={PPD.PP_STAFF[p.staff]} size={20} /><span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>{PPD.PP_STAFF[p.staff].split(" ")[0]}</span></div>
        <FollowPill days={p.follow} />
      </div>
    </div>
  );
}

function KanbanBoard({ leads, filter, setFilter, onDropLead, weighted, onResume, onProposalReceived }) {
  const [dragId, setDragId] = useStatePP(null);
  const [overCol, setOverCol] = useStatePP(null);
  const [filterOpen, setFilterOpen] = useStatePP(false);
  const filterRef = useRefPP(null);
  useEffectPP(() => {
    if (!filterOpen) return;
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [filterOpen]);

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; };
  const onDrop = (stage) => {
    if (dragId != null) {
      const lead = leads.find((l) => l.id === dragId);
      if (lead && lead.stage !== stage) onDropLead(lead, stage);
    }
    setDragId(null); setOverCol(null);
  };

  return (
    <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
      <div className="card-head">
        <h3><I.grid size={17} style={{ color: "var(--text-muted)" }} /> Lead board <span className="count-pill">{leads.length}</span></h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="card-link">{leads.length} active · {peso(weighted)} weighted</span>
          <div className="filter-pop-wrap" ref={filterRef}>
            <button className={"chip" + (filterOpen || filter !== "All" ? " on" : "")} onClick={() => setFilterOpen((o) => !o)}>
              <I.filter size={15} /> Filters{filter !== "All" ? <span className="filter-count">1</span> : null}
            </button>
            {filterOpen && (
              <div className="filter-pop">
                <div className="filter-pop-group">
                  <div className="filter-pop-label">Status</div>
                  <div className="filter-pop-chips">
                    {["All", ...PPD.PP_STATUSES.filter((s) => s !== "New")].map((s) => (
                      <button key={s} className={"chip" + (filter === s ? " on" : "")} onClick={() => setFilter(s)}>{s}</button>
                    ))}
                  </div>
                </div>
                {filter !== "All" && <button className="filter-pop-clear" onClick={() => setFilter("All")}>Clear filter</button>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="kanban-wrap" style={{ padding: "14px 16px 16px" }}>
        <div className="kanban">
          {PPD.PP_STAGES.map((stage) => {
            const items = leads.filter((p) => p.stage === stage);
            const val = items.reduce((a, p) => a + p.value, 0);
            const meta = PPD.PP_STAGE_META[stage];
            return (
              <div className="kan-col" key={stage}
                onDragOver={(e) => { e.preventDefault(); setOverCol(stage); }}
                onDrop={() => onDrop(stage)}>
                <div className="kan-col-head">
                  <span className="kch-dot" style={{ background: meta.color }}></span>
                  <span className="kch-name">{stage}</span>
                  <span className="kch-count">{items.length}</span>
                  <span className="kch-val">{val ? pesoShort(val) : ""}</span>
                </div>
                <div className="kan-col-body" style={overCol === stage && dragId != null ? { outline: "2px dashed var(--accent)", outlineOffset: 3, borderRadius: 10, minHeight: 80 } : null}>
                  {items.map((p) => <LeadCard key={p.id} p={p} onDragStart={onDragStart} onResume={onResume} onProposalReceived={onProposalReceived} dim={filter !== "All" && p.status !== filter} />)}
                  <div className="kan-add" onClick={() => window.dispatchEvent(new CustomEvent("open-page-modal", { detail: { modal: "prospect" } }))}><I.plus size={13} style={{ verticalAlign: "-2px" }} /> Add lead</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Proposal tracking (micro-status WITHIN the Proposal Sent stage) ---------- */
function ProposalTracking() {
  const steps = ["Requested", "Received", "Sent", "Decision"];
  const statusTone = { "Awaiting Decision": "amber", "Proposal Received": "blue", "Proposal Requested": "slate", "Negotiating": "violet" };
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.fileText size={17} style={{ color: "var(--text-muted)" }} /> Proposal tracking <span className="count-pill">within Proposal Sent</span></h3>
        <button className="card-link">View all <I.chevRight size={13} /></button>
      </div>
      <div style={{ padding: "10px 18px 0", fontSize: 11.5, color: "var(--text-subtle)" }}>The proposal-artifact status for leads in the <b style={{ color: "var(--violet)" }}>Proposal Sent</b> stage — not a separate pipeline.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.2fr auto", gap: 14, padding: "12px 18px 9px", borderBottom: "1px solid var(--border-soft)" }}>
        {["Lead", "Sent", "Progress", "Status"].map((h) => <div key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-subtle)" }}>{h}</div>)}
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
function LeadActivity() {
  const tone = { convert: "green", proposal_sent: "violet", discovery: "blue", brochure: "blue", proposal_req: "amber", inquiry: "slate", intake: "green" };
  const ico = { convert: "award", proposal_sent: "send", discovery: "phone", brochure: "mail", proposal_req: "fileText", inquiry: "user", intake: "clipboard" };
  return (
    <div className="card">
      <div className="card-head"><h3><I.clock size={17} style={{ color: "var(--text-muted)" }} /> Recent lead activity</h3><button className="card-link">View log <I.chevRight size={13} /></button></div>
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
  const [leads, setLeads] = useStatePP(PPD.PP_LEADS);
  const [exits, setExits] = useStatePP(PPD.PP_EXITS);
  const [filter, setFilter] = useStatePP("All");
  const [advance, setAdvance] = useStatePP(null); // { lead, preset }
  const [view, setView] = useStatePP("Board"); // Board | List | Forecast
  const [ownerF, setOwnerF] = useStatePP("All");
  const [productF, setProductF] = useStatePP("All");
  const [listStage, setListStage] = useStatePP(null); // Forecast → List drill (stage)
  const [listMonth, setListMonth] = useStatePP(null); // Forecast → List drill (expected-close month)

  // Derived funnel (SAME 6-stage list) + two exits
  const funnel = useMemoPP(() => {
    const rows = PPD.PP_STAGES.map((name) => {
      const items = leads.filter((l) => l.stage === name);
      return { name, count: items.length, value: items.reduce((a, l) => a + l.value, 0) };
    });
    rows.push({ name: "Converted", count: exits.Converted, value: exits.ConvertedValue });
    rows.push({ name: "Lost", count: exits.Lost, value: 0 });
    return rows;
  }, [leads, exits]);

  const statusCounts = useMemoPP(() => {
    const c = {};
    leads.forEach((l) => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leads]);

  const weighted = leads.reduce((a, l) => a + l.value, 0);
  const overdue = leads.filter((l) => l.follow < 0).length;
  const dueToday = leads.filter((l) => l.follow === 0).length;

  const kpis = [
    { id: "active", icon: "users", value: String(leads.length), label: "Active Leads", delta: "+6", dir: "up" },
    { id: "follow", icon: "phone", value: String(dueToday + overdue), label: "Follow-ups Due Today", delta: `${overdue} overdue`, dir: "flat", tone: "amber" },
    { id: "proposals", icon: "fileText", value: String(leads.filter((l) => l.stage === "Proposal").length), label: "Proposals Pending", delta: "+2", dir: "up" },
    { id: "starts", icon: "clipboard", value: String(leads.filter((l) => l.stage === "Application Started").length), label: "Application Starts", delta: "+4", dir: "up" },
    { id: "conv", icon: "award", value: String(exits.Converted), label: "Conversions This Month", delta: "+5", dir: "up" },
    { id: "rate", icon: "trendUp", value: "36%", label: "Conversion Rate", delta: "+3.1pt", dir: "up" },
  ];

  // A drag opens the Advance-Lead popup pre-set to the drop target — never silent.
  const onDropLead = (lead, stage) => {
    setAdvance({ lead, preset: { stage, status: lead.status, label: `Dragged to ${stage}` } });
  };

  // A New Lead created from the modal drops straight into its chosen column.
  useEffectPP(() => {
    const onCreated = (e) => { const l = e.detail && e.detail.lead; if (l) setLeads((ls) => ls.some((x) => x.id === l.id) ? ls : [l, ...ls]); };
    window.addEventListener("lead-created", onCreated);
    return () => window.removeEventListener("lead-created", onCreated);
  }, []);

  // Two-phase Convert to Application. Phase 1 (start): move the card to Application Started but keep it a
  // Lead. Phase 2 (commit): wizard saved → remove the card + count the conversion. Abandon: revert the card.
  const convertPrior = useRefPP({});
  useEffectPP(() => {
    const onStart = (e) => {
      const rid = e.detail && e.detail.rid; if (!rid) return;
      setLeads((ls) => ls.map((x) => x.rid === rid ? { ...x, stage: "Application Started", converting: true, last: "Application wizard open" } : x));
    };
    const onCommit = (e) => {
      const rid = e.detail && e.detail.rid; if (!rid) return;
      setLeads((ls) => {
        const lead = ls.find((x) => x.rid === rid);
        if (lead) setExits((ex) => ({ ...ex, Converted: ex.Converted + 1, ConvertedValue: ex.ConvertedValue + (lead.value || 0) }));
        return ls.filter((x) => x.rid !== rid);
      });
    };
    const onAbandon = (e) => {
      const rid = e.detail && e.detail.rid; if (!rid) return;
      const prior = PPD._convertPrior[rid];
      setLeads((ls) => ls.map((x) => x.rid === rid ? { ...x, stage: prior || x.stage, converting: false, last: "Wizard discarded — still a lead" } : x));
    };
    window.addEventListener("lead-convert-start", onStart);
    window.addEventListener("lead-convert-commit", onCommit);
    window.addEventListener("lead-convert-abandon", onAbandon);
    return () => { window.removeEventListener("lead-convert-start", onStart); window.removeEventListener("lead-convert-commit", onCommit); window.removeEventListener("lead-convert-abandon", onAbandon); };
  }, []);

  const fireToast = (title, sub) => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, sub } }));
  const emitLog = (lead, entry) => window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key: lead.rid, name: lead.name, entry: { actor: window.Perms.person().name, time: "Just now", ...entry } } }));

  const launchWizard = (lead) => {
    const cat = { "Health": "health", "Group HMO": "hmo", "Travel": "travel" }["Health"] || "health";
    const parts = lead.name.split(" ");
    const prefill = {
      _convert: { record_id: lead.rid, name: lead.name },
      appType: "New Insurance Application", category: /travel/i.test(lead.product) ? "travel" : /flexi|hmo|group/i.test(lead.product) ? "hmo" : "health",
      clientMode: "existing", existingClient: lead.name, agent: PPD.PP_STAFF[lead.staff],
      firstName: parts[0], lastName: parts.slice(1).join(" "), displayName: lead.name,
      product: lead.product || "", initialStatus: "Applicant", status: "Applicant",
    };
    window.dispatchEvent(new CustomEvent("open-new-application", { detail: { prefill } }));
  };

  const startConvert = (lead) => {
    PPD.leadConvertStart(lead.rid); // persist to shared data (survives board unmount)
    setLeads((ls) => ls.map((x) => x.id === lead.id ? { ...x, stage: "Application Started", converting: true, last: "Application wizard open" } : x));
  };
  const resumeConvert = (lead) => launchWizard(lead); // re-open the wizard without touching the stashed prior stage
  // One-click Mark Received from the Kanban proposal pill.
  const markProposalReceived = (lead) => {
    PPD.setProposal(lead.rid, { status: "Received" });
    setLeads((ls) => ls.map((x) => x.id === lead.id ? { ...x, proposal_status: "Received" } : x));
    emitLog(lead, { kind: "note", title: "Proposal received", body: `Carrier proposal / quote received for ${lead.name}.` });
    fireToast("Proposal received", `${lead.name} — ready to send.`);
  };

  // Apply the confirmed Advance-Lead result
  const applyAdvance = (lead, r) => {
    if (r.note) emitLog(lead, { kind: "note", title: "Outcome note", body: r.note });

    if (r.lost) {
      setLeads((ls) => ls.filter((x) => x.id !== lead.id));
      setExits((e) => ({ ...e, Lost: e.Lost + 1 }));
      emitLog(lead, { kind: "status", title: "Marked Lost — lifecycle_stage = Lost", body: "Retained for re-nurture." });
      fireToast("Lead marked lost", `${lead.name} moved to Lost — kept on the record for re-nurture.`);
    } else if (r.toApplication) {
      // Phase 1 only — move the card to Application Started and open the wizard. Nothing is created and the
      // card is NOT removed until the wizard is saved (commit) or reverted if abandoned.
      emitLog(lead, { kind: "status", title: `Stage changed — ${lead.stage} → Application Started`, body: "Application wizard opened — not yet converted." });
      if (r.status !== lead.status) emitLog(lead, { kind: "status", title: `Status changed — ${lead.status} → ${r.status}`, body: "" });
      startConvert(lead);
      fireToast("Application wizard opened", `${lead.name} moved to Application Started — nothing saves until you create or save a draft.`);
      launchWizard(lead);
    } else {
      const stageChanged = r.stage !== lead.stage;
      const statusChanged = r.status !== lead.status;
      const fd = r.follow ? Math.max(0, Math.round((new Date(r.follow) - new Date()) / 86400000)) : lead.follow;
      setLeads((ls) => ls.map((x) => x.id === lead.id ? { ...x, stage: r.stage, status: r.status, follow: fd, last: `Advanced → ${r.stage}`, est_premium: r.est_premium || x.est_premium, value: r.est_premium || x.value, expected_close_date: r.expected_close_date || x.expected_close_date } : x));
      if (stageChanged) emitLog(lead, { kind: "status", title: `Stage changed — ${lead.stage} → ${r.stage}`, body: r.note || "" });
      if (statusChanged) emitLog(lead, { kind: "status", title: `Status changed — ${lead.status} → ${r.status}`, body: "" });
      fireToast("Lead advanced", `${lead.name} → ${r.stage} · ${r.status}${r.follow ? " · follow-up scheduled" : ""}.`);
    }

    // Optional "Also send…" — reuse the shared Engage composer
    if (r.alsoSend) {
      const contact = { name: lead.name, record_id: lead.rid, owner: lead.staff, product: lead.product, interest: /travel/i.test(lead.product) ? "Travel" : "Health", value: lead.value };
      setTimeout(() => window.dispatchEvent(new CustomEvent("open-engage", { detail: { action: r.alsoSend, contact } })), 60);
    }
  };

  const AdvanceModal = window.AdvanceLeadModal;

  // List/Forecast wiring
  const onAdvanceRow = (l) => setAdvance({ lead: l, preset: { stage: PPD.nextStage(l.stage), status: l.status, label: "Advance from List" } });
  const onNurture = (l, action) => window.dispatchEvent(new CustomEvent("open-engage", { detail: { action, contact: { name: l.name, record_id: l.rid, owner: l.staff, product: l.product, interest: /travel/i.test(l.product) ? "Travel" : "Health", value: l.value } } }));
  const onBulk = (action, ids) => {
    const n = ids.length;
    if (action === "assign") {
      const me = window.Perms.current;
      setLeads((ls) => ls.map((l) => ids.includes(l.id) ? { ...l, staff: me } : l));
      fireToast("Owner assigned", `${n} lead${n > 1 ? "s" : ""} reassigned to ${window.Perms.person().name}.`);
    } else if (action === "send") {
      const first = leads.find((l) => ids.includes(l.id));
      fireToast("Batch send", `Template composer opened for ${n} lead${n > 1 ? "s" : ""}.`);
      if (first) window.dispatchEvent(new CustomEvent("open-engage", { detail: { action: "Send Brochure", contact: { name: `${n} leads (batch)`, product: first.product, owner: first.staff, interest: "Health" } } }));
    } else if (action === "lost") {
      setLeads((ls) => ls.filter((l) => !ids.includes(l.id)));
      setExits((e) => ({ ...e, Lost: e.Lost + n }));
      fireToast("Leads marked lost", `${n} lead${n > 1 ? "s" : ""} moved to Lost — retained for re-nurture.`);
    }
  };
  const onDrill = ({ stage, month }) => { setListStage(stage || null); setListMonth(month || null); setView("List"); };
  const clearDrill = () => { setListStage(null); setListMonth(null); };

  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            Lead Lifecycle <span className="module-tag"><I.users size={12} /> Pre-application</span>
          </h1>
          <p className="sub">Move a lead from first inquiry to a started application, tracked on two axes — a pipeline <b>Stage</b> and an orthogonal <b>Status</b> disposition. Every move routes through the Advance-Lead popup.</p>
        </div>
        <div className="page-head-actions">
          <div className="seg">
            {["Board", "List", "Forecast"].map((v) => <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v}</button>)}
          </div>
        </div>
      </div>

      <QuickActions />
      <LeadKpis kpis={kpis} />

      {view === "Board" && (<>
        <StatusDistribution counts={statusCounts} filter={filter} setFilter={setFilter} />
        <KanbanBoard leads={leads} filter={filter} setFilter={setFilter} onDropLead={onDropLead} weighted={weighted} onResume={resumeConvert} onProposalReceived={markProposalReceived} />
        <div className="grid12">
          <div className="col-8 stack">
            <ProposalTracking />
            <FollowUpQueue />
          </div>
          <div className="col-4 stack">
            <ProductInterest />
            <IntakeForms />
            <LeadActivity />
          </div>
        </div>
      </>)}

      {view === "List" && window.LeadListView && (
        <window.LeadListView
          key={(listStage || "") + (listMonth || "")}
          leads={leads} ownerF={ownerF} setOwnerF={setOwnerF} productF={productF} setProductF={setProductF}
          initialStage={listStage} monthPreset={listMonth} onClearDrill={clearDrill}
          onAdvance={onAdvanceRow} onNurture={onNurture} onBulk={onBulk}
        />
      )}

      {view === "Forecast" && window.LeadForecastView && (
        <window.LeadForecastView leads={leads} onDrill={onDrill} />
      )}

      {advance && AdvanceModal && (
        <AdvanceModal
          lead={advance.lead}
          preset={advance.preset}
          onClose={() => setAdvance(null)}
          onConfirm={(r) => applyAdvance(advance.lead, r)}
        />
      )}
    </div>
  );
}

window.ProspectPipeline = ProspectPipeline;
