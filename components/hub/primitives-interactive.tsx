"use client";

import { useId } from "react";

/* ---------- SVG sparkline ---------- */
/** Client-only (useId gives each gradient a collision-safe id). */
export function Sparkline({
  data,
  color = "var(--brand)",
  w = 110,
  h = 26,
  fill = true,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
}) {
  const gid = "spark" + useId().replace(/:/g, "");
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 2 - ((v - min) / range) * (h - 4),
  ]);
  const line = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block overflow-visible"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.3" fill={color} />
    </svg>
  );
}
