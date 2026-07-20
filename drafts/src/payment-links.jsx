// Pacific Insurance PH — Send Payment Links (batch) — new-modals.md §12
// Fired from the Dashboard revenue widget. Reuses the Email Templates store, the
// EngageModal composer patterns, and the Official Payment Channels from Settings.
// NO new sender or template store — everything routes through existing infra.
const { useState: useStatePL, useMemo: useMemoPL } = React;
const PLD = window.PData;
const { Field: PLField, Select: PLSelect, Textarea: PLArea, TextInput: PLInput, MultiChips: PLChips } = window.NAShared;

// Queue → auto-picked template + resulting source status (per §12 result table)
const PL_QUEUES = {
  Applications: { label: "Applications awaiting payment", icon: "fileText", color: "#059669", tpl: "Payment instruction", newStatus: "Awaiting Payment" },
  Renewals:     { label: "Renewals awaiting payment",     icon: "refresh",  color: "#2563eb", tpl: "Renewal reminder", newStatus: "Reminder Sent" },
  Travel:       { label: "Travel insurance awaiting payment", icon: "plane", color: "#d97706", tpl: "Travel insurance payment instruction", newStatus: "Payment Instruction Sent" },
};
const PL_QUEUE_ORDER = ["Applications", "Renewals", "Travel"];

// Build the pre-checked recipient list from the three live queues (awaiting-payment rows)
function plBuildRecipients() {
  const emailFor = (name) => {
    const c = PLD.CLIENTS.find((x) => x.name === name);
    if (c) return c.email;
    return name.toLowerCase().replace(/[^a-z ]/g, "").split(" ").slice(0, 2).join(".") + "@email.com";
  };
  const chans = ["Email", "WhatsApp", "Viber"];
  const pref = (name) => chans[name.length % 3];
  const rid = (name) => { const c = PLD.CLIENTS.find((x) => x.name === name); return c ? c.record_id : null; };

  const apps = PLD.APPLICATIONS.filter((a) => a.status === "Awaiting Payment").map((a) => ({
    id: a.id, queue: "Applications", name: a.client, amount: a.amount, product: a.product, ref: a.id,
    email: emailFor(a.client), channel: pref(a.client), sub: a.product + " · " + a.city, rid: rid(a.client),
  }));
  const rens = PLD.RENEWALS.filter((r) => r.status === "Awaiting Payment" || r.status === "Overdue").map((r) => ({
    id: r.id, queue: "Renewals", name: r.client, amount: r.amount, product: r.policy, ref: r.id,
    email: emailFor(r.client), channel: pref(r.client), sub: r.policy, rid: rid(r.client),
  }));
  const trvs = PLD.TRAVEL.filter((t) => t.status === "Awaiting Payment").map((t) => ({
    id: t.id, queue: "Travel", name: t.client, amount: t.amount, product: t.dest + " travel insurance", ref: t.id,
    email: emailFor(t.client), channel: pref(t.client), sub: t.flag + " " + t.dest + " · " + t.date, rid: rid(t.client),
  }));
  return [...apps, ...rens, ...trvs];
}

// Merge fill — reuses TemplatesStore.fill, then resolves {{reference}} + {{channel}} (§12 merge fields)
function plFill(str, ctx) {
  let s = window.TemplatesStore.fill(str, ctx);
  return s
    .replace(/\{\{?\s*reference\s*\}?\}/g, ctx.reference || "")
    .replace(/\{\{?\s*channel\s*\}?\}/g, ctx.channel || "");
}

function PaymentLinksModal({ onClose }) {
  const recipients = useMemoPL(plBuildRecipients, []);
  const channels = window.PAYMENT_CHANNELS || ["GCash for Business — Pacific Insurance PH"];
  const sender = window.Perms.person().name;

  // All recipients pre-checked (§12)
  const [checked, setChecked] = useStatePL(() => new Set(recipients.map((r) => r.id)));
  const [payChannel, setPayChannel] = useStatePL(channels[0]);
  const [via, setVia] = useStatePL(["Email"]);

  // Per-queue editable templates, seeded from the shared store (local edits — store untouched)
  const [templates, setTemplates] = useStatePL(() => {
    const out = {};
    PL_QUEUE_ORDER.forEach((q) => {
      const t = window.TemplatesStore.get(PL_QUEUES[q].tpl);
      out[q] = t ? { name: t.name, subject: t.subject, body: t.body } : { name: PL_QUEUES[q].tpl, subject: "", body: "" };
    });
    return out;
  });

  const selected = recipients.filter((r) => checked.has(r.id));
  const total = selected.reduce((a, r) => a + r.amount, 0);
  const activeQueues = PL_QUEUE_ORDER.filter((q) => selected.some((r) => r.queue === q));

  const [tplTab, setTplTab] = useStatePL("Applications");
  const editTab = activeQueues.includes(tplTab) ? tplTab : (activeQueues[0] || "Applications");

  const toggle = (id) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAll = (on) => setChecked(on ? new Set(recipients.map((r) => r.id)) : new Set());

  const ctxFor = (r) => ({
    first_name: r.name.split(" ")[0], product: r.product, premium: PLD.peso(r.amount),
    agent: sender, reference: r.ref, channel: payChannel.split(" — ")[0],
  });

  const previewR = selected[0];
  const previewT = previewR ? templates[previewR.queue] : null;
  const previewCtx = previewR ? ctxFor(previewR) : null;

  const canSend = selected.length > 0 && payChannel && via.length > 0;

  const send = () => {
    const actor = sender;
    selected.forEach((r) => {
      const ctx = ctxFor(r);
      const t = templates[r.queue];
      const subj = plFill(t.subject, ctx);
      const key = r.rid || r.name;
      // Log a payment-instruction entry to the contact's timeline
      window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key, name: r.name, entry: {
        kind: "email", dir: "sent", actor,
        title: "Payment instruction sent — " + r.ref,
        body: `${subj} · ${PLD.peso(r.amount)} · ${payChannel.split(" — ")[0]} · via ${via.join(", ")}`,
        time: "Just now",
      } } }));
      // Update the source record's status (§12)
      if (r.queue === "Applications") { const a = PLD.APPLICATIONS.find((x) => x.id === r.id); if (a) a.status = "Awaiting Payment"; }
      else if (r.queue === "Renewals") { const x = PLD.RENEWALS.find((y) => y.id === r.id); if (x) x.status = "Reminder Sent"; }
      else if (r.queue === "Travel") { const tv = PLD.TRAVEL.find((y) => y.id === r.id); if (tv) { tv.status = "Payment Instruction Sent"; tv.next = "Awaiting payment"; } }
    });

    // Recompute the dashboard revenue widget — subtract sent count + amount per queue
    const sumQ = { Applications: 0, Renewals: 0, Travel: 0 };
    const cntQ = { Applications: 0, Renewals: 0, Travel: 0 };
    selected.forEach((r) => { sumQ[r.queue] += r.amount; cntQ[r.queue]++; });
    PLD.REVENUE.rows.forEach((row) => {
      const q = PL_QUEUE_ORDER.find((k) => PL_QUEUES[k].label === row.label);
      if (q) { row.value = Math.max(0, row.value - sumQ[q]); row.count = Math.max(0, (row.count || 0) - cntQ[q]); }
    });
    PLD.REVENUE.total = PLD.REVENUE.rows.reduce((a, b) => a + b.value, 0);
    window.dispatchEvent(new CustomEvent("revenue-updated"));

    const n = selected.length;
    window.dispatchEvent(new CustomEvent("app-toast", { detail: {
      title: "Payment links sent",
      sub: `${n} personalized payment instruction${n > 1 ? "s" : ""} sent · logged to ${n > 1 ? "timelines" : "the timeline"} · widget updated.`,
    } }));
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.send size={20} /></div>
          <div><h2>Send payment links</h2><div className="dh-sub">Batch payment instructions to everyone with money awaiting collection</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>

        <div className="drawer-body">
          <div className="callout accent" style={{ marginBottom: 16 }}>
            <span className="co-ico"><I.command size={15} /></span>
            <div><b>Human-in-the-loop batch.</b> Every recipient is pre-selected across all three queues — uncheck anyone to exclude them, edit the per-queue copy, then <b>Send all</b>. Each person gets a personalized instruction logged to their timeline.</div>
          </div>

          {/* Payment channel + send-via */}
          <div className="grid-2">
            <PLField label="Official payment channel" req hint="Business payee from Settings — never a personal account">
              <PLSelect value={payChannel} onChange={setPayChannel} options={channels} />
            </PLField>
            <PLField label="Send via" req hint="One or more channels">
              <PLChips selected={via} onToggle={(c) => setVia(via.includes(c) ? via.filter((x) => x !== c) : [...via, c])} options={["Email", "WhatsApp", "Viber"]} />
            </PLField>
          </div>

          {/* Recipients */}
          <div className="pl-summary">
            <div>
              <div className="pl-summary-main"><b>{selected.length}</b> of {recipients.length} recipients · <b>{PLD.peso(total)}</b> selected</div>
              <div className="pl-summary-sub">Across {activeQueues.length || 0} queue{activeQueues.length === 1 ? "" : "s"} · auto-personalized per recipient</div>
            </div>
            <div className="pl-selall">
              <button className="pl-link" onClick={() => setAll(true)}>Select all</button>
              <button className="pl-link" onClick={() => setAll(false)}>None</button>
            </div>
          </div>

          {PL_QUEUE_ORDER.map((q) => {
            const rows = recipients.filter((r) => r.queue === q);
            if (!rows.length) return null;
            const qMeta = PL_QUEUES[q];
            const QIco = I[qMeta.icon];
            const selRows = rows.filter((r) => checked.has(r.id));
            const subtotal = selRows.reduce((a, r) => a + r.amount, 0);
            return (
              <div className="pl-group" key={q}>
                <div className="pl-group-head">
                  <QIco size={13} style={{ color: qMeta.color }} /> {q}
                  <span className="pl-gsub">{selRows.length}/{rows.length} · {PLD.peso(subtotal)}</span>
                </div>
                {rows.map((r) => {
                  const on = checked.has(r.id);
                  return (
                    <div key={r.id} className={"pl-row" + (on ? " on" : "")} onClick={() => toggle(r.id)}>
                      <span className="pl-check">{on && <I.check size={13} />}</span>
                      <Avatar name={r.name} size={30} />
                      <div className="pl-rmid">
                        <div className="pl-rname">{r.name}</div>
                        <div className="pl-rsub">{r.sub}</div>
                      </div>
                      <span className="pl-ramt">{PLD.peso(r.amount)}</span>
                      <span className="pl-chan">{r.channel}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Per-queue template editor */}
          {activeQueues.length > 0 && (
            <div className="form-section" style={{ marginTop: 6, marginBottom: 16 }}>
              <div className="form-section-title">Template <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>· auto-picked per queue, editable before send</span></div>
              <div className="pl-tabs">
                {activeQueues.map((q) => {
                  const TIco = I[PL_QUEUES[q].icon];
                  return (
                    <button key={q} className={"pl-tab" + (editTab === q ? " on" : "")} onClick={() => setTplTab(q)}>
                      <TIco size={13} /> {q}
                    </button>
                  );
                })}
              </div>
              <div className="autofill-card" style={{ marginBottom: 12 }}>
                <div className="af-row"><span className="af-k">Template</span><span className="af-v">{templates[editTab].name}</span></div>
                <div className="af-row"><span className="af-k">Applies to</span><span className="af-v">{selected.filter((r) => r.queue === editTab).length} {editTab} recipient(s)</span></div>
              </div>
              <PLField label="Subject" req>
                <PLInput value={templates[editTab].subject} onChange={(v) => setTemplates((s) => ({ ...s, [editTab]: { ...s[editTab], subject: v } }))} />
              </PLField>
              <PLField label="Message" hint="Merge fields: {{first_name}} · {{premium}} · {{reference}} · {{channel}} · {{agent}}">
                <PLArea value={templates[editTab].body} onChange={(v) => setTemplates((s) => ({ ...s, [editTab]: { ...s[editTab], body: v } }))} style={{ minHeight: 150, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.6 }} />
              </PLField>
            </div>
          )}

          {/* Preview — merged sample for one recipient */}
          {previewR && (
            <div className="mail-preview">
              <div className="mail-preview-label"><I.mail size={13} /> Preview — merged for {previewR.name} ({previewR.queue})</div>
              <div className="mail-card">
                <div className="mail-head">
                  <div className="mail-avatar"><Avatar name={sender} size={34} /></div>
                  <div className="mail-meta">
                    <div className="mail-from">{sender} <span className="mail-addr">· Pacific Insurance PH</span></div>
                    <div className="mail-to">To: {previewR.email} · via {via.join(", ") || "—"}</div>
                  </div>
                </div>
                <div className="mail-subject">{plFill(previewT.subject, previewCtx)}</div>
                <div className="mail-body">{plFill(previewT.body, previewCtx)}</div>
                <div className="mail-attach"><I.wallet size={13} /> Pay to: {payChannel} · Ref {previewR.ref}</div>
              </div>
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSend} style={!canSend ? { opacity: .5, cursor: "not-allowed" } : null} onClick={send}>
            <I.send size={15} /> Send all ({selected.length})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

window.PaymentLinksModal = PaymentLinksModal;
