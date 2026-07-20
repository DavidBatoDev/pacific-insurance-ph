// Pacific Insurance PH — Settings (settings-page.md)
// 6-tab admin surface: General · Team · Notifications · Payment Channels · Billing · Integrations.
// Reuses the persona/permission model (permissions.jsx), the Email Templates store for rule copy,
// and the app's existing switch / field / badge / table UI. Light config stores only — no parallel
// stores for contacts/policies.
const { useState: useStateSet, useEffect: useEffectSet } = React;
const SD = window.PData;

/* ============================ config stores (light) ============================ */
// Singleton agency profile (General tab)
window.AgencyProfile = window.AgencyProfile || {
  name: "Pacific Insurance PH", carrier: "Pacific Cross",
  address: "6789 Ayala Avenue, Makati City, Metro Manila 1226",
  email: "ops@pacificinsurance.ph", timezone: "Asia/Manila (GMT+8)", currency: "₱ PHP — Philippine Peso",
};
// users (name, email, role, status, last active) — the surface the persona switcher previews
window.UsersStore = window.UsersStore || {
  users: [
    { id: "matt", name: "Matt Nassr", email: "matt@pacificinsurance.ph", role: "Admin", status: "Active", last: "Active now" },
    { id: "eman", name: "Eman Bondoc", email: "eman@pacificinsurance.ph", role: "Staff", status: "Active", last: "2 hours ago" },
    { id: "joy", name: "Joy Mercado", email: "joy@pacificinsurance.ph", role: "Agent", status: "Active", last: "Yesterday" },
    { id: "bea", name: "Bea Ramos", email: "bea@pacificinsurance.ph", role: "Agent", status: "Invited", last: "—" },
    { id: "paolo", name: "Paolo Guisado", email: "paolo@pacificinsurance.ph", role: "Agent", status: "Disabled", last: "3 weeks ago" },
  ],
};
// payment_channels — Official Payment Channels (never personal accounts)
window.PaymentChannelsStore = window.PaymentChannelsStore || {
  channels: [
    { id: "pc1", label: "Pacific GCash for Business", type: "GCash for Business", account: "Pacific Insurance PH Inc.", number: "0917 888 2100", default: true, active: true },
    { id: "pc2", label: "BPI Corporate Current", type: "Company Bank", account: "Pacific Insurance PH Inc.", number: "BPI · 1234-5678-90", default: false, active: true },
    { id: "pc3", label: "BDO Collections", type: "Company Bank", account: "Pacific Insurance PH Inc.", number: "BDO · 0055-2211-88", default: false, active: false },
  ],
};
// notification_rules — the automation engine config
window.NotificationRulesStore = window.NotificationRulesStore || {
  rules: [
    { key: "renewal", name: "Renewal reminder", enabled: true, timing: "30 / 15 / 7 days before expiry, then overdue", channels: ["Email", "WhatsApp"], template: "Renewal reminder", logic: ["Suppress if paid (Early-payer)", "Escalate overdue"], autoSend: false },
    { key: "payment", name: "Payment reminder", enabled: true, timing: "On Awaiting Payment, then every 3 days", channels: ["Email", "WhatsApp"], template: "Payment instruction", logic: ["Stop when payment verified"], autoSend: false },
    { key: "missingdocs", name: "Missing-document reminder", enabled: true, timing: "While requirements outstanding", channels: ["Email", "WhatsApp"], template: "Request missing documents", logic: ["Stop when documents complete"], autoSend: false },
    { key: "taskcreate", name: "Task / follow-up auto-create", enabled: true, timing: "On status changes (e.g. OR entered)", channels: ["Internal task"], template: "—", logic: ["Creates a task on the linked contact"], autoSend: true },
    { key: "statuschange", name: "Status-change notifications", enabled: false, timing: "On record status transitions", channels: ["In-app", "Email"], template: "—", logic: ["Notify the assigned owner"], autoSend: true },
  ],
};

/* ================================ shared bits ================================ */
const setToastS = (title, sub) => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, sub } }));
const ROLE_TONE = { Admin: "green", Staff: "blue", Agent: "slate" };
const USTATUS_TONE = { Active: "green", Invited: "amber", Disabled: "red" };
const CHAN_TONE = { WhatsApp: "green", Email: "blue", "In-app": "violet", Viber: "amber", "Internal task": "slate" };

function TextField({ label, value, onChange, readOnly, type, multiline, hint }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      {multiline
        ? <textarea className="textarea" value={value} readOnly={readOnly} onChange={(e) => onChange && onChange(e.target.value)} style={readOnly ? { background: "var(--surface-3)", cursor: "default" } : null} />
        : <input className="input" type={type || "text"} value={value} readOnly={readOnly} onChange={(e) => onChange && onChange(e.target.value)} style={readOnly ? { background: "var(--surface-3)", cursor: "default" } : null} />}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function SelectField({ label, value, onChange, options, readOnly }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select className="select" value={value} disabled={readOnly} onChange={(e) => onChange && onChange(e.target.value)} style={readOnly ? { background: "var(--surface-3)" } : null}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/* ================================= General ================================= */
function GeneralTab({ canEdit }) {
  const [f, setF] = useStateSet({ ...window.AgencyProfile });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(window.AgencyProfile);
  const save = () => { window.AgencyProfile = { ...f }; setToastS("Settings saved", "Agency profile updated."); setF({ ...f }); };
  return (
    <div className="set-pane">
      <div className="grid-2" style={{ gap: 18 }}>
        <TextField label="Agency name" value={f.name} onChange={set("name")} readOnly={!canEdit} />
        <SelectField label="Primary carrier" value={f.carrier} onChange={set("carrier")} readOnly={!canEdit} options={["Pacific Cross", "Maxicare", "Insular Life", "+ Add provider…"]} />
      </div>
      <TextField label="Business address" value={f.address} onChange={set("address")} readOnly={!canEdit} multiline />
      <div className="grid-2" style={{ gap: 18 }}>
        <TextField label="Contact email" value={f.email} onChange={set("email")} readOnly={!canEdit} type="email" />
        <SelectField label="Timezone / locale" value={f.timezone} onChange={set("timezone")} readOnly={!canEdit} options={["Asia/Manila (GMT+8)", "Asia/Singapore (GMT+8)", "Asia/Hong_Kong (GMT+8)"]} />
      </div>
      <div className="grid-2" style={{ gap: 18 }}>
        <SelectField label="Currency" value={f.currency} onChange={set("currency")} readOnly={!canEdit} options={["₱ PHP — Philippine Peso", "$ USD — US Dollar"]} />
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Logo / brand mark</label>
          <div className="set-logo">
            <div className="set-logo-mark">PI</div>
            <div className="set-logo-body">
              <div className="set-logo-name">pacific-logo.svg</div>
              <div className="set-logo-hint">Used on branded invoices &amp; e-cards</div>
            </div>
            {canEdit && <button className="btn xs" onClick={() => setToastS("Upload", "Logo upload — connect storage to enable.")}><I.upload size={13} /> Replace</button>}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="set-actions">
          <button className="btn primary" disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>Save changes</button>
          <button className="btn" disabled={!dirty} onClick={() => setF({ ...window.AgencyProfile })}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/* =================================== Team ================================== */
function InviteModal({ onClose, onInvite }) {
  const [email, setEmail] = useStateSet("");
  const [role, setRole] = useStateSet("Agent");
  const ok = /.+@.+\..+/.test(email);
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.user size={20} /></div>
          <div><h2>Invite user</h2><div className="dh-sub">Send a workspace invitation by email</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="field"><label>Email address<span className="req"> *</span></label><input className="input" type="email" value={email} placeholder="name@pacificinsurance.ph" onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label>Role<span className="req"> *</span></label><select className="select" value={role} onChange={(e) => setRole(e.target.value)}><option>Admin</option><option>Staff</option><option>Agent</option></select>
            <div className="hint">{role === "Admin" ? "Full access — settings, team, billing." : role === "Staff" ? "Full pipeline CRUD; view-only settings." : "Own records only; no settings access."}</div>
          </div>
          <div className="callout accent" style={{ marginBottom: 0 }}><span className="co-ico"><I.command size={15} /></span><div>Adds an <b>Invited</b> user to the team roster. Real auth &amp; email delivery land in a later release.</div></div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ok} style={!ok ? { opacity: .5, cursor: "not-allowed" } : null} onClick={() => { onInvite(email, role); onClose(); }}><I.mail size={15} /> Send invite</button>
        </div>
      </div>
    </div>, document.body);
}

function TeamTab() {
  const [users, setUsers] = useStateSet(window.UsersStore.users.map((u) => ({ ...u })));
  const [invite, setInvite] = useStateSet(false);
  const sync = (next) => { window.UsersStore.users = next; setUsers(next.map((u) => ({ ...u }))); };
  const setRole = (id, role) => { sync(users.map((u) => u.id === id ? { ...u, role } : u)); setToastS("Role updated", `${users.find((u) => u.id === id).name} is now ${role}.`); };
  const deactivate = (id) => { sync(users.map((u) => u.id === id ? { ...u, status: u.status === "Disabled" ? "Active" : "Disabled", last: u.status === "Disabled" ? "Active now" : u.last } : u)); };
  const doInvite = (email, role) => { const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); sync([...users, { id: "u" + Date.now(), name, email, role, status: "Invited", last: "—" }]); setToastS("Invitation sent", `${email} invited as ${role}.`); };
  return (
    <div className="set-pane wide">
      <div className="set-tabhead">
        <div><div className="set-tabhead-t">Users &amp; roles</div><div className="set-tabhead-s">{users.filter((u) => u.status === "Active").length} active · {users.filter((u) => u.status === "Invited").length} invited · soft-deactivate preserves history</div></div>
        <button className="btn primary sm" onClick={() => setInvite(true)}><I.plus size={14} /> Invite user</button>
      </div>
      <div className="set-tbl-wrap">
        <table className="tbl set-tbl">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last active</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.status === "Disabled" ? "set-row-off" : ""}>
                <td><div className="client-cell"><Avatar name={u.name} size={30} /><div className="cc-name">{u.name}</div></div></td>
                <td className="cell-muted mono" style={{ fontSize: 12 }}>{u.email}</td>
                <td>
                  <select className="set-inline-sel" value={u.role} onChange={(e) => setRole(u.id, e.target.value)} disabled={u.status === "Disabled"}>
                    <option>Admin</option><option>Staff</option><option>Agent</option>
                  </select>
                </td>
                <td><span className={"badge " + USTATUS_TONE[u.status]}><span className="b-dot"></span>{u.status}</span></td>
                <td className="cell-muted">{u.last}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="set-link-btn" onClick={() => deactivate(u.id)}>{u.status === "Disabled" ? "Reactivate" : "Deactivate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="set-note"><I.shield size={14} /> Role changes here preview through the topbar <b>"View as"</b> switcher. Real authentication &amp; invitations land in a later release; assigned-agent reassignment stays Admin-only.</div>
      {invite && <InviteModal onClose={() => setInvite(false)} onInvite={doInvite} />}
    </div>
  );
}

/* =============================== Notifications ============================== */
function ChannelTag({ ch }) { return <span className={"set-chan " + (CHAN_TONE[ch] || "slate")}>{ch}</span>; }

function NotificationsTab({ canEdit }) {
  const [rules, setRules] = useStateSet(window.NotificationRulesStore.rules.map((r) => ({ ...r })));
  const sync = (next) => { window.NotificationRulesStore.rules = next; setRules(next.map((r) => ({ ...r }))); };
  const toggle = (key) => { if (!canEdit) return; const next = rules.map((r) => r.key === key ? { ...r, enabled: !r.enabled } : r); sync(next); const r = next.find((x) => x.key === key); setToastS(r.name + (r.enabled ? " enabled" : " paused"), r.enabled ? "Rule is active." : "Rule paused — no messages queued."); };
  const toggleAuto = (key) => { if (!canEdit) return; sync(rules.map((r) => r.key === key ? { ...r, autoSend: !r.autoSend } : r)); };
  return (
    <div className="set-pane wide">
      <div className="callout accent" style={{ marginBottom: 18 }}>
        <span className="co-ico"><I.command size={15} /></span>
        <div>Sends stay <b>human-in-the-loop</b> — each rule <b>queues a drafted message for review</b> unless set to auto-send. <b>WhatsApp is the preferred automation channel</b>; <b>Viber is manual-log only</b>. Rule copy is pulled from <b>Email Templates</b> so wording is edited once, centrally.</div>
      </div>
      <div className="set-rules">
        {rules.map((r) => (
          <div className={"set-rule" + (r.enabled ? "" : " off")} key={r.key}>
            <button className={"switch" + (r.enabled ? " on" : "")} onClick={() => toggle(r.key)} disabled={!canEdit} style={!canEdit ? { opacity: .6, cursor: "default" } : null}></button>
            <div className="set-rule-main">
              <div className="set-rule-top">
                <span className="set-rule-name">{r.name}</span>
                <div className="set-rule-chans">{r.channels.map((c) => <ChannelTag key={c} ch={c} />)}</div>
              </div>
              <div className="set-rule-timing"><I.refresh size={12} /> {r.timing}</div>
              <div className="set-rule-meta">
                {r.template !== "—" && <button className="set-tpl-link" onClick={() => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "templates" } }))} title="Edit in Email Templates"><I.fileText size={11} /> {r.template}</button>}
                {r.logic.map((l, i) => <span className="set-logic" key={i}>{l}</span>)}
              </div>
            </div>
            <div className="set-rule-send">
              <span className={"set-sendmode " + (r.autoSend ? "auto" : "queue")}>{r.channels[0] === "Internal task" || r.channels[0] === "In-app" ? "Automatic" : r.autoSend ? "Auto-send" : "Queue for review"}</span>
              {canEdit && r.template !== "—" && r.channels.some((c) => c === "Email" || c === "WhatsApp") &&
                <button className="set-mini-toggle" onClick={() => toggleAuto(r.key)} title="Toggle auto-send vs. queue for review">{r.autoSend ? "Switch to review" : "Enable auto-send"}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================= Payment Channels ============================ */
function ChannelModal({ channel, onClose, onSave }) {
  const editing = !!channel;
  const [f, setF] = useStateSet(channel ? { ...channel } : { label: "", type: "GCash for Business", account: "Pacific Insurance PH Inc.", number: "", active: true });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const ok = f.label.trim() && f.number.trim();
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" style={{ maxWidth: 460 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.peso size={20} /></div>
          <div><h2>{editing ? "Edit channel" : "Add payment channel"}</h2><div className="dh-sub">Official business account — never a personal wallet</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="field"><label>Label<span className="req"> *</span></label><input className="input" value={f.label} placeholder="e.g. Pacific GCash for Business" onChange={(e) => set("label")(e.target.value)} /></div>
          <div className="field"><label>Type<span className="req"> *</span></label><select className="select" value={f.type} onChange={(e) => set("type")(e.target.value)}><option>GCash for Business</option><option>Company Bank</option></select></div>
          <div className="field"><label>Account name</label><input className="input" value={f.account} onChange={(e) => set("account")(e.target.value)} /></div>
          <div className="field"><label>{f.type === "Company Bank" ? "Bank · Account number" : "GCash number / handle"}<span className="req"> *</span></label><input className="input" value={f.number} placeholder={f.type === "Company Bank" ? "BPI · 1234-5678-90" : "0917 000 0000"} onChange={(e) => set("number")(e.target.value)} /></div>
          <div className="callout amber" style={{ marginBottom: 0 }}><span className="co-ico"><I.shield size={15} /></span><div>Collections for the Travel prepay flow route here. <b>Business accounts only</b> — the single biggest trust win.</div></div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!ok} style={!ok ? { opacity: .5, cursor: "not-allowed" } : null} onClick={() => { onSave(f); onClose(); }}>{editing ? "Save channel" : "Add channel"}</button>
        </div>
      </div>
    </div>, document.body);
}

function PaymentChannelsTab({ canEdit }) {
  const [channels, setChannels] = useStateSet(window.PaymentChannelsStore.channels.map((c) => ({ ...c })));
  const [modal, setModal] = useStateSet(null); // 'add' | channel obj
  const sync = (next) => { window.PaymentChannelsStore.channels = next; setChannels(next.map((c) => ({ ...c }))); };
  const setDefault = (id) => { sync(channels.map((c) => ({ ...c, default: c.id === id }))); setToastS("Default channel set", channels.find((c) => c.id === id).label + " is now the default payee."); };
  const toggleActive = (id) => sync(channels.map((c) => c.id === id ? { ...c, active: !c.active } : c));
  const save = (f) => {
    if (f.id) { sync(channels.map((c) => c.id === f.id ? { ...c, ...f } : c)); setToastS("Channel updated", f.label + " saved."); }
    else { const c = { ...f, id: "pc" + Date.now(), default: channels.length === 0 }; sync([...channels, c]); setToastS("Channel added", f.label + " added to Official Payment Channels."); }
  };
  return (
    <div className="set-pane wide">
      <div className="set-tabhead">
        <div><div className="set-tabhead-t">Official Payment Channels</div><div className="set-tabhead-s">Business GCash / company bank accounts collections route through — never personal</div></div>
        {canEdit && <button className="btn primary sm" onClick={() => setModal("add")}><I.plus size={14} /> Add channel</button>}
      </div>
      <div className="set-tbl-wrap">
        <table className="tbl set-tbl">
          <thead><tr><th>Label</th><th>Type</th><th>Account name</th><th>Number / handle</th><th>Default</th><th>Active</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} className={c.active ? "" : "set-row-off"}>
                <td><div className="set-chan-label"><span className={"set-chan-ico " + (c.type === "GCash for Business" ? "gcash" : "bank")}><I.peso size={14} /></span><span className="cc-name">{c.label}</span></div></td>
                <td className="cell-muted">{c.type}</td>
                <td className="cell-muted">{c.account}</td>
                <td className="cell-muted mono" style={{ fontSize: 12 }}>{c.number}</td>
                <td>{c.default ? <span className="badge green"><span className="b-dot"></span>Default</span> : canEdit ? <button className="set-link-btn" onClick={() => setDefault(c.id)} disabled={!c.active}>Set default</button> : <span className="cell-muted">—</span>}</td>
                <td><button className={"switch sm" + (c.active ? " on" : "")} onClick={() => canEdit && toggleActive(c.id)} disabled={!canEdit || c.default} style={!canEdit ? { opacity: .6, cursor: "default" } : null}></button></td>
                {canEdit && <td style={{ textAlign: "right" }}><button className="set-link-btn" onClick={() => setModal(c)}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="set-note"><I.command size={14} /> Consumed by the Travel two-leg payment, <b>Send Payment Instruction</b>, and the <b>Send Payment Links</b> batch — all pick the payee from here.</div>
      {modal && <ChannelModal channel={modal === "add" ? null : modal} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}

/* ================================= Billing ================================= */
function BillingTab() {
  const invoices = [
    { id: "PIH-2026-06", date: "Jun 1, 2026", amt: "₱7,500", status: "Paid" },
    { id: "PIH-2026-05", date: "May 1, 2026", amt: "₱7,500", status: "Paid" },
    { id: "PIH-2026-04", date: "Apr 1, 2026", amt: "₱7,500", status: "Paid" },
  ];
  return (
    <div className="set-pane wide">
      <div className="set-post"><I.command size={13} /> Post-MVP · the CRM's own subscription (distinct from client premium collection)</div>
      <div className="grid12" style={{ marginBottom: 18 }}>
        <div className="col-5">
          <div className="set-plan">
            <div className="set-plan-tier">Growth</div>
            <div className="set-plan-price">₱7,500 <span>/ month</span></div>
            <div className="set-plan-seats"><span>Seats in use</span><b>5 of 10</b></div>
            <div className="set-seat-track"><div className="set-seat-fill" style={{ width: "50%" }}></div></div>
            <button className="btn sm" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => setToastS("Manage plan", "Subscription management — post-MVP.")}>Manage plan</button>
          </div>
        </div>
        <div className="col-7">
          <div className="set-pay-method">
            <div className="set-tabhead-t" style={{ marginBottom: 12 }}>Payment method</div>
            <div className="set-card"><span className="set-card-brand">VISA</span><span className="set-card-num">•••• 4210</span><span className="cell-muted">exp 09/28</span><button className="set-link-btn" style={{ marginLeft: "auto" }}>Update</button></div>
            <div className="set-tabhead-t" style={{ margin: "18px 0 10px" }}>Invoice history</div>
            {invoices.map((iv) => (
              <div className="set-invoice" key={iv.id}>
                <span className="mono" style={{ fontSize: 12 }}>{iv.id}</span>
                <span className="cell-muted">{iv.date}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{iv.amt}</span>
                <span className="badge green"><span className="b-dot"></span>{iv.status}</span>
                <button className="set-link-btn"><I.download size={12} /> PDF</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================== Integrations ============================== */
function IntegrationsTab({ canEdit }) {
  const seed = [
    { key: "gmail", name: "Gmail", role: "Inbound sync + send-in-app — email history per contact", state: "Connected", action: "Disconnect", icon: "mail" },
    { key: "whatsapp", name: "WhatsApp", role: "Preferred automation channel — renewal & payment reminders", state: "Not connected", action: "Connect", icon: "command" },
    { key: "viber", name: "Viber", role: "Manual logging only — not MVP (recurring integration fees). Interactions logged via the Contact Profile.", state: "Manual", action: "Manual-log", icon: "command" },
    { key: "pacific", name: "Pacific Cross portal", role: "Link-out for encoding / OR submission — no API", state: "External", action: "Open portal", icon: "shield" },
  ];
  const [items, setItems] = useStateSet(seed);
  const tone = { Connected: "green", "Not connected": "slate", Manual: "amber", External: "blue" };
  const act = (it) => {
    if (!canEdit && it.state !== "External") { return; }
    if (it.key === "pacific") { setToastS("Pacific Cross portal", "Opens the carrier portal in a new tab."); return; }
    if (it.key === "viber") { setToastS("Viber is manual-log only", "Log Viber chats from the Contact Profile — not MVP."); return; }
    setItems((s) => s.map((x) => x.key === it.key ? (x.state === "Connected" ? { ...x, state: "Not connected", action: "Connect" } : { ...x, state: "Connected", action: "Disconnect" }) : x));
    setToastS(it.name + (it.state === "Connected" ? " disconnected" : " connected"), it.state === "Connected" ? "Sync paused." : "OAuth flow completes in a later release.");
  };
  return (
    <div className="set-pane wide">
      <div className="set-int-grid">
        {items.map((it) => {
          const Ico = I[it.icon];
          return (
            <div className={"set-int" + (it.state === "Connected" ? " on" : "")} key={it.key}>
              <div className="set-int-top">
                <span className="set-int-ico"><Ico size={18} /></span>
                <span className={"badge " + tone[it.state]}><span className="b-dot"></span>{it.state}</span>
              </div>
              <div className="set-int-name">{it.name}</div>
              <div className="set-int-role">{it.role}</div>
              <button className={"btn sm" + (it.state === "Connected" ? "" : it.state === "Not connected" && canEdit ? " primary" : "")}
                onClick={() => act(it)} disabled={!canEdit && it.state !== "External" && it.key !== "pacific" && it.key !== "viber"}
                style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                {it.key === "pacific" ? <><I.arrowRight size={13} /> Open portal</> : it.action}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================== host =================================== */
const SET_TABS = [
  { id: "General", cap: "view" }, { id: "Team", cap: "admin" }, { id: "Notifications", cap: "view" },
  { id: "Payment Channels", cap: "view" }, { id: "Billing", cap: "admin" }, { id: "Integrations", cap: "view" },
];
function SettingsScreen() {
  const role = window.Perms.role();
  const isAdmin = role === "admin";
  const canManage = isAdmin; // Admin manages; Staff view-only where allowed
  const P = window.Perms.person();
  // Staff sees General / Payment Channels / Integrations (view-only); Team & Billing & Notifications are Admin-only.
  const tabs = SET_TABS.filter((t) => isAdmin || t.cap === "view");
  const [tab, setTab] = useStateSet(tabs[0].id);
  useEffectSet(() => { if (!tabs.some((t) => t.id === tab)) setTab(tabs[0].id); }, [role]);

  return (
    <div className="fade-in" data-screen-label="Settings">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span className="kpi-ico" style={{ width: 34, height: 34, borderRadius: 9 }}><I.settings size={19} /></span>Settings
          </h1>
          <p className="sub">Manage your agency workspace and preferences</p>
        </div>
      </div>

      {!isAdmin && (
        <div className="perm-banner">
          <I.shield size={16} style={{ color: "var(--amber)", flexShrink: 0, marginTop: 1 }} />
          <span>Viewing as <b>{P.name} · {P.roleLabel}</b>. General, Notifications, Payment Channels and Integrations are <b>view-only</b>; Team and Billing are managed by your Admin.</span>
        </div>
      )}

      <div className="set-tabs">
        {tabs.map((t) => <button key={t.id} className={"set-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>{t.id}</button>)}
      </div>

      <div className="card set-card-wrap">
        {tab === "General" && <GeneralTab canEdit={canManage} />}
        {tab === "Team" && <TeamTab />}
        {tab === "Notifications" && <NotificationsTab canEdit={canManage} />}
        {tab === "Payment Channels" && <PaymentChannelsTab canEdit={canManage} />}
        {tab === "Billing" && <BillingTab />}
        {tab === "Integrations" && <IntegrationsTab canEdit={canManage} />}
      </div>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
