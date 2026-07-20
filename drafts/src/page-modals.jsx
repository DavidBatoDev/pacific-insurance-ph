// Pacific Insurance PH — Page modals (Prospect, Client, Policy, Renewal, Claim, Travel)
const { useState: useStatePM2, useMemo: useMemoPM2 } = React;
const NS = window.NAShared;
const { Field: PF, TextInput: PTI, Textarea: PTA, Select: PSEL, Currency: PCUR, YesNo: PYN, MultiChips: PMC, FileDrop: PFD, ageFromDob: pAge } = NS;
const PO = NS.NA_OPTS;
const PMData = window.PData;

/* ---------- Shared drawer shell ---------- */
function FormDrawer({ icon, title, sub, wide, onClose, children, footer }) {
  const Ico = I[icon] || I.fileText;
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className={"drawer" + (wide ? " wide" : "")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><Ico size={20} /></div>
          <div><h2>{title}</h2><div className="dh-sub">{sub}</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        <div className="drawer-foot">{footer}</div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Client search (links to existing client) ---------- */
function ClientSearch({ value, onSelect, label = "Search existing client", req }) {
  const [q, setQ] = useStatePM2("");
  const results = useMemoPM2(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return PMData.CLIENTS.filter((c) => c.name.toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || c.city.toLowerCase().includes(ql)).slice(0, 4);
  }, [q]);
  return (
    <PF label={label} req={req}>
      {value ? (
        <div className="client-result on" onClick={() => onSelect(null)}>
          <Avatar name={value.name} size={30} />
          <div style={{ flex: 1 }}><div className="cr-name">{value.name}</div><div className="cr-sub">{value.email} · {value.city}</div></div>
          <span className="badge green"><span className="b-dot"></span>Linked</span>
        </div>
      ) : (
        <>
          <div className="filter-search" style={{ width: "100%", height: 38, marginBottom: results.length ? 8 : 0 }}>
            <I.search size={16} />
            <input placeholder="Search by name, email, or city…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {results.map((c) => (
            <div key={c.email} className="client-result" onClick={() => { onSelect(c); setQ(""); }}>
              <Avatar name={c.name} size={30} />
              <div style={{ flex: 1 }}><div className="cr-name">{c.name}</div><div className="cr-sub">{c.email} · {c.policies} policies</div></div>
              <I.plus size={16} style={{ color: "var(--text-subtle)" }} />
            </div>
          ))}
        </>
      )}
    </PF>
  );
}

const fireToast = (title, sub) => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, sub } }));

// Identity registry for dedup (email = unique identity key; phone / name = fuzzy)
let PM_NEXT_RID = 503;
const normPhone = (p) => (p || "").replace(/[^0-9]/g, "");
const EXISTING_PHONES = ["639174826610", "639175550110", "639175550145"];
const existingEmails = () => PMData.CLIENTS.map((c) => c.email.toLowerCase());
const existingNames = () => PMData.CLIENTS.map((c) => c.name.toLowerCase());

/* ============ 1. NEW LEAD ============ */
function ProspectModal({ onClose }) {
  const [f, setF] = useStatePM2({ name: "", email: "", phone: "", interest: "", source: "", agent: window.Perms.person().name, notes: "", followDate: "", channel: "", estPremium: "", closeDate: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const email = f.email.trim().toLowerCase();
  const emailDup = email && existingEmails().includes(email);
  const nameDup = f.name.trim() && existingNames().includes(f.name.trim().toLowerCase());
  const phoneDup = f.phone.trim() && EXISTING_PHONES.includes(normPhone(f.phone));
  const fuzzyWarn = !emailDup && (nameDup || phoneDup);

  // Starting stage/status — optional; default New Lead / New. Application Started is NOT offered
  // (reached only via Convert to Application).
  const STAGE_DEFAULT_STATUS = { "New Lead": "New", "Contacted": "Attempted", "Discovery": "Connected", "Proposal": "Qualified", "Product Selected": "Qualified" };
  const [startStage, setStartStage] = useStatePM2("New Lead");
  const [startStatus, setStartStatus] = useStatePM2("New");
  const pickStage = (v) => { setStartStage(v); setStartStatus(STAGE_DEFAULT_STATUS[v] || "New"); }; // auto-default, still editable

  // Minimum to save (draft or create): name + one contact + product interest + assigned agent
  const canSave = f.name.trim() && (f.email.trim() || f.phone.trim()) && f.interest && f.agent && !emailDup;

  const save = () => {
    const rid = String(PM_NEXT_RID++).padStart(6, "0");
    const AGENT_KEY = { "Matt Nassr": "matt", "Eman Bondoc": "eman", "Joy Mercado": "joy", "Bea Lim": "bea", "Paolo Aquino": "paolo" };
    const owner = AGENT_KEY[f.agent] || "eman";
    const stage = startStage || "New Lead";
    const status = startStatus || "New";
    onClose();
    fireToast("Lead created", `${f.name} added · stage ${stage} · status ${status} · #${rid}${f.agent ? " · " + f.agent.split(" ")[0] : ""}.`);

    // Add the card to the Lead Lifecycle board (persists for the board + counts in funnel/KPIs)
    const fd = f.followDate ? Math.max(0, Math.round((new Date(f.followDate) - new Date()) / 86400000)) : 3;
    const boardLead = { id: Date.now(), rid, name: f.name.trim(), product: f.interest, staff: owner, stage, status, last: "New lead created", follow: fd, prio: "med", value: Number(f.estPremium) || 0, est_premium: Number(f.estPremium) || 0, expected_close_date: f.closeDate || new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10) };
    if (window.PPData && Array.isArray(window.PPData.PP_LEADS)) window.PPData.PP_LEADS.unshift(boardLead);
    window.dispatchEvent(new CustomEvent("lead-created", { detail: { lead: boardLead } }));

    window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: {
      _kind: "prospect", record_id: rid, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(),
      interest: f.interest, source: f.source, owner,
      channel: f.channel, stage: "Lead", pipeStage: stage, leadStatus: status,
    } } }));
  };
  return (
    <FormDrawer icon="trendUp" title="New lead" sub="Capture an early-stage lead or inquiry" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Create lead</button></>}>
      <div className="callout accent" style={{ marginBottom: 18 }}>
        <span className="co-ico"><I.trendUp size={16} /></span>
        <div>Creates a <b>unified contact</b> with a new <span className="mono">#record_id</span>, <b>lifecycle stage = Lead</b>, <b>lead_stage = New Lead</b> and <b>lead_status = New</b>. Email is the identity key — duplicates are blocked. Appears only on the Lead Lifecycle board until converted.</div>
      </div>
      <PF label="Name" req><PTI value={f.name} onChange={(v) => set("name", v)} placeholder="Full name" autoFocus /></PF>
      <div className="grid-2">
        <PF label="Email" hint="Identity key — at least one contact required"><PTI type="email" value={f.email} onChange={(v) => set("email", v)} placeholder="name@email.com" /></PF>
        <PF label="Phone"><PTI value={f.phone} onChange={(v) => set("phone", v)} placeholder="+63 9XX XXX XXXX" /></PF>
      </div>
      {emailDup && (
        <div className="callout" style={{ marginTop: -4, marginBottom: 16, borderColor: "var(--red-border)", background: "var(--red-soft)" }}>
          <span className="co-ico" style={{ color: "var(--red)" }}><I.alertTri size={16} /></span>
          <div><b style={{ color: "var(--red)" }}>Duplicate email — blocked.</b> A contact with <b>{f.email.trim()}</b> already exists. Open that record instead of creating a new one.</div>
        </div>
      )}
      {fuzzyWarn && (
        <div className="callout" style={{ marginTop: -4, marginBottom: 16, borderColor: "var(--amber-border)", background: "var(--amber-soft)" }}>
          <span className="co-ico" style={{ color: "var(--amber)" }}><I.alertTri size={16} /></span>
          <div><b style={{ color: "var(--amber)" }}>Possible duplicate.</b> {nameDup ? "The name" : "The phone number"} matches an existing contact. Review before creating — you can still proceed if this is a different person.</div>
        </div>
      )}
      <div className="grid-2">
        <PF label="Product interest" req><PSEL value={f.interest} onChange={(v) => set("interest", v)} options={["", "Health", "Group HMO", "Travel"]} /></PF>
        <PF label="Source"><PSEL value={f.source} onChange={(v) => set("source", v)} options={["", "Referral", "Personal network", "Business network", "Campaign", "Agent", "Website", "Social media"]} /></PF>
      </div>
      <div className="grid-2">
        <PF label="Assigned agent" req><PSEL value={f.agent} onChange={(v) => set("agent", v)} options={["", ...PO.agents]} /></PF>
        <PF label="Preferred channel"><PSEL value={f.channel} onChange={(v) => set("channel", v)} options={["", "Email", "WhatsApp", "Viber", "Phone"]} /></PF>
      </div>
      <PF label="Follow-up date" hint="Adds a reminder task to the dashboard"><PTI type="date" value={f.followDate} onChange={(v) => set("followDate", v)} /></PF>
      <div className="grid-2">
        <PF label="Starting stage" hint="Optional — default New Lead. Application Started is reached only via Convert.">
          <PSEL value={startStage} onChange={pickStage} options={["New Lead", "Contacted", "Discovery", "Proposal", "Product Selected"]} />
        </PF>
        <PF label="Starting status" hint="Auto-set from stage — editable">
          <PSEL value={startStatus} onChange={setStartStatus} options={["New", "Attempted", "Connected", "Qualified", "Nurturing", "Unresponsive"]} />
        </PF>
      </div>
      <PF label="Notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Discovery or initial notes" /></PF>
      <div className="grid-2">
        <PF label="Estimated premium" hint="Deal size — drives forecast value (set during Discovery / Proposal)"><PTI type="number" value={f.estPremium} onChange={(v) => set("estPremium", v)} placeholder="₱ annual premium" /></PF>
        <PF label="Expected close date" hint="When the lead is expected to convert — buckets the forecast"><PTI type="date" value={f.closeDate} onChange={(v) => set("closeDate", v)} /></PF>
      </div>
    </FormDrawer>
  );
}

/* ============ 2. ADD CLIENT ============ */
function ClientModal({ onClose }) {
  const [f, setF] = useStatePM2({ first: "", last: "", dob: "", email: "", phone: "", address: "", city: "", agent: window.Perms.person().name, status: "Active Client", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const canSave = f.first.trim() && f.last.trim() && (f.email.trim() || f.phone.trim()) && f.agent && f.status;
  const save = () => { onClose(); fireToast("Client created", `${f.first} ${f.last} added as ${f.status}.`); };
  const age = pAge(f.dob);
  return (
    <FormDrawer icon="users" title="Add client" sub="Create a direct client record in the main database" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Create client</button></>}>
      <div className="form-section">
        <div className="form-section-title">Client profile</div>
        <div className="grid-2">
          <PF label="First name" req><PTI value={f.first} onChange={(v) => set("first", v)} autoFocus /></PF>
          <PF label="Last name" req><PTI value={f.last} onChange={(v) => set("last", v)} /></PF>
        </div>
        <div className="grid-2">
          <PF label="Date of birth"><PTI type="date" value={f.dob} onChange={(v) => set("dob", v)} /></PF>
          <PF label="Age" hint="Auto-calculated"><input className="input" value={age !== "" ? age + " years" : ""} readOnly placeholder="—" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} /></PF>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title">Contact</div>
        <div className="grid-2">
          <PF label="Email" req><PTI type="email" value={f.email} onChange={(v) => set("email", v)} placeholder="name@email.com" /></PF>
          <PF label="Phone" req><PTI value={f.phone} onChange={(v) => set("phone", v)} placeholder="+63 9XX XXX XXXX" /></PF>
        </div>
        <div className="grid-2">
          <PF label="City"><PTI value={f.city} onChange={(v) => set("city", v)} placeholder="Makati City" /></PF>
          <PF label="Address"><PTI value={f.address} onChange={(v) => set("address", v)} placeholder="Street, barangay" /></PF>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title">Ownership & status</div>
        <div className="grid-2">
          <PF label="Assigned agent" req><PSEL value={f.agent} onChange={(v) => set("agent", v)} options={["", ...PO.agents]} /></PF>
          <PF label="Initial status" req><PSEL value={f.status} onChange={(v) => set("status", v)} options={["Active Client", "Policyholder", "Inactive", "Old / Migrated"]} /></PF>
        </div>
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Historical data (optional)</div>
        <PF label="Existing policies"><PFD label="Upload historical policy records" sub="For data migration · PDF or Excel" /></PF>
        <PF label="Internal notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Initial context for the client timeline" /></PF>
      </div>
    </FormDrawer>
  );
}

/* ============ 3. ISSUE POLICY ============ */
function PolicyModal({ onClose }) {
  const [f, setF] = useStatePM2({ client: null, linkApp: "", product: "", policyNo: "", start: "", expiry: "", premium: "", schedule: "", agent: window.Perms.person().name, sendPolicy: true, notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const canSave = f.client && f.product && f.policyNo.trim() && f.start && f.expiry && f.premium && f.schedule && f.agent;
  const save = () => { onClose(); fireToast("Policy issued", `${f.policyNo} for ${f.client.name} · renewal tasks scheduled.`); };
  return (
    <FormDrawer icon="shield" title="Issue policy" sub="Create an active policy or encode an existing record" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Issue policy</button></>}>
      <div className="form-section">
        <div className="form-section-title">Client & source</div>
        <ClientSearch value={f.client} onSelect={(c) => set("client", c)} req />
        <PF label="Link application" hint="Optional — pulls data from an approved application">
          <PSEL value={f.linkApp} onChange={(v) => set("linkApp", v)} options={["", "APP-2026-000129 — Diego Mercado", "APP-2026-000126 — Liza Gomez", "APP-2026-000123 — John Santos"]} />
        </PF>
      </div>
      <div className="form-section">
        <div className="form-section-title">Policy details</div>
        <div className="grid-2">
          <PF label="Product / plan" req><PSEL value={f.product} onChange={(v) => set("product", v)} options={["", "Select Plan", "Blue Royale", "BC Flexi HMO", "Family Shield", "Premier Health"]} /></PF>
          <PF label="Policy number" req><PTI value={f.policyNo} onChange={(v) => set("policyNo", v)} placeholder="POL-2026-XXXXX" /></PF>
          <PF label="Policy start date" req><PTI type="date" value={f.start} onChange={(v) => set("start", v)} /></PF>
          <PF label="Policy expiry date" req hint="Sets the renewal window"><PTI type="date" value={f.expiry} onChange={(v) => set("expiry", v)} /></PF>
          <PF label="Premium amount" req><PCUR value={f.premium} onChange={(v) => set("premium", v)} /></PF>
          <PF label="Payment schedule" req><PSEL value={f.schedule} onChange={(v) => set("schedule", v)} options={["", "Annual", "Semi-annual", "Deferred Credit Card"]} /></PF>
        </div>
      </div>
      <div className="form-section">
        <div className="form-section-title">Documents & ownership</div>
        <PF label="Upload policy & e-card" req><PFD label="Attach final policy documents" sub="PDF · policy contract + e-card" /></PF>
        <PF label="Assigned agent" req hint="Establishes commission owner"><PSEL value={f.agent} onChange={(v) => set("agent", v)} options={["", ...PO.agents]} /></PF>
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
          <div><div className="sr-label">Send policy to client?</div><div className="sr-sub">Triggers the policy delivery email template</div></div>
          <button className={"switch" + (f.sendPolicy ? " on" : "")} onClick={() => set("sendPolicy", !f.sendPolicy)}></button>
        </div>
        <PF label="Internal notes" ><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Context for operations" /></PF>
      </div>
    </FormDrawer>
  );
}

/* ============ 4. SEND NOTICES (Renewals) ============ */
function RenewalModal({ onClose }) {
  const POLS = [
    { id: "POL-2021-04412", name: "Ramon Velasco", email: "r.velasco@email.com", phone: "+63 917 555 0110", premium: 62000 },
    { id: "POL-2019-07734", name: "Grace Castillo", email: "grace.c@email.com", phone: "+63 917 555 0134", premium: 73000 },
    { id: "POL-2020-03345", name: "Cristina Flores", email: "cristina.f@email.com", phone: "+63 917 555 0145", premium: 110000 },
  ];
  const [f, setF] = useStatePM2({ policy: "", noticeType: "45-day reminder", premium: "", instructions: "", via: ["Email"], followDate: "", agent: window.Perms.person().name, notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const pol = POLS.find((p) => p.id === f.policy);
  const canSave = f.policy && f.noticeType && (f.premium || pol) && f.instructions.trim() && f.via.length && f.followDate && f.agent;
  const save = () => { onClose(); fireToast("Renewal notice sent", `${f.noticeType} sent to ${pol ? pol.name : "client"} via ${f.via.join(", ")}.`); };
  return (
    <FormDrawer icon="refresh" title="Send renewal notice" sub="Notify clients with policies nearing expiry" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Send notice</button></>}>
      <PF label="Select policy" req hint="Policies expiring within 45 days">
        <PSEL value={f.policy} onChange={(v) => { const p = POLS.find((x) => x.id === v); set("policy", v); if (p) set("premium", String(p.premium)); }} options={[{ v: "", l: "Select…" }, ...POLS.map((p) => ({ v: p.id, l: `${p.id} — ${p.name}` }))]} />
      </PF>
      {pol && (
        <div className="autofill-card">
          <div className="af-row"><span className="af-k">Client</span><span className="af-v">{pol.name}</span></div>
          <div className="af-row"><span className="af-k">Email</span><span className="af-v">{pol.email}</span></div>
          <div className="af-row"><span className="af-k">Phone</span><span className="af-v">{pol.phone}</span></div>
        </div>
      )}
      <div className="grid-2">
        <PF label="Renewal notice type" req><PSEL value={f.noticeType} onChange={(v) => set("noticeType", v)} options={["45-day reminder", "30-day reminder", "Grace Period alert"]} /></PF>
        <PF label="Renewal premium" req><PCUR value={f.premium} onChange={(v) => set("premium", v)} /></PF>
      </div>
      <PF label="Billing / payment instructions" req><PTA value={f.instructions} onChange={(v) => set("instructions", v)} placeholder="Custom instructions or standard template" /></PF>
      <PF label="Send communication via" req>
        <PMC selected={f.via} onToggle={(c) => set("via", f.via.includes(c) ? f.via.filter((x) => x !== c) : [...f.via, c])} options={["Email", "WhatsApp", "Viber"]} />
      </PF>
      <div className="grid-2">
        <PF label="Next follow-up date" req><PTI type="date" value={f.followDate} onChange={(v) => set("followDate", v)} /></PF>
        <PF label="Assigned agent" req><PSEL value={f.agent} onChange={(v) => set("agent", v)} options={["", ...PO.agents]} /></PF>
      </div>
      <PF label="Internal notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Records client response / sentiment" /></PF>
    </FormDrawer>
  );
}

/* ============ 5. FILE CLAIM ============ */
function ClaimModal({ onClose }) {
  const CLAIM_DOCS = {
    "Inpatient": ["Hospital bill / statement", "Medical abstract", "Valid ID", "Doctor's certificate"],
    "Outpatient": ["Official receipt", "Doctor's prescription", "Valid ID"],
    "Emergency": ["ER record", "Hospital bill", "Valid ID", "Incident report"],
    "Reimbursement": ["Official receipts", "Medical abstract", "Bank details", "Valid ID"],
  };
  const [f, setF] = useStatePM2({ client: null, policy: "", type: "", date: "", hospital: "", amount: "", status: "Pending", bankAvail: "", handler: window.Perms.person().name, submitPC: false, template: "", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const docs = CLAIM_DOCS[f.type] || [];
  const canSave = f.client && f.policy && f.type && f.date && f.status && f.handler;
  const save = () => { onClose(); fireToast("Claim filed", `${f.type} claim for ${f.client.name} · status ${f.status}.`); };
  return (
    <FormDrawer icon="clipboard" title="File a claim" sub="File and track a claim for a policyholder" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>File claim</button></>}>
      <div className="form-section">
        <div className="form-section-title">Client & policy</div>
        <ClientSearch value={f.client} onSelect={(c) => set("client", c)} req />
        <PF label="Policy" req hint="Active policies under the selected client">
          <PSEL value={f.policy} onChange={(v) => set("policy", v)} options={f.client ? ["", "POL-2024-11820 — Blue Royale", "POL-2023-09241 — Premier Health"] : [""]} disabled={!f.client} />
        </PF>
      </div>
      <div className="form-section">
        <div className="form-section-title">Claim details</div>
        <div className="grid-2">
          <PF label="Claim type" req><PSEL value={f.type} onChange={(v) => set("type", v)} options={["", "Inpatient", "Outpatient", "Emergency", "Reimbursement"]} /></PF>
          <PF label="Claim date" req><PTI type="date" value={f.date} onChange={(v) => set("date", v)} /></PF>
          <PF label="Hospital / clinic"><PTI value={f.hospital} onChange={(v) => set("hospital", v)} placeholder="Provider name" /></PF>
          <PF label="Claim amount"><PCUR value={f.amount} onChange={(v) => set("amount", v)} /></PF>
          <PF label="Claim status" req><PSEL value={f.status} onChange={(v) => set("status", v)} options={["Pending", "Under Review", "Additional Documents Required", "Approved"]} /></PF>
          <PF label="Assigned handler" req><PSEL value={f.handler} onChange={(v) => set("handler", v)} options={["", ...PO.agents]} /></PF>
        </div>
      </div>
      {docs.length > 0 && (
        <div className="form-section">
          <div className="form-section-title">Required documents (auto-generated)</div>
          <div className="req-list">
            {docs.map((d) => <div key={d} className="req-item"><div className="req-check"></div><div className="req-name">{d}</div><span className="type-tag">Pending</span></div>)}
          </div>
          <div style={{ marginTop: 10 }}><PFD /></div>
        </div>
      )}
      <div className="form-section">
        <div className="form-section-title">Reimbursement</div>
        <PF label="Bank details available?"><PYN value={f.bankAvail} onChange={(v) => set("bankAvail", v)} /></PF>
        {f.bankAvail === "Yes" && (
          <div className="grid-2">
            <PF label="Bank name"><PTI value={f.bankName} onChange={(v) => set("bankName", v)} placeholder="e.g. BPI" /></PF>
            <PF label="Account number"><PTI value={f.bankAcct} onChange={(v) => set("bankAcct", v)} placeholder="XXXX-XXXX-XX" /></PF>
          </div>
        )}
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <div><div className="sr-label">Submit to Pacific Cross?</div><div className="sr-sub">Prepares a submission task and email</div></div>
          <button className={"switch" + (f.submitPC ? " on" : "")} onClick={() => set("submitPC", !f.submitPC)}></button>
        </div>
        <PF label="Email template" ><PSEL value={f.template} onChange={(v) => set("template", v)} options={["", "Claim requirement request", "Additional documents needed", "Claim approved notice"]} /></PF>
        <PF label="Internal notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Adds notes to the client timeline" /></PF>
      </div>
    </FormDrawer>
  );
}

/* ============ 6. NEW TRAVEL QUOTE ============ */
// Official business payment channels (sourced from Settings — never a personal account)
const TRAVEL_CHANNELS = [
  "GCash for Business — Pacific Insurance PH",
  "Company Bank — BDO ••2841 (Pacific Insurance PH)",
  "Maya Business — Pacific Insurance PH",
];
// Single source of official channels — also consumed by the batch Send Payment Links modal (§12)
window.PAYMENT_CHANNELS = TRAVEL_CHANNELS;
let TRV_SEQ = 141;

function TravelModal({ onClose }) {
  const [ref] = useStatePM2(() => "TRV-2026-000" + (TRV_SEQ++));
  const [f, setF] = useStatePM2({
    mode: "new", client: null, name: "", email: "", phone: "", dob: "", passport: "",
    destination: "", departure: "", returnDate: "", plan: "", amount: "", agent: window.Perms.person().name,
    channel: TRAVEL_CHANNELS[0], instrSent: "", instrChannel: "Email",
    collection: "Pending", proof: false, ackReceipt: false,
    disbursement: "Not yet", portalRef: "", portal: "Not started",
    sendPolicy: false, template: "", notes: "",
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const age = pAge(f.dob);
  const days = NS.daysBetween(f.departure, f.returnDate);
  const received = f.collection === "Received";
  const issued = f.portal === "Issued";

  // Acknowledgment receipt auto-arms the moment collection is Received
  const ackOn = received && f.ackReceipt;

  const canSave = (f.mode === "new" ? f.name.trim() : f.client) && (f.email.trim() || f.phone.trim()) && f.destination && f.departure && f.returnDate && f.collection;

  const save = () => {
    onClose();
    const who = f.mode === "new" ? f.name : f.client.name;
    const key = (f.client && (f.client.record_id || f.client.name)) || f.name;
    const log = (entry) => window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key, name: who, entry: { actor: f.agent, time: "Just now", ...entry } } }));
    // Auto-log each completed step to the contact timeline (§5)
    if (f.instrSent === "Yes") log({ kind: "email", dir: "sent", title: "Travel payment instruction sent — " + ref, body: `Branded e-invoice via ${f.instrChannel} · ${f.channel.split(" — ")[0]}${f.amount ? " · " + PMData.peso(+f.amount) : ""}` });
    if (received) log({ kind: "payment", title: "Payment received (Collection) — " + ref, body: `Client → ${f.agent}${f.amount ? " · " + PMData.peso(+f.amount) : ""}${f.proof ? " · proof on file" : ""}` });
    if (ackOn) log({ kind: "doc", title: "Acknowledgment receipt issued — " + ref, body: "Branded receipt auto-sent to client (instant proof of payment)." });
    if (f.disbursement === "Prepaid") log({ kind: "payment", title: "Portal prepaid (Disbursement)", body: `${f.agent} → travel portal${f.portalRef ? " · ref " + f.portalRef : ""}` });
    if (issued && f.sendPolicy) log({ kind: "doc", title: "Travel policy delivered — " + f.destination, body: "Policy + e-card auto-delivered to client the moment the portal issued." });
    fireToast("Travel quote saved", `${who} · ${f.destination || "trip"} · ${ref} · Collection ${f.collection}.`);
  };

  return (
    <FormDrawer icon="plane" title="New travel quote" sub="Fast-track quote, two-leg payment tracking & portal processing" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Save travel quote</button></>}>

      <div className="callout accent" style={{ marginBottom: 18 }}>
        <span className="co-ico"><I.shield size={16} /></span>
        <div>Payment is tracked in <b>two legs</b> — <b>Collection</b> (client → {f.agent}) and <b>Disbursement</b> ({f.agent} → travel portal). Instructions go out as a <b>branded e-invoice</b> to an <b>official business channel</b>, and a receipt auto-issues on payment — so the personal-account ask stops being the trust blocker.</div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Traveler</div>
        <PF label="New or existing client" req>
          <div className="radio-cards">
            <div className={"radio-card" + (f.mode === "new" ? " on" : "")} onClick={() => set("mode", "new")}><span className="radio-dot"></span><div><div className="rc-title">New client</div><div className="rc-desc">Create a traveler record</div></div></div>
            <div className={"radio-card" + (f.mode === "existing" ? " on" : "")} onClick={() => set("mode", "existing")}><span className="radio-dot"></span><div><div className="rc-title">Existing client</div><div className="rc-desc">Link to a client profile</div></div></div>
          </div>
        </PF>
        {f.mode === "existing"
          ? <ClientSearch value={f.client} onSelect={(c) => { if (c) { const info = NS.existingClientInfo(c); setF((s) => ({ ...s, client: c, name: c.name, email: info.email, phone: info.mobile, dob: info.dob })); } else { setF((s) => ({ ...s, client: null, email: "", phone: "", dob: "" })); } }} req />
          : <PF label="Traveler full name" req><PTI value={f.name} onChange={(v) => set("name", v)} placeholder="Full name" /></PF>}
        {f.mode === "existing" && f.client ? (
          <div className="autofill-card">
            <div className="af-row"><span className="af-k">Email</span><span className="af-v">{f.email}</span></div>
            <div className="af-row"><span className="af-k">Mobile</span><span className="af-v">{f.phone}</span></div>
            <div className="af-row"><span className="af-k">Date of birth</span><span className="af-v">{f.dob} · {age} yrs</span></div>
          </div>
        ) : (
          <>
            <div className="grid-2">
              <PF label="Email" req><PTI type="email" value={f.email} onChange={(v) => set("email", v)} placeholder="name@email.com" /></PF>
              <PF label="Mobile number" req><PTI value={f.phone} onChange={(v) => set("phone", v)} placeholder="+63 9XX XXX XXXX" /></PF>
            </div>
            <div className="grid-2">
              <PF label="Date of birth" req><PTI type="date" value={f.dob} onChange={(v) => set("dob", v)} /></PF>
              <PF label="Age" hint="Eligibility: age 0–72"><input className="input" value={age !== "" ? age + " years" : ""} readOnly placeholder="—" style={{ background: "var(--surface-3)", color: age !== "" && age > 72 ? "var(--red)" : "var(--text-muted)" }} /></PF>
            </div>
            {age !== "" && age > 72 && <div className="mini-warn"><I.alertTri size={13} /> Age {age} exceeds the 0–72 travel eligibility band.</div>}
          </>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Trip & coverage</div>
        <div className="grid-3">
          <PF label="Destination" req><PTI value={f.destination} onChange={(v) => set("destination", v)} placeholder="e.g. Japan" /></PF>
          <PF label="Departure date" req><PTI type="date" value={f.departure} onChange={(v) => set("departure", v)} /></PF>
          <PF label="Return date" req><PTI type="date" value={f.returnDate} onChange={(v) => set("returnDate", v)} /></PF>
        </div>
        {days !== "" && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>Travel days: <b style={{ color: "var(--text)" }}>{days} days</b></div>}
        <div className="grid-2">
          <PF label="Plan / coverage"><PSEL value={f.plan} onChange={(v) => set("plan", v)} options={["", "Global Travel", "Smart Traveler", "Family Travel"]} /></PF>
          <PF label="Quote amount" req hint="Required before sending the instruction"><PCUR value={f.amount} onChange={(v) => set("amount", v)} /></PF>
        </div>
        <PF label="Passport number" hint="Required before portal processing"><PTI value={f.passport} onChange={(v) => set("passport", v)} placeholder="P1234567A" /></PF>
        <PFD label="Upload passport copy" sub="Required before portal processing" />
      </div>

      <div className="form-section">
        <div className="form-section-title">Quote & invoice</div>
        <div className="grid-2">
          <PF label="Quote / invoice ref" hint="System-generated — prints on the invoice & receipt"><input className="input mono" value={ref} readOnly style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} /></PF>
          <PF label="Assigned agent" req><PSEL value={f.agent} onChange={(v) => set("agent", v)} options={PO.agents} /></PF>
        </div>
        <PF label="Official payment channel" req hint="Business payee from Settings — never a personal account">
          <PSEL value={f.channel} onChange={(v) => set("channel", v)} options={TRAVEL_CHANNELS} />
        </PF>
        {f.amount && f.channel && (
          <div className="invoice-card">
            <div className="invoice-top">
              <div className="invoice-brand"><span className="invoice-logo"><I.shield size={15} /></span><div><div className="invoice-co">Pacific Insurance PH</div><div className="invoice-agent">{f.agent} · Travel Desk</div></div></div>
              <div className="invoice-ref">{ref}</div>
            </div>
            <div className="invoice-rows">
              <div className="invoice-row"><span>{f.plan || "Travel insurance"}{f.destination ? " · " + f.destination : ""}</span><span className="mono">{PMData.peso(+f.amount)}</span></div>
              <div className="invoice-row total"><span>Total due</span><span className="mono">{PMData.peso(+f.amount)}</span></div>
            </div>
            <div className="invoice-foot"><I.wallet size={12} /> Pay to: <b>{f.channel}</b></div>
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Leg 1 — Collection <span className="leg-tag">client → {f.agent}</span></div>
        <PF label="Payment instruction sent?" hint="Sends the branded e-invoice (company + agent + breakdown + ref)">
          <div className="grid-2">
            <PYN value={f.instrSent} onChange={(v) => set("instrSent", v)} />
            <PSEL value={f.instrChannel} onChange={(v) => set("instrChannel", v)} options={["Email", "WhatsApp", "Viber"]} />
          </div>
        </PF>
        <div className="grid-2">
          <PF label="Client payment (collection)" req><PSEL value={f.collection} onChange={(v) => set("collection", v)} options={["Pending", "Received"]} /></PF>
          <PF label="Acknowledgment receipt" hint="Auto-issues a branded receipt on Received">
            <label className={"toggle-row" + (received ? "" : " disabled")}>
              <button type="button" className={"switch" + (ackOn ? " on" : "")} disabled={!received} onClick={() => set("ackReceipt", !f.ackReceipt)}></button>
              <span>{ackOn ? "Receipt issued to client" : received ? "Issue receipt" : "Available once payment received"}</span>
            </label>
          </PF>
        </div>
        <PF label="Payment proof upload" hint="Stores the client's proof of payment (required before processing)">
          <label className="toggle-row"><button type="button" className={"switch" + (f.proof ? " on" : "")} onClick={() => set("proof", !f.proof)}></button><span>{f.proof ? "Proof of payment on file" : "Attach proof of payment"}</span></label>
        </PF>
        {received && <div className="mini-ok"><I.check size={13} /> Collection complete — {ackOn ? "branded receipt sent." : "toggle the receipt to send instant proof."}</div>}
      </div>

      <div className="form-section">
        <div className="form-section-title">Leg 2 — Disbursement & portal <span className="leg-tag">{f.agent} → portal</span></div>
        <div className="grid-2">
          <PF label="Portal payment (disbursement)" req hint="Required before the portal issues"><PSEL value={f.disbursement} onChange={(v) => set("disbursement", v)} options={["Not yet", "Prepaid"]} /></PF>
          <PF label="Portal reference" hint="Stored after prepay"><PTI value={f.portalRef} onChange={(v) => set("portalRef", v)} placeholder="Pacific Cross ref" /></PF>
        </div>
        <PF label="Portal processing status" req hint="Tracked after disbursement"><PSEL value={f.portal} onChange={(v) => set("portal", v)} options={["Not started", "Encoding in portal", "Awaiting portal issue", "Issued", "Failed"]} /></PF>
        <PFD label="Upload travel policy" sub="Required after the portal issues" />
        <PF label="Send policy to client?" hint="Auto-delivers policy + e-card the moment the portal issues (~10-min turnaround)">
          <label className={"toggle-row" + (issued ? "" : " disabled")}>
            <button type="button" className={"switch" + (issued && f.sendPolicy ? " on" : "")} disabled={!issued} onClick={() => set("sendPolicy", !f.sendPolicy)}></button>
            <span>{issued && f.sendPolicy ? "Policy + e-card auto-delivered" : issued ? "Deliver policy now" : "Available once portal has issued"}</span>
          </label>
        </PF>
      </div>

      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Communication</div>
        <PF label="Email template"><PSEL value={f.template} onChange={(v) => set("template", v)} options={["", ...(window.TemplatesStore ? window.TemplatesStore.names(true) : ["Travel insurance payment instruction", "Policy issued"])]} /></PF>
        <PF label="Internal notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Adds context to the timeline" /></PF>
      </div>
    </FormDrawer>
  );
}

/* ============ 7. UPLOAD DOCUMENT ============ */
function DocumentModal({ onClose }) {
  const [f, setF] = useStatePM2({ client: null, fileName: "", type: "", link: "", status: "Pending", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const c = f.client;
  const linkOpts = c ? [
    { v: "", l: "None — attach to contact only" },
    ...PMData.APPLICATIONS.filter((a) => a.client === c.name).map((a) => ({ v: a.id, l: "Application · " + a.id })),
    ...PMData.CLAIMS.filter((x) => x.client === c.name).map((x) => ({ v: x.id, l: "Claim · " + x.id })),
    ...PMData.RENEWALS.filter((r) => r.client === c.name).map((r) => ({ v: r.id, l: "Policy · " + r.id })),
  ] : [{ v: "", l: "Select a client first" }];
  const canSave = c && f.fileName.trim() && f.type && f.status;
  const save = () => {
    onClose();
    const key = c.record_id || c.name;
    const linkLabel = f.link ? (linkOpts.find((o) => o.v === f.link) || {}).l : "";
    window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key, name: c.name, entry: {
      kind: "doc", actor: "Eman Bondoc",
      title: "Document uploaded — " + f.type,
      body: f.fileName + (linkLabel ? " · linked to " + linkLabel : "") + " · " + f.status,
      time: "Just now",
    } } }));
    fireToast("Document uploaded", `${f.fileName} added to ${c.name}'s profile${f.link ? " · linked to a record" : ""}.`);
  };
  return (
    <FormDrawer icon="folder" title="Upload document" sub="Add a file to the repository and attach it to a contact" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Upload document</button></>}>
      <div className="callout accent" style={{ marginBottom: 18 }}>
        <span className="co-ico"><I.folder size={16} /></span>
        <div>Stores the file in the central repository, links it to the contact via <span className="mono">contact_id</span>, and logs a <b>Document uploaded</b> entry on their timeline.</div>
      </div>
      <PF label="File(s)" req><PFD label="Click to upload or drag files here" sub="PDF, JPG or PNG · up to 10 MB · multiple allowed" /></PF>
      <PF label="File name" req hint="Simulated file — type the document's file name"><PTI value={f.fileName} onChange={(v) => set("fileName", v)} placeholder="e.g. Valid ID.pdf" /></PF>
      <ClientSearch value={f.client} onSelect={(x) => { set("client", x); set("link", ""); }} req />
      <div className="grid-2">
        <PF label="Document type" req><PSEL value={f.type} onChange={(v) => set("type", v)} options={["", "ID", "Medical questionnaire", "Application form", "Contract", "Claim bill", "Travel itinerary", "Proof of payment", "Other"]} /></PF>
        <PF label="Status" req><PSEL value={f.status} onChange={(v) => set("status", v)} options={["Pending", "Verified", "Missing / Requested"]} /></PF>
      </div>
      <PF label="Link to record" hint="Optional — attach to a specific Application / Policy / Claim under this contact">
        <PSEL value={f.link} onChange={(v) => set("link", v)} options={linkOpts} disabled={!c} />
      </PF>
      <PF label="Internal notes"><PTA value={f.notes} onChange={(v) => set("notes", v)} placeholder="Adds context to the contact timeline" /></PF>
    </FormDrawer>
  );
}

/* ============ 9. ADVANCE LEAD (confirmation modal) ============ */
// The single confirmation step for EVERY lead stage/status change (drag OR nurture action).
// Nothing advances silently. Reuses the shared Engage composer for the "Also send…" step.
function AdvanceLeadModal({ lead, preset, onClose, onConfirm }) {
  const PPD = window.PPData;
  const p = preset || {};
  const [stage, setStage] = useStatePM2(p.stage || (lead.stage ? PPD.nextStage(lead.stage) : PPD.PP_STAGES[0]));
  const [status, setStatus] = useStatePM2(p.status || lead.status || "New");
  const [note, setNote] = useStatePM2("");
  const [follow, setFollow] = useStatePM2("");
  const [alsoSend, setAlsoSend] = useStatePM2(p.alsoSend || "");
  const [lost, setLost] = useStatePM2(false);
  const [estPrem, setEstPrem] = useStatePM2(lead.est_premium || lead.value || "");
  const [closeDate, setCloseDate] = useStatePM2(lead.expected_close_date || "");

  const stageChanged = !lost && stage !== lead.stage;
  const statusChanged = !lost && status !== lead.status;
  const toApplication = !lost && stage === "Application Started";
  const canConfirm = lost || ((stageChanged || statusChanged) && follow);

  const confirm = () => {
    onConfirm({ stage: lost ? "Lost" : stage, status, note, follow, lost, alsoSend, toApplication, est_premium: Number(estPrem) || 0, expected_close_date: closeDate });
    onClose();
  };

  const stageTone = (window.STAGE_TONE_LEAD && window.STAGE_TONE_LEAD[lead.stage]) || "slate";
  const stTone = PPD.PP_STATUS_TONE[lead.status] || "slate";

  return (
    <FormDrawer icon="trendUp" title="Advance lead" sub="Confirm the stage / status change — nothing moves silently"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!canConfirm} style={!canConfirm ? { opacity: .5, cursor: "not-allowed" } : null} onClick={confirm}>
          {lost ? "Mark lead lost" : toApplication ? "Confirm & convert" : "Confirm move"}
        </button></>}>

      {/* Read-only lead summary */}
      <div className="autofill-card" style={{ marginBottom: 18 }}>
        <div className="af-row"><span className="af-k">Lead</span><span className="af-v">{lead.name} <span className="mono" style={{ color: "var(--text-subtle)" }}>#{lead.rid || lead.record_id}</span></span></div>
        <div className="af-row"><span className="af-k">Current stage</span><span className="af-v">{lead.stage}</span></div>
        <div className="af-row"><span className="af-k">Current status</span><span className="af-v"><span className={"badge " + stTone}><span className="b-dot"></span>{lead.status}</span></span></div>
        {p.label && <div className="af-row"><span className="af-k">Triggered by</span><span className="af-v">{p.label}</span></div>}
      </div>

      <div className={"grid-2" + (lost ? " disabled-block" : "")} style={lost ? { opacity: .45, pointerEvents: "none" } : null}>
        <PF label="Stage" req hint="Pipeline milestone (Kanban column)"><PSEL value={stage} onChange={setStage} options={PPD.PP_STAGES} /></PF>
        <PF label="Status" req hint="Disposition — how contact is going"><PSEL value={status} onChange={setStatus} options={PPD.PP_STATUSES} /></PF>
      </div>

      <div className={"grid-2" + (lost ? " disabled-block" : "")} style={lost ? { opacity: .45, pointerEvents: "none" } : null}>
        <PF label="Estimated premium" hint="Deal size — drives raw + weighted forecast value"><PTI type="number" value={estPrem} onChange={setEstPrem} placeholder="₱ annual premium" /></PF>
        <PF label="Expected close date" hint="Buckets the forecast timeline"><PTI type="date" value={closeDate} onChange={setCloseDate} disabled={lost} /></PF>
      </div>

      {toApplication && (
        <div className="callout accent" style={{ marginTop: -2, marginBottom: 16 }}>
          <span className="co-ico"><I.arrowRight size={16} /></span>
          <div>Reaching <b>Application Started</b> is the hand-off: it advances <b>lifecycle_stage \u2192 Applicant</b>, launches the 6-step wizard pre-filled, and removes the card from the board.</div>
        </div>
      )}

      <PF label="Outcome note" hint="What happened on this touch — appended to the timeline"><PTA value={note} onChange={setNote} placeholder="e.g. Reached client, walked through Blue Royale coverage…" /></PF>

      <PF label={"Next follow-up" + (lost ? "" : " *")} hint={lost ? "Not required for a lost lead" : "Schedules the next task on the board / dashboard"}>
        <PTI type="date" value={follow} onChange={setFollow} disabled={lost} />
      </PF>

      <PF label="Also send…" hint="Optional — fire a template through the shared composer in this same step">
        <PSEL value={alsoSend} onChange={setAlsoSend} options={["", "Send Brochure", "Send Intake / Application Form", "Send Email", "Send Payment Instruction"]} disabled={lost} />
      </PF>

      <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", marginTop: 4 }}>
        <div><div className="sr-label">Mark Lost</div><div className="sr-sub">Sets lifecycle_stage = Lost (retained for re-nurture) instead of advancing</div></div>
        <button className={"switch" + (lost ? " on" : "")} onClick={() => setLost(!lost)}></button>
      </div>

      <div className="callout" style={{ marginTop: 16, marginBottom: 0 }}>
        <span className="co-ico"><I.refresh size={15} /></span>
        <div>On confirm: move the card, recompute the funnel + KPI counts, schedule the follow-up, and log
          {lost ? <> <b>Marked Lost</b></> : <> {stageChanged && <b>Stage changed</b>}{stageChanged && statusChanged && " + "}{statusChanged && <b>Status changed</b>}{!stageChanged && !statusChanged && <b>the touch</b>}</>} to {lead.name}'s timeline.</div>
      </div>
    </FormDrawer>
  );
}
window.AdvanceLeadModal = AdvanceLeadModal;

/* ---------- Router ---------- */
function PageModals({ modal, onClose }) {
  if (!modal) return null;
  const map = { prospect: ProspectModal, client: ClientModal, policy: PolicyModal, renewal: RenewalModal, claim: ClaimModal, travel: TravelModal, document: DocumentModal, paymentLinks: window.PaymentLinksModal, newCampaign: window.NewCampaignModal, addTask: window.AddTaskModal };
  const M = map[modal];
  return M ? <M onClose={onClose} /> : null;
}

window.PageModals = PageModals;
