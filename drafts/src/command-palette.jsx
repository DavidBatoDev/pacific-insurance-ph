// Pacific Insurance PH — Global command-palette search (⌘K)
// Indexes the seed records already held in state — no backend, no new store.
// Reuses existing navigation events (open-contact / open-group / go-screen) and lifecycle/type badges.
const { useState: useStateCK, useEffect: useEffectCK, useRef: useRefCK, useMemo: useMemoCK } = React;

const CK_norm = (s) => (s == null ? "" : String(s)).toLowerCase();
const CK_staffName = (id) => (window.PData.STAFF[id] ? window.PData.STAFF[id].name : (window.PPData.PP_STAFF[id] || id));

// Persona scoping: Agent sees only records assigned to them (reuse the app's role→own pattern).
// Records with no owner field are visible to everyone (mirrors the unscoped list screens).
function CK_scope(rows, ownerKey) {
  const role = window.Perms.role();
  if (role !== "agent" || !ownerKey) return rows;
  const me = window.Perms.current;
  return rows.filter((r) => !r[ownerKey] || r[ownerKey] === me);
}

// Build the flat, grouped result set for a query.
function CK_search(qRaw) {
  const q = CK_norm(qRaw).trim();
  const D = window.PData, G = window.GroupsData, PP = window.PPData;
  const hit = (...fields) => !q || fields.some((f) => CK_norm(f).includes(q));

  // ---- People: clients + leads (unified contacts) ----
  const people = [];
  CK_scope(D.CLIENTS, null).forEach((c) => {
    if (hit(c.name, c.email, c.record_id)) {
      const life = (c.policies > 0) ? "Policyholder" : "Client";
      people.push({
        key: "cl-" + c.record_id, type: "Contact", icon: "users",
        label: c.name, sub: c.email + " · #" + c.record_id,
        badge: { text: life, tone: c.status === "At Risk" ? "amber" : "green" },
        open: () => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", record_id: c.record_id, name: c.name, email: c.email, status: c.status } } })),
      });
    }
  });
  CK_scope(PP.PP_LEADS, "staff").forEach((l) => {
    if (hit(l.name, l.rid, l.product)) {
      people.push({
        key: "ld-" + l.rid, type: "Contact", icon: "trendUp",
        label: l.name, sub: l.stage + " · " + l.product + " · #" + l.rid,
        badge: { text: "Lead", tone: (PP.PP_STATUS_TONE[l.status] || "slate") },
        open: () => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", record_id: l.rid, name: l.name, interest: l.product, product: l.product, owner: l.staff, initialStatus: "Lead", stage: "Lead", leadStage: l.stage, leadStatus: l.status } } })),
      });
    }
  });

  // ---- Group accounts ----
  const groups = CK_scope(G.GROUPS, "owner").filter((g) => hit(g.name, g.id, g.plan)).map((g) => ({
    key: "gr-" + g.id, type: "Group Account", icon: "building",
    label: g.name, sub: g.id + " · " + g.plan + " · " + G.membersOf(g.id).length + " members",
    badge: { text: "Group", tone: "blue" },
    open: () => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: g } })),
  }));

  // ---- Policies ----
  const policies = CK_scope(window.PoliciesRegister || [], null).filter((p) => hit(p.id, p.client, p.product)).map((p) => ({
    key: "po-" + p.id, type: "Policy", icon: "shield",
    label: p.id, sub: p.client + " · " + p.product,
    badge: { text: p.status, tone: p.status === "Active" ? "green" : "amber" },
    open: () => CK_goList("policies", p.id),
  }));

  // ---- Applications ----
  const apps = CK_scope(D.APPLICATIONS, "staff").filter((a) => hit(a.id, a.client, a.product)).map((a) => ({
    key: "ap-" + a.id, type: "Application", icon: "fileText",
    label: a.id, sub: a.client + " · " + a.product,
    badge: { text: a.status, tone: "slate" },
    open: () => CK_goList("applications", a.id),
  }));

  // ---- Claims ----
  const claims = CK_scope(D.CLAIMS, "staff").filter((c) => hit(c.id, c.client, c.policy)).map((c) => ({
    key: "cm-" + c.id, type: "Claim", icon: "clipboard",
    label: c.id, sub: c.client + " · " + c.policy,
    badge: { text: c.status, tone: "slate" },
    open: () => CK_goList("claims", c.id),
  }));

  // ---- Renewals ----
  const renewals = CK_scope(D.RENEWALS, null).filter((r) => hit(r.id, r.client, r.policy)).map((r) => ({
    key: "rn-" + r.id, type: "Renewal", icon: "refresh",
    label: r.client, sub: r.policy + " · due " + r.date,
    badge: { text: r.status, tone: "amber" },
    open: () => CK_goList("renewals", r.client),
  }));

  // ---- Travel ----
  const travel = CK_scope(D.TRAVEL, "staff").filter((t) => hit(t.id, t.client, t.dest)).map((t) => ({
    key: "tv-" + t.id, type: "Travel", icon: "plane",
    label: t.id, sub: t.client + " · " + t.dest,
    badge: { text: t.status, tone: "blue" },
    open: () => CK_goList("travel", t.id),
  }));

  return [
    { type: "People", icon: "users", items: people },
    { type: "Group Accounts", icon: "building", items: groups },
    { type: "Policies", icon: "shield", items: policies },
    { type: "Applications", icon: "fileText", items: apps },
    { type: "Claims", icon: "clipboard", items: claims },
    { type: "Renewals", icon: "refresh", items: renewals },
    { type: "Travel", icon: "plane", items: travel },
  ].filter((g) => g.items.length > 0);
}

function CK_goList(screen, query) {
  window.__pendingListQuery = query;
  window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen } }));
}

const CK_CAP = 5;

function CommandPalette({ open, onClose }) {
  const [q, setQ] = useStateCK("");
  const [dq, setDq] = useStateCK(""); // debounced
  const [active, setActive] = useStateCK(0);
  const [expanded, setExpanded] = useStateCK({});
  const inputRef = useRefCK(null);
  const listRef = useRefCK(null);

  // reset on open
  useEffectCK(() => {
    if (open) { setQ(""); setDq(""); setActive(0); setExpanded({}); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); }
  }, [open]);

  // debounce query
  useEffectCK(() => {
    const t = setTimeout(() => { setDq(q); setActive(0); }, 130);
    return () => clearTimeout(t);
  }, [q]);

  const groups = useMemoCK(() => open ? CK_search(dq) : [], [dq, open]);

  // flatten visible (respecting caps + expansion) for keyboard nav
  const flat = useMemoCK(() => {
    const out = [];
    groups.forEach((g) => {
      const lim = expanded[g.type] ? g.items.length : CK_CAP;
      g.items.slice(0, lim).forEach((it) => out.push(it));
    });
    return out;
  }, [groups, expanded]);

  useEffectCK(() => { if (active >= flat.length) setActive(Math.max(0, flat.length - 1)); }, [flat.length]);

  // keyboard within palette
  useEffectCK(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); const it = flat[active]; if (it) { it.open(); onClose(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flat, active, onClose]);

  // keep active row in view
  useEffectCK(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(".ck-row.active");
    if (el) { const r = el.getBoundingClientRect(), pr = listRef.current.getBoundingClientRect();
      if (r.bottom > pr.bottom) listRef.current.scrollTop += (r.bottom - pr.bottom + 8);
      else if (r.top < pr.top) listRef.current.scrollTop -= (pr.top - r.top + 8);
    }
  }, [active]);

  if (!open) return null;

  const totalItems = groups.reduce((a, g) => a + g.items.length, 0);
  let idx = -1; // running index across groups to match `flat`

  const suggestions = [
    { label: "Meridian Tech Solutions", hint: "Group account", run: () => window.dispatchEvent(new CustomEvent("open-group", { detail: { group: window.GroupsData.get("GRP-0007") } })) },
    { label: "John Santos", hint: "Client", run: () => window.dispatchEvent(new CustomEvent("open-contact", { detail: { contact: { _kind: "client", record_id: "000118", name: "John Santos" } } })) },
    { label: "Open Policies", hint: "Register", run: () => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "policies" } })) },
    { label: "Open Claims", hint: "Register", run: () => window.dispatchEvent(new CustomEvent("go-screen", { detail: { screen: "claims" } })) },
  ];

  return ReactDOM.createPortal(
    <div className="ck-overlay" onMouseDown={onClose}>
      <div className="ck-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ck-input-row">
          <I.search size={18} />
          <input ref={inputRef} className="ck-input" placeholder="Search clients, leads, policies, applications, claims…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="ck-esc" onClick={onClose}>Esc</button>
        </div>

        <div className="ck-results" ref={listRef}>
          {dq.trim() === "" ? (
            <div className="ck-group">
              <div className="ck-group-head">Jump to</div>
              {suggestions.map((s, i) => (
                <button key={i} className="ck-row" onMouseDown={(e) => e.preventDefault()} onClick={() => { s.run(); onClose(); }}>
                  <span className="ck-ico"><I.arrowRight size={15} /></span>
                  <span className="ck-label">{s.label}</span>
                  <span className="ck-sub">{s.hint}</span>
                </button>
              ))}
              <div className="ck-hint">Type to search across people, groups, policies, applications, claims, renewals and travel.</div>
            </div>
          ) : totalItems === 0 ? (
            <div className="ck-empty">
              <I.search size={26} />
              <div className="ck-empty-t">No results for “{dq}”</div>
              <div className="ck-empty-s">Try a name, a record ID, a POL- / CLM- / APP- number, or a company.</div>
            </div>
          ) : (
            groups.map((g) => {
              const GIco = I[g.icon];
              const lim = expanded[g.type] ? g.items.length : CK_CAP;
              const shown = g.items.slice(0, lim);
              const more = g.items.length - shown.length;
              return (
                <div className="ck-group" key={g.type}>
                  <div className="ck-group-head"><GIco size={12} /> {g.type} <span className="ck-count">{g.items.length}</span></div>
                  {shown.map((it) => {
                    idx++;
                    const RIco = I[it.icon];
                    const on = idx === active;
                    const myIdx = idx;
                    return (
                      <button key={it.key} className={"ck-row" + (on ? " active" : "")} onMouseMove={() => setActive(myIdx)}
                        onMouseDown={(e) => e.preventDefault()} onClick={() => { it.open(); onClose(); }}>
                        <span className="ck-ico"><RIco size={15} /></span>
                        <span className="ck-label">{it.label}</span>
                        <span className="ck-sub">{it.sub}</span>
                        {it.badge && <span className={"badge " + it.badge.tone}><span className="b-dot"></span>{it.badge.text}</span>}
                      </button>
                    );
                  })}
                  {more > 0 && (
                    <button className="ck-more" onMouseDown={(e) => e.preventDefault()} onClick={() => setExpanded((s) => ({ ...s, [g.type]: true }))}>
                      + {more} more {g.type.toLowerCase()}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="ck-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="ck-foot-spacer"></span>
          {window.Perms.role() === "agent" && <span className="ck-scope-note">Showing your records only</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}

window.CommandPalette = CommandPalette;
