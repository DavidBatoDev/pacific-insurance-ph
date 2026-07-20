// Pacific Insurance PH — Add Task — new-modals.md §10
// Fired from the Tasks board, the Dashboard My-tasks widget, and (as a trigger) the Contact Profile.
// Writes through window.TasksStore so the new card lands in the right column AND the dashboard widget.
const { useState: useStateAT, useMemo: useMemoAT } = React;
const ATD = window.PData;
const { Field: ATField, Select: ATSelect, TextInput: ATInput, Textarea: ATArea } = window.NAShared;

const AT_TAGS = ["Application", "Documents", "Renewal", "Travel", "Claim", "Relationship", "Commission", "General"];
const AT_PRIOS = ["Low", "Normal", "High"];
const AT_TODAY = new Date(2026, 6, 9); // prototype "today" — July 9, 2026
AT_TODAY.setHours(0, 0, 0, 0);

// Due date → board column + human meta label
function atBucket(dateStr) {
  if (!dateStr) return { group: "week", meta: "" };
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d - AT_TODAY) / 86400000);
  if (diff < 0) return { group: "overdue", meta: "Due " + d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) };
  if (diff === 0) return { group: "today", meta: "Today" };
  if (diff === 1) return { group: "week", meta: "Tomorrow" };
  return { group: "week", meta: d.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" }) };
}

// Records linked to a contact, for the optional "specific record" dropdown
function atLinkedRecords(name) {
  if (!name) return [];
  const out = [];
  ATD.APPLICATIONS.filter((a) => a.client === name).forEach((a) => out.push({ v: a.id, l: `${a.id} · Application` }));
  ATD.RENEWALS.filter((r) => r.client === name).forEach((r) => out.push({ v: r.id, l: `${r.id} · Renewal` }));
  ATD.CLAIMS.filter((c) => c.client === name).forEach((c) => out.push({ v: c.id, l: `${c.id} · Claim` }));
  ATD.TRAVEL.filter((t) => t.client === name).forEach((t) => out.push({ v: t.id, l: `${t.id} · Travel` }));
  return out;
}

function ATContactPicker({ contact, onPick, onClear }) {
  const [q, setQ] = useStateAT("");
  const results = useMemoAT(() => {
    if (!q.trim()) return [];
    const ql = q.toLowerCase();
    const clients = ATD.CLIENTS.map((c) => ({ name: c.name, key: c.record_id, sub: c.city + " · Client" }));
    const leads = (window.PPData ? window.PPData.PP_LEADS : []).map((l) => ({ name: l.name, key: l.rid, sub: l.product + " · Lead" }));
    return [...clients, ...leads].filter((r) => r.name.toLowerCase().includes(ql)).slice(0, 6);
  }, [q]);
  if (contact) {
    return (
      <div className="at-picked">
        <Avatar name={contact.name} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cr-name">{contact.name}</div>
          <div className="cr-sub">{contact.sub}</div>
        </div>
        <button className="at-clear" onClick={onClear}><I.plus size={15} style={{ transform: "rotate(45deg)" }} /></button>
      </div>
    );
  }
  return (
    <div>
      <div className="filter-search" style={{ width: "100%", height: 38, marginBottom: results.length ? 8 : 0 }}>
        <I.search size={16} />
        <input placeholder="Search a client or lead…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {results.map((r) => (
        <div key={r.name + r.key} className="client-result" onClick={() => { onPick(r); setQ(""); }}>
          <Avatar name={r.name} size={30} />
          <div style={{ flex: 1 }}><div className="cr-name">{r.name}</div><div className="cr-sub">{r.sub}</div></div>
          <I.plus size={16} style={{ color: "var(--text-subtle)" }} />
        </div>
      ))}
    </div>
  );
}

function AddTaskModal({ onClose, prefill }) {
  const persona = window.Perms.person().name;
  const [title, setTitle] = useStateAT((prefill && prefill.title) || "");
  const [tag, setTag] = useStateAT((prefill && prefill.tag) || "General");
  const [contact, setContact] = useStateAT((prefill && prefill.contact) || null);
  const [linked, setLinked] = useStateAT("");
  const [assignee, setAssignee] = useStateAT(persona);
  const [due, setDue] = useStateAT("");
  const [prio, setPrio] = useStateAT("Normal");
  const [notes, setNotes] = useStateAT("");

  const linkedOpts = useMemoAT(() => atLinkedRecords(contact && contact.name), [contact]);
  const bucket = atBucket(due);
  const bucketLabel = { overdue: "Overdue", today: "Due today", week: "Due this week" }[bucket.group];
  const bucketTone = { overdue: "red", today: "amber", week: "blue" }[bucket.group];

  const canSave = title.trim() && tag && assignee && due;

  const save = () => {
    window.TasksStore.add({
      title: title.trim(),
      tag,
      group: bucket.group,
      meta: bucket.meta + (prio === "High" ? " · High" : ""),
      contactName: contact ? contact.name : null,
      contactKey: contact ? contact.key : null,
      linkedRecord: linked || null,
      assignee,
      priority: prio,
      notes: notes.trim() || null,
    });
    window.dispatchEvent(new CustomEvent("app-toast", { detail: {
      title: "Task created",
      sub: `"${title.trim()}" added to ${bucketLabel}${contact ? " · linked to " + contact.name : ""} · assigned to ${assignee}.`,
    } }));
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="dh-ico"><I.checkSquare size={20} /></div>
          <div><h2>New task</h2><div className="dh-sub">Create a follow-up — it lands on the board and your dashboard</div></div>
          <button className="drawer-close" onClick={onClose}><I.plus size={20} style={{ transform: "rotate(45deg)" }} /></button>
        </div>

        <div className="drawer-body">
          <ATField label="Task title" req>
            <ATInput value={title} onChange={setTitle} placeholder="e.g. Follow up payment for APP-2026-000131" autoFocus />
          </ATField>

          <div className="grid-2">
            <ATField label="Type / Tag" req>
              <ATSelect value={tag} onChange={setTag} options={AT_TAGS} />
            </ATField>
            <ATField label="Assigned to" req hint="Defaults to you">
              <ATSelect value={assignee} onChange={setAssignee} options={window.NAShared.NA_OPTS.agents} />
            </ATField>
          </div>

          <div className="grid-2">
            <ATField label="Due date" req>
              <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              {due && <div className="at-bucket"><span className="b-dot" style={{ background: `var(--${bucketTone})` }}></span>Lands in <b>{bucketLabel}</b></div>}
            </ATField>
            <ATField label="Priority" hint="Optional">
              <div className="nc-radio-row">
                {AT_PRIOS.map((p) => (
                  <button key={p} className={"nc-radio" + (prio === p ? " on" : "")} onClick={() => setPrio(p)}>
                    <span className="nc-radio-dot"></span>{p}
                  </button>
                ))}
              </div>
            </ATField>
          </div>

          <div className="form-section" style={{ marginTop: 6 }}>
            <div className="form-section-title">Link to a contact <span style={{ fontWeight: 500, color: "var(--text-subtle)" }}>· optional</span></div>
            <ATContactPicker contact={contact} onPick={(r) => { setContact(r); setLinked(""); }} onClear={() => { setContact(null); setLinked(""); }} />
            {contact && linkedOpts.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <ATField label="Specific record" hint="Attach to one of this contact's records">
                  <ATSelect value={linked} onChange={setLinked} options={[{ v: "", l: "None — contact only" }, ...linkedOpts]} />
                </ATField>
              </div>
            )}
            {contact && linkedOpts.length === 0 && (
              <div className="at-norec">No open Applications / Policies / Claims / Renewals under {contact.name} — the task links to the contact.</div>
            )}
          </div>

          <ATField label="Notes" hint="Optional detail or context">
            <ATArea value={notes} onChange={setNotes} style={{ minHeight: 80 }} placeholder="Anything the assignee should know…" />
          </ATField>

          <div className="callout" style={{ marginBottom: 0 }}>
            <span className="co-ico"><I.checkSquare size={15} /></span>
            <div>Saving adds this to the <b>{bucketLabel}</b> column and your dashboard My-tasks widget.{contact ? <> Marking it done later logs <b>Task completed</b> to {contact.name}'s timeline.</> : null}</div>
          </div>
        </div>

        <div className="drawer-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canSave} style={!canSave ? { opacity: .5, cursor: "not-allowed" } : null} onClick={save}>
            <I.plus size={15} /> Create task
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

window.AddTaskModal = AddTaskModal;
