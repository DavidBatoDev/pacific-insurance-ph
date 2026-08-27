"use client";

import type { Client } from "@/lib/repositories/clients/client.entity";
import { peso, pesoShort } from "@/lib/format";
import { LEAD_STAGES, monthBucket, STAGE_META, STAGE_PROB, weightedValue } from "../../lead-config";
import { Card, CardHead, StatStrip } from "../../primitives";

/** The Forecast view: weighted funnel + expected-close buckets with drill-down. */
export function ForecastView({
  filteredLeads,
  weightedTotal,
  rawTotal,
  onDrillStage,
  onDrillMonth,
}: {
  filteredLeads: Client[];
  weightedTotal: number;
  rawTotal: number;
  /** Drill into a stage (switches the parent to the List view). */
  onDrillStage: (stage: string) => void;
  /** Drill into an expected-close bucket (switches the parent to the List view). */
  onDrillMonth: (bucket: string) => void;
}) {
  const TARGET = 2_500_000;
  const thisMonthLeads = filteredLeads.filter((l) => monthBucket(l.expectedCloseDate) === "This month");
  const quarterLeads = filteredLeads.filter((l) => {
    if (!l.expectedCloseDate) return false;
    const d = new Date(l.expectedCloseDate);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  });
  const wThisMonth = thisMonthLeads.reduce((a, l) => a + weightedValue(l.leadStage, l.estPremium), 0);
  const targetPct = Math.min(100, Math.round((wThisMonth / TARGET) * 100));
  const funnel = LEAD_STAGES.map((s) => {
    const items = filteredLeads.filter((l) => l.leadStage === s);
    return {
      stage: s,
      count: items.length,
      raw: items.reduce((a, l) => a + (l.estPremium ?? 0), 0),
      weighted: items.reduce((a, l) => a + weightedValue(l.leadStage, l.estPremium), 0),
    };
  });
  const maxW = Math.max(...funnel.map((f) => f.weighted), 1);
  const buckets = ["This month", "Next month", "Later"].map((b) => {
    const items = filteredLeads.filter((l) => monthBucket(l.expectedCloseDate) === b);
    return { bucket: b, count: items.length, weighted: items.reduce((a, l) => a + weightedValue(l.leadStage, l.estPremium), 0) };
  });
  const maxB = Math.max(...buckets.map((b) => b.weighted), 1);

  const forecast = (
    <>
      <StatStrip
        size="sm"
        className="mb-4"
        stats={[
          { val: pesoShort(weightedTotal), label: "Weighted pipeline", cls: "text-brand" },
          { val: pesoShort(rawTotal), label: "Raw pipeline" },
          {
            val: (
              <>
                {thisMonthLeads.length}{" "}
                <span className="text-[13px] font-semibold text-subtle">/ {quarterLeads.length} qtr</span>
              </>
            ),
            label: "Expected conversions · month / quarter",
          },
          {
            val: targetPct + "%",
            label: `Forecast vs target (${pesoShort(wThisMonth)} / ${pesoShort(TARGET)})`,
            extra: (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand" style={{ width: targetPct + "%" }} />
              </div>
            ),
          },
        ]}
      />
      <div className="grid grid-cols-12 gap-4 max-[1100px]:grid-cols-1">
        <Card className="col-span-7 max-[1100px]:col-span-1">
          <CardHead iconName="trendUp" title="Weighted funnel" action={<span className="text-[12.5px] font-semibold text-brand-hover">bar = weighted ₱ · click a stage</span>} />
          <div className="px-[18px] pb-[18px] pt-3.5">
            {funnel.map((f) => (
              <button
                key={f.stage}
                onClick={() => onDrillStage(f.stage)}
                className="group grid w-full grid-cols-[170px_1fr_150px] items-center gap-3 py-1.5 text-left"
              >
                <span className="text-[12.5px] font-semibold">
                  {f.stage} <span className="text-[11px] text-subtle">{Math.round((STAGE_PROB[f.stage] ?? 0) * 100)}%</span>
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-surface-3">
                  <span className="block h-full rounded-full transition-all group-hover:opacity-80" style={{ width: (f.weighted / maxW) * 100 + "%", background: STAGE_META[f.stage].color }} />
                </span>
                <span className="text-right text-[12px] tabular-nums text-muted-foreground">
                  <b>{f.count}</b> · {pesoShort(f.raw)} · <b className="text-foreground">{pesoShort(f.weighted)}</b>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="col-span-5 max-[1100px]:col-span-1">
          <CardHead iconName="refresh" title="Expected close" action={<span className="text-[12.5px] font-semibold text-brand-hover">by month · click to drill</span>} />
          <div className="px-[18px] pb-[18px] pt-3.5">
            {buckets.map((b) => (
              <button
                key={b.bucket}
                onClick={() => onDrillMonth(b.bucket)}
                className="mb-3.5 block w-full text-left last:mb-0"
              >
                <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold">
                  {b.bucket}
                  <span className="text-subtle">{b.count} lead{b.count === 1 ? "" : "s"}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-brand" style={{ width: (b.weighted / maxB) * 100 + "%" }} />
                </div>
                <div className="mt-1 text-[12px] tabular-nums text-muted-foreground">{peso(b.weighted)} weighted</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-4 rounded-md border border-border-soft bg-surface-2 px-4 py-3 text-[12px] text-muted-foreground">
        <b>Weighted value = estimated premium × stage close-probability.</b> Assumptions:{" "}
        {LEAD_STAGES.map((s) => `${s} ${Math.round((STAGE_PROB[s] ?? 0) * 100)}%`).join(" · ")}
      </div>
    </>
  );
  return forecast;
}
