// New Client Application — Step content components
const S = window.NAShared;
const { Field, TextInput, Textarea, Select, Currency, YesNo, MultiChips, FileDrop, ageFromDob, daysBetween } = S;
const { NA_OPTS, NA_CHECKLISTS } = S;

/* ---------- Existing client picker (searches real client records) ---------- */
function ExistingClientPicker({ f, set }) {
  const [q, setQ] = React.useState("");
  const rec = f.existingClientRec;
  const results = React.useMemo(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    return window.PData.CLIENTS.filter((c) => c.name.toLowerCase().includes(ql) || c.email.toLowerCase().includes(ql) || c.city.toLowerCase().includes(ql)).slice(0, 4);
  }, [q]);
  const pick = (c) => {
    const info = S.existingClientInfo(c);
    set({ existingClientRec: c, existingClient: c.name, displayName: c.name, email: info.email, mobile: info.mobile, dob: info.dob });
    setQ("");
  };
  const clear = () => set({ existingClientRec: null, existingClient: "", displayName: "", email: "", mobile: "", dob: "" });
  if (rec) {
    return (
      <div className="client-result on" onClick={clear}>
        <Avatar name={rec.name} size={30} />
        <div style={{ flex: 1 }}><div className="cr-name">{rec.name}</div><div className="cr-sub">{rec.email} · {rec.city}</div></div>
        <span className="badge green"><span className="b-dot"></span>Linked</span>
      </div>
    );
  }
  return (
    <>
      <div className="filter-search" style={{ width: "100%", height: 38, marginBottom: results.length ? 8 : 0 }}>
        <I.search size={16} />
        <input placeholder="Search by name, email, or city…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results.map((c) => (
        <div key={c.email} className="client-result" onClick={() => pick(c)}>
          <Avatar name={c.name} size={30} />
          <div style={{ flex: 1 }}><div className="cr-name">{c.name}</div><div className="cr-sub">{c.email} · {c.policies} policies</div></div>
          <I.plus size={16} style={{ color: "var(--text-subtle)" }} />
        </div>
      ))}
    </>
  );
}

/* ---------- STEP 1: Client type & application setup ---------- */
function Step1({ f, set }) {
  const cat = NA_OPTS.categories.find((c) => c.id === f.category);
  return (
    <div>
      <div className="form-section">
        <div className="form-section-title">Workflow</div>
        <div className="grid-2">
          <Field label="Application type" req>
            <Select value={f.appType} onChange={(v) => set({ appType: v })} options={["", ...NA_OPTS.appType]} />
          </Field>
          <Field label="Source" req>
            <Select value={f.source} onChange={(v) => set({ source: v })} options={["", ...NA_OPTS.sources]} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Product</div>
        <div className="grid-2">
          <Field label="Product category" req hint="Products are pulled from the editable Products module.">
            <Select value={f.category} onChange={(v) => set({ category: v, product: "" })} options={[{ v: "", l: "Select…" }, ...NA_OPTS.categories.map((c) => ({ v: c.id, l: c.name }))]} />
          </Field>
          <Field label="Product" req>
            <Select value={f.product} onChange={(v) => set({ product: v })} options={["", ...(cat ? cat.products : [])]} disabled={!cat} />
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Client</div>
        <Field label="New or existing client" req>
          <div className="radio-cards">
            <div className={"radio-card" + (f.clientMode === "new" ? " on" : "")} onClick={() => set({ clientMode: "new", existingClientRec: null, existingClient: "", displayName: "", email: "", mobile: "", dob: "" })}>
              <span className="radio-dot"></span>
              <div><div className="rc-title">New client</div><div className="rc-desc">Create a fresh client profile</div></div>
            </div>
            <div className={"radio-card" + (f.clientMode === "existing" ? " on" : "")} onClick={() => set({ clientMode: "existing" })}>
              <span className="radio-dot"></span>
              <div><div className="rc-title">Existing client</div><div className="rc-desc">Add application under an existing record</div></div>
            </div>
          </div>
        </Field>
        {f.clientMode === "existing" && (
          <Field label="Search existing client" req hint="Links this application to the existing client profile — contact details are pulled in automatically.">
            <ExistingClientPicker f={f} set={set} />
          </Field>
        )}
      </div>

      <div className="form-section" style={{ marginBottom: 8 }}>
        <div className="form-section-title">Ownership</div>
        <div className="grid-2">
          <Field label="Assigned agent" req>
            <Select value={f.agent} onChange={(v) => set({ agent: v })} options={["", ...NA_OPTS.agents]} />
          </Field>
          <Field label="Application priority">
            <Select value={f.priority} onChange={(v) => set({ priority: v })} options={NA_OPTS.priority} />
          </Field>
        </div>
      </div>

      <div className="callout accent">
        <span className="co-ico"><I.help size={16} /></span>
        <div><b>Initial status: {f.initialStatus}.</b> If only inquiry details are available it's saved as a Lead. Once an application form or requirements are being collected, it becomes an Applicant.</div>
      </div>
    </div>
  );
}

/* ---------- STEP 2: Client information ---------- */
function Step2({ f, set }) {
  const isGroup = f.category === "hmo";
  if (isGroup) {
    return (
      <div>
        <div className="callout blue" style={{ marginBottom: 20 }}>
          <span className="co-ico"><I.building size={16} /></span>
          <div>Group HMO creates a <b>Company / Group account</b> with multiple members. Enter the primary contact here — members are added in the next step.</div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Company / group</div>
          <div className="grid-2">
            <Field label="Company / group name" req span={2}><TextInput value={f.companyName} onChange={(v) => set({ companyName: v })} placeholder="e.g. Northwind Logistics Inc." /></Field>
            <Field label="Company contact person" req><TextInput value={f.companyContact} onChange={(v) => set({ companyContact: v })} placeholder="Full name" /></Field>
            <Field label="Contact number" req><TextInput value={f.mobile} onChange={(v) => set({ mobile: v })} placeholder="+63 9XX XXX XXXX" /></Field>
            <Field label="Contact email" req><TextInput type="email" value={f.email} onChange={(v) => set({ email: v })} placeholder="hr@company.com" /></Field>
            <Field label="Number of members" req hint="Minimum 3 members required.">
              <TextInput type="number" min="3" value={f.memberCount} onChange={(v) => set({ memberCount: v })} placeholder="3" />
            </Field>
            <Field label="Company address" span={2}><Textarea value={f.address} onChange={(v) => set({ address: v })} placeholder="Building, street, city, province" /></Field>
          </div>
        </div>
        <div className="callout accent" style={{ marginBottom: 0 }}>
          <span className="co-ico"><I.check size={16} /></span>
          <div><b>Minimum to save draft:</b> company name, one contact method, product category, and assigned agent. This creates a Lead you can complete later.</div>
        </div>
      </div>
    );
  }
  const age = ageFromDob(f.dob);
  const linked = f.clientMode === "existing" && f.existingClientRec;
  return (
    <div>
      {linked ? (
        <div className="autofill-card" style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
            <Avatar name={f.existingClientRec.name} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 650 }}>{f.existingClientRec.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>Linked existing client · profile pulled in automatically</div>
            </div>
            <span className="badge green"><span className="b-dot"></span>Existing</span>
          </div>
          <div className="af-row"><span className="af-k">Email</span><span className="af-v">{f.email}</span></div>
          <div className="af-row"><span className="af-k">Mobile</span><span className="af-v">{f.mobile}</span></div>
          <div className="af-row"><span className="af-k">Date of birth</span><span className="af-v">{f.dob} · {age} yrs</span></div>
        </div>
      ) : (
      <div className="form-section">
        <div className="form-section-title">Name</div>
        <div className="grid-3">
          <Field label="First name" req><TextInput value={f.firstName} onChange={(v) => set({ firstName: v, displayName: (v + " " + (f.lastName || "")).trim() })} /></Field>
          <Field label="Middle name"><TextInput value={f.middleName} onChange={(v) => set({ middleName: v })} /></Field>
          <Field label="Last name" req><TextInput value={f.lastName} onChange={(v) => set({ lastName: v, displayName: ((f.firstName || "") + " " + v).trim() })} /></Field>
        </div>
        <Field label="Client display name" req hint="Auto-generated from name, editable. Used throughout the CRM."><TextInput value={f.displayName} onChange={(v) => set({ displayName: v })} /></Field>
      </div>
      )}

      <div className="form-section">
        <div className="form-section-title">Contact</div>
        {!linked && (
          <div className="grid-2">
            <Field label="Email address" hint="Required if email communication will be used."><TextInput type="email" value={f.email} onChange={(v) => set({ email: v })} placeholder="name@email.com" /></Field>
            <Field label="Mobile number" req hint="Enables call, WhatsApp, and Viber documentation."><TextInput value={f.mobile} onChange={(v) => set({ mobile: v })} placeholder="+63 9XX XXX XXXX" /></Field>
          </div>
        )}
        <Field label="Preferred communication channel" req>
          <MultiChips selected={f.channels} onToggle={(c) => set({ channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] })} options={NA_OPTS.channels} />
        </Field>
      </div>

      <div className="form-section">
        <div className="form-section-title">Personal details</div>
        <div className="grid-3">
          {!linked && <Field label="Date of birth"><TextInput type="date" value={f.dob} onChange={(v) => set({ dob: v })} /></Field>}
          {!linked && <Field label="Age" hint="Auto-calculated"><input className="input" value={age !== "" ? age + " years" : ""} placeholder="—" readOnly style={{ background: "var(--surface-3)", color: "var(--text-muted)" }} /></Field>}
          <Field label="Gender"><Select value={f.gender} onChange={(v) => set({ gender: v })} options={NA_OPTS.gender} /></Field>
          <Field label="Civil status"><Select value={f.civil} onChange={(v) => set({ civil: v })} options={NA_OPTS.civil} /></Field>
          <Field label="Nationality"><TextInput value={f.nationality} onChange={(v) => set({ nationality: v })} placeholder="Filipino" /></Field>
          <Field label="Occupation"><TextInput value={f.occupation} onChange={(v) => set({ occupation: v })} /></Field>
        </div>
        <Field label="Address" hint="Optional now; may be required before final submission."><Textarea value={f.address} onChange={(v) => set({ address: v })} placeholder="Unit, street, barangay, city, province" /></Field>
        <Field label="Notes"><Textarea value={f.notes} onChange={(v) => set({ notes: v })} placeholder="Discovery notes and client context" /></Field>
      </div>

      <div className="callout accent" style={{ marginBottom: 0 }}>
        <span className="co-ico"><I.check size={16} /></span>
        <div>{linked ? <><b>Contact details pulled from the linked client.</b> Only add product and application details for this new application.</> : <><b>Minimum to save draft:</b> name, one contact method (email or phone), product category, and assigned agent. This creates a Lead record you can complete later.</>}</div>
      </div>
    </div>
  );
}

window.NASteps12 = { Step1, Step2 };
