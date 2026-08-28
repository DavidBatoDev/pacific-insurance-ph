"use client";

import { useMemo, useState } from "react";

import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { followDays, toggleFilterValue, weightedValue } from "../lead-config";
import { AdvanceLeadModal, type AdvanceLeadPreset, type AdvanceLeadTarget } from "../overlays/advance-lead";
import { useOverlays } from "../overlays/overlay-provider";
import { Btn } from "../primitives";
import { BoardView } from "./prospects/board-view";
import { LeadFilters } from "./prospects/filters";
import { ForecastView } from "./prospects/forecast-view";
import { ListView } from "./prospects/list-view";

/**
 * Lead Lifecycle — Board / List / Forecast over real clients rows at
 * lifecycle_stage='Lead'. Every stage/status change routes through the
 * Advance-Lead popup. The three views live in ./prospects/ and mount one
 * at a time; this parent owns the shared filters and derived totals.
 */

export interface LeadActivityRow {
  id: string;
  summary: string;
  actorName: string | null;
  when: string;
}

interface Props {
  leads: Client[];
  userNames: Record<string, string>;
  activity: LeadActivityRow[];
  /** Exit counters derived from all-time data (Converted / Lost). */
  exits: { converted: number; lost: number };
}

type ViewId = "Board" | "List" | "Forecast";

export function ProspectsLive({ leads, userNames, activity, exits }: Props) {
  const overlays = useOverlays();
  const [view, setView] = useState<ViewId>("Board");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const [advance, setAdvance] = useState<{ lead: AdvanceLeadTarget; preset?: AdvanceLeadPreset } | null>(null);
  const [drillStage, setDrillStage] = useState<string | null>(null);
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const [ownerF, setOwnerF] = useState("All");

  const productOptions = useMemo(
    () =>
      [...new Set(leads.map((lead) => lead.productInterest?.trim()).filter((value): value is string => !!value))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [leads],
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(lead.leadStatus ?? "New")) return false;
        if (selectedProducts.length > 0 && !selectedProducts.includes(lead.productInterest?.trim() ?? "")) return false;
        if (overdueOnly && (followDays(lead.nextFollowUpDate) ?? 0) >= 0) return false;
        return true;
      }),
    [leads, overdueOnly, selectedProducts, selectedStatuses],
  );
  const target = (l: Client): AdvanceLeadTarget => ({
    clientId: l.id,
    name: l.fullName,
    referenceNo: l.referenceNo,
    stage: l.leadStage,
    status: l.leadStatus,
  });

  /* ---------- derived numbers ---------- */
  const weightedTotal = filteredLeads.reduce((a, l) => a + weightedValue(l.leadStage, l.estPremium), 0);
  const rawTotal = filteredLeads.reduce((a, l) => a + (l.estPremium ?? 0), 0);
  const overdue = leads.filter((l) => (followDays(l.nextFollowUpDate) ?? 1) < 0).length;
  const dueToday = leads.filter((l) => followDays(l.nextFollowUpDate) === 0).length;

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.leadStatus ?? "New"] = (c[l.leadStatus ?? "New"] ?? 0) + 1;
    return c;
  }, [leads]);

  const kpis = [
    { icon: "users", value: leads.length, label: "Active Leads" },
    { icon: "phone", value: dueToday + overdue, label: "Follow-ups Due Today", sub: `${overdue} overdue`, tone: "amber" },
    { icon: "fileText", value: leads.filter((l) => l.leadStage === "Proposal").length, label: "Proposals Pending" },
    { icon: "clipboard", value: leads.filter((l) => l.leadStage === "Application Started").length, label: "Application Starts" },
    { icon: "award", value: exits.converted, label: "Conversions (all time)" },
    {
      icon: "trendUp",
      value:
        exits.converted + exits.lost > 0
          ? Math.round((exits.converted / (exits.converted + exits.lost)) * 100) + "%"
          : "—",
      label: "Conversion Rate",
    },
  ] as const;

  const onAdvance = (lead: Client, preset: AdvanceLeadPreset) =>
    setAdvance({ lead: target(lead), preset });

  return (
    <div>
      {/* Header */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-[11px] text-[23px] font-bold tracking-[-0.025em]">
            Lead Lifecycle
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-hover">
              <I.users size={12} /> Pre-application
            </span>
          </h1>
          <p className="mt-[3px] max-w-[720px] text-[13.5px] text-muted-foreground">
            Move a lead from first inquiry to a started application, tracked on two axes — a pipeline{" "}
            <b>Stage</b> and an orthogonal <b>Status</b>. Every move routes through the Advance-Lead
            popup.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LeadFilters
            statuses={selectedStatuses}
            products={selectedProducts}
            overdueOnly={overdueOnly}
            productOptions={productOptions}
            onToggleStatus={(status) =>
              setSelectedStatuses((current) => toggleFilterValue(current, status))
            }
            onToggleProduct={(product) =>
              setSelectedProducts((current) => toggleFilterValue(current, product))
            }
            onToggleOverdue={() => setOverdueOnly((current) => !current)}
            onClear={() => {
              setSelectedStatuses([]);
              setSelectedProducts([]);
              setOverdueOnly(false);
            }}
          />
          <div className="flex items-center rounded-md border border-border bg-surface-3 p-0.5">
            {(["Board", "List", "Forecast"] as ViewId[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                  view === v ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions — Request/Generate Proposal and Log Call intentionally not here: all
          three need a lead first, so with none in scope they just detour through a client search
          before landing on the exact same action already pre-scoped on that lead's own Contact
          Profile (docs/development-alignment.md). */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Btn variant="primary" onClick={() => overlays.openPageModal("new-lead")}>
          <I.plus size={16} /> New Lead
        </Btn>
      </div>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-6 gap-3 max-[1200px]:grid-cols-3">
        {kpis.map((k) => {
          const Ico = I[k.icon as keyof typeof I];
          return (
            <div key={k.label} className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="grid size-[28px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                  <Ico size={16} />
                </span>
                {"sub" in k && k.sub && <span className="text-[11px] font-bold text-amber">{k.sub}</span>}
              </div>
              <div className="mt-2.5 text-[23px] font-[760] leading-none tracking-[-0.02em] tabular-nums">{k.value}</div>
              <div className="mt-1 text-[12px] font-[550] text-muted-foreground">{k.label}</div>
            </div>
          );
        })}
      </div>


      {view === "Board" && (
        <BoardView
          leads={leads}
          filteredLeads={filteredLeads}
          statusCounts={statusCounts}
          weightedTotal={weightedTotal}
          userNames={userNames}
          activity={activity}
          onAdvance={onAdvance}
        />
      )}
      {view === "List" && (
        <ListView
          leads={leads}
          filteredLeads={filteredLeads}
          userNames={userNames}
          renderedAt={renderedAt}
          ownerF={ownerF}
          setOwnerF={setOwnerF}
          drillStage={drillStage}
          drillMonth={drillMonth}
          onClearDrill={() => {
            setDrillStage(null);
            setDrillMonth(null);
          }}
          onAdvance={onAdvance}
        />
      )}
      {view === "Forecast" && (
        <ForecastView
          filteredLeads={filteredLeads}
          weightedTotal={weightedTotal}
          rawTotal={rawTotal}
          onDrillStage={(stage) => {
            setDrillStage(stage);
            setDrillMonth(null);
            setView("List");
          }}
          onDrillMonth={(bucket) => {
            setDrillMonth(bucket);
            setDrillStage(null);
            setView("List");
          }}
        />
      )}

      {advance && (
        <AdvanceLeadModal
          lead={advance.lead}
          preset={advance.preset}
          onClose={() => setAdvance(null)}
        />
      )}
    </div>
  );
}
