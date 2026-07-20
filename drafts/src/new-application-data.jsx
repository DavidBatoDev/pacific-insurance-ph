// New Client Application — options, checklists, shared field components
const { useState: useStateNA, useMemo: useMemoNA, useEffect: useEffectNA } = React;

const NA_OPTS = {
  appType: ["New Insurance Application", "Additional Product (Existing Client)", "Renewal Application", "Inquiry / Lead Only"],
  categories: [
    { id: "health", name: "Health Insurance", products: ["Select Plan", "Blue Royale"] },
    { id: "hmo", name: "Group HMO", products: ["BC Flexi HMO"] },
    { id: "travel", name: "Travel Insurance", products: ["Travel Insurance"] },
  ],
  agents: ["Eman Bondoc", "Matt Nassr", "Joy Mercado", "Bea Lim", "Paolo Aquino"],
  sources: ["Referral", "Personal network", "Business network", "Existing client", "Website", "Social media", "Other"],
  priority: ["Normal", "Urgent", "VIP"],
  channels: ["Email", "WhatsApp", "Viber", "Phone", "iMessage"],
  gender: ["", "Female", "Male", "Prefer not to say"],
  civil: ["", "Single", "Married", "Widowed", "Separated"],
  coverage: ["Individual", "Family"],
  payFreq: ["", "Annual", "Semi-annual", "Deferred Credit Card"],
  relationship: ["Employee", "Principal", "Dependent", "Other"],
  travelPurpose: ["", "Leisure", "Business", "Family visit", "Other"],
  paymentStatus: ["Pending", "Paid", "Verified"],
  portalStatus: ["Not started", "Processing", "Issued", "Failed"],
  emailTemplates: ["New inquiry response", "Send brochure", "Send application form", "Request missing documents", "Payment instruction", "Proof of payment follow-up", "Policy issued", "Renewal reminder", "Claim requirement request", "Travel insurance payment instruction"],
  waTemplates: ["Intro & brochure", "Follow-up nudge", "Request documents", "Payment reminder"],
  statuses: ["Lead", "Applicant", "Pending Requirements", "Submitted to Pacific Cross", "Awaiting Payment"],
  docTypes: ["Valid ID", "Application form", "Attestation letter", "Passport", "Medical record", "Pacific Cross questionnaire", "Payment proof", "Policy document"],
  docStatus: ["Pending", "Received", "Incomplete", "Verified"],
};

// Auto document checklist by category
const NA_CHECKLISTS = {
  health: [
    { name: "Application form", cond: null },
    { name: "Valid ID", cond: null },
    { name: "Attestation letter (3 specimen signatures)", cond: null },
    { name: "Medical records", cond: "if applicable" },
    { name: "Pacific Cross questionnaire", cond: "if applicable" },
    { name: "Proof of payment", cond: "later stage" },
    { name: "Policy documents", cond: "after issuance" },
  ],
  hmo: [
    { name: "Company / group details", cond: null },
    { name: "Member list", cond: null },
    { name: "Member information sheets", cond: null },
    { name: "Application documents", cond: null },
    { name: "Valid IDs", cond: "if needed" },
    { name: "Payment proof", cond: null },
    { name: "Policy documents", cond: "after issuance" },
  ],
  travel: [
    { name: "Application details", cond: null },
    { name: "Passport copy", cond: null },
    { name: "Travel dates confirmation", cond: null },
    { name: "Destination details", cond: null },
    { name: "Payment proof", cond: null },
    { name: "Issued policy", cond: "after issuance" },
  ],
};

// Email template subject/body seeds
const NA_EMAIL_SEED = {
  "New inquiry response": { subject: "Thank you for your interest in Pacific Insurance PH", body: "Hi {name},\n\nThank you for reaching out about {product}. I'd be glad to walk you through your options and answer any questions.\n\nWhen would be a good time for a short call this week?\n\nBest regards,\n{agent}\nPacific Insurance PH" },
  "Send brochure": { subject: "{product} — plan details & brochure", body: "Hi {name},\n\nAs promised, please find attached the brochure for {product}. It covers the benefits, coverage limits, and premium options.\n\nLet me know if you'd like me to prepare a personalized proposal.\n\nBest regards,\n{agent}" },
  "Send application form": { subject: "Your {product} application form", body: "Hi {name},\n\nAttached is the application form for {product}. Please complete the highlighted sections and return with a valid ID.\n\nHappy to help if you have questions.\n\n{agent}" },
  "Request missing documents": { subject: "A few documents to complete your application", body: "Hi {name},\n\nTo move your {product} application forward, we still need the following:\n\n- (documents will be listed here)\n\nYou can reply with photos or scans. Thank you!\n\n{agent}" },
  "Payment instruction": { subject: "Payment instructions for your {product} policy", body: "Hi {name},\n\nYour proposal is ready. Here are your payment options and instructions...\n\n{agent}" },
  "Travel insurance payment instruction": { subject: "Payment link for your travel insurance", body: "Hi {name},\n\nYour travel insurance quote for your upcoming trip is ready. Please use the secure payment link below to confirm coverage before departure.\n\n{agent}" },
};

// Shared field components ---------------------------------------------------
function Field({ label, req, hint, children, span }) {
  return (
    <div className="field" style={span ? { gridColumn: `span ${span}` } : null}>
      {label && <label>{label} {req && <span className="req">*</span>}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function TextInput({ value, onChange, ...p }) {
  return <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} {...p} />;
}
function Textarea({ value, onChange, ...p }) {
  return <textarea className="textarea" value={value || ""} onChange={(e) => onChange(e.target.value)} {...p} />;
}
function Select({ value, onChange, options, ...p }) {
  return (
    <select className="select" value={value || ""} onChange={(e) => onChange(e.target.value)} {...p}>
      {options.map((o) => typeof o === "string"
        ? <option key={o} value={o}>{o || "Select…"}</option>
        : <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}
function Currency({ value, onChange, sym = "₱" }) {
  return (
    <div className="input-prefix">
      <span className="ip-sym">{sym}</span>
      <input className="input" type="text" inputMode="numeric" value={value || ""} onChange={(e) => onChange(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
    </div>
  );
}
function YesNo({ value, onChange, unknown }) {
  return (
    <div className="yn-group">
      <button type="button" className={"yn-btn" + (value === "Yes" ? " on-yes" : "")} onClick={() => onChange("Yes")}>Yes</button>
      <button type="button" className={"yn-btn" + (value === "No" ? " on-no" : "")} onClick={() => onChange("No")}>No</button>
      {unknown && <button type="button" className={"yn-btn" + (value === "Unknown" ? " on-unknown" : "")} onClick={() => onChange("Unknown")}>Unknown</button>}
    </div>
  );
}
function MultiChips({ selected, onToggle, options }) {
  return (
    <div className="ms-chips">
      {options.map((o) => (
        <button type="button" key={o} className={"ms-chip" + (selected.includes(o) ? " on" : "")} onClick={() => onToggle(o)}>
          {selected.includes(o) && <I.check size={13} />}{o}
        </button>
      ))}
    </div>
  );
}
function FileDrop({ label = "Click to upload or drag files here", sub = "PDF, JPG or PNG · up to 10 MB" }) {
  return (
    <div className="file-drop">
      <div className="fd-ico"><I.upload size={22} /></div>
      <div className="fd-main">{label}</div>
      <div className="fd-sub">{sub}</div>
    </div>
  );
}
function ageFromDob(dob) {
  if (!dob) return "";
  const d = new Date(dob); if (isNaN(d)) return "";
  const now = new Date(2026, 6, 7);
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? a : "";
}
function daysBetween(a, b) {
  if (!a || !b) return "";
  const d1 = new Date(a), d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return "";
  const diff = Math.round((d2 - d1) / 86400000);
  return diff >= 0 ? diff : "";
}
// Synthesize deterministic contact details for an existing client record
function existingClientInfo(c) {
  if (!c) return null;
  const seed = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const d7 = String(1000000 + (seed * 97) % 9000000);
  const mobile = `+63 917 ${d7.slice(0, 3)} ${d7.slice(3)}`;
  const age = 27 + (seed % 35);
  const mm = String(1 + (seed % 12)).padStart(2, "0");
  const dd = String(1 + (seed % 27)).padStart(2, "0");
  const dob = `${2026 - age}-${mm}-${dd}`;
  return { name: c.name, email: c.email, mobile, dob, age, city: c.city };
}

window.NAShared = { NA_OPTS, NA_CHECKLISTS, NA_EMAIL_SEED, Field, TextInput, Textarea, Select, Currency, YesNo, MultiChips, FileDrop, ageFromDob, daysBetween, existingClientInfo };
