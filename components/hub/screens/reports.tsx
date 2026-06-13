"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/screens-extra.jsx for prototype review. Static charts built
 * from placeholder figures; no real data layer, date ranges, or exports are wired up yet.
 */
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Btn, Card, CardHead, PageHead } from "../primitives";

const BARS = [
  { m: "Jan", v: 1.8 }, { m: "Feb", v: 2.1 }, { m: "Mar", v: 1.9 }, { m: "Apr", v: 2.4 },
  { m: "May", v: 2.7 }, { m: "Jun", v: 3.1 }, { m: "Jul", v: 2.9 }, { m: "Aug", v: 3.4 },
  { m: "Sep", v: 3.2 }, { m: "Oct", v: 3.8 }, { m: "Nov", v: 4.1 }, { m: "Dec", v: 4.6 },
];
const MIX = [
  { label: "Health", pct: 46, color: "#059669" },
  { label: "Life", pct: 27, color: "#2563eb" },
  { label: "Family", pct: 18, color: "#7c3aed" },
  { label: "Travel", pct: 9, color: "#d97706" },
];
const STATS = [
  { val: "₱34.2M", label: "Premiums YTD", color: "var(--brand)" },
  { val: "+18.4%", label: "vs last year", color: "var(--brand)" },
  { val: "1,248", label: "Active clients" },
  { val: "94.2%", label: "Renewal rate", color: "var(--brand)" },
];

function Seg() {
  const opts = ["YTD", "Quarter", "Month"];
  return (
    <div className="inline-flex rounded-md border border-border-strong bg-card p-0.5">
      {opts.map((s, i) => (
        <button
          key={s}
          className={cn(
            "h-7 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors",
            i === 0 ? "bg-brand-soft text-brand-hover" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function ReportsScreen() {
  const max = Math.max(...BARS.map((b) => b.v));
  return (
    <div>
      <PageHead
        icon={I.chart}
        title="Reports"
        sub="Performance overview · Year to date 2026"
        actions={
          <>
            <Seg />
            <Btn><I.download size={15} /> Export</Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
            <div className="text-[22px] font-[760] leading-none tracking-[-0.02em] tabular-nums" style={{ color: s.color }}>
              {s.val}
            </div>
            <div className="mt-1.5 text-[12.5px] font-[550] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 max-[1000px]:grid-cols-1">
        <div className="col-span-8 max-[1000px]:col-span-1">
          <Card>
            <CardHead
              icon={I.trendUp}
              title="Monthly premium revenue"
              action={<span className="text-[12.5px] font-semibold text-subtle">₱ Millions</span>}
            />
            <div className="flex h-[240px] items-end gap-2.5 px-[22px] pb-[18px] pt-[26px]">
              {BARS.map((b) => (
                <div key={b.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className="text-[10.5px] font-bold text-subtle tabular-nums">{b.v}</div>
                  <div
                    className="w-full max-w-[34px] rounded-t-[6px] transition-[height]"
                    style={{
                      height: `${(b.v / max) * 100}%`,
                      background: b.m === "Jun" ? "var(--brand)" : "var(--brand-soft-2)",
                    }}
                  />
                  <div className="text-[11px] font-semibold text-subtle">{b.m}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-4 max-[1000px]:col-span-1">
          <Card className="h-full">
            <CardHead icon={I.shield} title="Product mix" />
            <div className="px-[22px] py-5">
              <div className="mb-5 flex h-3 overflow-hidden rounded-full">
                {MIX.map((m) => (
                  <div key={m.label} style={{ width: `${m.pct}%`, background: m.color }} />
                ))}
              </div>
              {MIX.map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 border-b border-border-soft py-2 last:border-b-0">
                  <span className="size-2.5 rounded-sm" style={{ background: m.color }} />
                  <span className="flex-1 text-[13px] font-[550]">{m.label}</span>
                  <span className="text-[13px] font-bold tabular-nums">{m.pct}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
