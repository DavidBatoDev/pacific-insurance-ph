// New Client Application — Steps 3-6
const S2 = window.NAShared;
const { Field: F2, TextInput: TI, Textarea: TA, Select: SEL, Currency: CUR, YesNo: YN, FileDrop: FD, ageFromDob: age2, daysBetween } = S2;
const O = S2.NA_OPTS;

/* ---------- STEP 3: Product-specific ---------- */
function Step3Health({ f, set }) {
  const isBlue = f.product === "Blue Royale";
  const cur = isBlue ? "USD ($)" : "PHP (₱)";
  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">Plan & coverage</div>
        <div className="grid-2">
          <F2 label="Plan type" req><SEL value={f.product} onChange={(v) => set({ product: v })} options={["Select Plan", "Blue Royale"]} /></F2>
          <F2 label="Coverage type" req><SEL value={f.coverage} onChange={(v) => set({ coverage: v })} options={["", ...O.coverage]} /></F2>
          <F2 label="Currency" hint="Auto-filled from plan"><input className="input" value={cur} readOnly style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} /></F2>
          <F2 label="Desired coverage start date"><TI type="date" value={f.startDate} onChange={(v) => set({ startDate: v })} /></F2>
        </div>
        {f.coverage === "Family" && (
          <F2 label="Number of applicants / dependents" req hint="Opens dependent member fields for the family plan.">
            <TI type="number" min="1" value={f.dependents} onChange={(v) => set({ dependents: v })} placeholder="e.g. 3" />
          </F2>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Underwriting</div>
        <div className="grid-2">
          <F2 label="Existing Pacific Cross client?"><YN value={f.existingPC} onChange={(v) => set({ existingPC: v })} /></F2>
          <F2 label="Pre-existing conditions?" req hint="Required before Pacific Cross submission."><YN value={f.preExisting} onChange={(v) => set({ preExisting: v })} unknown /></F2>
        </div>
        {f.preExisting === "Yes" && (
          <>
            <F2 label="Medical notes" req><TA value={f.medicalNotes} onChange={(v) => set({ medicalNotes: v })} placeholder="Describe condition(s), treatment history, and current status" /></F2>
            <div className="callout">
              <span className="co-ico"><I.alertTri size={16} /></span>
              <div><b>Because pre-existing conditions = Yes, we'll auto-create:</b>
                <ul>
                  <li>Task — request medical records</li>
                  <li>Task — check required Pacific Cross questionnaire</li>
                  <li>Note — coordinate with Glynn / TSM if needed</li>
                  <li>Document requirements — medical records + questionnaire</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Commercials</div>
        <div className="grid-3">
          <F2 label="Preferred payment frequency"><SEL value={f.payFreq} onChange={(v) => set({ payFreq: v })} options={O.payFreq} /></F2>
          <F2 label="Estimated premium"><CUR sym={isBlue ? "$" : "₱"} value={f.premium} onChange={(v) => set({ premium: v })} /></F2>
          <F2 label="Commission estimate"><CUR sym={isBlue ? "$" : "₱"} value={f.commission} onChange={(v) => set({ commission: v })} /></F2>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ m, onChange, onRemove }) {
  const a = age2(m.dob);
  return (
    <tr>
      <td><input className="m-input" value={m.name || ""} onChange={(e) => onChange({ ...m, name: e.target.value })} placeholder="Full name" /></td>
      <td style={{ width: 130 }}><input className="m-input" type="date" value={m.dob || ""} onChange={(e) => onChange({ ...m, dob: e.target.value })} /></td>
      <td style={{ width: 44 }}><div className="m-age">{a !== "" ? a : "—"}</div></td>
      <td style={{ width: 120 }}>
        <select className="m-input" value={m.rel || "Employee"} onChange={(e) => onChange({ ...m, rel: e.target.value })}>
          {O.relationship.map((r) => <option key={r}>{r}</option>)}
        </select>
      </td>
      <td><input className="m-input" value={m.email || ""} onChange={(e) => onChange({ ...m, email: e.target.value })} placeholder="Email (optional)" /></td>
      <td style={{ width: 40 }}><button className="member-remove" onClick={onRemove}><I.fileMissing size={15} /></button></td>
    </tr>
  );
}

function Step3Group({ f, set }) {
  const members = f.members;
  const setMember = (i, m) => set({ members: members.map((x, idx) => idx === i ? m : x) });
  const addMember = () => set({ members: [...members, { name: "", dob: "", rel: "Employee", email: "" }] });
  const removeMember = (i) => set({ members: members.filter((_, idx) => idx !== i) });
  const tooFew = members.length < 3;
  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">Coverage & commercials</div>
        <div className="grid-3">
          <F2 label="Coverage start date"><TI type="date" value={f.startDate} onChange={(v) => set({ startDate: v })} /></F2>
          <F2 label="Estimated premium"><CUR value={f.premium} onChange={(v) => set({ premium: v })} /></F2>
          <F2 label="Commission estimate"><CUR value={f.commission} onChange={(v) => set({ commission: v })} /></F2>
        </div>
      </div>
      <div className="form-section" style={{ marginBottom: 12 }}>
        <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Member list</span>
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600, color: tooFew ? "var(--red)" : "var(--accent)" }}>{members.length} member{members.length !== 1 ? "s" : ""} {tooFew ? "· minimum 3" : "✓"}</span>
        </div>
        <div style={{ marginBottom: 12 }}><FD label="Batch upload member list" sub="CSV or Excel · or add members manually below" /></div>
        <div style={{ overflowX: "auto" }}>
          <table className="member-tbl">
            <thead><tr><th>Full name</th><th>Date of birth</th><th>Age</th><th>Role</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {members.map((m, i) => <MemberRow key={i} m={m} onChange={(mm) => setMember(i, mm)} onRemove={() => removeMember(i)} />)}
            </tbody>
          </table>
        </div>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={addMember}><I.plus size={14} /> Add member</button>
      </div>
      {tooFew && (
        <div className="callout" style={{ marginBottom: 0 }}>
          <span className="co-ico"><I.alertTri size={16} /></span>
          <div><b>Minimum 3 members required.</b> You can save this as a draft now, but final submission is blocked until at least 3 members are added.</div>
        </div>
      )}
    </div>
  );
}

function Step3Travel({ f, set }) {
  const a = age2(f.dob);
  const days = daysBetween(f.departure, f.returnDate);
  return (
    <div>
      <div className="callout accent" style={{ marginBottom: 20 }}>
        <span className="co-ico"><I.plane size={16} /></span>
        <div>Travel insurance is a <b>lighter, per-trip workflow</b>. Passport, payment, and portal processing tasks are auto-created on save.</div>
      </div>
      <div className="form-section">
        <div className="form-section-title">Traveler</div>
        <div className="grid-3">
          <F2 label="Traveler full name" req span={2}><TI value={f.displayName} onChange={(v) => set({ displayName: v })} /></F2>
          <F2 label="Passport number" req hint="Before issuance"><TI value={f.passport} onChange={(v) => set({ passport: v })} placeholder="P1234567A" /></F2>
          <F2 label="Date of birth" req><TI type="date" value={f.dob} onChange={(v) => set({ dob: v })} /></F2>
          <F2 label="Age" hint="Must be within accepted range"><input className="input" value={a !== "" ? a + " years" : ""} placeholder="—" readOnly style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} /></F2>
          <F2 label="Travel purpose"><SEL value={f.travelPurpose} onChange={(v) => set({ travelPurpose: v })} options={O.travelPurpose} /></F2>
        </div>
        <F2 label="Passport upload" req><FD label="Upload passport copy" sub="Required before issuance" /></F2>
      </div>
      <div className="form-section">
        <div className="form-section-title">Trip</div>
        <div className="grid-3">
          <F2 label="Destination country" req><TI value={f.destination} onChange={(v) => set({ destination: v })} placeholder="e.g. Japan" /></F2>
          <F2 label="Departure date" req><TI type="date" value={f.departure} onChange={(v) => set({ departure: v })} /></F2>
          <F2 label="Return date" req><TI type="date" value={f.returnDate} onChange={(v) => set({ returnDate: v })} /></F2>
        </div>
        {days !== "" && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: -4 }}>Travel days: <b style={{ color: "var(--text)" }}>{days} days</b> (auto-calculated)</div>}
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Payment & processing</div>
        <div className="grid-3">
          <F2 label="Payment status" req><SEL value={f.paymentStatus} onChange={(v) => set({ paymentStatus: v })} options={O.paymentStatus} /></F2>
          <F2 label="Payment link sent?"><YN value={f.payLinkSent} onChange={(v) => set({ payLinkSent: v })} /></F2>
          <F2 label="Portal processing status"><SEL value={f.portalStatus} onChange={(v) => set({ portalStatus: v })} options={O.portalStatus} /></F2>
        </div>
        <F2 label="Estimated premium"><CUR value={f.premium} onChange={(v) => set({ premium: v })} /></F2>
      </div>
    </div>
  );
}

function Step3({ f, set }) {
  if (!f.category) return <div className="callout"><span className="co-ico"><I.alertTri size={16} /></span><div>Select a product category in Step 1 to configure product-specific details.</div></div>;
  if (f.category === "health") return <Step3Health f={f} set={set} />;
  if (f.category === "hmo") return <Step3Group f={f} set={set} />;
  if (f.category === "travel") return <Step3Travel f={f} set={set} />;
  return null;
}

/* ---------- STEP 4: Requirements & documents ---------- */
function Step4({ f, set }) {
  const base = NA_CHECKLISTS_REF()[f.category] || [];
  // extra reqs from health pre-existing
  const list = f.checklist;
  const toggle = (name) => set({ checklist: list.map((x) => x.name === name ? { ...x, checked: !x.checked } : x) });
  const setStatus = (name, st) => set({ checklist: list.map((x) => x.name === name ? { ...x, status: st } : x) });
  return (
    <div>
      <div className="callout accent" style={{ marginBottom: 18 }}>
        <span className="co-ico"><I.clipboard size={16} /></span>
        <div>This checklist was <b>auto-generated from the selected product</b>. Check off items as they're received; upload documents now or request them later.</div>
      </div>
      <div className="form-section">
        <div className="form-section-title">Requirement checklist</div>
        <div className="req-list">
          {list.map((r) => (
            <div key={r.name} className={"req-item" + (r.checked ? " checked" : "")}>
              <div className="req-check" onClick={() => toggle(r.name)}>{r.checked && <I.check size={13} />}</div>
              <div className="req-name">{r.name}{r.cond && <span className="rq-cond">{r.cond}</span>}</div>
              <select className="select req-doc-status" style={{ width: "auto", height: 30, minWidth: 118 }} value={r.status || "Pending"} onChange={(e) => setStatus(r.name, e.target.value)}>
                {O.docStatus.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">Upload documents</div>
        <FD />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn"><I.send size={15} /> Request missing documents</button>
        </div>
      </div>
    </div>
  );
}
function NA_CHECKLISTS_REF() { return window.NAShared.NA_CHECKLISTS; }

/* ---------- STEP 5: Communication & follow-up ---------- */
function Step5({ f, set }) {
  const applyTemplate = (t) => {
    const store = window.TemplatesStore;
    const seed = store && store.get(t);
    if (seed) {
      const nm = (f.displayName || f.companyName || "there").split(" ")[0];
      const cx = { first_name: nm, product: f.product || "your plan", premium: f.premium ? "₱" + f.premium : "your premium", agent: f.agent || "Pacific Insurance PH" };
      set({ emailTemplate: t, emailSubject: store.fill(seed.subject, cx), emailBody: store.fill(seed.body, cx) });
    } else set({ emailTemplate: t });
  };
  return (
    <div>
      <div className="form-section">
        <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Initial email</span>
          <button type="button" className={"switch" + (f.sendEmail ? " on" : "")} onClick={() => set({ sendEmail: !f.sendEmail, emailRecipient: f.emailRecipient || f.email })}></button>
        </div>
        {f.sendEmail ? (
          <>
            <div className="grid-2">
              <F2 label="Email template" req><SEL value={f.emailTemplate} onChange={applyTemplate} options={["", ...(window.TemplatesStore ? window.TemplatesStore.names(true) : O.emailTemplates)]} /></F2>
              <F2 label="Recipient" req><TI type="email" value={f.emailRecipient || f.email} onChange={(v) => set({ emailRecipient: v })} placeholder="client@email.com" /></F2>
            </div>
            <F2 label="Subject"><TI value={f.emailSubject} onChange={(v) => set({ emailSubject: v })} /></F2>
            <F2 label="Message"><TA value={f.emailBody} onChange={(v) => set({ emailBody: v })} style={{ minHeight: 130 }} /></F2>
          </>
        ) : <div style={{ fontSize: 12.5, color: "var(--text-subtle)", paddingBottom: 4 }}>Toggle on to compose an initial email from a template.</div>}
      </div>

      <div className="form-section">
        <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>WhatsApp follow-up</span>
          <button type="button" className={"switch" + (f.sendWA ? " on" : "")} onClick={() => set({ sendWA: !f.sendWA })}></button>
        </div>
        {f.sendWA ? (
          <F2 label="Message template" req><SEL value={f.waTemplate} onChange={(v) => set({ waTemplate: v })} options={["", ...O.waTemplates]} /></F2>
        ) : <div style={{ fontSize: 12.5, color: "var(--text-subtle)", paddingBottom: 4 }}>Toggle on to draft a WhatsApp message.</div>}
        <F2 label="Log Viber conversation (optional)"><TA value={f.viberLog} onChange={(v) => set({ viberLog: v })} placeholder="Paste or summarize a Viber conversation to save to the client timeline" /></F2>
      </div>

      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Follow-up task</span>
          <button type="button" className={"switch" + (f.createTask ? " on" : "")} onClick={() => set({ createTask: !f.createTask })}></button>
        </div>
        {f.createTask && (
          <div className="grid-2">
            <F2 label="Follow-up date" req><TI type="datetime-local" value={f.followDate} onChange={(v) => set({ followDate: v })} /></F2>
            <F2 label="Task owner" req><SEL value={f.taskOwner || f.agent} onChange={(v) => set({ taskOwner: v })} options={["", ...O.agents]} /></F2>
          </div>
        )}
        <F2 label="Internal note"><TA value={f.internalNote} onChange={(v) => set({ internalNote: v })} placeholder="Adds a private note to the client timeline" /></F2>
      </div>
    </div>
  );
}

/* ---------- STEP 6: Review & create ---------- */
function Step6({ f, set, dup }) {
  const cat = O.categories.find((c) => c.id === f.category);
  const clientName = f.displayName || f.companyName || "—";
  const contact = f.email || f.mobile || "—";
  const tasks = [];
  if (f.preExisting === "Yes") { tasks.push("Request medical records"); tasks.push("Check Pacific Cross questionnaire"); }
  if (f.category === "travel") { tasks.push("Send payment link"); tasks.push("Collect passport copy"); tasks.push("Process in portal after payment"); }
  if (f.createTask) tasks.push("Follow-up on " + (f.followDate ? new Date(f.followDate).toLocaleDateString("en-PH") : "scheduled date"));
  if (f.appType && f.appType.includes("New Insurance")) tasks.push("Submit to Pacific Cross");
  const row = (k, v, muted) => <div className="review-row"><span className="rr-k">{k}</span><span className={"rr-v" + (muted ? " muted" : "")}>{v || "Not set"}</span></div>;
  return (
    <div>
      {dup && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <span className="co-ico"><I.alertTri size={16} /></span>
          <div><b>Possible duplicate.</b> A client with a similar name or contact already exists ({dup}). Review before creating to avoid a duplicate record.</div>
        </div>
      )}
      <div className="review-grid">
        <div className="review-card">
          <div className="review-card-head"><span className="rch-ico"><I.user size={14} /></span> {f.category === "hmo" ? "Group account" : "Client"}</div>
          <div className="review-rows">
            {row("Name", clientName)}
            {row("Contact", contact)}
            {f.category !== "hmo" && row("Channels", f.channels.length ? f.channels.join(", ") : "", !f.channels.length)}
            {f.clientMode === "existing" && row("Linked to", f.existingClient)}
          </div>
        </div>
        <div className="review-card">
          <div className="review-card-head"><span className="rch-ico"><I.shield size={14} /></span> Product & ownership</div>
          <div className="review-rows">
            {row("Category", cat ? cat.name : "")}
            {row("Product", f.product)}
            {row("Agent", f.agent)}
            {row("Source", f.source)}
            {row("Priority", f.priority)}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Application status</div>
        <F2 label="Set initial application status" req>
          <SEL value={f.status} onChange={(v) => set({ status: v })} options={O.statuses} />
        </F2>
      </div>

      <div className="form-section" style={{ marginBottom: 0 }}>
        <div className="form-section-title">This will automatically create</div>
        <div className="actions-preview">
          <div className="action-prev-item"><span className="api-ico"><I.user size={13} /></span> {f.category === "hmo" ? "Company/group account" : "Client record"} — status <b style={{ margin: "0 3px" }}>{f.status}</b></div>
          <div className="action-prev-item"><span className="api-ico"><I.fileText size={13} /></span> Application record linked to {f.product || "product"} &amp; {f.agent || "agent"}</div>
          <div className="action-prev-item"><span className="api-ico"><I.shield size={13} /></span> Product / policy shell (tracks application progress)</div>
          <div className="action-prev-item"><span className="api-ico"><I.clipboard size={13} /></span> Document checklist ({f.checklist.length} items)</div>
          <div className="action-prev-item"><span className="api-ico"><I.clock size={13} /></span> Timeline entry — "Application created by {f.agent || "agent"}"</div>
          {tasks.map((t, i) => <div className="action-prev-item" key={i}><span className="api-ico"><I.checkSquare size={13} /></span> Task — {t}</div>)}
          {f.sendEmail && <div className="action-prev-item"><span className="api-ico"><I.mail size={13} /></span> Email — {f.emailTemplate || "initial email"}</div>}
        </div>
      </div>
    </div>
  );
}

window.NASteps36 = { Step3, Step4, Step5, Step6 };
