// Pacific Insurance PH — Right rail widgets + Dashboard assembly
const { useState: useStateRail } = React;
const PDR = window.PData;

/* ---------- My Tasks ---------- */
function TasksWidget() {
  const [tasks, setTasks] = useStateRail(PDR.TASKS);
  const toggle = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const groups = [
    { key: "overdue", label: "Overdue", cls: "overdue" },
    { key: "today", label: "Due today", cls: "" },
    { key: "week", label: "Due this week", cls: "" },
  ];
  const tagTone = { Application: "blue", Documents: "amber", Renewal: "violet", Travel: "blue", Claim: "red", Relationship: "green" };
  const remaining = tasks.filter((t) => !t.done).length;
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.checkSquare size={17} style={{ color: "var(--text-muted)" }} /> My tasks <span className="count-pill">{remaining}</span></h3>
        <button className="card-link">Open board <I.chevRight size={13} /></button>
      </div>
      <div style={{ padding: "4px 0 8px" }}>
        {groups.map((g) => {
          const items = tasks.filter((t) => t.group === g.key);
          if (!items.length) return null;
          return (
            <div className="task-group" key={g.key}>
              <div className={"task-group-label " + g.cls}>
                {g.cls === "overdue" && <I.alertTri size={13} />}{g.label}
                <span className="tgl-count">· {items.filter((t) => !t.done).length}</span>
              </div>
              {items.map((t) => (
                <div key={t.id} className={"task" + (t.done ? " done" : "")} onClick={() => toggle(t.id)}>
                  <div className="task-check">{t.done && <I.check size={13} />}</div>
                  <div className="task-body">
                    <div className="task-title">{t.title}</div>
                    <div className="task-meta">
                      <span className="task-tag" style={{ color: `var(--${tagTone[t.tag]})` }}>{t.tag}</span>
                      {t.meta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Recent Activity ---------- */
function ActivityWidget() {
  const tone = { policy: "green", payment: "green", claim: "red", travel: "blue", doc: "slate", renewal: "amber", client: "violet" };
  const ico = { policy: "shield", payment: "peso", claim: "clipboard", travel: "plane", doc: "upload", renewal: "refresh", client: "user" };
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.clock size={17} style={{ color: "var(--text-muted)" }} /> Recent activity</h3>
        <button className="card-link">View log <I.chevRight size={13} /></button>
      </div>
      <div className="feed">
        {PDR.ACTIVITY.map((a) => {
          const Ico = I[ico[a.type]];
          const t = tone[a.type];
          return (
            <div className="feed-item" key={a.id}>
              <div className="feed-rail">
                <div className="feed-ico" style={{ background: `var(--${t}-soft)`, color: `var(--${t})` }}><Ico size={15} /></div>
                <div className="feed-line"></div>
              </div>
              <div className="feed-body">
                <div className="feed-text"><b>{a.who}</b> <span dangerouslySetInnerHTML={{ __html: a.text }} /></div>
                <div className="feed-time">{a.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Relationship Management ---------- */
function RelationshipWidget() {
  const tone = { birthday: "violet", anniversary: "green", loyalty: "amber" };
  const ico = { birthday: "cake", anniversary: "award", loyalty: "gift" };
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.heart size={17} style={{ color: "var(--text-muted)" }} /> Relationship management</h3>
        <button className="card-link">View all <I.chevRight size={13} /></button>
      </div>
      <div>
        {PDR.RELATIONSHIPS.map((r) => {
          const Ico = I[ico[r.type]];
          const t = tone[r.type];
          return (
            <div className="rel-item" key={r.id}>
              <div className="rel-ico" style={{ background: `var(--${t}-soft)`, color: `var(--${t})` }}><Ico size={17} /></div>
              <div className="rel-body">
                <div className="rel-name">{r.name}</div>
                <div className="rel-sub">{r.sub}</div>
              </div>
              <span className={"rel-when" + (r.soon ? " soon" : "")}>{r.when}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Dashboard assembly ---------- */
function Dashboard({ setScreen }) {
  const today = new Date(2026, 5, 10);
  const dateStr = today.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <h1>Good morning, Matt</h1>
          <p className="sub">{dateStr} · Here's what needs your attention today.</p>
        </div>
        <div className="page-head-actions">
          <button className="btn"><I.download size={15} /> Export</button>
          <button className="btn primary"><I.plus size={15} /> New application</button>
        </div>
      </div>

      <AlertBar setScreen={setScreen} />
      <KpiRow setScreen={setScreen} />
      <RevenueWidget />

      <div className="grid12">
        <div className="col-8 stack">
          <ApplicationsCard setScreen={setScreen} />
          <RenewalsCard setScreen={setScreen} />
          <div className="grid12" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <ClaimsCard setScreen={setScreen} />
            <TravelCard setScreen={setScreen} />
          </div>
        </div>
        <div className="col-4 stack">
          <TasksWidget />
          <RelationshipWidget />
          <ActivityWidget />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TasksWidget, ActivityWidget, RelationshipWidget, Dashboard });
