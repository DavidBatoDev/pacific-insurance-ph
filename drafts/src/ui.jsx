// Pacific Insurance PH — shared UI primitives
const { useState } = React;
const { initials, avColor } = window.PData;

function Avatar({ name, size = 28, color }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: color || avColor(name), fontSize: size * 0.4 }}>
      {initials(name)}
    </div>
  );
}

// Status → badge color mapping
const STATUS_TONE = {
  "Awaiting Payment": "amber",
  "Missing Documents": "red",
  "Missing Requirements": "red",
  "Under Review": "blue",
  "Approved": "green",
  "Notice Sent": "blue",
  "In Progress": "violet",
  "Overdue": "red",
  "Additional Documents Required": "red",
  "Awaiting Response": "amber",
  "Policy Issued": "green",
  "Active": "green",
  "At Risk": "amber",
  "New": "blue",
};

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || "slate";
  return (
    <span className={"badge " + tone}>
      <span className="b-dot"></span>{status}
    </span>
  );
}

function TierBadge({ tier }) {
  const tone = tier === "Gold" ? "amber" : tier === "Silver" ? "slate" : "violet";
  return <span className={"badge " + tone}>{tier}</span>;
}

// Due-date cell with urgency
function DueCell({ days, label }) {
  let cls = "ok", text = label;
  if (days < 0) { cls = "over"; text = days === -1 ? "1 day overdue" : `${Math.abs(days)} days overdue`; }
  else if (days === 0) { cls = "soon"; text = "Due today"; }
  else if (days <= 5) { cls = "soon"; text = `In ${days} day${days > 1 ? "s" : ""}`; }
  else text = label || `In ${days} days`;
  return (
    <span className={"due-cell " + cls}>
      <span className="due-dot"></span>{text}
    </span>
  );
}

// SVG sparkline
function Sparkline({ data, color = "var(--accent)", w = 110, h = 26, fill = true }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x, y];
  });
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = "sg" + Math.random().toString(36).slice(2, 7);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.3" fill={color} />
    </svg>
  );
}

// Sortable table header
function useSort(rows, defaultKey, defaultDir = "asc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const toggle = (key) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  const sorted = [...rows].sort((a, b) => {
    let av = a[sort.key], bv = b[sort.key];
    if (typeof av === "string") { av = av.toLowerCase(); bv = (bv || "").toLowerCase(); }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });
  return { sorted, sort, toggle };
}

function Th({ label, k, sort, toggle, num }) {
  const active = sort && sort.key === k;
  return (
    <th className={(toggle ? "sortable " : "") + (num ? "num " : "") + (active ? "sorted" : "")}
      onClick={toggle ? () => toggle(k) : undefined}>
      <span className="th-in">
        {label}
        {toggle && <span className="sort-ico">{active && sort.dir === "desc" ? <I.arrowDown size={12} /> : <I.arrowUp size={12} />}</span>}
      </span>
    </th>
  );
}

Object.assign(window, { Avatar, StatusBadge, TierBadge, DueCell, Sparkline, useSort, Th, STATUS_TONE });
