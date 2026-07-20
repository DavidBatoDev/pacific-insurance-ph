// Pacific Insurance PH — Shared nurture / template composer (human-in-the-loop send)
const { useState: useStateEG, useMemo: useMemoEG } = React;
const EGShared = window.NAShared;
const { Field: EGField, TextInput: EGInput, Textarea: EGArea, Select: EGSelect } = EGShared;
const EGD = window.PData;

// Action → composer config
const ENGAGE_ACTIONS = {
  "Send Email": { kind: "email", tpl: "New inquiry response", icon: "mail", sub: "Compose from a template — editable before you send." },
  "Send Brochure": { kind: "email", tpl: "Send brochure", icon: "mail", sub: "Attach the plan brochure and send.", attach: "Brochure.pdf" },
  "Send Intake / Application Form": { kind: "email", tpl: "Send application form", icon: "fileText", sub: "Send the intake / application form.", attach: "Application-form.pdf" },
  "Send Payment Instruction": { kind: "email", tpl: "Payment instruction", icon: "peso", sub: "Send payment options and instructions." },
  "Send Renewal Notice": { kind: "email", tpl: "Renewal reminder", icon: "refresh", sub: "Send the renewal notice and payment options." },
  "Request Commission Voucher": { kind: "email", tpl: "Commission Voucher Request", icon: "mail", sub: "Email the Pacific Cross commission contact to request the voucher." },
  "Log Commission Follow-Up": { kind: "email", tpl: "Commission Follow-Up", icon: "mail", sub: "Chase a commission voucher that hasn't arrived yet." },
  "Request Proposal": { kind: "proposal", icon: "fileText", sub: "Internal request to the carrier — logs a note and a follow-up task." },
};

const AGENT_KEY_EG = { "Matt Nassr": "matt", "Eman Bondoc": "eman", "Joy Mercado": "joy", "Bea Lim": "bea", "Paolo Aquino": "paolo" };

function RecipientPicker({ onSelect }) {
  const [q, setQ] = useStateEG("");
  const results = useMemoEG(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    const clients = EGD.CLIENTS.map((c) => ({ name: c.name, email: c.email, sub: c.city + " · Client", _kind: "client", record_id: c.record_id, city: c.city, value: EGD.clientLTV(c), tier: EGD.clientTier(c), status: c.status, since: c.since }));
    const prospects = window.PPData.PP_PROSPECTS.map((p) => ({ name: p.name, email: "", sub: p.product + " · Lead", _kind: "prospect", product: p.product, owner: p.staff, pipeStage: p.stage, value: p.value, last: p.last, source: "Referral" }));
    return [...prospects, ...clients].filter((r) => r.name.toLowerCase().includes(ql)).slice(0, 6);
  }, [q]);
  return (
    <EGField label="Recipient" req>
      <div className="filter-search" style={{ width: "100%", height: 38, marginBottom: results.length ? 8 : 0 }}>
        <I.search size={16} />
        <input placeholder="Search a lead or client…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {results.map((r) => (
        <div key={r.name + r._kind} className="client-result" onClick={() => onSelect(r)}>
          <Avatar name={r.name} size={30} />
          <div style={{ flex: 1 }}><div className="cr-name">{r.name}</div><div className="cr-sub">{r.sub}</div></div>
          <I.plus size={16} style={{ color: "var(--text-subtle)" }} />
        </div>
      ))}
    </EGField>
  );
}

function EngageModal({ action, contact: initialContact, onClose, logTo, onSent }) {
  const cfg = ENGAGE_ACTIONS[action] || ENGAGE_ACTIONS["Send Email"];
  const [contact, setContact] = useStateEG(initialContact || null);

  const ctx = useMemoEG(() => {
    if (!contact) return {};
    const acting = window.Perms.person().name; // sender = logged-in persona
    const ownerName = contact.owner ? (EGD.STAFF[contact.owner] ? EGD.STAFF[contact.owner].name : contact.owner) : "Eman Bondoc";
    return {
      first_name: (contact.name || "there").split(" ")[0],
      product: contact.product || contact.renewalPolicy || (contact.interest ? contact.interest + " plan" : "your plan"),
      premium: contact.value ? EGD.peso(contact.value) : "your premium",
      agent: acting,
      ownerName,
    };
  }, [contact]);

  const store = window.TemplatesStore;
  const [tpl, setTpl] = useStateEG(cfg.tpl || "");
  const seedFrom = (name, c) => {
    const t = store.get(name);
    const cx = c || ctx;
    return t ? { subject: store.fill(t.subject, cx), body: store.fill(t.body, cx) } : { subject: "", body: "" };
  };
  const init = cfg.kind === "email" && contact ? seedFrom(cfg.tpl) : { subject: "", body: "" };
  const [subject, setSubject] = useStateEG(init.subject);
  const [body, setBody] = useStateEG(init.body);
  const [recipient, setRecipient] = useStateEG(initialContact ? (initialContact.email || "") : "");

  const [outcome, setOutcome] = useStateEG("Reached");
  const [callNote, setCallNote] = useStateEG("");
  const [proposalNote, setProposalNote] = useStateEG("");
  const [taskOwner, setTaskOwner] = useStateEG(window.Perms.person().name);
  const [taskDue, setTaskDue] = useStateEG("");

  const applyTemplate = (name) => {
    setTpl(name);
    const s = seedFrom(name);
    setSubject(s.subject); setBody(s.body);
  };
  const pickRecipient = (r) => {
    setContact(r);
    setRecipient(r.email || "");
    const ownerName = r.owner ? (EGD.STAFF[r.owner] ? EGD.STAFF[r.owner].name : r.owner) : "Eman Bondoc";
    const cx = { first_name: (r.name || "there").split(" ")[0], product: r.product || (r.interest ? r.interest + " plan" : "your plan"), premium: r.value ? EGD.peso(r.value) : "your premium", agent: window.Perms.person().name };
    if (cfg.kind === "email") { const s = seedFrom(tpl, cx); setSubject(s.subject); setBody(s.body); }
    if (cfg.kind === "proposal" || cfg.kind === "call") setTaskOwner(window.Perms.person().name);
  };

  const canSend = contact && (
    cfg.kind === "email" ? (recipient && subject) :
    cfg.kind === "call" ? outcome :
    proposalNote.trim()
  );

  const send = () => {
    const key = (logTo && logTo.key) || contact.record_id || contact.name;
    const logName = (logTo && logTo.name) || contact.name;
    const actor = window.Perms.person().name;
    const emit = (entry) => window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key, name: logName, entry } }));
    if (cfg.kind === "email") {
      emit({ kind: "email", dir: "sent", actor, title: subject, body: (cfg.attach ? "📎 " + cfg.attach + " — " : "") + (body || "").split("\n")[0], time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: action, sub: `"${tpl}" sent to ${contact.name} · logged to ${logName}'s timeline.` } }));
    } else if (cfg.kind === "call") {
      emit({ kind: "call", actor, title: "Call logged — " + outcome, body: callNote, time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Call logged", sub: `Discovery call with ${contact.name} saved to timeline.` } }));
    } else {
      emit({ kind: "note", actor, title: "Proposal requested", body: proposalNote, time: "Just now" });
      emit({ kind: "task", actor, title: "Task — follow up on proposal for " + contact.name, body: `Owner: ${taskOwner}${taskDue ? " · Due " + new Date(taskDue).toLocaleDateString("en-PH") : ""}`, time: "Just now" });
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Proposal requested", sub: `Note + follow-up task added for ${contact.name}.` } }));
    }
    // Signal completion so a Lead's Contact Profile can chain into the Advance-Lead popup (lead-workflow.md §4)
    window.dispatchEvent(new CustomEvent("engage-complete", { detail: { action, outcome: cfg.kind === "call" ? outcome : null, key, name: logName } }));
    if (onSent) onSent();
    onClose();
  };

  const Ico = I[cfg.icon] || I.mail;
  const sendLabel = cfg.kind === "email" ? "Send" : cfg.kind === "call" ? "Log call" : "Request proposal";

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><Ico size={20} /></div>
          <div><h2>{action}</h2><div className="dh-sub">{cfg.sub}</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <div className="callout accent" style={{ marginBottom: 16 }}>
            <span className="co-ico"><I.command size={15} /></span>
            <div><b>Human-in-the-loop.</b> Nothing sends automatically — review and edit the draft, then click <b>{sendLabel}</b>. The touch is logged to {contact ? contact.name + "'s" : "the contact's"} timeline.</div>
          </div>

          {!contact && <RecipientPicker onSelect={pickRecipient} />}
          {contact && (
            <div className="autofill-card" style={{ marginBottom: 16 }}>
              <div className="af-row"><span className="af-k">Contact</span><span className="af-v">{contact.name}{contact.record_id ? " · #" + contact.record_id : ""}</span></div>
              {cfg.kind === "email" && <div className="af-row"><span className="af-k">Merge fields</span><span className="af-v" style={{ fontSize: 11.5 }}>{ctx.first_name} · {ctx.product} · {ctx.agent}</span></div>}
            </div>
          )}

          {contact && cfg.kind === "email" && (
            <>
              <div className="grid-2">
                <EGField label="Template" req><EGSelect value={tpl} onChange={applyTemplate} options={["", ...store.names(true)]} /></EGField>
                <EGField label="Recipient" req><EGInput type="email" value={recipient} onChange={setRecipient} placeholder="name@email.com" /></EGField>
              </div>
              <EGField label="Subject" req><EGInput value={subject} onChange={setSubject} /></EGField>
              <EGField label="Message"><EGArea value={body} onChange={setBody} style={{ minHeight: 170 }} /></EGField>
              {cfg.attach && <div className="tpl-attach"><I.folder size={14} /> {cfg.attach} attached</div>}

              <div className="mail-preview">
                <div className="mail-preview-label"><I.mail size={13} /> Preview</div>
                <div className="mail-card">
                  <div className="mail-head">
                    <div className="mail-avatar"><Avatar name={ctx.agent || "Pacific Insurance PH"} size={34} /></div>
                    <div className="mail-meta">
                      <div className="mail-from">{ctx.agent || "Pacific Insurance PH"} <span className="mail-addr">· Pacific Insurance PH</span></div>
                      <div className="mail-to">To: {recipient || contact.name}</div>
                    </div>
                  </div>
                  <div className="mail-subject">{subject || <span className="mail-placeholder">No subject yet — pick a template above</span>}</div>
                  <div className="mail-body">{body ? body : <span className="mail-placeholder">Message body will appear here.</span>}</div>
                  {cfg.attach && <div className="mail-attach"><I.folder size={13} /> {cfg.attach}</div>}
                </div>
              </div>
            </>
          )}

          {contact && cfg.kind === "call" && (
            <>
              <EGField label="Outcome" req><EGSelect value={outcome} onChange={setOutcome} options={["Reached", "No answer", "Voicemail", "Wrong number"]} /></EGField>
              <EGField label="Call notes"><EGArea value={callNote} onChange={setCallNote} style={{ minHeight: 130 }} placeholder="Summary of the discovery conversation…" /></EGField>
            </>
          )}

          {contact && cfg.kind === "proposal" && (
            <>
              <EGField label="Proposal request note" req><EGArea value={proposalNote} onChange={setProposalNote} style={{ minHeight: 120 }} placeholder="What to request from the carrier (product, coverage, budget)…" /></EGField>
              <div className="grid-2">
                <EGField label="Follow-up owner" req><EGSelect value={taskOwner} onChange={setTaskOwner} options={EGShared.NA_OPTS.agents} /></EGField>
                <EGField label="Follow-up date"><EGInput type="date" value={taskDue} onChange={setTaskDue} /></EGField>
              </div>
            </>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSend} style={!canSend ? { opacity: .5, cursor: "not-allowed" } : null} onClick={send}><I.send size={15} /> {sendLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

window.EngageModal = EngageModal;
window.ENGAGE_ACTIONS = ENGAGE_ACTIONS;
