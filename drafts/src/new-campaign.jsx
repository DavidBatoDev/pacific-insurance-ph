// Pacific Insurance PH — New Campaign (batch touchpoints) — new-modals.md §11
// Fired from the Relationship Management page. Reuses the Email Templates store and the
// EngageModal merge/preview patterns. Two steps: build → review/preview (human-in-the-loop).
const { useState: useStateNC, useMemo: useMemoNC } = React;
const NCD = window.PData;
const { Field: NCField, Select: NCSelect, TextInput: NCInput, Textarea: NCArea, MultiChips: NCChips } = window.NAShared;

// Campaign type → default template + a sensible auto-segment (§11)
const NC_TYPES = {
  Birthday:    { tpl: "Birthday greeting",    seg: "birthday",    icon: "cake",  color: "#7c3aed", segLabel: "Birthdays in the next 7 days" },
  Anniversary: { tpl: "Anniversary greeting", seg: "anniversary", icon: "award", color: "#059669", segLabel: "Client anniversaries this month" },
  Loyalty:     { tpl: "Loyalty / thank-you",  seg: "loyalty",     icon: "gift",  color: "#d97706", segLabel: "Loyalty activities due" },
  "Re-nurture":{ tpl: "New inquiry response", seg: "renurture",   icon: "refresh", color: "#2563eb", segLabel: "Lost / Nurturing leads" },
  Custom:      { tpl: "",                      seg: "manual",      icon: "users", color: "#64748b", segLabel: "Hand-picked contacts" },
};
const NC_TYPE_ORDER = ["Birthday", "Anniversary", "Loyalty", "Re-nurture", "Custom"];

const ncEmailFor = (name) => {
  const c = NCD.CLIENTS.find((x) => x.name === name);
  if (c) return c.email;
  return name.toLowerCase().replace(/[^a-z ]/g, "").split(" ").slice(0, 2).join(".") + "@email.com";
};
// Enrich a recipient with product + premium (from Clients LTV, or lead value)
const ncEnrich = (name, fallbackProduct) => {
  const c = NCD.CLIENTS.find((x) => x.name === name);
  if (c) return { email: c.email, premium: NCD.peso(NCD.clientLTV(c)), product: fallbackProduct || "your plan", rid: c.record_id };
  const lead = (window.PPData ? window.PPData.PP_LEADS : []).find((l) => l.name === name);
  if (lead) return { email: ncEmailFor(name), premium: NCD.peso(lead.value), product: lead.product, rid: lead.rid };
  return { email: ncEmailFor(name), premium: "your premium", product: fallbackProduct || "your plan", rid: null };
};

// Build the recipient pool for an auto-segment
function ncSegment(seg) {
  if (seg === "renurture") {
    const leads = (window.PPData ? window.PPData.PP_LEADS : []).filter((l) => l.status === "Nurturing");
    return leads.map((l) => ({ name: l.name, sub: l.product + " · " + l.status + " lead", ...ncEnrich(l.name, l.product) }));
  }
  if (seg === "manual") return [];
  // birthday / anniversary / loyalty come from the RELATIONSHIPS store
  return NCD.RELATIONSHIPS.filter((r) => r.type === seg).map((r) => {
    const prod = (r.sub.split("·")[1] || "").trim() || (r.sub.includes("Blue") ? "Blue Royale" : "your plan");
    return { name: r.name, sub: r.sub, ...ncEnrich(r.name, prod), when: r.when };
  });
}

// Lightweight multi-pick search across clients + leads (Custom / manual additions)
function NCPicker({ chosen, onAdd }) {
  const [q, setQ] = useStateNC("");
  const results = useMemoNC(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    const clients = NCD.CLIENTS.map((c) => ({ name: c.name, sub: c.city + " · Client" }));
    const leads = (window.PPData ? window.PPData.PP_LEADS : []).map((l) => ({ name: l.name, sub: l.product + " · Lead" }));
    return [...clients, ...leads].filter((r) => r.name.toLowerCase().includes(ql) && !chosen.some((x) => x.name === r.name)).slice(0, 6);
  }, [q, chosen]);
  return (
    <div>
      <div className="filter-search" style={{ width: "100%", height: 38, marginBottom: results.length ? 8 : 0 }}>
        <I.search size={16} />
        <input placeholder="Search a client or lead to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results.map((r) => (
        <div key={r.name} className="client-result" onClick={() => { onAdd({ name: r.name, sub: r.sub, ...ncEnrich(r.name) }); setQ(""); }}>
          <Avatar name={r.name} size={30} />
          <div style={{ flex: 1 }}><div className="cr-name">{r.name}</div><div className="cr-sub">{r.sub}</div></div>
          <I.plus size={16} style={{ color: "var(--text-subtle)" }} />
        </div>
      ))}
    </div>
  );
}

function NewCampaignModal({ presetType, onClose }) {
  const persona = window.Perms.person().name;
  const [step, setStep] = useStateNC(1); // 1 = build, 2 = review/preview
  const [type, setType] = useStateNC(presetType || "Birthday");
  const meta = NC_TYPES[type];

  const [name, setName] = useStateNC(() => (presetType || "Birthday") + " campaign — July 2026");
  const [tpl, setTpl] = useStateNC(meta.tpl);
  const [channels, setChannels] = useStateNC(["Email"]);
  const [schedule, setSchedule] = useStateNC("now"); // now · onDate · scheduled
  const [schedDate, setSchedDate] = useStateNC("");
  const [owner, setOwner] = useStateNC(persona);

  // Recipients: auto-segment seed + manual add/exclude
  const [auto, setAuto] = useStateNC(() => ncSegment(meta.seg));
  const [excluded, setExcluded] = useStateNC(() => new Set());
  const [manual, setManual] = useStateNC([]);

  const changeType = (t) => {
    setType(t);
    const m = NC_TYPES[t];
    setTpl(m.tpl);
    setAuto(ncSegment(m.seg));
    setExcluded(new Set());
    setManual([]);
    if (/campaign — July 2026$/.test(name) || !name.trim()) setName(t + " campaign — July 2026");
  };

  const pool = [...auto, ...manual];
  const recipients = pool.filter((r) => !excluded.has(r.name));
  const toggleExcl = (nm) => setExcluded((s) => { const n = new Set(s); n.has(nm) ? n.delete(nm) : n.add(nm); return n; });
  const addManual = (r) => { if (!manual.some((x) => x.name === r.name) && !auto.some((x) => x.name === r.name)) setManual((m) => [...m, r]); };

  const tplObj = window.TemplatesStore.get(tpl);
  const ctxFor = (r) => ({ first_name: r.name.split(" ")[0], product: r.product, premium: r.premium, agent: owner });
  const preview = recipients[0];
  const previewCtx = preview ? ctxFor(preview) : null;

  const scheduleLabel = schedule === "now" ? "Send immediately"
    : schedule === "onDate" ? "On each recipient's date (e.g. their birthday)"
    : "Scheduled" + (schedDate ? " for " + new Date(schedDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "");

  const canReview = name.trim() && type && tpl && channels.length > 0 && recipients.length > 0 && (schedule !== "scheduled" || schedDate);

  const send = () => {
    const actor = owner;
    const verb = schedule === "now" ? "Sent" : "Queued";
    recipients.forEach((r) => {
      const ctx = ctxFor(r);
      const subj = window.TemplatesStore.fill(tplObj.subject, ctx);
      const key = r.rid || r.name;
      window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key, name: r.name, entry: {
        kind: "email", dir: "sent", actor,
        title: verb + " — " + subj,
        body: `${type} campaign "${name}" · ${window.TemplatesStore.fill(tplObj.body, ctx).split("\n")[0]} · via ${channels.join(", ")}`,
        time: "Just now",
      } } }));
    });
    const n = recipients.length;
    const done = schedule === "now" ? "sent" : "queued";
    const when = schedule === "now" ? "delivering now"
      : schedule === "onDate" ? "on each recipient's date"
      : "scheduled" + (schedDate ? " for " + new Date(schedDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "");
    window.dispatchEvent(new CustomEvent("app-toast", { detail: {
      title: `Campaign ${done}`,
      sub: `${n} personalized ${type.toLowerCase()} message${n > 1 ? "s" : ""} ${done} · ${when} · logged to ${n > 1 ? "timelines" : "the timeline"}.`,
    } }));
    onClose();
  };

  const TypeIco = I[meta.icon] || I.send;

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.heart size={20} /></div>
          <div>
            <h2>New campaign</h2>
            <div className="dh-sub">{step === 1 ? "Batch a personal touchpoint to a segment of contacts" : "Review the segment and preview before sending"}</div>
          </div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>

        <div className="nc-steps">
          <span className={"nc-step" + (step === 1 ? " on" : " done")}><span className="nc-step-n">{step > 1 ? <I.check size={12} /> : "1"}</span> Build</span>
          <span className="nc-step-bar"></span>
          <span className={"nc-step" + (step === 2 ? " on" : "")}><span className="nc-step-n">2</span> Review &amp; preview</span>
        </div>

        <div className="drawer-body">
          {step === 1 && (
            <>
              <NCField label="Campaign name" req>
                <NCInput value={name} onChange={setName} placeholder="Internal label" />
              </NCField>

              <NCField label="Type" req hint="Picking a type pre-fills the audience segment and greeting template">
                <div className="nc-type-grid">
                  {NC_TYPE_ORDER.map((t) => {
                    const m = NC_TYPES[t]; const TI = I[m.icon] || I.send;
                    return (
                      <button key={t} className={"nc-type" + (type === t ? " on" : "")} onClick={() => changeType(t)}>
                        <span className="nc-type-ic" style={{ background: m.color + "1f", color: m.color }}><TI size={15} /></span>
                        <span className="nc-type-lb">{t}</span>
                      </button>
                    );
                  })}
                </div>
              </NCField>

              <div className="grid-2">
                <NCField label="Template" req hint="From Email Templates — editable at send">
                  <NCSelect value={tpl} onChange={setTpl} options={["", ...window.TemplatesStore.names(true)]} />
                </NCField>
                <NCField label="Owner" req hint="Defaults to the active persona">
                  <NCSelect value={owner} onChange={setOwner} options={window.NAShared.NA_OPTS.agents} />
                </NCField>
              </div>

              <div className="grid-2">
                <NCField label="Channel" req>
                  <NCChips selected={channels} onToggle={(c) => setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c])} options={["Email", "WhatsApp", "Viber"]} />
                </NCField>
                <NCField label="Schedule" req>
                  <div className="nc-radio-row">
                    {[["now", "Send now"], ["onDate", "On the date"], ["scheduled", "Scheduled"]].map(([v, l]) => (
                      <button key={v} className={"nc-radio" + (schedule === v ? " on" : "")} onClick={() => setSchedule(v)}>
                        <span className="nc-radio-dot"></span>{l}
                      </button>
                    ))}
                  </div>
                  {schedule === "scheduled" && <input className="input" type="date" style={{ marginTop: 8 }} value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />}
                  {schedule === "onDate" && <div className="nc-sched-note">Each message fires on the recipient's own date (birthday / anniversary).</div>}
                </NCField>
              </div>

              {/* Audience */}
              <div className="form-section" style={{ marginTop: 6 }}>
                <div className="form-section-title">
                  Audience <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>· {meta.segLabel}</span>
                </div>
                <div className="nc-aud-summary">
                  <span className="nc-aud-ic" style={{ background: meta.color + "1f", color: meta.color }}><TypeIco size={14} /></span>
                  <div><b>{recipients.length}</b> recipient{recipients.length === 1 ? "" : "s"} in this segment{excluded.size ? ` · ${excluded.size} excluded` : ""}</div>
                </div>

                {pool.length === 0 && (
                  <div className="nc-empty">No auto-segment for this type — search and add contacts below.</div>
                )}
                {pool.map((r) => {
                  const on = !excluded.has(r.name);
                  return (
                    <div key={r.name} className={"pl-row" + (on ? " on" : "")} onClick={() => toggleExcl(r.name)}>
                      <span className="pl-check">{on && <I.check size={13} />}</span>
                      <Avatar name={r.name} size={30} />
                      <div className="pl-rmid">
                        <div className="pl-rname">{r.name}</div>
                        <div className="pl-rsub">{r.sub}{r.when ? " · " + r.when : ""}</div>
                      </div>
                      <span className="pl-chan">{r.premium}</span>
                    </div>
                  );
                })}

                <div style={{ marginTop: 10 }}>
                  <div className="nc-add-label">Add more contacts</div>
                  <NCPicker chosen={pool} onAdd={addManual} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="callout accent" style={{ marginBottom: 16 }}>
                <span className="co-ico"><I.command size={15} /></span>
                <div><b>Human-in-the-loop.</b> Nothing sends until you click <b>{schedule === "now" ? "Send campaign" : "Queue campaign"}</b>. Each recipient gets a personalized message logged to their timeline.</div>
              </div>

              <div className="autofill-card" style={{ marginBottom: 16 }}>
                <div className="af-row"><span className="af-k">Campaign</span><span className="af-v">{name}</span></div>
                <div className="af-row"><span className="af-k">Type</span><span className="af-v">{type} · template “{tpl}”</span></div>
                <div className="af-row"><span className="af-k">Audience</span><span className="af-v">{recipients.length} recipients · {meta.segLabel}</span></div>
                <div className="af-row"><span className="af-k">Channel</span><span className="af-v">{channels.join(", ")}</span></div>
                <div className="af-row"><span className="af-k">Schedule</span><span className="af-v">{scheduleLabel}</span></div>
                <div className="af-row"><span className="af-k">Owner</span><span className="af-v">{owner}</span></div>
              </div>

              {preview && (
                <div className="mail-preview">
                  <div className="mail-preview-label"><I.mail size={13} /> Preview — merged for {preview.name}</div>
                  <div className="mail-card">
                    <div className="mail-head">
                      <div className="mail-avatar"><Avatar name={owner} size={34} /></div>
                      <div className="mail-meta">
                        <div className="mail-from">{owner} <span className="mail-addr">· Pacific Insurance PH</span></div>
                        <div className="mail-to">To: {preview.email} · via {channels.join(", ")}</div>
                      </div>
                    </div>
                    <div className="mail-subject">{window.TemplatesStore.fill(tplObj.subject, previewCtx)}</div>
                    <div className="mail-body">{window.TemplatesStore.fill(tplObj.body, previewCtx)}</div>
                  </div>
                </div>
              )}

              <div className="nc-recap">
                <div className="nc-recap-head">All {recipients.length} recipients</div>
                <div className="nc-recap-list">
                  {recipients.map((r) => (
                    <div key={r.name} className="nc-recap-chip"><Avatar name={r.name} size={22} /> {r.name}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="drawer-foot">
          {step === 1 ? (
            <>
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={!canReview} style={!canReview ? { opacity: .5, cursor: "not-allowed" } : null} onClick={() => setStep(2)}>
                Review &amp; preview <I.arrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setStep(1)}><I.arrowRight size={15} style={{ transform: "rotate(180deg)" }} /> Back</button>
              <button className="btn primary" onClick={send}>
                <I.send size={15} /> {schedule === "now" ? "Send campaign" : "Queue campaign"} ({recipients.length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

window.NewCampaignModal = NewCampaignModal;
