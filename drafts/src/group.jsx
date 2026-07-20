// Pacific Insurance PH — Group Account detail (group-account-page.md)
// Company-level equivalent of the Contact Profile for a Group HMO account.
// Reuses: ListScreen (roster), the Contact Profile shell/timeline CSS, Documents store, EngageModal (billing).
// New data only: `groups` + `members` (no parallel comms/task/document stores).
const { useState: useStateGA, useEffect: useEffectGA } = React;
const GAD = window.PData;
const GAShared = window.NAShared;
const { Field: GAField, TextInput: GAInput, Select: GASelect } = GAShared;

/* ============================== data (groups + members) ============================== */
const TIER_SHARE = { Executive: 96000, Premium: 62000, Standard: 44000 };
const GA_GROUPS = [
  { id: "GRP-0007", name: "Meridian Tech Solutions", plan: "BC Flexi HMO", policyNo: "POL-2025-GRP-0007", cycle: "Quarterly", premium: 1860000, status: "Active", owner: "eman", primaryContactId: "000118", rep: { id: "000118", name: "Regina Ateneo", email: "regina.ateneo@meridiantech.com", role: "HR Director · Company Contact" }, renewalDate: "Sep 30, 2026", renewalDays: 82, effective: "Oct 1, 2025", expiry: "Sep 30, 2026", city: "BGC, Taguig City", claimsOpen: 3, claimsYtd: 11 },
  { id: "GRP-0011", name: "Isla Grande Resorts", plan: "BC Flexi HMO", policyNo: "POL-2026-GRP-0011", cycle: "Annual", premium: 1120000, status: "Onboarding", owner: "joy", primaryContactId: "000711", rep: { id: "000711", name: "Hector Salazar", email: "hector.salazar@islagrande.com", role: "Owner / GM · Company Contact" }, renewalDate: "Feb 15, 2027", renewalDays: 220, effective: "Feb 16, 2026", expiry: "Feb 15, 2027", city: "Cebu City", claimsOpen: 1, claimsYtd: 2 },
  { id: "GRP-0004", name: "Craft & Co. Manila", plan: "Maxicare Group", policyNo: "POL-2024-GRP-0004", cycle: "Monthly", premium: 640000, status: "Lapsing", owner: "eman", primaryContactId: "000704", rep: { id: "000704", name: "Camille Herrera", email: "camille.herrera@craftco.com", role: "Managing Partner · Company Contact" }, renewalDate: "Jul 20, 2026", renewalDays: 10, effective: "Jul 21, 2024", expiry: "Jul 20, 2026", city: "Makati City", claimsOpen: 0, claimsYtd: 5 },
];

// members keyed by group id — principals first
const GA_MEMBERS = {
  "GRP-0007": [
    { id: "M-7001", name: "Regina Ateneo", relationship: "Principal", tier: "Executive", ecard: "Issued", claims: 1, join: "Oct 2025", status: "Active", contactId: "000118" },
    { id: "M-7002", name: "Paulo Mendoza", relationship: "Employee", tier: "Premium", ecard: "Issued", claims: 0, join: "Oct 2025", status: "Active", contactId: "000164" },
    { id: "M-7003", name: "Celine Mendoza", relationship: "Dependent", tier: "Standard", ecard: "Issued", claims: 2, join: "Oct 2025", status: "Active", contactId: null },
    { id: "M-7004", name: "Arturo Villanueva", relationship: "Employee", tier: "Premium", ecard: "Issued", claims: 1, join: "Oct 2025", status: "Active", contactId: null },
    { id: "M-7005", name: "Sam Villanueva", relationship: "Dependent", tier: "Standard", ecard: "Pending", claims: 0, join: "Nov 2025", status: "Active", contactId: null },
    { id: "M-7006", name: "Beatriz Cordova", relationship: "Employee", tier: "Executive", ecard: "Issued", claims: 0, join: "Oct 2025", status: "Active", contactId: "000205" },
    { id: "M-7007", name: "Enzo Fuentes", relationship: "Employee", tier: "Standard", ecard: "Issued", claims: 3, join: "Oct 2025", status: "Active", contactId: null },
    { id: "M-7008", name: "Marisol Fuentes", relationship: "Dependent", tier: "Standard", ecard: "Pending", claims: 0, join: "Jan 2026", status: "Pending", contactId: null },
    { id: "M-7009", name: "Rafael Ibarra", relationship: "Employee", tier: "Premium", ecard: "Issued", claims: 0, join: "Oct 2025", status: "Active", contactId: null },
    { id: "M-7010", name: "Dominic Salvador", relationship: "Employee", tier: "Standard", ecard: "Issued", claims: 1, join: "Nov 2025", status: "Active", contactId: null },
    { id: "M-7011", name: "Ingrid Salvador", relationship: "Dependent", tier: "Standard", ecard: "Pending", claims: 0, join: "Feb 2026", status: "Pending", contactId: null },
    { id: "M-7012", name: "Lourdes Bautista", relationship: "Employee", tier: "Premium", ecard: "Issued", claims: 0, join: "Oct 2025", status: "Active", contactId: null },
    { id: "M-7013", name: "Teodoro Ramos", relationship: "Employee", tier: "Standard", ecard: "Issued", claims: 0, join: "Oct 2025", status: "Lapsed", contactId: null },
    { id: "M-7014", name: "Aurora Del Rosario", relationship: "Employee", tier: "Standard", ecard: "Pending", claims: 0, join: "Feb 2026", status: "Pending", contactId: null },
    { id: "M-7015", name: "Miguel Torres", relationship: "Employee", tier: "Premium", ecard: "Issued", claims: 1, join: "Oct 2025", status: "Active", contactId: "000377" },
  ],
  "GRP-0011": [
    { id: "M-1101", name: "Hector Salazar", relationship: "Principal", tier: "Executive", ecard: "Issued", claims: 0, join: "Feb 2026", status: "Active", contactId: null },
    { id: "M-1102", name: "Nadia Ocampo", relationship: "Employee", tier: "Premium", ecard: "Pending", claims: 0, join: "Feb 2026", status: "Pending", contactId: null },
    { id: "M-1103", name: "Vince Trinidad", relationship: "Employee", tier: "Standard", ecard: "Pending", claims: 1, join: "Feb 2026", status: "Active", contactId: null },
  ],
  "GRP-0004": [
    { id: "M-4001", name: "Camille Herrera", relationship: "Principal", tier: "Premium", ecard: "Issued", claims: 0, join: "Jul 2024", status: "Active", contactId: null },
    { id: "M-4002", name: "Gabriel Reyes", relationship: "Employee", tier: "Standard", ecard: "Issued", claims: 2, join: "Jul 2024", status: "Active", contactId: null },
  ],
};

window.GroupsData = {
  GROUPS: GA_GROUPS,
  get: (id) => GA_GROUPS.find((g) => g.id === id),
  membersOf: (id) => GA_MEMBERS[id] || [],
  // Reverse lookup: is this person (by name) a member of any group? Powers the cross-page "Group member" cue.
  membershipOf: (name) => {
    if (!name) return null;
    const key = name.trim().toLowerCase();
    for (const g of GA_GROUPS) {
      const m = (GA_MEMBERS[g.id] || []).find((x) => x.name.trim().toLowerCase() === key);
      if (m) return { group: g.name, groupId: g.id, role: m.relationship + " · " + m.tier };
    }
    return null;
  },
  // Create a Group Account from a completed Group HMO application (New Application wizard, §B path).
  // No parallel store — pushes into the same GA_GROUPS / GA_MEMBERS the rest of the page reads.
  addGroup: (form) => {
    const seq = 12 + GA_GROUPS.length;
    const id = "GRP-00" + seq;
    const premium = parseInt(String(form.premium || "").replace(/[^\d]/g, ""), 10) || 0;
    const cycle = ["Monthly", "Quarterly", "Semi-annual", "Annual"].includes(form.payFreq) ? form.payFreq : "Annual";
    const ownerId = Object.keys(GAD.STAFF).find((k) => GAD.STAFF[k].name === form.agent) || (window.Perms ? window.Perms.current : "eman");
    const start = form.startDate ? new Date(form.startDate) : new Date();
    const expiry = new Date(start); expiry.setFullYear(expiry.getFullYear() + 1); expiry.setDate(expiry.getDate() - 1);
    const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const renewalDays = Math.max(0, Math.round((expiry - new Date()) / 864e5));
    const city = (form.address || "").split(",").map((s) => s.trim()).filter(Boolean).slice(-1)[0] || "Metro Manila";
    const contactId = "0007" + (10 + GA_GROUPS.length);
    const rep = form.companyContact ? { id: contactId, name: form.companyContact.trim(), email: form.email || "", role: "Primary contact" } : null;

    const valid = (form.members || []).filter((m) => m.name && m.name.trim());
    const members = valid.map((m, i) => ({
      id: "M-" + seq + "0" + (i + 1), name: m.name.trim(),
      relationship: i === 0 && !valid.some((x, j) => j < i && x.rel === "Principal") ? (m.rel || "Principal") : (m.rel || "Employee"),
      tier: "Standard", ecard: "Pending", claims: 0, join: "This month", status: "Pending",
      contactId: rep && m.name.trim().toLowerCase() === rep.name.toLowerCase() ? rep.id : null,
    }));
    // If the primary contact isn't in the roster, they stay a contact-only rep (not forced into members).

    const g = {
      id, name: form.companyName || "New group account", plan: form.product || "BC Flexi HMO",
      policyNo: "POL-" + start.getFullYear() + "-" + id, cycle, premium,
      status: "Onboarding", owner: ownerId, primaryContactId: rep ? rep.id : null, rep,
      renewalDate: fmt(expiry), renewalDays, effective: fmt(start), expiry: fmt(expiry),
      city, claimsOpen: 0, claimsYtd: 0, _new: true,
    };
    GA_GROUPS.unshift(g);
    GA_MEMBERS[id] = members;
    return g;
  },
};

const GA_STATUS_TONE = { Active: "green", Onboarding: "blue", Lapsing: "amber", Lapsed: "red", Pending: "slate", Issued: "green" };
const gaBadge = (val) => <span className={"badge " + (GA_STATUS_TONE[val] || "slate")}><span className="b-dot"></span>{val}</span>;

/* ================================= group-level timeline ================================= */
const GA_TL_META = {
  member: { icon: "users", tone: "blue" }, ecard: { icon: "shield", tone: "green" },
  billing: { icon: "peso", tone: "green" }, status: { icon: "refresh", tone: "green" },
  doc: { icon: "folder", tone: "amber" }, note: { icon: "doc2", tone: "slate" },
};
function GATimeline({ entries }) {
  return (
    <div className="cp-timeline" style={{ padding: "6px 4px 4px" }}>
      {entries.map((e) => {
        const m = GA_TL_META[e.kind] || GA_TL_META.note;
        const Ico = I[m.icon];
        return (
          <div className="cp-tl-item" key={e.id}>
            <div className="cp-tl-rail"><div className="cp-tl-dot" style={{ background: `var(--${m.tone}-soft)`, color: `var(--${m.tone})` }}><Ico size={14} /></div></div>
            <div className="cp-tl-content">
              <div className="cp-tl-head"><span className="cp-tl-title">{e.title}</span><span className="cp-tl-time">{e.time}</span></div>
              {e.body && <div className="cp-tl-body">{e.body}</div>}
              <div className="cp-tl-actor">{e.actor}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================= Add Member modal (§13) ================================= */
function AddMemberModal({ group, onAdd, onClose }) {
  const [name, setName] = useStateGA("");
  const [relationship, setRelationship] = useStateGA("Employee");
  const [tier, setTier] = useStateGA("Standard");
  const [join, setJoin] = useStateGA("");
  const [isContact, setIsContact] = useStateGA(false);
  const [ecardNow, setEcardNow] = useStateGA(true);
  const canSave = name.trim();
  const save = () => {
    onAdd({
      id: "M-" + Math.floor(Math.random() * 9000 + 1000), name: name.trim(), relationship, tier,
      ecard: ecardNow ? "Issued" : "Pending", claims: 0,
      join: join ? new Date(join).toLocaleDateString("en-PH", { month: "short", year: "numeric" }) : "This month",
      status: "Pending", contactId: isContact ? "000" + Math.floor(Math.random() * 900 + 100) : null,
    });
    onClose();
  };
  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.users size={20} /></div>
          <div><h2>Add member</h2><div className="dh-sub">Enroll a person under {group.name}'s group policy</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>
        <div className="drawer-body">
          <GAField label="Full name" req><GAInput value={name} onChange={setName} placeholder="e.g. Juan Dela Cruz" /></GAField>
          <div className="grid-2">
            <GAField label="Relationship / role" req><GASelect value={relationship} onChange={setRelationship} options={["Principal", "Employee", "Dependent"]} /></GAField>
            <GAField label="Coverage tier" req><GASelect value={tier} onChange={setTier} options={["Standard", "Premium", "Executive"]} /></GAField>
          </div>
          <GAField label="Join date"><GAInput type="date" value={join} onChange={setJoin} /></GAField>
          <div className="switch-row" style={{ borderTop: "1px solid var(--border-soft)" }}>
            <div><div className="sr-label">Issue e-card immediately</div><div className="sr-sub">Otherwise queued as Pending for the next batch</div></div>
            <button className={"switch" + (ecardNow ? " on" : "")} onClick={() => setEcardNow(!ecardNow)}></button>
          </div>
          <div className="switch-row" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div><div className="sr-label">Create a linked Contact record</div><div className="sr-sub">Lets you open this member's Contact Profile</div></div>
            <button className={"switch" + (isContact ? " on" : "")} onClick={() => setIsContact(!isContact)}></button>
          </div>
          <div className="callout accent" style={{ marginBottom: 0 }}>
            <span className="co-ico"><I.command size={15} /></span>
            <div>Adds <b>{name.trim() || "the member"}</b> to the roster (status Pending), updates the census/premium share, and logs <b>Member added</b> to the group timeline.</div>
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}><I.plus size={15} /> Add member</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================================= right-column panels ================================= */
function GAPanel({ title, icon, count, action, children }) {
  const Ico = I[icon];
  return (
    <div className="cp-assoc">
      <div className="cp-assoc-head">
        <span className="cp-assoc-title"><Ico size={15} />{title}{count != null && <span className="cp-assoc-count">{count}</span>}</span>
        {action}
      </div>
      <div className="cp-assoc-body">{children}</div>
    </div>
  );
}

/* ================================= main screen ================================= */
function GroupAccount({ seed, onBack }) {
  const group = seed && seed.id ? (window.GroupsData.get(seed.id) || seed) : GA_GROUPS[0];
  const owner = GAD.STAFF[group.owner] || GAD.STAFF.eman;
  const role = window.Perms.role();
  const me = window.Perms.current;

  const [members, setMembers] = useStateGA(() => window.GroupsData.membersOf(group.id).map((m) => ({ ...m })));
  const [addOpen, setAddOpen] = useStateGA(false);
  const [timeline, setTimeline] = useStateGA(() => [
    { id: 5, kind: "billing", actor: "Eman Bondoc", title: "Q2 billing sent", body: "Quarterly invoice " + GAD.peso(group.premium / 4) + " emailed to " + (group.rep ? group.rep.name : group.name + " HR") + ".", time: "Jun 30, 2026 · 3:20 PM" },
    { id: 4, kind: "member", actor: "Eman Bondoc", title: "Member added — Aurora Del Rosario", body: "Employee · Standard tier · pending e-card.", time: "Jun 12, 2026 · 10:04 AM" },
    { id: 3, kind: "ecard", actor: "System", title: "E-cards issued — 9 members", body: "Batch delivered to enrolled members.", time: "May 2, 2026 · 9:00 AM" },
    { id: 2, kind: "status", actor: "System", title: "Renewal window opened", body: group.plan + " renews " + group.renewalDate + ".", time: "Apr 1, 2026 · 8:00 AM" },
    { id: 1, kind: "doc", actor: "Joy Mercado", title: "Group contract uploaded", body: "Signed master policy " + group.policyNo + ".", time: "Oct 1, 2025 · 2:30 PM" },
  ]);
  const log = (e) => setTimeline((t) => [{ ...e, id: Date.now() }, ...t]);
  const toast = (title, sub) => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, sub } }));

  const active = members.filter((m) => m.status === "Active").length;
  const pending = members.filter((m) => m.status === "Pending").length;
  const pendingEcards = members.filter((m) => m.ecard === "Pending").length;

  const addMember = (m) => {
    setMembers((list) => [...list, m]);
    log({ kind: "member", actor: window.Perms.person().name, title: "Member added — " + m.name, body: m.relationship + " · " + m.tier + " tier · e-card " + m.ecard + ".", time: "Just now" });
    toast("Member added", m.name + " enrolled under " + group.name + " (status Pending).");
  };
  const issueEcards = () => {
    if (!pendingEcards) { toast("All e-cards issued", "No pending e-cards for " + group.name + "."); return; }
    setMembers((list) => list.map((m) => m.ecard === "Pending" ? { ...m, ecard: "Issued" } : m));
    log({ kind: "ecard", actor: window.Perms.person().name, title: "E-cards issued — " + pendingEcards + " member" + (pendingEcards > 1 ? "s" : ""), body: "Batch delivered to enrolled members.", time: "Just now" });
    toast("E-cards issued", pendingEcards + " e-card" + (pendingEcards > 1 ? "s" : "") + " delivered.");
  };
  const renewGroup = () => {
    const r = group.rep;
    log({ kind: "status", actor: window.Perms.person().name, title: "Group renewal started", body: group.plan + " · " + group.policyNo + " — renewal notice prepared for " + (r ? r.name : group.name) + ".", time: "Just now" });
    if (r) {
      window.dispatchEvent(new CustomEvent("open-engage", { detail: {
        action: "Send Renewal Notice",
        contact: { name: r.name, email: r.email, product: group.plan, value: group.premium },
        logTo: { key: group.id, name: group.name },
        onSent: () => log({ kind: "status", actor: window.Perms.person().name, title: "Renewal notice sent", body: "Emailed to " + r.name + " (" + r.email + ").", time: "Just now" }),
      } }));
    } else {
      toast("Group renewal started", group.name + " · " + group.plan + " routed to the renewal flow.");
    }
  };
  const sendBilling = () => {
    const r = group.rep;
    const invoiceAmt = Math.round(group.premium / (group.cycle === "Monthly" ? 12 : group.cycle === "Quarterly" ? 4 : 1));
    window.dispatchEvent(new CustomEvent("open-engage", { detail: {
      action: "Send Payment Instruction",
      contact: r
        ? { name: r.name, email: r.email, product: group.plan, value: invoiceAmt }
        : { name: group.name + " (HR)", email: "hr@" + group.name.toLowerCase().replace(/[^a-z]+/g, "") + ".com", product: group.plan, value: invoiceAmt },
      logTo: { key: group.id, name: group.name },
      onSent: () => log({ kind: "billing", actor: window.Perms.person().name, title: "Billing sent", body: "Invoice emailed to " + (r ? r.name + " (" + r.email + ")" : group.name + " HR") + ".", time: "Just now" }),
    } }));
  };
  const exportCensus = () => {
    const share = (m) => TIER_SHARE[m.tier] || 44000;
    const rows = [["Member", "Relationship", "Coverage tier", "E-card", "Join date", "Status", "Premium share (PHP)"]]
      .concat(members.map((m) => [m.name, m.relationship, m.tier, m.ecard, m.join, m.status, share(m)]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-census.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Census exported", members.length + " members · " + group.name + " (CSV).");
  };

  const openMember = (m) => {
    if (!m.contactId) { toast("No linked contact", m.name + " is a roster-only member — add a Contact record to open a profile."); return; }
    const isRep = group.rep && group.rep.id === m.contactId;
    window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: {
      _kind: "client", record_id: m.contactId, name: m.name, status: "Active",
      interest: "Group HMO", product: group.plan, owner: group.owner,
      groupMembership: { group: group.name, groupId: group.id, role: m.relationship + " · " + m.tier },
      represents: isRep ? { group: group.name, groupId: group.id } : null,
    } } }));
  };

  // Primary contact / representative (the "Company Contact Person" the group is run through)
  const rep = group.rep;
  const openRep = () => {
    if (!rep) return;
    window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: {
      _kind: "client", record_id: rep.id, name: rep.name, email: rep.email, status: "Active",
      interest: "Group HMO", product: group.plan, owner: group.owner,
      represents: { group: group.name, groupId: group.id },
    } } }));
  };

  // census breakdown by tier
  const tierRows = ["Executive", "Premium", "Standard"].map((t) => {
    const list = members.filter((m) => m.tier === t);
    return { tier: t, count: list.length, share: TIER_SHARE[t], total: list.length * TIER_SHARE[t] };
  }).filter((r) => r.count > 0);
  const cycleUnit = group.cycle === "Monthly" ? group.premium / 12 : group.cycle === "Quarterly" ? group.premium / 4 : group.premium;

  const GA_DOCS = [
    { name: "Master policy contract — " + group.policyNo, type: "Contract", status: "Verified" },
    { name: "Official member list (census)", type: "Census", status: "Verified" },
    { name: "E-card batch — " + (members.length - pendingEcards) + " issued", type: "E-cards", status: pendingEcards ? "Pending" : "Verified" },
    { name: group.cycle + " invoice — current cycle", type: "Invoice", status: "Received" },
  ];

  const canManage = role === "admin" || role === "staff";

  return (
    <div className="fade-in cp-screen" data-screen-label="Group Account">
      {/* header */}
      <div className="cp-head">
        <button className="cp-back" onClick={onBack}><I.arrowRight size={16} style={{ transform: "rotate(180deg)" }} /> Clients</button>
        <div className="cp-head-main">
          <div className="ga-glyph"><I.building size={26} /></div>
          <div className="cp-head-id">
            <div className="cp-head-name">
              {group.name}
              <span className="cp-record-id">{group.id}</span>
              {gaBadge(group.status)}
            </div>
            <div className="cp-head-meta">
              <span><I.shield size={13} /> {group.plan} · {group.policyNo}</span>
              <span><I.users size={13} /> {members.length} members</span>
              <span><I.refresh size={13} /> Renews {group.renewalDate}</span>
              {rep && <button className="ga-rep" onClick={openRep} title={"Open " + rep.name + "'s Contact Profile"}><Avatar name={rep.name} size={20} /> {rep.name} · Primary contact</button>}
              <span className="cp-owner"><Avatar name={owner.name} size={20} /> {owner.name} · Account manager</span>
            </div>
          </div>
          <div className="cp-head-actions">
            {canManage && <button className="btn sm" onClick={() => setAddOpen(true)}><I.plus size={14} /> Add member</button>}
            {canManage && <button className="btn sm" onClick={renewGroup}><I.refresh size={14} /> Renew group</button>}
            <button className="btn sm" onClick={issueEcards}><I.shield size={14} /> Issue e-cards</button>
            <button className="btn sm" onClick={sendBilling}><I.peso size={14} /> Send billing</button>
            <button className="btn primary sm" onClick={exportCensus}><I.download size={14} /> Export census</button>
          </div>
        </div>
      </div>

      {/* summary strip */}
      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="stat-mini"><div className="sm-val tnum">{active} <span style={{ fontSize: 13, color: "var(--text-subtle)", fontWeight: 600 }}>/ {pending} pending</span></div><div className="sm-label">Members active</div></div>
        <div className="stat-mini"><div className="sm-val" style={{ fontSize: 16 }}>{group.plan}</div><div className="sm-label">Coverage plan</div></div>
        <div className="stat-mini"><div className="sm-val tnum" style={{ color: "var(--accent)" }}>{GAD.pesoShort(group.premium)}</div><div className="sm-label">Group premium · {group.cycle}</div></div>
        <div className="stat-mini"><div className="sm-val tnum">{group.renewalDate.split(",")[0]}</div><div className="sm-label">Renewal · in {group.renewalDays} days</div></div>
        <div className="stat-mini"><div className="sm-val tnum">{group.claimsOpen} <span style={{ fontSize: 13, color: "var(--text-subtle)", fontWeight: 600 }}>/ {group.claimsYtd} YTD</span></div><div className="sm-label">Claims open</div></div>
      </div>

      {/* body: roster (left) + panels (right) */}
      <div className="grid12">
        <div className="col-8">
          <window.ListScreen hideHead
            title="Member roster" icon="users" sub=""
            filters={["Active", "Pending", "Dependents", "Lapsed"]}
            filterMatch={(m, f) => f === "Dependents" ? m.relationship === "Dependent" : m.status === f}
            rows={members}
            defaultSort={{ key: "relationship", dir: "asc" }}
            emptyText="No members in this view."
            onExport={exportCensus}
            columns={[
              { k: "name", label: "Member" }, { k: "relationship", label: "Relationship" }, { k: "tier", label: "Coverage tier" },
              { k: "ecard", label: "E-card" }, { k: "claims", label: "Claims", num: true }, { k: "join", label: "Join date" }, { k: "status", label: "Status" },
            ]}
            renderRow={(m) => (
              <tr key={m.id} style={{ cursor: m.contactId ? "pointer" : "default" }} onClick={() => openMember(m)} title={m.contactId ? "Open Contact Profile" : "Roster-only member"}>
                <td>
                  <div className="client-cell">
                    <Avatar name={m.name} size={30} />
                    <div><div className="cc-name">{m.name}</div>{!m.contactId && <div className="cc-sub">Roster only</div>}</div>
                  </div>
                </td>
                <td><span className={"badge " + (m.relationship === "Principal" ? "green" : m.relationship === "Dependent" ? "violet" : "slate")}>{m.relationship}</span></td>
                <td className="cell-muted">{m.tier}</td>
                <td>{gaBadge(m.ecard)}</td>
                <td className="num tnum">{m.claims || <span className="cell-muted">0</span>}</td>
                <td className="cell-muted">{m.join}</td>
                <td>{gaBadge(m.status)}</td>
              </tr>
            )}
          />
        </div>

        <div className="col-4 stack">
          {/* Group policy */}
          <GAPanel title="Group policy" icon="shield" action={<button className="cp-assoc-add" title="View policy" onClick={() => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "policies" } }))}><I.arrowRight size={13} /></button>}>
            <div className="ga-kv"><span>Policy no.</span><b className="mono">{group.policyNo}</b></div>
            <div className="ga-kv"><span>Plan</span><b>{group.plan}</b></div>
            <div className="ga-kv"><span>Effective</span><b>{group.effective}</b></div>
            <div className="ga-kv"><span>Expiry</span><b>{group.expiry}</b></div>
            <div className="ga-kv"><span>Premium</span><b>{GAD.peso(group.premium)} <span className="cell-muted" style={{ fontWeight: 500 }}>/ yr</span></b></div>
          </GAPanel>

          {/* Billing / census */}
          <GAPanel title="Billing & census" icon="peso">
            <div className="ga-kv"><span>Billing cycle</span><b>{group.cycle}</b></div>
            <div className="ga-kv"><span>This invoice</span><b style={{ color: "var(--accent)" }}>{GAD.peso(Math.round(cycleUnit))}</b></div>
            {rep && <div className="ga-kv"><span>Billed to</span><b><button className="ga-rep inline" onClick={openRep} title={"Open " + rep.name + "'s Contact Profile"}>{rep.name}</button></b></div>}
            <div style={{ padding: "8px 14px 4px" }}>
              <div className="ga-breakdown-label">Per-member breakdown / yr</div>
              {tierRows.map((r) => (
                <div className="ga-bd-row" key={r.tier}>
                  <span className="ga-bd-tier">{r.tier} <span className="cell-muted">× {r.count}</span></span>
                  <span className="ga-bd-total mono">{GAD.peso(r.total)}</span>
                </div>
              ))}
            </div>
            <div className="ga-panel-acts">
              <button className="btn xs" onClick={sendBilling}><I.mail size={12} /> Send billing</button>
              <button className="btn xs" onClick={exportCensus}><I.download size={12} /> Export census</button>
            </div>
          </GAPanel>

          {/* Documents */}
          <GAPanel title="Documents" icon="folder" count={GA_DOCS.length}>
            {GA_DOCS.map((d, i) => (
              <div className="cp-assoc-row" key={i}>
                <div className="cp-assoc-main"><div className="cp-assoc-code" style={{ fontFamily: "inherit", fontWeight: 600 }}>{d.name}</div><div className="cp-assoc-sub">{d.type}</div></div>
                {gaBadge(d.status === "Verified" ? "Issued" : d.status === "Received" ? "Active" : "Pending")}
              </div>
            ))}
          </GAPanel>

          {/* Timeline */}
          <GAPanel title="Group activity" icon="refresh">
            <GATimeline entries={timeline} />
          </GAPanel>
        </div>
      </div>

      {addOpen && <AddMemberModal group={group} onAdd={addMember} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

/* ================================= Clients → Group Accounts list ================================= */
function GroupAccountsList({ headerControl }) {
  const role = window.Perms.role();
  const me = window.Perms.current;
  let groups = window.GroupsData.GROUPS;
  if (role === "agent") groups = groups.filter((g) => g.owner === me);
  return (
    <window.ListScreen
      title="Clients" icon="users"
      sub={groups.length + " group HMO accounts · company-level records"}
      headerControl={headerControl}
      primaryAction="New group application"
      onPrimary={() => window.dispatchEvent(new CustomEvent("open-new-application", { detail: { prefill: {
        appType: "New Insurance Application", category: "hmo", product: "BC Flexi HMO",
        agent: (window.Perms ? window.Perms.person().name : ""),
      } } }))}
      onExport={() => window.dispatchEvent(new CustomEvent("app-toast", { detail: { title: "Group accounts exported", sub: groups.length + " company records." } }))}
      stats={[
        { val: groups.length, label: "Group accounts" },
        { val: groups.reduce((a, g) => a + window.GroupsData.membersOf(g.id).length, 0), label: "Total members" },
        { val: GAD.pesoShort(groups.reduce((a, g) => a + g.premium, 0)), label: "Group premium", color: "var(--accent)" },
        { val: groups.filter((g) => g.status === "Lapsing").length, label: "Lapsing soon", color: "var(--amber)" },
      ]}
      filters={["Active", "Onboarding", "Lapsing", "Lapsed"]}
      rows={groups.map((g) => ({ ...g, _filter: g.status, memberCount: window.GroupsData.membersOf(g.id).length }))}
      defaultSort={{ key: "premium", dir: "desc" }}
      columns={[
        { k: "name", label: "Company" }, { k: "id", label: "Group ID" }, { k: "plan", label: "Plan" },
        { k: "memberCount", label: "Members", num: true }, { k: "premium", label: "Group premium", num: true },
        { k: "renewalDate", label: "Renewal" }, { k: "status", label: "Status" },
      ]}
      renderRow={(g) => (
        <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: g } }))}>
          <td><div className="client-cell"><span className="ga-glyph sm"><I.building size={16} /></span><div><div className="cc-name">{g.name}</div><div className="cc-sub">{g.city}</div></div></div></td>
          <td><span className="cell-code">{g.id}</span></td>
          <td className="cell-muted">{g.plan}</td>
          <td className="num tnum" style={{ fontWeight: 600 }}>{g.memberCount}</td>
          <td className="num mono" style={{ fontWeight: 600 }}>{GAD.peso(g.premium)}</td>
          <td className="cell-muted">{g.renewalDate}</td>
          <td>{gaBadge(g.status)}</td>
        </tr>
      )}
    />
  );
}

window.GroupAccount = GroupAccount;
window.GroupAccountsList = GroupAccountsList;
