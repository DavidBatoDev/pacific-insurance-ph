// Pacific Insurance PH — Dashboard widgets
const { useState: useStateDash } = React;
const PD = window.PData;

/* ---------- Alert bar ---------- */
function AlertBar({ setScreen }) {
  return (
    <div className="alert-row">
      {PD.ALERTS.map((a) => {
        const Ico = I[a.icon];
        return (
          <button key={a.id} className={"alert-card " + a.color} onClick={() => setScreen(a.screen)}>
            <span className="ac-ico"><Ico size={20} /></span>
            <span className="ac-body">
              <span className="ac-num tnum">{a.num}</span>
              <span className="ac-label">{a.label}</span>
            </span>
            <span className="ac-arrow"><I.arrowRight size={17} /></span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- KPI row ---------- */
function KpiRow({ setScreen }) {
  const dirIco = { up: <I.arrowUp size={12} />, down: <I.arrowDown size={12} />, flat: <I.arrowRight size={12} /> };
  return (
    <div className="kpi-row">
      {PD.KPIS.map((k) => {
        const Ico = I[k.icon];
        const col = k.dir === "down" ? "var(--red)" : k.dir === "flat" ? "var(--text-subtle)" : "var(--accent)";
        return (
          <div key={k.id} className="kpi" onClick={() => setScreen(k.screen)}>
            <div className="kpi-top">
              <span className="kpi-ico"><Ico size={17} /></span>
              <span className={"kpi-delta " + k.dir}>{dirIco[k.dir]}{k.delta}</span>
            </div>
            <div className="kpi-val tnum">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-spark"><Sparkline data={k.spark} color={col} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Revenue widget ---------- */
function RevenueWidget() {
  const r = PD.REVENUE;
  const max = Math.max(...r.rows.map((x) => x.value));
  return (
    <div className="revenue">
      <div className="rev-total">
        <div className="rt-label"><I.wallet size={15} /> Revenue opportunity awaiting collection</div>
        <div className="rt-val tnum">{PD.peso(r.total)}</div>
        <div className="rt-meta"><I.trendUp size={13} style={{ color: "var(--accent)" }} /> 42 items across 3 pipelines · updated 5m ago</div>
      </div>
      <div className="rev-bars">
        {r.rows.map((row, i) => {
          const RowIco = I[row.icon];
          return (
          <div className="rev-bar-row" key={i}>
            <span className="rb-label"><RowIco size={15} style={{ color: row.color }} />{row.label}</span>
            <span className="rb-track"><span className="rb-fill" style={{ width: (row.value / max * 100) + "%", background: row.color }}></span></span>
            <span className="rb-val tnum">{PD.peso(row.value)}</span>
          </div>
          );
        })}
      </div>
      <div className="rev-cta">
        <button className="btn primary"><I.send size={15} /> Send payment links</button>
        <button className="btn">View breakdown</button>
      </div>
    </div>
  );
}

/* ---------- Applications table ---------- */
function ApplicationsCard({ setScreen }) {
  const rows = PD.APPLICATIONS.slice(0, 6);
  const { sorted, sort, toggle } = useSort(rows, "due", "asc");
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.fileText size={17} style={{ color: "var(--text-muted)" }} /> Applications requiring action <span className="count-pill">{PD.APPLICATIONS.length}</span></h3>
        <button className="card-link" onClick={() => setScreen("applications")}>View all <I.chevRight size={13} /></button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <Th label="Application" k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Product" k="product" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Staff" k="staff" sort={sort} toggle={toggle} />
            <Th label="Due" k="due" sort={sort} toggle={toggle} />
          </tr></thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id} onClick={() => setScreen("applications")}>
                <td><span className="cell-code">{a.id}</span></td>
                <td>
                  <div className="client-cell">
                    <Avatar name={a.client} size={28} />
                    <div><div className="cc-name">{a.client}</div><div className="cc-sub">{a.city}</div></div>
                  </div>
                </td>
                <td className="cell-muted">{a.product}</td>
                <td><StatusBadge status={a.status} /></td>
                <td><div className="client-cell"><Avatar name={PD.STAFF[a.staff].name} size={24} /><span className="cell-muted" style={{ fontSize: 12.5 }}>{PD.STAFF[a.staff].name.split(" ")[0]}</span></div></td>
                <td><DueCell days={a.due} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Renewals queue ---------- */
function RenewalsCard({ setScreen }) {
  const rows = PD.RENEWALS.slice(0, 6);
  const { sorted, sort, toggle } = useSort(rows, "due", "asc");
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.refresh size={17} style={{ color: "var(--text-muted)" }} /> Renewals queue <span className="count-pill">{PD.RENEWALS.length}</span></h3>
        <button className="card-link" onClick={() => setScreen("renewals")}>View all <I.chevRight size={13} /></button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Policy" k="policy" sort={sort} toggle={toggle} />
            <Th label="Renewal date" k="due" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Premium" k="amount" sort={sort} toggle={toggle} num />
          </tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} onClick={() => setScreen("renewals")}>
                <td>
                  <div className="client-cell">
                    <Avatar name={r.client} size={28} />
                    <div><div className="cc-name">{r.client}</div><div className="cc-sub">{r.city}</div></div>
                  </div>
                </td>
                <td className="cell-muted">{r.policy}</td>
                <td><DueCell days={r.due} label={r.date} /></td>
                <td><StatusBadge status={r.status} /></td>
                <td className="num mono" style={{ fontWeight: 600 }}>{PD.peso(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Claims table ---------- */
function ClaimsCard({ setScreen }) {
  const rows = PD.CLAIMS;
  const { sorted, sort, toggle } = useSort(rows, "updated", "asc");
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.clipboard size={17} style={{ color: "var(--text-muted)" }} /> Claims requiring action <span className="count-pill">{PD.CLAIMS.length}</span></h3>
        <button className="card-link" onClick={() => setScreen("claims")}>View all <I.chevRight size={13} /></button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <Th label="Claim" k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Updated" k="updated" sort={sort} toggle={toggle} />
          </tr></thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} onClick={() => setScreen("claims")}>
                <td><span className="cell-code">{c.id}</span></td>
                <td>
                  <div className="client-cell">
                    <Avatar name={c.client} size={28} />
                    <div><div className="cc-name">{c.client}</div><div className="cc-sub">{c.policy}</div></div>
                  </div>
                </td>
                <td><StatusBadge status={c.status} /></td>
                <td className="cell-muted">{c.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Travel queue ---------- */
function TravelCard({ setScreen }) {
  const rows = PD.TRAVEL;
  const { sorted, sort, toggle } = useSort(rows, "status", "asc");
  return (
    <div className="card">
      <div className="card-head">
        <h3><I.plane size={17} style={{ color: "var(--text-muted)" }} /> Travel insurance queue <span className="count-pill">{PD.TRAVEL.length}</span></h3>
        <button className="card-link" onClick={() => setScreen("travel")}>View all <I.chevRight size={13} /></button>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <Th label="Travel no." k="id" sort={sort} toggle={toggle} />
            <Th label="Client" k="client" sort={sort} toggle={toggle} />
            <Th label="Destination" k="dest" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Next step" k="next" sort={sort} toggle={toggle} />
          </tr></thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} onClick={() => setScreen("travel")}>
                <td><span className="cell-code">{t.id}</span></td>
                <td>
                  <div className="client-cell">
                    <Avatar name={t.client} size={28} />
                    <div><div className="cc-name">{t.client}</div><div className="cc-sub">{t.date}</div></div>
                  </div>
                </td>
                <td><span style={{ fontWeight: 550 }}>{t.flag} {t.dest}</span></td>
                <td><StatusBadge status={t.status} /></td>
                <td className="cell-muted">{t.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { AlertBar, KpiRow, RevenueWidget, ApplicationsCard, RenewalsCard, ClaimsCard, TravelCard });
