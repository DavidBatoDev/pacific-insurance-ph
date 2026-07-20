// Pacific Insurance PH — Email Templates module (single source for every composer)
const { useState: useStateTPL } = React;

// Merge-field driven templates. Bodies use {{first_name}} {{product}} {{premium}} {{agent}}.
const SEED_TEMPLATES = [
  { id: 1, name: "New inquiry response", channel: "Email", active: true,
    subject: "Thank you for your interest in Pacific Insurance PH",
    body: "Hi {{first_name}},\n\nThank you for reaching out about {{product}}. I'd be glad to walk you through your options and answer any questions.\n\nWhen would be a good time for a short call this week?\n\nBest regards,\n{{agent}}\nPacific Insurance PH" },
  { id: 2, name: "Send brochure", channel: "Email", active: true,
    subject: "{{product}} — plan details & brochure",
    body: "Hi {{first_name}},\n\nAs promised, please find attached the brochure for {{product}}. It covers the benefits, coverage limits, and premium options.\n\nLet me know if you'd like me to prepare a personalized proposal.\n\nBest regards,\n{{agent}}" },
  { id: 3, name: "Send application form", channel: "Email", active: true,
    subject: "Your {{product}} application form",
    body: "Hi {{first_name}},\n\nAttached is the application form for {{product}}. Please complete the highlighted sections and return it with a valid ID.\n\nYou can also fill out our secure intake form here: [intake link]\n\nHappy to help if you have any questions.\n\n{{agent}}" },
  { id: 4, name: "Request missing documents", channel: "Email", active: true,
    subject: "A few documents to complete your application",
    body: "Hi {{first_name}},\n\nTo move your {{product}} application forward, we still need the following:\n\n- (documents will be listed here)\n\nYou can reply with clear photos or scans. Thank you!\n\n{{agent}}" },
  { id: 5, name: "Payment instruction", channel: "Email", active: true,
    subject: "Payment instructions for your {{product}} policy",
    body: "Hi {{first_name}},\n\nYour proposal for {{product}} is ready. The premium is {{premium}}.\n\nHere are your payment options and instructions:\n\n- (payment details)\n\nOnce paid, kindly send the proof of payment and we'll process your policy right away.\n\n{{agent}}" },
  { id: 6, name: "Proof of payment follow-up", channel: "Email", active: true,
    subject: "Following up on your {{product}} payment",
    body: "Hi {{first_name}},\n\nJust following up on the payment for your {{product}} plan ({{premium}}). If you've already paid, please share the proof of payment so we can finalize your coverage.\n\nThank you!\n{{agent}}" },
  { id: 7, name: "Policy issued", channel: "Email", active: true,
    subject: "Your {{product}} policy is now active",
    body: "Hi {{first_name}},\n\nGreat news — your {{product}} policy has been issued and is now active. Your policy documents and e-card are attached.\n\nPlease keep these for your records. Reach out anytime if you need assistance.\n\n{{agent}}" },
  { id: 8, name: "Renewal reminder", channel: "Email", active: true,
    subject: "Time to renew your {{product}} policy",
    body: "Hi {{first_name}},\n\nYour {{product}} policy is up for renewal. The renewal premium is {{premium}}.\n\nTo keep your coverage continuous, please settle before the expiry date. I can send a payment link right away — just let me know.\n\n{{agent}}" },
  { id: 9, name: "Claim requirement request", channel: "Email", active: true,
    subject: "Documents needed for your claim",
    body: "Hi {{first_name}},\n\nWe've received your claim under your {{product}} policy. To proceed, please submit the following requirements:\n\n- (claim documents)\n\nOnce complete, we'll forward everything to the provider.\n\n{{agent}}" },
  { id: 10, name: "Travel insurance payment instruction", channel: "Email", active: true,
    subject: "Payment link for your travel insurance",
    body: "Hi {{first_name}},\n\nYour travel insurance quote is ready ({{premium}}). Please use the secure payment link below to confirm coverage before departure:\n\n- (payment link)\n\nSafe travels!\n{{agent}}" },
  { id: 11, name: "Birthday greeting", channel: "Email", active: true,
    subject: "Happy birthday, {{first_name}}! 🎉",
    body: "Hi {{first_name}},\n\nHappy birthday from all of us at Pacific Insurance PH! We're grateful to have you in the family and hope your day is wonderful.\n\nAs always, we're here whenever you need us — your {{product}} coverage keeps you and your loved ones protected all year round.\n\nWarmest wishes,\n{{agent}}\nPacific Insurance PH" },
  { id: 12, name: "Anniversary greeting", channel: "Email", active: true,
    subject: "Celebrating another year together, {{first_name}}",
    body: "Hi {{first_name}},\n\nToday marks another year of your partnership with Pacific Insurance PH — thank you for your continued trust. It's a privilege to help protect what matters most to you.\n\nIf there's ever anything we can do for you, or coverage you'd like to review, I'm just one message away.\n\nHere's to many more years together,\n{{agent}}" },
  { id: 13, name: "Loyalty / thank-you", channel: "Email", active: true,
    subject: "A thank-you for your loyalty, {{first_name}}",
    body: "Hi {{first_name}},\n\nWe just wanted to say thank you for being a valued client of Pacific Insurance PH. Your loyalty means the world to us.\n\nAs a token of appreciation, we'd love to review your {{product}} coverage and make sure you're getting the most from your plan — and share any loyalty perks you may qualify for.\n\nWith gratitude,\n{{agent}}" },
  { id: 14, name: "Commission Voucher Request", channel: "Email", active: true,
    subject: "Commission voucher request — {{product}}",
    body: "Hi {{first_name}},\n\nMay I request the commission voucher for {{product}}? The client's payment has been confirmed and the Official Receipt is on file. Commission due is {{premium}}.\n\nPlease let me know if you need any further details to process it.\n\nThank you,\n{{agent}}\nPacific Insurance PH" },
  { id: 15, name: "Commission Follow-Up", channel: "Email", active: true,
    subject: "Follow-up — commission voucher for {{product}}",
    body: "Hi {{first_name}},\n\nJust following up on the commission voucher for {{product}} (commission {{premium}}). Could you share an update on where it stands?\n\nAppreciate your help — thank you!\n{{agent}}" },
  { id: 16, name: "Proposal / Quote Request", channel: "Email", active: true,
    subject: "Proposal request — {{product}} for {{first_name}}",
    body: "Hi Pacific Cross team,\n\nRequesting a proposal / quote for the following lead:\n\n- Client: {{first_name}}\n- Product: {{product}}\n- Target budget / est. premium: {{budget}}\n- Family size / dependents: {{family_size}}\n- Preferred coverage tier / room: {{coverage_tier}}\n\nKindly send the indicative quote and plan options at your earliest convenience.\n\nThank you,\n{{agent}}\nPacific Insurance PH" },
  { id: 17, name: "Proposal / Quote Delivery", channel: "Email", active: true,
    subject: "Your {{product}} proposal is ready, {{first_name}}",
    body: "Hi {{first_name}},\n\nGood news — your proposal for {{product}} is ready. Based on what we discussed (budget {{budget}}, {{family_size}} to cover, {{coverage_tier}}), here are the recommended plan and premium options:\n\n- (proposal details attached)\n\nI'd be happy to walk you through it on a quick call. Let me know your thoughts!\n\nBest regards,\n{{agent}}\nPacific Insurance PH" },
];

const TemplatesStore = {
  templates: SEED_TEMPLATES.map((t) => ({ ...t })),
  list(activeOnly) { return activeOnly ? this.templates.filter((t) => t.active) : this.templates; },
  get(name) { return this.templates.find((t) => t.name === name) || null; },
  names(activeOnly) { return this.list(activeOnly).map((t) => t.name); },
  fill(str, ctx = {}) {
    const map = {
      first_name: ctx.first_name || "there",
      product: ctx.product || "your plan",
      premium: ctx.premium || "your premium",
      agent: ctx.agent || "Pacific Insurance PH",
      budget: ctx.budget || "to be confirmed",
      family_size: ctx.family_size || "to be confirmed",
      coverage_tier: ctx.coverage_tier || "to be confirmed",
    };
    return (str || "")
      .replace(/\{\{?\s*(first_name|name)\s*\}?\}/g, map.first_name)
      .replace(/\{\{?\s*product\s*\}?\}/g, map.product)
      .replace(/\{\{?\s*premium\s*\}?\}/g, map.premium)
      .replace(/\{\{?\s*budget\s*\}?\}/g, map.budget)
      .replace(/\{\{?\s*family_size\s*\}?\}/g, map.family_size)
      .replace(/\{\{?\s*coverage_tier\s*\}?\}/g, map.coverage_tier)
      .replace(/\{\{?\s*agent\s*\}?\}/g, map.agent);
  },
  update(id, patch) {
    this.templates = this.templates.map((t) => t.id === id ? { ...t, ...patch } : t);
    return this.templates;
  },
};
window.TemplatesStore = TemplatesStore;

const MERGE_FIELDS = ["{{first_name}}", "{{product}}", "{{premium}}", "{{agent}}"];

/* ---------- Admin screen ---------- */
function TemplatesScreen() {
  const [rows, setRows] = useStateTPL(TemplatesStore.templates);
  const [selId, setSelId] = useStateTPL(TemplatesStore.templates[0].id);
  const sel = rows.find((t) => t.id === selId) || rows[0];

  const commit = (patch) => {
    const next = TemplatesStore.update(sel.id, patch);
    setRows([...next]);
  };

  const activeCount = rows.filter((t) => t.active).length;

  return (
    <div className="fade-in" data-screen-label="Email Templates">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.mail size={19} /></span>Email Templates
          </h1>
          <p className="sub">One source of truth for outbound copy — reused by the Contact Profile composer, the application wizard, and every send-enabled modal.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><I.plus size={15} /> New template</button>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat-mini"><div className="sm-val tnum">{rows.length}</div><div className="sm-label">Templates</div></div>
        <div className="stat-mini"><div className="sm-val tnum" style={{ color: "var(--accent)" }}>{activeCount}</div><div className="sm-label">Active</div></div>
        <div className="stat-mini"><div className="sm-val tnum">4</div><div className="sm-label">Merge fields</div></div>
        <div className="stat-mini"><div className="sm-val tnum">3</div><div className="sm-label">Consumers wired</div></div>
      </div>

      <div className="tpl-grid">
        {/* List */}
        <div className="card tpl-list">
          <div className="card-head"><h3><I.folder size={16} style={{ color: "var(--text-muted)" }} /> Templates <span className="count-pill">{rows.length}</span></h3></div>
          <div className="tpl-list-body">
            {rows.map((t) => (
              <button key={t.id} className={"tpl-row" + (t.id === selId ? " on" : "")} onClick={() => setSelId(t.id)}>
                <div className="tpl-row-main">
                  <div className="tpl-row-name">{t.name}</div>
                  <div className="tpl-row-sub">{t.subject}</div>
                </div>
                <span className={"tpl-dot" + (t.active ? " on" : "")} title={t.active ? "Active" : "Inactive"}></span>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="card tpl-editor">
          <div className="card-head">
            <h3><I.mail size={16} style={{ color: "var(--text-muted)" }} /> {sel.name}</h3>
            <div className="switch-row" style={{ gap: 10 }}>
              <span className="sr-label" style={{ fontSize: 12.5 }}>{sel.active ? "Active" : "Inactive"}</span>
              <button className={"switch" + (sel.active ? " on" : "")} onClick={() => commit({ active: !sel.active })}></button>
            </div>
          </div>
          <div className="tpl-editor-body">
            <div className="grid-2">
              <div className="field"><label>Template name</label><input className="input" value={sel.name} onChange={(e) => commit({ name: e.target.value })} /></div>
              <div className="field"><label>Channel</label>
                <select className="select" value={sel.channel} onChange={(e) => commit({ channel: e.target.value })}>
                  <option>Email</option><option>WhatsApp</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Subject</label><input className="input" value={sel.subject} onChange={(e) => commit({ subject: e.target.value })} /></div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Body <span style={{ fontWeight: 500, color: "var(--text-subtle)", textTransform: "none", letterSpacing: 0 }}>· rich text with merge fields</span></label>
              <textarea className="textarea" style={{ minHeight: 220, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6 }} value={sel.body} onChange={(e) => commit({ body: e.target.value })}></textarea>
            </div>
            <div className="tpl-merge">
              <span className="tpl-merge-label">Insert merge field:</span>
              {MERGE_FIELDS.map((m) => (
                <button key={m} className="tpl-chip" onClick={() => commit({ body: sel.body + " " + m })}>{m}</button>
              ))}
            </div>
            <div className="tpl-preview">
              <div className="tpl-preview-label">Preview — merged for Grace Castillo · Maxicare Plus</div>
              <div className="tpl-preview-subj">{TemplatesStore.fill(sel.subject, { first_name: "Grace", product: "Maxicare Plus", premium: "₱73,000", agent: "Eman Bondoc" })}</div>
              <div className="tpl-preview-body">{TemplatesStore.fill(sel.body, { first_name: "Grace", product: "Maxicare Plus", premium: "₱73,000", agent: "Eman Bondoc" })}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TemplatesScreen = TemplatesScreen;
