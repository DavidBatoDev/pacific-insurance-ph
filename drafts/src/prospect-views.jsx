// Pacific Insurance PH — Lead Lifecycle: List (triage table) + Forecast (weighted pipeline) views.
// Fills the empty List/Forecast positions of the Board/List/Forecast toggle (lead-lifecycle-views.md).
// Reuses: generic ListScreen, the Advance-Lead popup, the shared lead_stage/lead_status data. No parallel store.
const { useState: useStateLV, useMemo: useMemoLV } = React;
const LVD = window.PPData;
const lvPeso = window.PData.peso;
const lvPesoShort = window.PData.pesoShort;

const LV_NOW = new Date(2026, 6, 10); // anchor "today" = Jul 10, 2026
const lvMonthKey = (iso) => { const d = new Date(iso); return d.getFullYear() * 12 + d.getMonth(); };
const LV_NOW_KEY = LV_NOW.getFullYear() * 12 + LV_NOW.getMonth();
const lvBucket = (iso) => { const k = lvMonthKey(iso) - LV_NOW_KEY; return k <= 0 ? "This month" : k === 1 ? "Next month" : "Later"; };
const lvAge = (l) => 2 + (l.id * 7) % 42; // deterministic age-in-stage (days)

// Follow-up cell (overdue in red)
function LVFollow({ days }) {
  if (days === 99) return <span className="lv-follow ok">Won</span>;
  if (days < 0) return <span className="lv-follow over">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="lv-follow soon">Due today</span>;
  if (days === 1) return <span className="lv-follow soon">Tomorrow</span>;
  return <span className="lv-follow ok">In {days}d</span>;
}

/* =============================== LIST VIEW =============================== */
function LeadListView({ leads, ownerF, setOwnerF, productF, setProductF, initialStage, monthPreset, onClearDrill, onAdvance, onNurture, onBulk }) {
  const [selected, setSelected] = useStateLV(() => new Set());
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const openProfile = (l) => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "prospect", record_id: l.rid, name: l.name, product: l.product, owner: l.staff, pipeStage: l.stage, leadStatus: l.status, value: l.value, est_premium: l.est_premium, expected_close_date: l.expected_close_date, last: l.last, source: "Referral" } } }));

  const owners = ["All", ...Array.from(new Set(leads.map((l) => l.staff)))];
  const products = ["All", ...Array.from(new Set(leads.map((l) => l.product)))];

  // Owner + Product pre-filter (the two dims beyond ListScreen's built-in Stage/Status chips) + optional month drill.
  let rows = leads;
  if (ownerF !== "All") rows = rows.filter((l) => l.staff === ownerF);
  if (productF !== "All") rows = rows.filter((l) => l.product === productF);
  if (monthPreset) rows = rows.filter((l) => lvBucket(l.expected_close_date) === monthPreset);
  rows = rows.map((l) => ({ ...l, _filter: l.stage, weighted: LVD.weightedValue(l), age: lvAge(l), ownerName: LVD.PP_STAFF[l.staff] }));

  const selCount = selected.size;
  const banner = (
    <div className="lv-toolbar">
      <div className="lv-selects">
        <select className="select sm" value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
          {owners.map((o) => <option key={o} value={o}>{o === "All" ? "All owners" : LVD.PP_STAFF[o]}</option>)}
        </select>
        <select className="select sm" value={productF} onChange={(e) => setProductF(e.target.value)}>
          {products.map((p) => <option key={p} value={p}>{p === "All" ? "All products" : p}</option>)}
        </select>
      </div>
      {(selCount || monthPreset || initialStage) && (
        <div className={"lv-bulkbar" + (selCount ? " on" : "")}>
          {selCount ? (
            <>
              <span className="lv-bulk-n">{selCount} selected</span>
              <button className="btn xs" onClick={() => { onBulk("assign", [...selected]); setSelected(new Set()); }}><I.user size={13} /> Assign owner</button>
              <button className="btn xs" onClick={() => { onBulk("send", [...selected]); setSelected(new Set()); }}><I.mail size={13} /> Send</button>
              <button className="btn xs danger" onClick={() => { onBulk("lost", [...selected]); setSelected(new Set()); }}><I.plus size={13} style={{ transform: "rotate(45deg)" }} /> Mark Lost</button>
              <button className="lv-bulk-clear" onClick={() => setSelected(new Set())}>Clear</button>
            </>
          ) : null}
          {(monthPreset || initialStage) && <button className="lv-bulk-clear" style={{ marginLeft: "auto" }} onClick={onClearDrill}>Clear drill-down: {monthPreset || initialStage}</button>}
        </div>
      )}
    </div>
  );

  return (
    <window.ListScreen
      title="Lead Lifecycle" icon="users" hideHead
      scopeBanner={banner}
      filters={LVD.PP_STAGES}
      initialFilter={initialStage || "All"}
      filters2={LVD.PP_STATUSES} filter2Key="status" filters2Label="Status"
      rows={rows}
      defaultSort={{ key: "follow", dir: "asc" }}
      emptyText="No leads match these filters."
      onExport={() => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Lead list exported", sub: rows.length + " leads." } }))}
      columns={[
        { k: "sel", label: "" },
        { k: "name", label: "Lead" }, { k: "product", label: "Product interest" },
        { k: "stage", label: "Stage" }, { k: "status", label: "Status" }, { k: "ownerName", label: "Owner" },
        { k: "last", label: "Last activity" }, { k: "follow", label: "Next follow-up", num: true },
        { k: "age", label: "Age in stage", num: true }, { k: "weighted", label: "Weighted value", num: true },
        { k: "act", label: "" },
      ]}
      renderRow={(l) => {
        const color = LVD.PP_PRODUCTS[l.product] || "var(--slate)";
        const on = selected.has(l.id);
        return (
          <tr key={l.id} className={on ? "lv-row-sel" : ""}>
            <td style={{ width: 30 }} onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" className="lv-check" checked={on} onChange={() => toggle(l.id)} />
            </td>
            <td style={{ cursor: "pointer" }} onClick={() => openProfile(l)}>
              <div className="client-cell"><Avatar name={l.name} size={30} /><div><div className="cc-name">{l.name}</div><div className="cc-sub">#{l.rid}</div></div></div>
            </td>
            <td className="cell-muted"><span className="lv-pdot" style={{ background: color }}></span>{l.product}</td>
            <td><span className={"badge " + ((window.STAGE_TONE_LEAD && window.STAGE_TONE_LEAD[l.stage]) || "slate")}>{l.stage}</span></td>
            <td><span className={"badge " + (LVD.PP_STATUS_TONE[l.status] || "slate")}><span className="b-dot"></span>{l.status}</span></td>
            <td className="cell-muted">{LVD.PP_STAFF[l.staff].split(" ")[0]}</td>
            <td className="cell-muted">{l.last}</td>
            <td><LVFollow days={l.follow} /></td>
            <td className="num tnum cell-muted">{l.age}d</td>
            <td className="num mono" style={{ fontWeight: 600 }}>{lvPeso(l.weighted)}</td>
            <td onClick={(e) => e.stopPropagation()}>
              <div className="lv-actions">
                <button className="btn xs primary" onClick={() => onAdvance(l)} title="Advance lead">Advance</button>
                <button className="lv-act-ico" title="Send Email" onClick={() => onNurture(l, "Send Email")}><I.mail size={14} /></button>
                <button className="lv-act-ico" title="Send Brochure" onClick={() => onNurture(l, "Send Brochure")}><I.fileText size={14} /></button>
                <button className="lv-act-ico" title="Log Call" onClick={() => onNurture(l, "Log Discovery Call")}><I.phone size={14} /></button>
              </div>
            </td>
          </tr>
        );
      }}
    />
  );
}

/* ============================== FORECAST VIEW ============================== */
const LV_TARGET = 2500000; // weighted monthly goal (₱)

function LeadForecastView({ leads, onDrill }) {
  const rawTotal = leads.reduce((a, l) => a + (l.est_premium || 0), 0);
  const wTotal = leads.reduce((a, l) => a + LVD.weightedValue(l), 0);
  const thisMonth = leads.filter((l) => lvBucket(l.expected_close_date) === "This month");
  const quarter = leads.filter((l) => { const k = lvMonthKey(l.expected_close_date) - LV_NOW_KEY; return k >= 0 && k <= 2; });
  const wThisMonth = thisMonth.reduce((a, l) => a + LVD.weightedValue(l), 0);
  const targetPct = Math.min(100, Math.round(wThisMonth / LV_TARGET * 100));

  const funnel = LVD.PP_STAGES.map((s) => {
    const items = leads.filter((l) => l.stage === s);
    return { stage: s, count: items.length, raw: items.reduce((a, l) => a + (l.est_premium || 0), 0), weighted: items.reduce((a, l) => a + LVD.weightedValue(l), 0), prob: LVD.PP_STAGE_PROB[s] };
  });
  const maxW = Math.max(...funnel.map((f) => f.weighted), 1);

  const buckets = ["This month", "Next month", "Later"].map((b) => {
    const items = leads.filter((l) => lvBucket(l.expected_close_date) === b);
    return { bucket: b, count: items.length, weighted: items.reduce((a, l) => a + LVD.weightedValue(l), 0), raw: items.reduce((a, l) => a + (l.est_premium || 0), 0) };
  });
  const maxB = Math.max(...buckets.map((b) => b.weighted), 1);

  return (
    <div className="fade-in">
      {/* Summary band */}
      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-mini"><div className="sm-val tnum" style={{ color: "var(--accent)" }}>{lvPesoShort(wTotal)}</div><div className="sm-label">Weighted pipeline</div></div>
        <div className="stat-mini"><div className="sm-val tnum">{lvPesoShort(rawTotal)}</div><div className="sm-label">Raw pipeline</div></div>
        <div className="stat-mini"><div className="sm-val tnum">{thisMonth.length} <span style={{ fontSize: 13, color: "var(--text-subtle)", fontWeight: 600 }}>/ {quarter.length} qtr</span></div><div className="sm-label">Expected conversions · month / quarter</div></div>
        <div className="stat-mini">
          <div className="sm-val tnum">{targetPct}%</div>
          <div className="sm-label">Forecast vs target ({lvPesoShort(wThisMonth)} / {lvPesoShort(LV_TARGET)})</div>
          <div className="lv-target-track"><div className="lv-target-fill" style={{ width: targetPct + "%" }}></div></div>
        </div>
      </div>

      <div className="grid12">
        {/* Weighted funnel */}
        <div className="col-7">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-head"><h3><I.trendUp size={16} style={{ color: "var(--text-muted)" }} /> Weighted funnel</h3><span className="card-link">bar = weighted ₱ · click a stage</span></div>
            <div style={{ padding: "14px 18px 18px" }}>
              {funnel.map((f) => (
                <button key={f.stage} className="lv-fn-row" onClick={() => onDrill({ stage: f.stage })} title={"Drill to " + f.stage}>
                  <span className="lv-fn-label">{f.stage} <span className="lv-fn-prob">{Math.round(f.prob * 100)}%</span></span>
                  <span className="lv-fn-track"><span className="lv-fn-fill" style={{ width: (f.weighted / maxW * 100) + "%", background: LVD.PP_STAGE_META[f.stage].color }}></span></span>
                  <span className="lv-fn-nums"><span className="lv-fn-count tnum">{f.count}</span><span className="lv-fn-raw tnum">{lvPesoShort(f.raw)}</span><span className="lv-fn-w tnum">{lvPesoShort(f.weighted)}</span></span>
                </button>
              ))}
              <div className="lv-fn-legend"><span>Stage</span><span className="lv-fn-nums"><span className="lv-fn-count">count</span><span className="lv-fn-raw">raw</span><span className="lv-fn-w">weighted</span></span></div>
            </div>
          </div>
        </div>

        {/* Expected-close timeline */}
        <div className="col-5">
          <div className="card" style={{ height: "100%" }}>
            <div className="card-head"><h3><I.refresh size={16} style={{ color: "var(--text-muted)" }} /> Expected close</h3><span className="card-link">by month · click to drill</span></div>
            <div style={{ padding: "16px 18px 18px" }}>
              {buckets.map((b) => (
                <button key={b.bucket} className="lv-tl-row" onClick={() => onDrill({ month: b.bucket })} title={"Drill to " + b.bucket}>
                  <div className="lv-tl-head"><span className="lv-tl-label">{b.bucket}</span><span className="lv-tl-count">{b.count} lead{b.count !== 1 ? "s" : ""}</span></div>
                  <div className="lv-tl-track"><div className="lv-tl-fill" style={{ width: (b.weighted / maxB * 100) + "%" }}></div></div>
                  <div className="lv-tl-val tnum">{lvPeso(b.weighted)} <span className="cell-muted" style={{ fontWeight: 500 }}>weighted</span></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assumptions footnote */}
      <div className="lv-assume">
        <b>Weighted value = estimated premium × stage close-probability.</b> Assumptions:
        {LVD.PP_STAGES.map((s, i) => <span key={s} className="lv-assume-item">{s} {Math.round(LVD.PP_STAGE_PROB[s] * 100)}%</span>)}
      </div>
    </div>
  );
}

window.LeadListView = LeadListView;
window.LeadForecastView = LeadForecastView;
