// New Client Application — wizard shell + trigger wiring
const { useState: useStateWiz, useEffect: useEffectWiz, useMemo: useMemoWiz } = React;

const WIZ_STEPS = [
  { n: 1, label: "Client type & setup", desc: "Workflow & product" },
  { n: 2, label: "Client information", desc: "Profile details" },
  { n: 3, label: "Product details", desc: "Plan-specific" },
  { n: 4, label: "Requirements", desc: "Documents" },
  { n: 5, label: "Communication", desc: "Email & follow-up" },
  { n: 6, label: "Review & create", desc: "Confirm" },
];

const emptyForm = () => ({
  appType: "", source: "", category: "", product: "", clientMode: "new", existingClient: "",
  agent: (window.Perms ? window.Perms.person().name : ""), priority: "Normal", initialStatus: "Lead",
  firstName: "", middleName: "", lastName: "", displayName: "", email: "", mobile: "", channels: [],
  dob: "", gender: "", civil: "", nationality: "", address: "", occupation: "", notes: "",
  companyName: "", companyContact: "", memberCount: "", members: [{ name: "", dob: "", rel: "Principal", email: "" }, { name: "", dob: "", rel: "Employee", email: "" }, { name: "", dob: "", rel: "Employee", email: "" }],
  coverage: "", startDate: "", dependents: "", existingPC: "", preExisting: "", medicalNotes: "", payFreq: "", premium: "", commission: "",
  passport: "", destination: "", departure: "", returnDate: "", travelPurpose: "", paymentStatus: "Pending", payLinkSent: "", portalStatus: "Not started",
  checklist: [],
  sendEmail: false, emailTemplate: "", emailRecipient: "", emailSubject: "", emailBody: "", sendWA: false, waTemplate: "", viberLog: "",
  createTask: true, followDate: "", taskOwner: "", internalNote: "",
  status: "Lead",
});

function NewApplicationWizard({ onClose, onCreated, initialForm }) {
  const [step, setStep] = useStateWiz(1);
  const [f, setF] = useStateWiz(() => ({ ...emptyForm(), ...(initialForm || {}) }));
  const [splitOpen, setSplitOpen] = useStateWiz(false);
  const [dirty, setDirty] = useStateWiz(false);
  const set = (patch) => {
    // Auto-effects (checklist regen, derived initial status) shouldn't count as user edits.
    const keys = Object.keys(patch);
    if (!keys.every((k) => k === "checklist" || k === "initialStatus")) setDirty(true);
    setF((s) => ({ ...s, ...patch }));
  };
  // Confirm before discarding a convert-in-progress that has unsaved input.
  const requestClose = () => {
    if (dirty && !window.confirm("Discard this application draft? Nothing has been saved.")) return;
    onClose();
  };

  // Derived initial status
  useEffectWiz(() => {
    const st = f.appType === "Inquiry / Lead Only" ? "Lead" : (f.firstName || f.companyName || f.product) ? "Applicant" : "Lead";
    if (st !== f.initialStatus) set({ initialStatus: st });
  }, [f.appType, f.firstName, f.companyName, f.product]);

  // Auto-generate checklist when category changes
  useEffectWiz(() => {
    if (!f.category) return;
    const base = window.NAShared.NA_CHECKLISTS[f.category] || [];
    let items = base.map((b) => ({ ...b, checked: false, status: "Pending" }));
    if (f.category === "health" && f.preExisting === "Yes") {
      // ensure medical + questionnaire present & flagged
      items = items.map((x) => (x.name.includes("Medical") || x.name.includes("questionnaire")) ? { ...x, cond: "required" } : x);
    }
    set({ checklist: items });
  }, [f.category, f.preExisting]);

  // Duplicate check (demo: matches a known seed)
  const dup = useMemoWiz(() => {
    const nm = (f.displayName || "").toLowerCase();
    const em = (f.email || "").toLowerCase();
    if (nm.includes("john santos") || em === "john.santos@email.com") return "John Santos · john.santos@email.com";
    if (nm.includes("maria cruz")) return "Maria Cruz · maria.cruz@email.com";
    return null;
  }, [f.displayName, f.email]);

  // Minimum-to-save-draft
  const hasName = !!(f.firstName || f.displayName || f.companyName);
  const hasContact = !!(f.email || f.mobile);
  const canDraft = hasName && hasContact && !!f.category && !!f.agent;
  // Full submission validation
  const groupTooFew = f.category === "hmo" && f.members.filter((m) => m.name.trim()).length < 3;
  const canCreate = canDraft && !!f.product && !!f.appType && !!f.source && !groupTooFew;

  const { Step1, Step2 } = window.NASteps12;
  const { Step3, Step4, Step5, Step6 } = window.NASteps36;

  const go = (n) => setStep(Math.max(1, Math.min(6, n)));

  const finish = (mode) => {
    onCreated({ form: f, mode });
  };

  const stepEl = { 1: <Step1 f={f} set={set} />, 2: <Step2 f={f} set={set} />, 3: <Step3 f={f} set={set} />, 4: <Step4 f={f} set={set} />, 5: <Step5 f={f} set={set} />, 6: <Step6 f={f} set={set} dup={dup} /> }[step];
  const head = {
    1: ["Client type & application setup", "Tell the system what workflow to prepare."],
    2: [f.category === "hmo" ? "Company information" : "Client information", "Create or update the main profile."],
    3: ["Product-specific details", "Configure details for the selected product."],
    4: ["Requirements & documents", "Auto-generated checklist based on the product."],
    5: ["Communication & follow-up", "Prepare the next action for the client."],
    6: ["Review & create application", "Final confirmation before saving."],
  }[step];

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={requestClose}>
      <div className="wiz" onMouseDown={(e) => e.stopPropagation()}>
        <button className="wiz-close-x" onClick={requestClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>

        {/* Left rail */}
        <div className="wiz-rail">
          <div className="wiz-brand">
            <span className="wb-glyph"><BrandGlyph size={17} /></span>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Pacific Insurance PH</div>
          </div>
          <div className="wiz-title">New Client Application</div>
          <div className="wiz-sub">Create a new client record and start an insurance application workflow.</div>
          <div className="wiz-steps">
            {WIZ_STEPS.map((s) => (
              <div key={s.n} className={"wiz-step" + (step === s.n ? " active" : "") + (step > s.n ? " done" : "")} onClick={() => go(s.n)}>
                <span className="ws-num">{step > s.n ? <I.check size={13} /> : s.n}</span>
                <span className="ws-txt"><span className="ws-label">{s.label}</span><span className="ws-desc">{s.desc}</span></span>
              </div>
            ))}
          </div>
          <div className="wiz-rail-foot">
            <div className="status-preview">
              <span>Initial status</span>
              <span className="badge blue" style={{ marginLeft: "auto" }}><span className="b-dot"></span>{f.initialStatus}</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="wiz-body">
          <div className="wiz-body-head">
            {f._convert && (
              <div className="callout accent" style={{ marginBottom: 16 }}>
                <span className="co-ico"><I.user size={16} /></span>
                <div>Converting <b>{f._convert.name}</b> (<span className="mono">#{f._convert.record_id}</span>) from Lead → Applicant. Fields are pre-filled from the existing contact — <b>the same record is used, no duplicate is created.</b></div>
              </div>
            )}
            <h2>{head[0]}</h2>
            <p>{head[1]}</p>
          </div>
          {stepEl}
        </div>

        {/* Footer */}
        <div className="wiz-foot">
          {step > 1
            ? <button className="btn" onClick={() => go(step - 1)}><I.chevRight size={15} style={{ transform: "rotate(180deg)" }} /> Back</button>
            : <button className="btn" onClick={requestClose}>Cancel</button>}
          <span className="draft-note">{canDraft ? "Draft can be saved" : "Add name, contact, category & agent to save draft"}</span>
          <div className="wiz-foot-right">
            <button className="btn" disabled={!canDraft} style={!canDraft ? { opacity: 0.5, cursor: "not-allowed" } : null} onClick={() => finish("draft")}>Save draft</button>
            {step < 6
              ? <button className="btn primary" onClick={() => go(step + 1)}>Continue <I.chevRight size={15} /></button>
              : (
                <div className="split-btn">
                  <button className="btn primary" disabled={!canCreate} style={!canCreate ? { opacity: 0.5, cursor: "not-allowed" } : null} onClick={() => finish("docs")}><I.send size={15} /> Create &amp; request documents</button>
                  <button className="split-caret" onClick={() => setSplitOpen((o) => !o)}><I.chevDown size={15} style={{ transform: "rotate(180deg)" }} /></button>
                  {splitOpen && (
                    <div className="split-menu">
                      <div className="menu-item" onClick={() => { setSplitOpen(false); finish("create"); }}><span className="mi-ico"><I.check size={15} /></span>Create application</div>
                      <div className="menu-item" onClick={() => { setSplitOpen(false); finish("email"); }}><span className="mi-ico"><I.mail size={15} /></span>Create &amp; send email</div>
                      <div className="menu-sep"></div>
                      <div className="menu-item" onClick={() => { setSplitOpen(false); finish("draft"); }}><span className="mi-ico"><I.doc2 size={15} /></span>Save as draft</div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Toast
function Toast({ toast, onClose }) {
  useEffectWiz(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return ReactDOM.createPortal(
    <div className="toast-wrap">
      <div className="toast">
        <div className="t-ico"><I.check size={19} /></div>
        <div className="t-body"><div className="t-title">{toast.title}</div><div className="t-sub">{toast.sub}</div></div>
        <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={onClose}><I.plus size={16} style={{ transform: "rotate(45deg)" }} /></button>
      </div>
    </div>,
    document.body
  );
}

window.NewApplicationWizard = NewApplicationWizard;
window.NAToast = Toast;
