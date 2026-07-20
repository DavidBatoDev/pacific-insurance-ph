// Pacific Insurance PH — Payments & Commissions backing data (payments-page.md)
// Two new tables the app didn't have: `payments` (collection ledger over App/Renewal/Travel)
// and `commissions` (OR-number → paid voucher). Session-persistent via localStorage.
// No parallel comms/task stores — verify/actions reuse engage-logged, TasksStore, Documents.

const PMD = window.PData;

// Pacific Cross contact index — who we email. Central so personnel changes are one edit.
window.PC_CONTACTS = {
  voucher: { name: "Roseanne Llaga", email: "roseanne.llaga@pacificcross.com", role: "Commissions / Vouchers" },
  tsm: { name: "Glynn Ramos", email: "glynn.ramos@pacificcross.com", role: "TSM · OR submission" },
};

// Commission rate by source (first-year richer than renewal)
const COMM_RATE = { Application: 0.18, Renewal: 0.10, Travel: 0.15 };
const commEst = (source, premium) => Math.round(premium * (COMM_RATE[source] || 0.12));

// ---- Seed: payments (~10 across the 3 sources, mixed statuses) ----
const PAY_SEED = [
  { id: "PAY-2026-0101", contact: "Patricia Lim",     key: "000531", source: "Application", ref: "APP-2026-000130", label: "Select — Individual",       amount: 88000,  method: "Business link",  status: "Awaiting", proof: null, or: null, verified: null, staff: "eman" },
  { id: "PAY-2026-0102", contact: "Diego Mercado",    key: null,     source: "Application", ref: "APP-2026-000129", label: "Blue Royale — Individual",   amount: 210000, method: "Bank transfer",  status: "Received", proof: "Bank slip — BPI.pdf", or: null, verified: null, staff: "joy" },
  { id: "PAY-2026-0103", contact: "Maria Cruz",       key: "000164", source: "Application", ref: "APP-2026-000124", label: "Family Shield — Family",     amount: 156000, method: "Portal",         status: "Overdue",  proof: null, or: null, verified: null, staff: "eman" },
  { id: "PAY-2026-0104", contact: "Ramon Velasco",    key: "000092", source: "Renewal",     ref: "POL-2021-04412",  label: "Blue Royale — Individual",   amount: 62000,  method: "Portal",         status: "Awaiting", proof: null, or: null, verified: null, staff: "eman" },
  { id: "PAY-2026-0105", contact: "Grace Castillo",   key: "000482", source: "Renewal",     ref: "POL-2019-07734",  label: "Maxicare Plus",              amount: 73000,  method: "Credit card",    status: "Overdue",  proof: null, or: null, verified: null, staff: "eman" },
  { id: "PAY-2026-0106", contact: "Cristina Flores",  key: "000131", source: "Renewal",     ref: "POL-2020-03345",  label: "AsianLife Care",             amount: 110000, method: "Bank transfer",  status: "Verified", proof: "Deposit slip.pdf", or: "OR-2026-88123", verified: "Jul 2, 2026", staff: "joy" },
  { id: "PAY-2026-0107", contact: "Katrina Bautista", key: null,     source: "Travel",      ref: "TRV-2026-000123", label: "Japan travel insurance",     amount: 18000,  method: "Business link",  status: "Awaiting", proof: null, or: null, verified: null, staff: "bea" },
  { id: "PAY-2026-0108", contact: "Hannah Villamor",  key: null,     source: "Travel",      ref: "TRV-2026-000125", label: "Singapore travel insurance", amount: 9800,   method: "Credit card",    status: "Verified", proof: "GCash receipt.png", or: "OR-2026-88090", verified: "Jul 4, 2026", staff: "bea" },
  { id: "PAY-2026-0109", contact: "John Santos",      key: "000118", source: "Application", ref: "APP-2026-000121", label: "Blue Royale — Individual",   amount: 185000, method: "Cashier",        status: "Verified", proof: "Provisional receipt.pdf", or: "OR-2026-88055", verified: "Jun 27, 2026", staff: "eman" },
  { id: "PAY-2026-0110", contact: "Jericho Ramos",    key: null,     source: "Travel",      ref: "TRV-2026-000124", label: "South Korea travel insurance", amount: 14500, method: "Portal",         status: "Received", proof: "Bank transfer.jpg", or: null, verified: null, staff: "bea" },
];

// ---- Seed: commissions (auto-appear once a payment is Verified; a few pre-seeded) ----
const COMM_SEED = [
  { or: "OR-2026-88055", client: "John Santos",     key: "000118", policy: "Blue Royale · APP-2026-000121", source: "Application", premium: 185000, est: commEst("Application", 185000), actual: 33300, status: "Paid",      contact: "Roseanne Llaga", lastFollowup: "Jun 30, 2026", voucher: "CV-88055.pdf", staff: "eman" },
  { or: "OR-2026-88123", client: "Cristina Flores", key: "000131", policy: "AsianLife Care · POL-2020-03345", source: "Renewal",     premium: 110000, est: commEst("Renewal", 110000),     actual: null,  status: "Follow-up", contact: "Roseanne Llaga", lastFollowup: "Jul 6, 2026", voucher: null, staff: "joy" },
  { or: "OR-2026-88090", client: "Hannah Villamor", key: null,     policy: "Singapore travel · TRV-2026-000125", source: "Travel",      premium: 9800,   est: commEst("Travel", 9800),        actual: null,  status: "Requested", contact: "Roseanne Llaga", lastFollowup: null, voucher: null, staff: "bea" },
];

function pmLoad(lsKey, seed) {
  try { const raw = localStorage.getItem(lsKey); if (raw) return JSON.parse(raw); } catch (e) {}
  return seed.map((x) => ({ ...x }));
}
const todayLabel = () => new Date(2026, 6, 9).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const PaymentsStore = {
  items: pmLoad("pi_payments", PAY_SEED),
  save() { try { localStorage.setItem("pi_payments", JSON.stringify(this.items)); } catch (e) {} window.dispatchEvent(new CustomEvent("payments-updated")); },
  get(id) { return this.items.find((p) => p.id === id); },
  // Verify Payment result (payments-page.md Tab 1 modal)
  verify(id, { method, status, or, proof, submitted, notes }) {
    const p = this.get(id);
    if (!p) return;
    if (method) p.method = method;
    if (proof) p.proof = proof;
    p.status = status;
    const actor = (window.Perms && window.Perms.person) ? window.Perms.person().name : "Eman Bondoc";
    const logKey = p.key || p.contact;
    const log = (entry) => window.dispatchEvent(new CustomEvent("engage-logged", { detail: { key: logKey, name: p.contact, entry } }));

    if (status === "Received") {
      log({ kind: "note", actor, title: "Proof of payment received — " + p.id, body: (proof || "Proof on file") + (submitted ? " · submitted to Pacific Cross (Glynn)" : ""), time: "Just now" });
    }
    if (status === "Verified" && or) {
      p.or = or;
      p.verified = todayLabel();
      log({ kind: "payment", actor, title: "Payment verified — " + p.label, body: PMD.peso(p.amount) + " · " + p.method + (notes ? " · " + notes : ""), time: "Just now" });
      log({ kind: "status", actor, title: "OR recorded — " + or, body: "Official Receipt on file · commission tracking started.", time: "Just now" });
      // Advance the source record
      if (p.source === "Application") { const a = PMD.APPLICATIONS.find((x) => x.id === p.ref); if (a) a.status = "Approved"; }
      else if (p.source === "Renewal") { const r = PMD.RENEWALS.find((x) => x.id === p.ref); if (r) r.status = "In Progress"; }
      else if (p.source === "Travel") { const t = PMD.TRAVEL.find((x) => x.id === p.ref); if (t) t.status = "Policy Issued"; }
      // Stamp the OR onto any matching policy record
      if (window.setPolicyOR) window.setPolicyOR(p.contact, or);
      // Auto-create the commission row + a voucher follow-up task
      CommissionsStore.add({
        or, client: p.contact, key: p.key, policy: p.label + " · " + p.ref, source: p.source,
        premium: p.amount, est: commEst(p.source, p.amount), actual: null,
        status: "Requested", contact: window.PC_CONTACTS.voucher.name, lastFollowup: null, voucher: null, staff: p.staff,
      });
      if (window.TasksStore) window.TasksStore.add({
        title: "Request commission voucher — " + p.contact + " (OR " + or + ")",
        tag: "Commission", group: "today", meta: "Today",
        contactName: p.contact, contactKey: p.key, linkedRecord: or, assignee: actor, priority: "Normal",
      });
    }
    this.save();
  },
};

const CommissionsStore = {
  items: pmLoad("pi_commissions", COMM_SEED),
  save() { try { localStorage.setItem("pi_commissions", JSON.stringify(this.items)); } catch (e) {} window.dispatchEvent(new CustomEvent("commissions-updated")); },
  add(row) { if (this.items.some((c) => c.or === row.or)) return; this.items.unshift(row); this.save(); },
  update(or, patch) { this.items = this.items.map((c) => c.or === or ? { ...c, ...patch } : c); this.save(); },
  get(or) { return this.items.find((c) => c.or === or); },
};

window.PaymentsStore = PaymentsStore;
window.CommissionsStore = CommissionsStore;
