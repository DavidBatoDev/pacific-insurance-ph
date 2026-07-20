// Pacific Insurance PH — Contact Profile (single record view)
const { useState: useStateCP, useEffect: useEffectCP, useRef: useRefCP } = React;
const CPD = window.PData;
const CPShared = window.NAShared;
const { Field: CPField, TextInput: CPInput, Textarea: CPArea, Select: CPSelect } = CPShared;

// ---- Rich showcase contact (unified record, Renewal stage) ----
const GRACE = {
  record_id: "000482",
  name: "Grace Castillo",
  email: "grace.c@email.com",            // identity / Lead ID (unique)
  phone: "+63 917 482 6610",
  channel: "WhatsApp",
  source: "Referral",
  interest: "Health",
  owner: "eman",
  stage: "Renewal",
  tier: "Silver",
  dob: "1984-03-12",
  birthday: "Mar 12",
  address: "Unit 14B, Cebu Business Park, Cebu City",
  created: "Feb 2, 2020",
  renewalDueDays: -1,                     // overdue → red banner
  renewalPolicy: "Maxicare Plus (POL-2019-07734)",
  earlyPayer: false,
  lifetimeValue: 168000,
  groupMembership: null,                  // individual → no group panel
  applications: [
    { code: "APP-2020-000318", product: "Maxicare Plus", status: "Approved", amount: 73000 },
  ],
  policies: [
    { no: "POL-2019-07734", product: "Maxicare Plus", status: "Active", amount: 73000 },
  ],
  renewals: [
    { policy: "Maxicare Plus", date: "Jun 9, 2026", status: "Overdue", amount: 73000 },
  ],
  claims: [
    { no: "CLM-2024-00412", status: "Approved", amount: 21500 },
  ],
  documents: [
    { name: "Valid ID — Passport", type: "ID", status: "Verified" },
    { name: "2019 Application form", type: "Application", status: "Verified" },
    { name: "Renewal notice (2026)", type: "Notice", status: "Received" },
  ],
};

// Grace's timeline seed (reverse chronological)
const GRACE_TIMELINE = [
  { id: 6, kind: "status", actor: "System", title: "Stage changed — Policyholder → Renewal", body: "Maxicare Plus entered its renewal window.", time: "Jun 2, 2026 · 9:04 AM" },
  { id: 5, kind: "email", dir: "sent", actor: "Eman Bondoc", title: "Renewal reminder sent", body: "Hi Grace, your Maxicare Plus policy is up for renewal on Jun 9…", time: "Jun 2, 2026 · 9:05 AM" },
  { id: 4, kind: "call", actor: "Eman Bondoc", title: "Call logged — No answer", body: "Called re: renewal, left voicemail. Will follow up on WhatsApp.", time: "Jun 4, 2026 · 2:12 PM" },
  { id: 3, kind: "email", dir: "received", actor: "Grace Castillo", title: "Reply received", body: "Hi Eman, I'll settle it this week. Can you resend the payment link?", time: "Jun 5, 2026 · 8:41 AM" },
  { id: 2, kind: "doc", actor: "Grace Castillo", title: "Document uploaded — Renewal notice (2026)", body: "Signed renewal notice returned via WhatsApp screenshot.", time: "Jun 6, 2026 · 11:20 AM" },
  { id: 1, kind: "note", actor: "Eman Bondoc", title: "Note added", body: "Grace prefers WhatsApp. Overdue by 1 day — nudge gently, she always pays.", time: "Jun 10, 2026 · 10:02 AM" },
].reverse();
GRACE.timeline = GRACE_TIMELINE;

// ---- Build a full contact record from a clicked-row/card seed ----
const PIPE_TO_STAGE = {
  "New Lead": "Lead", "Contacted": "Lead", "Discovery": "Lead", "Proposal": "Lead", "Product Selected": "Lead",
  "Application Started": "Applicant", "Converted": "Applicant", "Lost": "Lost",
};
const hash = (s) => (s || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
const interestFromProduct = (p) => /travel/i.test(p || "") ? "Travel" : /flexi|hmo|group/i.test(p || "") ? "Group HMO" : "Health";

function buildContactRecord(seed) {
  if (!seed || (seed.email && seed.email === GRACE.email) || (seed.name && seed.name === GRACE.name)) return GRACE;

  const h = hash(seed.name);
  const rid = seed.record_id || String(500 + (h % 480)).padStart(6, "0");
  const phone = seed.phone || `+63 917 ${String(200 + h % 700)} ${String(1000 + (h * 7) % 9000)}`;
  const email = seed.email || (seed.name || "lead").toLowerCase().replace(/[^a-z]+/g, ".") + "@email.com";
  const stage = seed.stage || (seed._kind === "client" ? (seed.status === "New" ? "Client" : "Policyholder") : (seed.pipeStage ? PIPE_TO_STAGE[seed.pipeStage] || "Lead" : "Lead"));
  const owner = seed.owner || "eman";
  const product = seed.product || "";
  const interest = seed.interest || interestFromProduct(product);
  const value = seed.value || 0;
  const dobYear = 1970 + (h % 30);
  const dob = seed.dob || `${dobYear}-${String(1 + h % 12).padStart(2, "0")}-${String(1 + h % 27).padStart(2, "0")}`;
  const isBook = stage === "Client" || stage === "Policyholder" || stage === "Renewal";

  const appCode = `APP-2026-000${300 + (h % 90)}`;
  const polNo = `POL-20${20 + (h % 5)}-0${1000 + (h % 8000)}`;

  const applications = isBook
    ? [{ code: appCode, product: product || "Health plan", status: "Approved", amount: value || 90000 }]
    : stage === "Applicant"
      ? [{ code: appCode, product: product || "Health plan", status: "Under Review", amount: value || 90000 }]
      : [];
  const policies = isBook ? [{ no: polNo, product: product || "Health plan", status: "Active", amount: value || 90000 }] : [];
  const renewals = stage === "Renewal" ? [{ policy: product || "Health plan", date: "Aug 1, 2026", status: "Notice Sent", amount: value || 90000 }] : [];
  const documents = isBook
    ? [{ name: "Valid ID", type: "ID", status: "Verified" }, { name: "Application form", type: "Application", status: "Verified" }]
    : interest ? [{ name: "Intake form", type: "Application", status: "Requested" }] : [];

  let timeline;
  if (isBook) {
    timeline = [
      { id: 1, kind: "status", actor: "System", title: `Stage — ${stage}`, body: `Contact record #${rid}.`, time: "Earlier" },
      { id: 2, kind: "payment", actor: "System", title: "Payment recorded", body: `Premium ${CPD.peso(value || 90000)} received.`, time: "Recently" },
      { id: 3, kind: "email", dir: "sent", actor: CPD.STAFF[owner].name, title: "Policy documents sent", body: "Delivered e-policy and welcome pack.", time: "Recently" },
    ];
  } else {
    timeline = [
      { id: 1, kind: "status", actor: "System", title: "Lead created", body: `Source: ${seed.source || "Referral"} · #${rid}.`, time: "Earlier" },
      { id: 2, kind: "email", dir: "received", actor: seed.name, title: "Inquiry received", body: `Interested in ${interest} coverage.`, time: "Recently" },
    ];
    // Started at a non-default stage → log an initial "Stage set" entry
    if (seed.pipeStage && seed.pipeStage !== "New Lead" && PIPE_TO_STAGE[seed.pipeStage] === "Lead") {
      timeline.push({ id: 4, kind: "status", actor: CPD.STAFF[owner].name, title: `Stage set — ${seed.pipeStage}`, body: `Lead started at ${seed.pipeStage} · status ${seed.leadStatus || "New"}.`, time: "Recently" });
    }
    if (seed.last) timeline.push({ id: 3, kind: "note", actor: CPD.STAFF[owner].name, title: "Note added", body: seed.last, time: "Recently" });
  }
  timeline = timeline.reverse();

  return {
    record_id: rid, name: seed.name || "New Lead", email, phone,
    channel: seed.channel || "Email", source: seed.source || "Referral", interest, product,
    owner, stage, tier: seed.tier || (isBook ? "Bronze" : null),
    leadStage: stage === "Lead" ? (seed.pipeStage && PIPE_TO_STAGE[seed.pipeStage] === "Lead" ? seed.pipeStage : "New Lead") : null,
    leadStatus: stage === "Lead" ? (seed.leadStatus || "New") : null,
    dob, birthday: new Date(dob).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    address: seed.city ? `${seed.city}, Philippines` : "—",
    created: seed.since ? `20${seed.since.slice(-2)}` : "Recently",
    renewalDueDays: stage === "Renewal" ? 24 : null,
    renewalPolicy: renewals[0] ? `${renewals[0].policy} (${polNo})` : "",
    earlyPayer: false, lifetimeValue: value, groupMembership: seed.groupMembership || (window.GroupsData && window.GroupsData.membershipOf(seed.name)) || null, represents: seed.represents || null,
    proposalStatus: seed.proposalStatus || null, proposalDecision: seed.proposalDecision || null,
    // Discovery fields (captured on the Log Call tab; est_premium + product_interest reuse existing fields)
    est_premium: seed.est_premium || seed.value || (isBook ? value : null),
    product_interest: seed.product_interest || null,
    family_size: seed.family_size || null,
    coverage_tier: seed.coverage_tier || null,
    applications, policies, renewals, claims: [], documents, timeline,
  };
}

const TL_META = {
  email: { icon: "mail", tone: "blue" },
  message: { icon: "download", tone: "green" },
  call: { icon: "phone", tone: "violet" },
  note: { icon: "doc2", tone: "slate" },
  doc: { icon: "folder", tone: "amber" },
  status: { icon: "refresh", tone: "green" },
  payment: { icon: "peso", tone: "green" },
  task: { icon: "checkSquare", tone: "violet" },
};

const STAGE_TONE = { Lead: "blue", Applicant: "violet", Client: "green", Policyholder: "green", Renewal: "amber", Lost: "slate" };

const TL_FILTERS = [
  { label: "All", kinds: null },
  { label: "Emails", kinds: ["email"] },
  { label: "Messages", kinds: ["message"] },
  { label: "Calls", kinds: ["call"] },
  { label: "Notes", kinds: ["note"] },
  { label: "Documents", kinds: ["doc"] },
  { label: "Status", kinds: ["status"] },
  { label: "Payments", kinds: ["payment"] },
];

// ---- Left: property row ----
function PropRow({ label, children, mono }) {
  return (
    <div className="cp-prop">
      <div className="cp-prop-k">{label}</div>
      <div className={"cp-prop-v" + (mono ? " mono" : "")}>{children}</div>
    </div>
  );
}

// ---- Center: engagement composer (reuses wizard email-template component) ----
const CALL_OUTCOMES = ["Reached", "No answer", "Voicemail", "Wrong number"];
const CALL_INTERESTS = ["", "Health (Select / Blue Royale)", "Group HMO", "Travel"];
const CALL_TIERS = ["", "Standard / Ward", "Semi-private room", "Private room", "Suite / Executive"];
function Composer({ contact, onLog, onCall, discovery }) {
  const [tab, setTab] = useStateCP("Email");
  const rootRef = React.useRef(null);
  // Single source of truth for Log Call: header button + nurture-rail chip both fire this to focus the tab.
  useEffectCP(() => {
    const focusTab = (e) => {
      const t = (e.detail && e.detail.tab) || "Log Call";
      setTab(t);
      if (e.detail && e.detail.template != null) applyTemplate(e.detail.template);
      requestAnimationFrame(() => { const el = rootRef.current; if (el) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight * 0.5) window.scrollBy({ top: r.top - 80, behavior: "smooth" }); } });
    };
    window.addEventListener("cp-composer-tab", focusTab);
    return () => window.removeEventListener("cp-composer-tab", focusTab);
  }, []);
  const owner = CPD.STAFF[contact.owner].name;
  const acting = window.Perms.person().name; // the logged-in user does the sending

  // Email state (mirrors New Application Step 5 template-send behavior)
  const [tpl, setTpl] = useStateCP("");
  const [recipient, setRecipient] = useStateCP(contact.email);
  const [subject, setSubject] = useStateCP("");
  const [body, setBody] = useStateCP("");
  const applyTemplate = (t) => {
    setTpl(t);
    const store = window.TemplatesStore;
    const seed = store && store.get(t);
    if (seed) {
      const cx = { first_name: contact.name.split(" ")[0], product: (contact.renewalPolicy || "").split(" (")[0] || contact.product || (contact.interest ? contact.interest + " plan" : "your plan"), premium: contact.lifetimeValue ? CPD.peso(contact.lifetimeValue) : "your premium", agent: acting,
        budget: discovery && discovery.est_premium ? CPD.peso(Number(discovery.est_premium) || discovery.est_premium) : "", family_size: (discovery && discovery.family_size) || "", coverage_tier: (discovery && discovery.coverage_tier) || "" };
      setSubject(store.fill(seed.subject, cx));
      setBody(store.fill(seed.body, cx));
    }
  };

  // Inbound message state
  const [msgChannel, setMsgChannel] = useStateCP(contact.channel || "WhatsApp");
  const [msgWhen, setMsgWhen] = useStateCP("");
  const [msgText, setMsgText] = useStateCP("");
  const [msgShot, setMsgShot] = useStateCP(null); // { name, url }
  const onShot = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setMsgShot({ name: file.name, url: e.target.result });
    reader.readAsDataURL(file);
  };

  // Call / Note / Task state
  const [callOutcome, setCallOutcome] = useStateCP("Reached");
  const [callBudget, setCallBudget] = useStateCP((discovery && discovery.est_premium) || "");
  const [callFamily, setCallFamily] = useStateCP((discovery && discovery.family_size) || "");
  const [callInterest, setCallInterest] = useStateCP((discovery && discovery.product_interest) || "");
  const [callTier, setCallTier] = useStateCP((discovery && discovery.coverage_tier) || "");
  const [callNote, setCallNote] = useStateCP("");
  const [callFollow, setCallFollow] = useStateCP("");
  const [note, setNote] = useStateCP("");
  const [taskTitle, setTaskTitle] = useStateCP("");
  const [taskOwner, setTaskOwner] = useStateCP(acting);
  const [taskDue, setTaskDue] = useStateCP("");

  const tabs = [
    { id: "Email", icon: "mail" }, { id: "Log Message", icon: "download" }, { id: "Log Call", icon: "phone" },
    { id: "Note", icon: "doc2" }, { id: "Task", icon: "checkSquare" },
  ];

  const send = () => {
    if (tab === "Email") {
      onLog({ kind: "email", dir: "sent", actor: acting, title: subject || "Email sent", body: (body || "").split("\n")[0], time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Email sent", sub: `${tpl || "Email"} sent to ${contact.name}.` } }));
      // Signal completion so a Lead's Contact Profile can chain into the Advance-Lead popup (parity with the drawer)
      const emailAction = tpl === "Send brochure" ? "Send Brochure" : "Send Email";
      window.dispatchEvent(new CustomEvent("engage-complete", { detail: { key: contact.record_id, name: contact.name, action: emailAction } }));
      if (tpl === "Proposal / Quote Delivery") window.dispatchEvent(new CustomEvent("cp-proposal-sent", { detail: { rid: contact.record_id } }));
      setTpl(""); setSubject(""); setBody("");
    } else if (tab === "Log Message") {
      onLog({ kind: "message", dir: "received", actor: contact.name, channel: msgChannel, title: `${msgChannel} message received`, body: msgText || (msgShot ? "Screenshot attached." : ""), shot: msgShot ? msgShot.url : null, shotName: msgShot ? msgShot.name : null, time: msgWhen ? new Date(msgWhen).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Message logged", sub: `Inbound ${msgChannel} message saved to ${contact.name}'s timeline.` } }));
      setMsgText(""); setMsgShot(null); setMsgWhen("");
    } else if (tab === "Log Call") {
      const reached = callOutcome === "Reached";
      onCall({ outcome: callOutcome, budget: reached ? callBudget : "", family: reached ? callFamily : "", interest: reached ? callInterest : "", tier: reached ? callTier : "", notes: callNote, followUp: callFollow });
      setCallNote(""); setCallFollow("");
    } else if (tab === "Note") {
      onLog({ kind: "note", actor: acting, title: "Note added", body: note, time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Note added", sub: `Private note saved to timeline.` } }));
      setNote("");
    } else if (tab === "Task") {
      onLog({ kind: "task", actor: acting, title: "Task created — " + (taskTitle || "Follow-up"), body: `Owner: ${taskOwner}${taskDue ? " · Due " + new Date(taskDue).toLocaleDateString("en-PH") : ""}`, time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Task created", sub: `Assigned to ${taskOwner}.` } }));
      setTaskTitle(""); setTaskDue("");
    }
  };

  const sendLabel = { "Email": "Send email", "Log Message": "Log message", "Log Call": "Save call", "Note": "Save note", "Task": "Create task" }[tab];
  const O = CPShared.NA_OPTS;

  return (
    <div className="cp-composer" ref={rootRef}>
      <div className="cp-tabs">
        {tabs.map((t) => {
          const Ico = I[t.icon];
          return (
            <button key={t.id} className={"cp-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
              <Ico size={15} />{t.id}
            </button>
          );
        })}
      </div>

      <div className="cp-composer-body">
        {tab === "Email" && (
          <>
            <div className="grid-2">
              <CPField label="Email template" req><CPSelect value={tpl} onChange={applyTemplate} options={["", ...(window.TemplatesStore ? window.TemplatesStore.names(true) : O.emailTemplates)]} /></CPField>
              <CPField label="Recipient" req><CPInput type="email" value={recipient} onChange={setRecipient} /></CPField>
            </div>
            <CPField label="Subject"><CPInput value={subject} onChange={setSubject} placeholder="Pick a template to auto-fill…" /></CPField>
            <CPField label="Message"><CPArea value={body} onChange={setBody} style={{ minHeight: 120 }} placeholder="Message body — editable before sending." /></CPField>
            <div className="mail-preview">
              <div className="mail-preview-label"><I.mail size={13} /> Preview</div>
              <div className="mail-card">
                <div className="mail-head">
                  <div className="mail-avatar"><Avatar name={acting} size={34} /></div>
                  <div className="mail-meta">
                    <div className="mail-from">{acting} <span className="mail-addr">· Pacific Insurance PH</span></div>
                    <div className="mail-to">To: {recipient || contact.name}</div>
                  </div>
                </div>
                <div className="mail-subject">{subject || <span className="mail-placeholder">No subject yet — pick a template above</span>}</div>
                <div className="mail-body">{body ? body : <span className="mail-placeholder">Message body will appear here.</span>}</div>
              </div>
            </div>
          </>
        )}
        {tab === "Log Message" && (
          <>
            <div className="grid-2">
              <CPField label="Channel" req><CPSelect value={msgChannel} onChange={setMsgChannel} options={["WhatsApp", "Viber", "iMessage", "SMS", "Messenger", "Email"]} /></CPField>
              <CPField label="Received"><CPInput type="datetime-local" value={msgWhen} onChange={setMsgWhen} /></CPField>
            </div>
            <CPField label="Screenshot">
              <label className="cp-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onShot(e.dataTransfer.files[0]); }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onShot(e.target.files[0])} />
                {msgShot ? (
                  <div className="cp-drop-preview">
                    <img src={msgShot.url} alt="" />
                    <div className="cp-drop-meta"><div className="cp-drop-name">{msgShot.name}</div><div className="cp-drop-hint">Click to replace</div></div>
                    <button className="cp-drop-x" onClick={(ev) => { ev.preventDefault(); setMsgShot(null); }}><I.plus size={15} style={{ transform: "rotate(45deg)" }} /></button>
                  </div>
                ) : (
                  <div className="cp-drop-empty"><I.upload size={20} /><div>Drop a chat screenshot or <b>browse</b></div><span>WhatsApp · Viber · iMessage · PNG / JPG</span></div>
                )}
              </label>
            </CPField>
            <CPField label="Message / transcript"><CPArea value={msgText} onChange={setMsgText} style={{ minHeight: 90 }} placeholder="Paste or summarize what the client sent…" /></CPField>
          </>
        )}
        {tab === "Log Call" && (
          <>
            <CPField label="Outcome" req><CPSelect value={callOutcome} onChange={setCallOutcome} options={CALL_OUTCOMES} /></CPField>
            {callOutcome === "Reached" && (
              <>
                <div className="grid-2">
                  <CPField label="Budget / est. premium"><CPInput type="number" value={callBudget} onChange={setCallBudget} placeholder="₱ annual premium" /></CPField>
                  <CPField label="Family size / dependents"><CPInput type="number" value={callFamily} onChange={setCallFamily} placeholder="# people to cover" /></CPField>
                </div>
                <div className="grid-2">
                  <CPField label="Product interest"><CPSelect value={callInterest} onChange={setCallInterest} options={CALL_INTERESTS} /></CPField>
                  <CPField label="Coverage tier / room"><CPSelect value={callTier} onChange={setCallTier} options={CALL_TIERS} /></CPField>
                </div>
              </>
            )}
            <CPField label="Call notes"><CPArea value={callNote} onChange={setCallNote} placeholder={callOutcome === "Reached" ? "Anything the fields above don't capture…" : "What happened on the attempt…"} /></CPField>
            <CPField label="Next follow-up"><CPInput type="date" value={callFollow} onChange={setCallFollow} /></CPField>
            {callOutcome === "Reached" &&
              <div className="cp-discovery-hint"><I.check size={12} /> Structured discovery writes to the record — budget &amp; product interest carry into Convert to Application.</div>}
          </>
        )}
        {tab === "Note" && (
          <CPField label="Internal note"><CPArea value={note} onChange={setNote} style={{ minHeight: 110 }} placeholder="Free-text note visible to the team only…" /></CPField>
        )}
        {tab === "Task" && (
          <>
            <CPField label="Task" req><CPInput value={taskTitle} onChange={setTaskTitle} placeholder="e.g. Follow up on renewal payment" /></CPField>
            <div className="grid-2">
              <CPField label="Owner" req><CPSelect value={taskOwner} onChange={setTaskOwner} options={O.agents} /></CPField>
              <CPField label="Due date"><CPInput type="datetime-local" value={taskDue} onChange={setTaskDue} /></CPField>
            </div>
          </>
        )}
      </div>

      <div className="cp-composer-foot">
        <span className="cp-hitl"><I.alertTri size={13} /> Human-in-the-loop — nothing sends automatically</span>
        <button className="btn primary sm" onClick={send}><I.send size={14} /> {sendLabel}</button>
      </div>
    </div>
  );
}

// ---- Center: timeline ----
function Timeline({ entries }) {
  const [filter, setFilter] = useStateCP("All");
  const active = TL_FILTERS.find((f) => f.label === filter);
  const view = active.kinds ? entries.filter((e) => active.kinds.includes(e.kind)) : entries;
  return (
    <div className="cp-timeline-wrap">
      <div className="cp-tl-filters">
        {TL_FILTERS.map((f) => (
          <button key={f.label} className={"chip" + (filter === f.label ? " on" : "")} onClick={() => setFilter(f.label)}>{f.label}</button>
        ))}
      </div>
      <div className="cp-timeline">
        {view.map((e) => {
          const m = TL_META[e.kind] || TL_META.note;
          const Ico = I[m.icon];
          return (
            <div className="cp-tl-item" key={e.id + e.title}>
              <div className="cp-tl-rail">
                <div className="cp-tl-dot" style={{ background: `var(--${m.tone}-soft)`, color: `var(--${m.tone})` }}><Ico size={14} /></div>
              </div>
              <div className="cp-tl-content">
                <div className="cp-tl-head">
                  <span className="cp-tl-title">{e.title}{(e.kind === "email" || e.kind === "message") && e.dir && <span className={"cp-tl-tag " + (e.dir === "received" ? "in" : "out")}>{e.dir === "received" ? "Received" : "Sent"}</span>}</span>
                  <span className="cp-tl-time">{e.time}</span>
                </div>
                {e.body && <div className="cp-tl-body">{e.body}</div>}
                {e.shot && <img className="cp-tl-shot" src={e.shot} alt={e.shotName || "screenshot"} />}
                <div className="cp-tl-actor">{e.actor}</div>
              </div>
            </div>
          );
        })}
        {view.length === 0 && <div className="cp-empty">No {filter.toLowerCase()} yet.</div>}
      </div>
    </div>
  );
}

// ---- Right: associated records panel ----
function AssocPanel({ title, icon, count, addLabel, children }) {
  const Ico = I[icon];
  return (
    <div className="cp-assoc">
      <div className="cp-assoc-head">
        <span className="cp-assoc-title"><Ico size={15} />{title}<span className="cp-assoc-count">{count}</span></span>
        <button className="cp-assoc-add"><I.plus size={13} /></button>
      </div>
      <div className="cp-assoc-body">{children}</div>
    </div>
  );
}
function AssocRow({ code, sub, right }) {
  return (
    <div className="cp-assoc-row">
      <div className="cp-assoc-main">
        <div className="cp-assoc-code">{code}</div>
        {sub && <div className="cp-assoc-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// ---- Proposal tracking: stepper panel (right column) ----
const PROPOSAL_STEPS = ["Requested", "Received", "Sent", "Decision"];
function ProposalTrackingPanel({ status, decision, stamps, onRequest, onReceived, onDecision }) {
  const reachedIdx = status === "Sent" ? 2 : status === "Received" ? 1 : 0;
  const decided = !!decision;
  return (
    <div className="cp-assoc cp-proposal">
      <div className="cp-assoc-head">
        <span className="cp-assoc-title"><I.clipboard size={15} /> Proposal tracking</span>
        <span className="badge violet"><span className="b-dot"></span>{decision || status}</span>
      </div>
      <div className="cp-assoc-body">
        <div className="cp-prop-stepper">
          {PROPOSAL_STEPS.map((step, i) => {
            const isDecision = step === "Decision";
            const done = isDecision ? decided : i <= reachedIdx;
            const current = isDecision ? (status === "Sent" && !decided) : (i === reachedIdx && !(status === "Sent"));
            const label = isDecision ? (decision || "Decision") : step;
            const stamp = isDecision ? stamps.Decision : stamps[step];
            return (
              <div key={step} className={"cp-prop-step" + (done ? " done" : "") + (current ? " current" : "")}>
                <span className="cp-prop-step-dot">{done ? <I.check size={11} /> : i + 1}</span>
                <div className="cp-prop-step-txt">
                  <div className="cp-prop-step-label">{label}</div>
                  <div className="cp-prop-step-time">{stamp || (done ? "—" : "Pending")}</div>
                </div>
              </div>
            );
          })}
        </div>
        {status === "Requested" && <button className="btn sm" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={onReceived}><I.check size={14} /> Mark Received</button>}
        {status === "Requested" && <button className="btn sm ghost" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={onRequest}><I.clipboard size={13} /> Edit / email request</button>}
        {status === "Sent" && decided && (
          <div className="cp-prop-decision">
            <span className="cp-prop-decision-lbl">Decision</span>
            <div className="seg-ctrl">
              {["Awaiting Decision", "Negotiating"].map((d) => (
                <button key={d} className={"seg" + (decision === d ? " on" : "")} onClick={() => onDecision(d)}>{d === "Awaiting Decision" ? "Awaiting" : "Negotiating"}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Request Proposal: single merged modal (internal note + task, optional carrier email) ----
function ProposalRequestModal({ contact, discovery, agent, defaultFollow, onClose, onConfirm }) {
  const store = window.TemplatesStore;
  const [note, setNote] = useStateCP("");
  const [follow, setFollow] = useStateCP(defaultFollow || "");
  const [emailOn, setEmailOn] = useStateCP(false);
  const [recipient, setRecipient] = useStateCP("");
  const cx = {
    first_name: contact.name.split(" ")[0],
    product: contact.product || (contact.interest ? contact.interest + " plan" : "your plan"),
    budget: discovery && discovery.est_premium ? CPD.peso(Number(discovery.est_premium) || discovery.est_premium) : "",
    family_size: (discovery && discovery.family_size) || "",
    coverage_tier: (discovery && discovery.coverage_tier) || "",
    agent,
  };
  const seed = store && store.get("Proposal / Quote Request");
  const [subject, setSubject] = useStateCP(seed ? store.fill(seed.subject, cx) : "");
  const [body, setBody] = useStateCP(seed ? store.fill(seed.body, cx) : "");
  const canConfirm = !emailOn || (recipient.trim() && subject.trim());
  const submit = () => {
    if (!canConfirm) return;
    onConfirm({ note: note.trim(), follow, email: emailOn ? { recipient: recipient.trim(), subject, body } : null });
    onClose();
  };
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.clipboard size={20} /></div>
          <div><h2>Request Proposal</h2><div className="dh-sub">Log the request internally — optionally email the carrier too</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="autofill-card" style={{ marginBottom: 16 }}>
            <div className="af-row"><span className="af-k">Lead</span><span className="af-v">{contact.name} · #{contact.record_id}</span></div>
            <div className="af-row"><span className="af-k">Discovery</span><span className="af-v" style={{ fontSize: 11.5 }}>{[cx.budget && ("Budget " + cx.budget), cx.family_size && (cx.family_size + " to cover"), cx.coverage_tier].filter(Boolean).join(" · ") || "Not captured yet"}</span></div>
          </div>
          <CPField label="Internal note"><CPArea value={note} onChange={setNote} style={{ minHeight: 70 }} placeholder="Context for the proposal request (optional)…" /></CPField>
          <CPField label="Follow-up date"><CPInput type="date" value={follow} onChange={setFollow} /></CPField>
          <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
            <div><div className="sr-label">Also email Pacific Cross</div><div className="sr-sub">Send the carrier a quote request — the lead won't see it</div></div>
            <button className={"switch" + (emailOn ? " on" : "")} onClick={() => setEmailOn(!emailOn)}></button>
          </div>
          {emailOn && (
            <>
              <CPField label="Send to (Pacific Cross)" req><CPInput type="email" value={recipient} onChange={setRecipient} placeholder="carrier contact email — typed each time" /></CPField>
              <CPField label="Template"><CPInput value="Proposal / Quote Request" onChange={() => {}} /></CPField>
              <CPField label="Subject" req><CPInput value={subject} onChange={setSubject} /></CPField>
              <CPField label="Message"><CPArea value={body} onChange={setBody} style={{ minHeight: 140 }} /></CPField>
              <div className="callout accent" style={{ marginBottom: 0 }}>
                <span className="co-ico"><I.alertTri size={15} /></span>
                <div>Human-in-the-loop — review and edit before it sends. Goes to the carrier, not {cx.first_name}.</div>
              </div>
            </>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canConfirm} style={!canConfirm ? { opacity: .5, cursor: "not-allowed" } : null} onClick={submit}><I.check size={15} /> {emailOn ? "Request & send email" : "Request proposal"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- Main screen ----
function ContactProfile({ onBack, seed }) {
  const c = buildContactRecord(seed);
  const PPD = window.PPData;
  const [timeline, setTimeline] = useStateCP(c.timeline);
  const [earlyPayer, setEarlyPayer] = useStateCP(c.earlyPayer);
  const [stage, setStage] = useStateCP(c.stage);
  const [leadStage, setLeadStage] = useStateCP(c.leadStage);
  const [leadStatus, setLeadStatus] = useStateCP(c.leadStatus);
  const [proposalStatus, setProposalStatus] = useStateCP(c.proposalStatus || (window.PPData && window.PPData.proposalOf ? (window.PPData.proposalOf(c.record_id) || {}).status : null) || null);
  const [proposalDecision, setProposalDecision] = useStateCP(c.proposalDecision || null);
  const [proposalStamps, setProposalStamps] = useStateCP(() => (c.proposalStamps ? { ...c.proposalStamps } : (c.proposalStatus ? { Requested: "Earlier" } : {})));
  const nowStamp = () => new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const syncProposal = (patch) => { if (window.PPData && window.PPData.setProposal) window.PPData.setProposal(c.record_id, patch); };
  const [advance, setAdvance] = useStateCP(null);
  const convertPriorRef = useRefCP(null);
  const [discovery, setDiscovery] = useStateCP({
    est_premium: c.est_premium || "", product_interest: c.product_interest || "",
    family_size: c.family_size || "", coverage_tier: c.coverage_tier || "",
  });
  const owner = CPD.STAFF[c.owner];
  const stageTone = STAGE_TONE[stage] || "slate";
  const logEntry = (e) => setTimeline((t) => [{ ...e, id: Date.now() }, ...t]);

  // Structured discovery capture (Log Call tab): writes est_premium / product_interest / family_size / coverage_tier,
  // logs a structured call entry, optionally schedules a follow-up, and — when Reached on a Lead — suggests
  // Contacted → Discovery (status Connected) via the Advance-Lead popup, same as the shared composer.
  const onCall = (p) => {
    const actor = window.Perms.person().name;
    setDiscovery((d) => ({
      est_premium: (p.budget !== "" && p.budget != null) ? Number(p.budget) : d.est_premium,
      family_size: (p.family !== "" && p.family != null) ? p.family : d.family_size,
      product_interest: p.interest || d.product_interest,
      coverage_tier: p.tier || d.coverage_tier,
    }));
    const bits = [];
    if (p.budget) bits.push("Budget " + CPD.peso(Number(p.budget)));
    if (p.family) bits.push(p.family + (Number(p.family) === 1 ? " person" : " people") + " to cover");
    if (p.interest) bits.push(p.interest);
    if (p.tier) bits.push(p.tier);
    const structured = bits.join(" · ");
    const body = [structured, p.notes].filter(Boolean).join(structured && p.notes ? " — " : "");
    logEntry({ kind: "call", actor, title: "Call logged — " + p.outcome, body: body || "No details captured.", time: "Just now" });
    if (p.followUp) logEntry({ kind: "task", actor, title: "Follow-up scheduled", body: "Next contact " + new Date(p.followUp).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + ".", time: "Just now" });
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Call logged", sub: `Discovery details saved to ${c.name}'s record.` } }));
    if (/^Reached/.test(p.outcome)) registerProposalReply();
    if (/^Reached/.test(p.outcome) && stage === "Lead") {
      const laterStage = (a, b) => { const S = PPD.PP_STAGES; return S.indexOf(b) > S.indexOf(a) ? b : a; };
      const preset = leadStatus === "Nurturing"
        ? { stage: leadStage, status: "Qualified", label: "Re-engaged from nurturing — reached" }
        : { stage: laterStage(leadStage, "Discovery"), status: "Connected", label: "Discovery call — reached" };
      setTimeout(() => setAdvance({ preset }), 320);
    }
  };

  // Auto-log: append entries emitted by the shared composer for THIS contact
  useEffectCP(() => {
    const onLogged = (ev) => {
      const d = ev.detail || {};
      if (d.key === c.record_id || d.name === c.name) logEntry(d.entry);
    };
    window.addEventListener("engage-logged", onLogged);
    return () => window.removeEventListener("engage-logged", onLogged);
  }, [c.record_id, c.name]);

  // Nurture action → suggestion: a completed action on a Lead opens the Advance-Lead popup pre-set (lead-workflow.md §4)
  useEffectCP(() => {
    const onComplete = (ev) => {
      const d = ev.detail || {};
      if (!(d.key === c.record_id || d.name === c.name)) return;
      if (stage !== "Lead") return;
      let preset = null;
      const parked = leadStatus === "Nurturing";
      if ((d.action === "Send Email" || d.action === "Send Brochure") && leadStage === "New Lead")
        preset = { stage: "Contacted", status: "Attempted", label: "Sent " + (d.action === "Send Brochure" ? "brochure" : "first email") };
      else if ((d.action === "Send Email" || d.action === "Send Brochure") && parked)
        preset = { stage: leadStage, status: "Qualified", label: "Re-engaged from nurturing" };
      if (!preset) return;
      if (preset) setTimeout(() => setAdvance({ preset }), 320); // let the Engage composer close first
    };
    window.addEventListener("engage-complete", onComplete);
    return () => window.removeEventListener("engage-complete", onComplete);
  }, [stage, leadStage, leadStatus, c.record_id, c.name]);

  useEffectCP(() => {
    const onProposalSent = (e) => {
      if (!e.detail || e.detail.rid !== c.record_id) return;
      const stamp = nowStamp();
      setProposalStatus("Sent"); setProposalStamps((s) => ({ ...s, Sent: stamp }));
      syncProposal({ status: "Sent" });
      logEntry({ kind: "note", actor: window.Perms.person().name, title: "Proposal sent to lead", body: `Proposal delivered to ${c.name}. Awaiting reply.`, time: "Just now" });
    };
    window.addEventListener("cp-proposal-sent", onProposalSent);
    return () => window.removeEventListener("cp-proposal-sent", onProposalSent);
  }, [c.record_id]);

  const openLogCall = () => window.dispatchEvent(new CustomEvent("cp-composer-tab", { detail: { tab: "Log Call" } }));
  // A logged client reply while the proposal is Sent moves it into the Decision step (default: Awaiting Decision).
  // This is deliberately separate from Send Proposal — "sent, no reply" vs "they replied" are distinct states.
  const registerProposalReply = () => {
    if (proposalStatus === "Sent" && !proposalDecision) {
      setProposalDecision("Awaiting Decision"); setProposalStamps((s) => ({ ...s, Decision: nowStamp() }));
      syncProposal({ decision: "Awaiting Decision" });
    }
  };
  // Composer's generic log passthrough — also detects an inbound reply for proposal Decision tracking.
  const handleComposerLog = (entry) => {
    logEntry(entry);
    if (entry && entry.kind === "message" && entry.dir === "received") registerProposalReply();
  };
  // Manual decision sub-state toggle (Awaiting Decision ↔ Negotiating) once a reply has landed.
  const setProposalDecisionState = (d) => {
    if (d === proposalDecision) return;
    setProposalDecision(d); setProposalStamps((s) => ({ ...s, Decision: nowStamp() }));
    syncProposal({ decision: d });
    logEntry({ kind: "note", actor: window.Perms.person().name, title: "Proposal decision — " + d, body: `${c.name}'s proposal marked ${d}.`, time: "Just now" });
  };
  // Request Proposal: opens the merged modal (internal note + task always; carrier email optional).
  const [reqOpen, setReqOpen] = useStateCP(false);
  const defaultFollowDate = () => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); };
  const confirmProposalRequest = ({ note, follow, email }) => {
    const actor = window.Perms.person().name;
    logEntry({ kind: "note", actor, title: "Proposal requested", body: note || `Internal proposal request raised for ${c.name}${c.product || c.interest ? " — " + (c.product || c.interest) : ""}.`, time: "Just now" });
    logEntry({ kind: "task", actor, title: "Follow up on proposal for " + c.name, body: `Owner: ${owner.name}${follow ? " · due " + new Date(follow).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : ""} · chase carrier proposal.`, time: "Just now" });
    if (proposalStatus !== "Received" && proposalStatus !== "Sent") {
      const stamp = nowStamp();
      setProposalStatus("Requested"); setProposalStamps((s) => ({ ...s, Requested: s.Requested || stamp }));
      syncProposal({ status: "Requested" });
    }
    if (email) {
      logEntry({ kind: "email", dir: "sent", actor, title: "Proposal / quote request sent", body: `Sent to ${email.recipient} (Pacific Cross) for ${c.name}.`, time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Proposal requested & emailed", sub: `Note + task logged · request sent to ${email.recipient}.` } }));
    } else {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Proposal requested", sub: `Note + follow-up task added for ${c.name}.` } }));
    }
  };
  // Mark Received: one click, no modal — stamps proposal_received_at.
  const markReceived = () => {
    const actor = window.Perms.person().name;
    const stamp = nowStamp();
    setProposalStatus("Received"); setProposalStamps((s) => ({ ...s, Requested: s.Requested || stamp, Received: stamp }));
    syncProposal({ status: "Received" });
    logEntry({ kind: "note", actor, title: "Proposal received", body: `Carrier proposal / quote received for ${c.name}.`, time: "Just now" });
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Proposal received", sub: `Ready to send to ${c.name}.` } }));
  };
  // All Send-Email-family entry points focus the inline Email tab (optionally preselecting a template).
  const openEmail = (template) => window.dispatchEvent(new CustomEvent("cp-composer-tab", { detail: { tab: "Email", template: template || "" } }));

  const convert = () => {
    const rawInterest = discovery.product_interest || c.interest || "";
    const interestCanon = rawInterest.indexOf("Health") === 0 ? "Health" : rawInterest;
    const cat = { "Health": "health", "Group HMO": "hmo", "Travel": "travel" }[interestCanon] || "health";
    const parts = c.name.split(" ");
    const prefill = {
      _convert: { record_id: c.record_id, name: c.name },
      appType: "New Insurance Application",
      category: cat,
      clientMode: "existing", existingClient: c.name,
      agent: owner.name, source: c.source,
      firstName: parts[0], lastName: parts.slice(1).join(" "), displayName: c.name,
      email: c.email, mobile: c.phone, emailRecipient: c.email,
      address: c.address && c.address !== "\u2014" ? c.address : "", dob: c.dob || "",
      channels: c.channel ? [c.channel] : [],
      product: c.product || "",
      // Discovery carries forward — not re-asked of the lead
      est_premium: discovery.est_premium || "", premium: discovery.est_premium || "",
      family_size: discovery.family_size || "", coverage_tier: discovery.coverage_tier || "",
      initialStatus: "Applicant", status: "Applicant",
    };
    if (stage === "Lead") {
      // Phase 1: open the wizard, but DON'T convert yet. Move the lead into Application Started and keep
      // lifecycle_stage = Lead. The record only becomes an Applicant when the wizard is actually saved
      // (lead-convert-commit); abandoning the wizard reverts the stage (lead-convert-abandon).
      convertPriorRef.current = leadStage;
      setLeadStage("Application Started");
      if (window.PPData && window.PPData.leadConvertStart) window.PPData.leadConvertStart(c.record_id);
      logEntry({ kind: "status", actor: owner.name, title: `Stage changed \u2014 ${leadStage} \u2192 Application Started`, body: "Application wizard opened \u2014 still a Lead until the application is saved.", time: "Just now" });
      window.dispatchEvent(new CustomEvent("lead-convert-start", { detail: { rid: c.record_id } }));
    }
    window.dispatchEvent(new CustomEvent("open-new-application", { detail: { prefill } }));
  };

  // Phase 2 / abandon: react to the wizard being saved or closed (scoped to this record).
  useEffectCP(() => {
    const onCommit = (e) => {
      if (!e.detail || e.detail.rid !== c.record_id) return;
      setStage("Applicant"); setLeadStage(null); setLeadStatus(null);
      logEntry({ kind: "status", actor: owner.name, title: "Stage changed \u2014 Lead \u2192 Applicant", body: "Application created \u2014 same record, no duplicate. Checklist & tasks generated.", time: "Just now" });
    };
    const onAbandon = (e) => {
      if (!e.detail || e.detail.rid !== c.record_id) return;
      setLeadStage(convertPriorRef.current || "Product Selected");
      logEntry({ kind: "note", actor: owner.name, title: "Application draft discarded", body: "Wizard closed without saving \u2014 still a workable Lead.", time: "Just now" });
    };
    window.addEventListener("lead-convert-commit", onCommit);
    window.addEventListener("lead-convert-abandon", onAbandon);
    return () => { window.removeEventListener("lead-convert-commit", onCommit); window.removeEventListener("lead-convert-abandon", onAbandon); };
  }, [c.record_id, owner.name]);

  // Advance-Lead popup (same modal as the board) — opened from the header while lifecycle_stage = Lead
  const openAdvance = (preset) => setAdvance({ preset: preset || {} });
  const applyLeadAdvance = (r) => {
    const actor = owner.name;
    if (r.note) logEntry({ kind: "note", actor, title: "Outcome note", body: r.note, time: "Just now" });
    if (r.lost) {
      setStage("Lost"); setLeadStage(null); setLeadStatus(null);
      logEntry({ kind: "status", actor, title: "Marked Lost — lifecycle_stage = Lost", body: "Retained for re-nurture.", time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Lead marked lost", sub: `${c.name} moved to Lost — kept for re-nurture.` } }));
    } else if (r.toApplication) {
      if (r.status !== leadStatus) { logEntry({ kind: "status", actor, title: `Status changed — ${leadStatus} → ${r.status}`, body: "", time: "Just now" }); setLeadStatus(r.status); }
      convert();
    } else {
      if (r.stage !== leadStage) logEntry({ kind: "status", actor, title: `Stage changed — ${leadStage} → ${r.stage}`, body: r.note || "", time: "Just now" });
      if (r.status !== leadStatus) logEntry({ kind: "status", actor, title: `Status changed — ${leadStatus} → ${r.status}`, body: "", time: "Just now" });
      setLeadStage(r.stage); setLeadStatus(r.status);
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Lead advanced", sub: `${c.name} → ${r.stage} · ${r.status}.` } }));
    }
    if (r.alsoSend) setTimeout(() => window.dispatchEvent(new CustomEvent("open-engage", { detail: { action: r.alsoSend, contact: engageContact } })), 60);
  };

  const renewalDue = c.renewalDueDays;
  const hasRenewal = typeof renewalDue === "number";
  const renewalText = !hasRenewal ? "" : renewalDue < 0
    ? `Renewal overdue by ${Math.abs(renewalDue)} day${Math.abs(renewalDue) !== 1 ? "s" : ""}`
    : renewalDue === 0 ? "Renewal due today" : `Renewal due in ${renewalDue} days`;

  return (
    <div className="fade-in cp-screen" data-screen-label="Contact Profile">
      {/* Header */}
      <div className="cp-head">
        <button className="cp-back" onClick={onBack}><I.arrowRight size={16} style={{ transform: "rotate(180deg)" }} /> Clients</button>
        <div className="cp-head-main">
          <Avatar name={c.name} size={54} />
          <div className="cp-head-id">
            <div className="cp-head-name">
              {c.name}
              <span className="cp-record-id">#{c.record_id}</span>
              <span className={"badge " + stageTone}><span className="b-dot"></span>{stage}</span>
              {stage === "Lead" && leadStage && <span className={"badge " + ((window.STAGE_TONE_LEAD && window.STAGE_TONE_LEAD[leadStage]) || "slate")}><span className="b-dot"></span>{leadStage === "Proposal" && proposalStatus ? `Proposal: ${proposalDecision || proposalStatus}` : leadStage}</span>}
              {stage === "Lead" && leadStatus && <span className={"badge " + ((PPD && PPD.PP_STATUS_TONE[leadStatus]) || "slate")}><span className="b-dot"></span>{leadStatus}</span>}
              {proposalStatus && leadStage !== "Proposal" && <span className="badge violet" title="Proposal tracking"><I.clipboard size={11} /> Proposal · {proposalDecision || proposalStatus}</span>}
            </div>
            <div className="cp-head-meta">
              <span><I.mail size={13} /> {c.email}</span>
              {c.groupMembership && <button className="group-chip" onClick={() => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: (window.GroupsData && window.GroupsData.get(c.groupMembership.groupId)) || { id: c.groupMembership.groupId, name: c.groupMembership.group } } }))} title={"Open " + c.groupMembership.group}><I.building size={12} /> Group member — {c.groupMembership.group}</button>}
              <span className="cp-owner"><Avatar name={owner.name} size={20} /> {owner.name} · Owner</span>
            </div>
          </div>
          <div className="cp-head-actions">
            {stage === "Lead" && leadStage === "Discovery" && (
              <button className="btn sm" onClick={() => openAdvance({ stage: "Proposal", status: "Qualified", label: "Marked discovery complete", alsoSend: "Send Intake / Application Form" })}><I.check size={14} /> Mark Discovery Complete</button>
            )}
            {stage === "Lead" && leadStatus === "Qualified" && (
              <button className="btn sm" onClick={() => openAdvance({ stage: leadStage, status: "Nurturing", label: "Marked as nurturing" })}><I.clock size={14} /> Mark as Nurturing</button>
            )}
            {stage === "Lead" && (
              <button className="btn sm" onClick={() => openAdvance({ stage: (PPD ? PPD.nextStage(leadStage) : leadStage), status: leadStatus, label: "Advance from profile" })}><I.trendUp size={14} /> Advance</button>
            )}
            <button className="btn primary sm" onClick={convert}><I.arrowRight size={14} /> Convert to Application</button>
          </div>
        </div>
        <div className="cp-nurture">
          <span className="cp-nurture-label">Nurture</span>
          <button className="chip" onClick={openLogCall}><I.phone size={14} /> Log Call</button>
          <button className="chip" onClick={() => openEmail("New inquiry response")}><I.mail size={14} /> Send Email</button>
          <button className="chip" onClick={() => openEmail("Send brochure")}><I.folder size={14} /> Send Brochure</button>
          <button className="chip" onClick={() => openEmail("Send application form")}><I.fileText size={14} /> Send Intake Form</button>
          <span className="cp-nurture-label cp-nurture-group">Proposal</span>
          <button className="chip" onClick={() => setReqOpen(true)}><I.clipboard size={14} /> Request Proposal</button>
          {proposalStatus === "Received" && <button className="chip" onClick={() => openEmail("Proposal / Quote Delivery")}><I.mail size={14} /> Send Proposal</button>}
        </div>
      </div>

      {/* 3-column body */}
      <div className="cp-grid">
        {/* LEFT — identity & properties */}
        <div className="cp-col cp-left">
          {hasRenewal && renewalDue <= 30 && (
            <div className="cp-banner red">
              <span className="cp-banner-ico"><I.refresh size={17} /></span>
              <div>
                <div className="cp-banner-title">{renewalText}</div>
                <div className="cp-banner-sub">{c.renewalPolicy}</div>
              </div>
            </div>
          )}

          <div className="cp-panel">
            <div className="cp-panel-head">Contact properties <button className="cp-edit-all"><I.settings size={13} /> Edit</button></div>
            <div className="cp-props">
              <PropRow label="Email (Lead ID)" mono>{c.email}</PropRow>
              <PropRow label="Phone" mono>{c.phone}</PropRow>
              <PropRow label="Preferred channel">{c.channel}</PropRow>
              <PropRow label="Source">{c.source}</PropRow>
              <PropRow label="Product interest">{discovery.product_interest || c.interest || <span className="cp-derived">— not captured</span>}</PropRow>
              <PropRow label="Budget / est. premium">{discovery.est_premium ? CPD.peso(Number(discovery.est_premium)) : <span className="cp-derived">— not captured</span>}</PropRow>
              <PropRow label="Family size / dependents">{discovery.family_size ? discovery.family_size + (Number(discovery.family_size) === 1 ? " person" : " people") : <span className="cp-derived">— not captured</span>}</PropRow>
              <PropRow label="Coverage tier / room">{discovery.coverage_tier || <span className="cp-derived">— not captured</span>}</PropRow>
              <PropRow label="Assigned agent">{owner.name}</PropRow>
              <PropRow label="Lifecycle stage"><span className={"badge " + stageTone}><span className="b-dot"></span>{stage}</span></PropRow>
              <PropRow label="Tier">{c.tier ? <><TierBadge tier={c.tier} /> <span className="cp-derived">derived · {CPD.peso(c.lifetimeValue)} LTV</span></> : <span className="cp-derived">— no policies yet</span>}</PropRow>
              <PropRow label="Date of birth">{new Date(c.dob).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })} <span className="cp-derived">🎂 {c.birthday}</span></PropRow>
              <PropRow label="Address">{c.address}</PropRow>
              <PropRow label="Record ID" mono>#{c.record_id}</PropRow>
              <PropRow label="Created">{c.created}</PropRow>
            </div>
          </div>

          <div className="cp-panel">
            <div className="cp-panel-head">State flags</div>
            <div className="cp-flag">
              <div className="cp-flag-txt">
                <div className="cp-flag-title">Early payer</div>
                <div className="cp-flag-sub">Suppresses renewal reminders — already paid, don't nag.</div>
              </div>
              <button className={"switch" + (earlyPayer ? " on" : "")} onClick={() => setEarlyPayer(!earlyPayer)}></button>
            </div>
            {earlyPayer && <div className="cp-flag-note"><I.check size={13} /> Renewal reminders suppressed for this contact.</div>}
            <div className="cp-flag">
              <div className="cp-flag-txt">
                <div className="cp-flag-title">Lost / Do not contact</div>
                <div className="cp-flag-sub">Archives from active queues; preserves history.</div>
              </div>
              <button className="switch"></button>
            </div>
          </div>
        </div>

        {/* CENTER — composer + timeline */}
        <div className="cp-col cp-center">
          <Composer contact={c} onLog={handleComposerLog} onCall={onCall} discovery={discovery} />
          <Timeline entries={timeline} />
        </div>

        {/* RIGHT — associated records */}
        <div className="cp-col cp-right">
          {proposalStatus && (
            <ProposalTrackingPanel status={proposalStatus} decision={proposalDecision} stamps={proposalStamps}
              onRequest={() => setReqOpen(true)} onReceived={markReceived} onDecision={setProposalDecisionState} />
          )}
          <AssocPanel title="Applications" icon="fileText" count={c.applications.length}>
            {c.applications.map((a) => <AssocRow key={a.code} code={a.code} sub={a.product} right={<StatusBadge status={a.status} />} />)}
          </AssocPanel>
          <AssocPanel title="Policies" icon="shield" count={c.policies.length}>
            {c.policies.map((p) => <AssocRow key={p.no} code={p.no} sub={p.product} right={<span className="cp-amt">{CPD.peso(p.amount)}</span>} />)}
          </AssocPanel>
          <AssocPanel title="Renewals" icon="refresh" count={c.renewals.length}>
            {c.renewals.map((r, i) => <AssocRow key={i} code={r.policy} sub={r.date} right={<StatusBadge status={r.status} />} />)}
          </AssocPanel>
          <AssocPanel title="Claims" icon="clipboard" count={c.claims.length}>
            {c.claims.map((cl) => <AssocRow key={cl.no} code={cl.no} sub={CPD.peso(cl.amount)} right={<StatusBadge status={cl.status} />} />)}
          </AssocPanel>
          <AssocPanel title="Documents" icon="folder" count={c.documents.length}>
            {c.documents.map((d, i) => <AssocRow key={i} code={d.name} sub={d.type} right={<StatusBadge status={d.status} />} />)}
          </AssocPanel>
          {c.represents && (
            <AssocPanel title="Represents" icon="building" count={1}>
              <div className="cp-assoc-row" style={{ cursor: "pointer" }} title="Open Group Account" onClick={() => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: (window.GroupsData && window.GroupsData.get(c.represents.groupId)) || { id: c.represents.groupId, name: c.represents.group } } }))}>
                <div className="cp-assoc-main"><div className="cp-assoc-code" style={{ fontFamily: "inherit", fontWeight: 600 }}>{c.represents.group}</div><div className="cp-assoc-sub">Primary contact · Group HMO account</div></div>
                <I.arrowRight size={14} style={{ color: "var(--text-subtle)" }} />
              </div>
            </AssocPanel>
          )}
          {c.groupMembership && (
            <AssocPanel title="Group membership" icon="building" count={1}>
              <div className="cp-assoc-row" style={{ cursor: "pointer" }} title="Open Group Account" onClick={() => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: (window.GroupsData && window.GroupsData.get(c.groupMembership.groupId)) || { id: c.groupMembership.groupId, name: c.groupMembership.group } } }))}>
                <div className="cp-assoc-main"><div className="cp-assoc-code" style={{ fontFamily: "inherit", fontWeight: 600 }}>{c.groupMembership.group}</div><div className="cp-assoc-sub">{c.groupMembership.role}</div></div>
                <I.arrowRight size={14} style={{ color: "var(--text-subtle)" }} />
              </div>
            </AssocPanel>
          )}
        </div>
      </div>

      {advance && window.AdvanceLeadModal && (
        <window.AdvanceLeadModal
          lead={{ name: c.name, rid: c.record_id, stage: leadStage, status: leadStatus }}
          preset={advance.preset}
          onClose={() => setAdvance(null)}
          onConfirm={applyLeadAdvance}
        />
      )}
      {reqOpen && (
        <ProposalRequestModal contact={c} discovery={discovery} agent={window.Perms.person().name} defaultFollow={defaultFollowDate()}
          onClose={() => setReqOpen(false)} onConfirm={confirmProposalRequest} />
      )}
    </div>
  );
}

window.ContactProfile = ContactProfile;
