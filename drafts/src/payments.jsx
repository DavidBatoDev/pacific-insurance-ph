// Pacific Insurance PH — Payments & Commissions page (payments-page.md)
// Two ListScreen tabs: Collections (verify payment + capture OR) and Commissions (OR → paid voucher).
// Reuses ListScreen, EngageModal (commission sends), Email Templates, Documents proof/voucher, tasks, timeline.
const { useState: useStatePay, useMemo: useMemoPay } = React;
const PAYD = window.PData;
const { Field: PayField, Select: PaySelect, TextInput: PayInput, Textarea: PayArea, FileDrop: PayFileDrop } = window.NAShared;

const SOURCE_TONE = { Application: "blue", Renewal: "violet", Travel: "amber" };

// ---------- Verify Payment modal (Tab 1) ----------
function VerifyPaymentModal({ payment, onClose }) {
  const [method, setMethod] = useStatePay(payment.method || "Portal");
  const [status, setStatus] = useStatePay(payment.status === "Verified" ? "Verified" : payment.proof ? "Received" : "Received");
  const [proof, setProof] = useStatePay(payment.proof || "");
  const [or, setOr] = useStatePay(payment.or || "");
  const [submitted, setSubmitted] = useStatePay(false);
  const [notes, setNotes] = useStatePay("");

  const methods = ["Portal", "Bank transfer", "Cashier", "Credit card", "Semiannual", "Annual", "Deferred card", "Business link"];
  const needProof = status === "Received" || status === "Verified";
  const canSave = (!needProof || proof) && (status !== "Verified" || or.trim());

  const save = () => {
    window.PaymentsStore.verify(payment.id, { method, status, or: or.trim(), proof, submitted, notes: notes.trim() });
    const verified = status === "Verified" && or.trim();
    window.dispatchEvent(new CustomEvent("app-toast", { detail: {
      title: verified ? "Payment verified · OR recorded" : "Payment updated",
      sub: verified
        ? `${payment.contact} · OR ${or.trim()} on file · commission row + follow-up task created.`
        : `${payment.contact} marked ${status}${proof ? " · proof on file" : ""}.`,
    } }));
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.peso size={20} /></div>
          <div><h2>Verify payment</h2><div className="dh-sub">Confirm proof, then capture the OR number to start commission tracking</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>

        <div className="drawer-body">
          <div className="autofill-card" style={{ marginBottom: 16 }}>
            <div className="af-row"><span className="af-k">Payment</span><span className="af-v">{payment.id}</span></div>
            <div className="af-row"><span className="af-k">Client</span><span className="af-v">{payment.contact}{payment.key ? " · #" + payment.key : ""}</span></div>
            <div className="af-row"><span className="af-k">Source</span><span className="af-v"><span className={"badge " + SOURCE_TONE[payment.source]} style={{ marginRight: 6 }}>{payment.source}</span>{payment.ref}</span></div>
            <div className="af-row"><span className="af-k">Amount</span><span className="af-v" style={{ fontWeight: 700 }}>{PAYD.peso(payment.amount)}</span></div>
          </div>

          <PayField label="Proof of payment" req={needProof} hint="Screenshot / bank slip — or a provisional receipt for cashier payments">
            {proof
              ? <div className="pay-proof"><I.fileText size={15} /> <span style={{ flex: 1 }}>{proof}</span><button className="at-clear" onClick={() => setProof("")}><I.plus size={15} style={{ transform: "rotate(45deg)" }} /></button></div>
              : <div onClick={() => setProof("Proof of payment — " + payment.contact.split(" ")[0] + ".pdf")}><PayFileDrop label="Click to attach proof of payment" sub="PDF, JPG or PNG · reuses the Documents proof type" /></div>}
          </PayField>

          <div className="grid-2">
            <PayField label="Payment method" req><PaySelect value={method} onChange={setMethod} options={methods} /></PayField>
            <PayField label="Payment status" req hint="Awaiting → Received → Verified">
              <PaySelect value={status} onChange={setStatus} options={["Received", "Verified"]} />
            </PayField>
          </div>

          <PayField label="OR number" req={status === "Verified"} hint="Official Receipt from Pacific Cross (via Glynn) — also stored on the policy">
            <PayInput value={or} onChange={setOr} placeholder="OR-2026-XXXXX" />
          </PayField>

          <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
            <div><div className="sr-label">Submitted to Pacific Cross (Glynn)?</div><div className="sr-sub">Proof emailed to the TSM — the step that triggers the OR number</div></div>
            <button className={"switch" + (submitted ? " on" : "")} onClick={() => setSubmitted(!submitted)}></button>
          </div>

          <PayField label="Internal notes" hint="Optional context for the timeline">
            <PayArea value={notes} onChange={setNotes} style={{ minHeight: 70 }} placeholder="Anything worth noting…" />
          </PayField>

          <div className="callout accent" style={{ marginBottom: 0 }}>
            <span className="co-ico"><I.command size={15} /></span>
            <div>{status === "Verified"
              ? <><b>On verify:</b> logs Payment verified + OR recorded to {payment.contact}'s timeline, advances the {payment.source.toLowerCase()}, and auto-creates a commission row + follow-up task.</>
              : <>Marks the payment <b>Received</b> and files the proof. Add the OR number and set status to <b>Verified</b> to start commission tracking.</>}</div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>
            <I.check size={15} /> {status === "Verified" ? "Verify & record OR" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------- Payments page (tab host) ----------
function PaymentsScreen() {
  const [tab, setTab] = useStatePay("collections");
  const [verify, setVerify] = useStatePay(null);
  const [, bump] = useStatePay(0);
  React.useEffect(() => {
    const rerender = () => bump((n) => n + 1);
    window.addEventListener("payments-updated", rerender);
    window.addEventListener("commissions-updated", rerender);
    return () => { window.removeEventListener("payments-updated", rerender); window.removeEventListener("commissions-updated", rerender); };
  }, []);

  const role = window.Perms.role();
  const me = window.Perms.current;
  const canSeeAmt = (owner) => role === "admin" || owner === me; // Staff never see other agents' commissions

  const tabControl = (
    <div className="seg-ctrl">
      <button className={"seg" + (tab === "collections" ? " on" : "")} onClick={() => setTab("collections")}>Collections</button>
      <button className={"seg" + (tab === "commissions" ? " on" : "")} onClick={() => setTab("commissions")}>Commissions</button>
    </div>
  );

  // Agent = own records only (no agent persona in the demo, but honour the rule)
  const scope = (rows) => role === "agent" ? rows.filter((r) => r.staff === me) : rows;

  // ---- Collections tab ----
  const collections = () => {
    const items = scope(window.PaymentsStore.items);
    const sum = (st) => items.filter((p) => p.status === st).reduce((a, p) => a + p.amount, 0);
    const cnt = (st) => items.filter((p) => p.status === st).length;
    const rows = items.map((p) => ({ ...p, _filter: p.status, _source: p.source }));
    return <window.ListScreen
      title="Payments" icon="peso" sub="Premium collection across Applications, Renewals & Travel · verify payments and capture the OR number"
      headerControl={tabControl}
      stats={[
        { val: PAYD.pesoShort(sum("Awaiting")), label: `Awaiting payment · ${cnt("Awaiting")}`, color: "var(--amber)" },
        { val: cnt("Received"), label: "Received · unverified", color: "var(--blue)" },
        { val: cnt("Verified"), label: "Verified · OR in", color: "var(--accent)" },
        { val: PAYD.pesoShort(sum("Overdue")), label: `Overdue · ${cnt("Overdue")}`, color: "var(--red)" },
      ]}
      filters={["Awaiting", "Received", "Verified", "Overdue"]}
      filters2={["Application", "Renewal", "Travel"]} filter2Key="_source" filters2Label="All sources"
      rows={rows}
      defaultSort={{ key: "status", dir: "asc" }}
      columns={[
        { k: "id", label: "Payment ref" }, { k: "contact", label: "Client" }, { k: "source", label: "Source" },
        { k: "amount", label: "Amount", num: true }, { k: "method", label: "Method" }, { k: "status", label: "Status" },
        { k: "or", label: "OR number" }, { k: "verified", label: "Date" }, { k: "_act", label: "" },
      ]}
      renderRow={(p) => {
        const done = p.status === "Verified";
        return (
          <tr key={p.id}>
            <td><span className="cell-code">{p.id}</span></td>
            <td><div className="client-cell"><Avatar name={p.contact} size={30} /><div><div className="cc-name">{p.contact}</div><div className="cc-sub">{p.label}</div></div></div></td>
            <td><span className={"badge " + SOURCE_TONE[p.source]} style={{ marginRight: 6 }}>{p.source}</span><span className="cell-code" style={{ fontSize: 11 }}>{p.ref}</span></td>
            <td className="num mono" style={{ fontWeight: 600 }}>{PAYD.peso(p.amount)}</td>
            <td className="cell-muted">{p.method}</td>
            <td><StatusBadge status={p.status} /></td>
            <td>{p.or ? <span className="cell-code">{p.or}</span> : <span className="cell-muted">—</span>}</td>
            <td className="cell-muted">{p.verified || "—"}</td>
            <td style={{ textAlign: "right" }}>
              {done
                ? <span className="pay-done"><I.check size={13} /> Verified</span>
                : <button className="btn sm" onClick={() => setVerify(p)}><I.peso size={13} /> Verify Payment</button>}
            </td>
          </tr>
        );
      }}
    />;
  };

  // ---- Commissions tab ----
  const requestVoucher = (c, followup) => {
    const action = followup ? "Log Commission Follow-Up" : "Request Commission Voucher";
    const pc = window.PC_CONTACTS.voucher;
    window.dispatchEvent(new CustomEvent("open-engage", { detail: {
      action,
      contact: { name: pc.name, email: pc.email, product: `OR ${c.or} — ${c.client} (${c.policy})`, value: c.est },
      logTo: { key: c.key || c.client, name: c.client },
      onSent: () => {
        window.CommissionsStore.update(c.or, followup
          ? { status: "Follow-up", lastFollowup: new Date(2026, 6, 9).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) }
          : { status: "Requested" });
      },
    } }));
  };
  const logCommission = (c, entry) => window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key: c.key || c.client, name: c.client, entry: { actor: window.Perms.person().name, time: "Just now", ...entry } } }));
  const markReceived = (c) => {
    window.CommissionsStore.update(c.or, { status: "Received", actual: c.est, voucher: "CV-" + c.or.replace(/[^0-9]/g, "") + ".pdf" });
    logCommission(c, { kind: "note", title: "Commission received — " + c.or, body: "Voucher on file · " + PAYD.peso(c.est) });
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Commission received", sub: `Voucher stored for ${c.client} · ${PAYD.peso(c.est)}.` } }));
  };
  const markPaid = (c) => {
    window.CommissionsStore.update(c.or, { status: "Paid", actual: c.actual || c.est });
    logCommission(c, { kind: "payment", title: "Commission paid — " + c.or, body: PAYD.peso(c.actual || c.est) + " · counts toward YTD" });
    window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Commission paid", sub: `${c.client} · ${PAYD.peso(c.actual || c.est)} closed out.` } }));
  };

  const commissions = () => {
    const items = scope(window.CommissionsStore.items);
    const cnt = (st) => items.filter((c) => c.status === st).length;
    const sum = (st) => items.filter((c) => c.status === st).reduce((a, c) => a + (c.actual || c.est), 0);
    const ytd = items.filter((c) => c.status === "Paid").reduce((a, c) => a + (c.actual || c.est), 0);
    const rows = items.map((c) => ({ ...c, _filter: c.status }));
    return <window.ListScreen
      title="Payments" icon="peso" sub="Commission tracking · OR number → voucher requested → follow-up → received → paid"
      headerControl={tabControl}
      stats={[
        { val: cnt("Requested"), label: "Requested", color: "var(--violet)" },
        { val: cnt("Follow-up"), label: "Follow-up pending", color: "var(--amber)" },
        { val: cnt("Received"), label: "Received", color: "var(--blue)" },
        { val: PAYD.pesoShort(sum("Paid")) + ` · ${cnt("Paid")}`, label: "Paid", color: "var(--accent)" },
        { val: role === "admin" ? PAYD.pesoShort(ytd) : PAYD.pesoShort(ytd), label: "Commission YTD (agency)", color: "var(--accent)" },
      ]}
      filters={["Requested", "Follow-up", "Received", "Paid"]}
      rows={rows}
      defaultSort={{ key: "status", dir: "asc" }}
      emptyText="No commissions yet — verify a payment with an OR number to start one."
      columns={[
        { k: "or", label: "OR number" }, { k: "client", label: "Client" }, { k: "policy", label: "Policy / Source" },
        { k: "premium", label: "Premium", num: true }, { k: "est", label: "Commission", num: true }, { k: "status", label: "Status" },
        { k: "contact", label: "Commission contact" }, { k: "lastFollowup", label: "Last follow-up" }, { k: "voucher", label: "Voucher" }, { k: "_act", label: "" },
      ]}
      renderRow={(c) => {
        const seeAmt = canSeeAmt(c.staff);
        return (
          <tr key={c.or}>
            <td><span className="cell-code">{c.or}</span></td>
            <td><div className="client-cell"><Avatar name={c.client} size={30} /><div className="cc-name">{c.client}</div></div></td>
            <td className="cell-muted">{c.policy}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>{PAYD.peso(c.premium)}</td>
            <td className="num mono" style={{ fontWeight: 600 }}>
              {seeAmt
                ? (c.actual ? PAYD.peso(c.actual) : <span style={{ color: "var(--text-muted)" }}>~{PAYD.peso(c.est)}</span>)
                : <span className="cell-muted" title="Hidden — other agent's commission">•••••</span>}
            </td>
            <td><StatusBadge status={c.status} /></td>
            <td className="cell-muted">{c.contact}</td>
            <td className="cell-muted">{c.lastFollowup || "—"}</td>
            <td>{c.voucher ? <span className="pay-done"><I.fileText size={12} /> {c.voucher}</span> : <span className="cell-muted">—</span>}</td>
            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div className="pay-acts">
                {(c.status === "Requested" || c.status === "Follow-up") && <>
                  {c.status === "Requested" && <button className="btn xs" onClick={() => requestVoucher(c, false)} title="Email the commission contact">Request Voucher</button>}
                  <button className="btn xs" onClick={() => requestVoucher(c, true)}>Log Follow-up</button>
                  <button className="btn xs" onClick={() => markReceived(c)}>Mark Received</button>
                </>}
                {c.status === "Received" && <button className="btn xs primary" onClick={() => markPaid(c)}>Mark Paid</button>}
                {c.status === "Paid" && <span className="pay-done"><I.check size={13} /> Paid</span>}
              </div>
            </td>
          </tr>
        );
      }}
    />;
  };

  return (
    <div className="fade-in" data-screen-label="Payments">
      {tab === "collections" ? collections() : commissions()}
      {verify && <VerifyPaymentModal payment={verify} onClose={() => setVerify(null)} />}
    </div>
  );
}

window.PaymentsScreen = PaymentsScreen;
