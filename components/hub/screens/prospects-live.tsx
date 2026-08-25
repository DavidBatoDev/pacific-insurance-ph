"use client";

import { useMemo, useState, useTransition } from "react";
import { Popover } from "@base-ui/react/popover";
import { useRouter } from "next/navigation";

import { setProposalStatusAction } from "@/app/(app)/prospects/actions";
import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "../data";
import { I } from "../icons";
import {
  LEAD_STAGES,
  LEAD_STATUSES,
  PRODUCT_COLORS,
  STAGE_META,
  STAGE_PROB,
  STAGE_TONE,
  STATUS_TONE,
  nextStage,
  proposalChipLabel,
  weightedValue,
} from "../lead-config";
import { useRecordNav } from "../nav";
import { AdvanceLeadModal, type AdvanceLeadPreset, type AdvanceLeadTarget } from "../overlays/advance-lead";
import { useOverlays } from "../overlays/overlay-provider";
import { Avatar, Btn, Card, CardHead, TONE_BADGE } from "../primitives";

/**
 * Lead Lifecycle — Board / List / Forecast over real clients rows at
 * lifecycle_stage='Lead' (design prospects.jsx + prospect-views.jsx, wired).
 * Every stage/status change routes through the Advance-Lead popup.
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

const toggleFilterValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

const isIndividualProposalProduct = (product: string | null) =>
  ["select", "blue royale"].includes(product?.trim().toLowerCase() ?? "");

const followDays = (d: string | null): number | null => {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
};

function FollowPill({ date }: { date: string | null }) {
  const days = followDays(date);
  if (days == null)
    return <span className="text-[11px] font-semibold text-faint">No follow-up</span>;
  const cls =
    days < 0 ? "text-red" : days === 0 ? "text-amber" : days <= 1 ? "text-amber" : "text-muted-foreground";
  const label =
    days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : days === 1 ? "Tomorrow" : `In ${days}d`;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold", cls)}>
      <I.clock size={12} /> {label}
    </span>
  );
}

const StageBadge = ({ stage }: { stage: string | null }) => (
  <span className={cn("inline-flex h-[20px] items-center whitespace-nowrap rounded-full border px-2 text-[10.5px] font-[650]", TONE_BADGE[STAGE_TONE[stage ?? ""] ?? "slate"])}>
    {stage ?? "—"}
  </span>
);
const StatusChip = ({ status }: { status: string | null }) => (
  <span className={cn("inline-flex h-[20px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[10.5px] font-[650]", TONE_BADGE[STATUS_TONE[status ?? ""] ?? "slate"])}>
    <span className="size-1 rounded-full bg-current" />
    {status ?? "—"}
  </span>
);

function LeadFilters({
  statuses,
  products,
  overdueOnly,
  productOptions,
  onToggleStatus,
  onToggleProduct,
  onToggleOverdue,
  onClear,
}: {
  statuses: string[];
  products: string[];
  overdueOnly: boolean;
  productOptions: string[];
  onToggleStatus: (status: string) => void;
  onToggleProduct: (product: string) => void;
  onToggleOverdue: () => void;
  onClear: () => void;
}) {
  const activeCount = Number(statuses.length > 0) + Number(products.length > 0) + Number(overdueOnly);
  const optionClass =
    "flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-hover focus-within:bg-hover";

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={activeCount ? `Filter leads, ${activeCount} active` : "Filter leads"}
        title="Filter leads"
        className={cn(
          "relative grid size-[34px] shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20",
          activeCount
            ? "border-brand bg-brand-soft text-brand-hover"
            : "border-border bg-card text-muted-foreground hover:bg-hover hover:text-foreground",
        )}
      >
        <I.filter size={15} />
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid size-[17px] place-items-center rounded-full bg-brand text-[10px] font-bold text-white ring-2 ring-background">
            {activeCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-[320px] max-w-[calc(100vw-24px)] rounded-lg border border-border bg-card shadow-pop outline-none">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <Popover.Title className="text-[13.5px] font-bold">Filter leads</Popover.Title>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[12px] font-semibold text-brand-hover hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-3">
              <fieldset>
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Status
                </legend>
                <div className="grid grid-cols-2 gap-0.5">
                  {LEAD_STATUSES.map((status) => (
                    <label key={status} className={optionClass}>
                      <input
                        type="checkbox"
                        checked={statuses.includes(status)}
                        onChange={() => onToggleStatus(status)}
                        className="size-3.5 rounded border-border-strong accent-brand"
                      />
                      <span className="size-2 rounded-full" style={{ background: `var(--${STATUS_TONE[status]})` }} />
                      {status}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-3 border-t border-border-soft pt-3">
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Product interest
                </legend>
                {productOptions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0.5">
                    {productOptions.map((product) => (
                      <label key={product} className={optionClass}>
                        <input
                          type="checkbox"
                          checked={products.includes(product)}
                          onChange={() => onToggleProduct(product)}
                          className="size-3.5 rounded border-border-strong accent-brand"
                        />
                        <span
                          className="size-2 rounded-full"
                          style={{ background: PRODUCT_COLORS[product] ?? "var(--slate)" }}
                        />
                        <span className="truncate">{product}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-1 text-[12px] text-subtle">No product interests recorded.</p>
                )}
              </fieldset>

              <fieldset className="mt-3 border-t border-border-soft pt-3">
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Follow-up date
                </legend>
                <label className={optionClass}>
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={onToggleOverdue}
                    className="size-3.5 rounded border-border-strong accent-brand"
                  />
                  <I.clock size={14} className="text-red" />
                  Overdue only
                </label>
              </fieldset>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ProspectsLive({ leads, userNames, activity, exits }: Props) {
  const router = useRouter();
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const [view, setView] = useState<ViewId>("Board");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const [advance, setAdvance] = useState<{ lead: AdvanceLeadTarget; preset?: AdvanceLeadPreset } | null>(null);
  const [drillStage, setDrillStage] = useState<string | null>(null);
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const markProposalReceived = (l: Client) =>
    startTransition(async () => {
      const res = await setProposalStatusAction(l.id, "Received");
      if (res.ok) overlays.toast("Proposal received", `${l.fullName} — ready to send.`);
      else overlays.toast("Couldn’t update proposal", res.error);
      router.refresh();
    });

  const markProposalSent = (l: Client) =>
    startTransition(async () => {
      const res = await setProposalStatusAction(l.id, "Sent");
      if (res.ok) overlays.toast("Proposal sent", `${l.fullName} — proposal marked Sent.`);
      else overlays.toast("Couldn’t update proposal", res.error);
      router.refresh();
    });

  /* ---------- board ---------- */
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const onDrop = (stage: string) => {
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!lead || lead.leadStage === stage) return;
    setAdvance({
      lead: target(lead),
      preset: { stage, status: lead.leadStatus ?? "New", label: `Dragged to ${stage}` },
    });
  };

  const board = (
    <>
      {/* Status distribution */}
      <Card className="mb-4">
        <CardHead iconName="users" title="Status distribution" action={<span className="text-[12.5px] font-semibold text-brand-hover">how many did we reach · is discovery done</span>} />
        <div className="px-[18px] pb-4 pt-3.5">
          <div className="mb-3.5 flex h-3 overflow-hidden rounded-full border border-border-soft">
            {LEAD_STATUSES.map((s) => {
              const c = statusCounts[s] ?? 0;
              if (!c) return null;
              return (
                <div
                  key={s}
                  title={`${s}: ${c}`}
                  style={{ width: (c / leads.length) * 100 + "%", background: `var(--${STATUS_TONE[s]})` }}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUSES.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground"
              >
                <span className="size-2 rounded-full" style={{ background: `var(--${STATUS_TONE[s]})` }} />
                {s}
                <span className="tabular-nums text-subtle">{statusCounts[s] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Kanban */}
      <Card className="mb-4 overflow-hidden">
        <CardHead
          iconName="grid"
          title="Lead board"
          count={filteredLeads.length}
          action={
            <span className="text-[12.5px] font-semibold text-brand-hover">
              {filteredLeads.length} of {leads.length} · {peso(weightedTotal)} weighted
            </span>
          }
        />
        <div className="overflow-x-auto px-4 pb-4 pt-3.5">
          {filteredLeads.length === 0 && (
            <div className="mb-3 rounded-md border border-border-soft bg-surface-2 px-4 py-3 text-[12.5px] text-subtle">
              No leads match these filters. Clear or adjust the filters to see more leads.
            </div>
          )}
          <div className="grid min-w-[1080px] grid-cols-6 gap-3">
            {LEAD_STAGES.map((stage) => {
              const items = filteredLeads.filter((l) => l.leadStage === stage);
              const val = items.reduce((a, l) => a + (l.estPremium ?? 0), 0);
              const meta = STAGE_META[stage];
              return (
                <div
                  key={stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverCol(stage);
                  }}
                  onDrop={() => onDrop(stage)}
                >
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <span className="size-2 rounded-full" style={{ background: meta.color }} />
                    <span className="text-[11.5px] font-bold">{stage}</span>
                    <span className="tabular-nums text-[11px] font-bold text-subtle">{items.length}</span>
                    <span className="ml-auto text-[10.5px] font-semibold text-faint">{val ? pesoShort(val) : ""}</span>
                  </div>
                  <div
                    className={cn(
                      "flex min-h-[90px] flex-col gap-2 rounded-lg",
                      overCol === stage && dragId != null && "outline-dashed outline-2 outline-offset-2 outline-brand",
                    )}
                  >
                    {items.map((l) => {
                      const color = PRODUCT_COLORS[l.productInterest ?? ""] ?? "var(--slate)";
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={() => setDragId(l.id)}
                          onClick={() => openContact(l.id, "prospects")}
                          className="cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-xs transition-all hover:-translate-y-px hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-[12.5px] font-[650] leading-snug">{l.fullName}</span>
                            <StatusChip status={l.leadStatus} />
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] font-[550] text-muted-foreground">
                            <span className="size-2 rounded-full" style={{ background: color }} />
                            {l.productInterest ?? "—"}
                          </div>
                          {l.leadStage === "Proposal" && l.proposalStatus && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (l.proposalStatus === "Requested") markProposalReceived(l);
                              }}
                              title={l.proposalStatus === "Requested" ? "Click to mark received" : "Proposal " + proposalChipLabel(l.proposalStatus, l.proposalDecision)}
                              className={cn(
                                "mt-1.5 inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-px text-[10.5px] font-bold",
                                l.proposalDecision === "Declined"
                                  ? "border-red-border bg-red-soft text-red"
                                  : "border-violet-border bg-violet-soft text-violet",
                              )}
                            >
                              <I.clipboard size={11} /> Proposal · {proposalChipLabel(l.proposalStatus, l.proposalDecision)}
                            </button>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Avatar name={userNames[l.assignedUserId ?? ""] ?? "Unassigned"} size={20} />
                              <span className="text-[11px] font-semibold text-muted-foreground">
                                {(userNames[l.assignedUserId ?? ""] ?? "—").split(" ")[0]}
                              </span>
                            </div>
                            <FollowPill date={l.nextFollowUpDate} />
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => overlays.openPageModal("new-lead")}
                      className="rounded-md border border-dashed border-border-strong py-1.5 text-[11.5px] font-semibold text-subtle transition-colors hover:border-brand hover:text-brand"
                    >
                      <I.plus size={13} className="mr-1 inline -translate-y-px" /> Add lead
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Lower grid */}
      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ProposalTracking
            leads={leads}
            onMarkReceived={markProposalReceived}
            onMarkSent={markProposalSent}
            onGenerate={(lead) =>
              overlays.openPageModal("generate-proposal", { clientId: lead.id, clientName: lead.fullName })
            }
          />
          <FollowUpQueue leads={leads} userNames={userNames} onOpen={(id) => openContact(id, "prospects")} />
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ProductInterest leads={leads} />
          <Card>
            <CardHead iconName="clock" title="Recent lead activity" />
            <div className="py-1.5">
              {activity.length === 0 && (
                <div className="px-[18px] py-3 text-[12.5px] text-subtle">No lead activity yet.</div>
              )}
              {activity.map((a) => (
                <div key={a.id} className="border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <div className="text-[12.5px] leading-snug">
                    {a.actorName && <b className="font-[650]">{a.actorName} </b>}
                    {a.summary}
                  </div>
                  <div className="mt-0.5 text-[11px] text-subtle">{a.when}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );

  /* ---------- list ---------- */
  const [ownerF, setOwnerF] = useState("All");
  const owners = ["All", ...new Set(leads.map((l) => l.assignedUserId ?? ""))].filter(Boolean);

  const monthBucket = (iso: string | null): string => {
    if (!iso) return "Later";
    const now = new Date();
    const k = (new Date(iso).getFullYear() * 12 + new Date(iso).getMonth()) - (now.getFullYear() * 12 + now.getMonth());
    return k <= 0 ? "This month" : k === 1 ? "Next month" : "Later";
  };

  let listRows = filteredLeads;
  if (ownerF !== "All") listRows = listRows.filter((l) => l.assignedUserId === ownerF);
  if (drillStage) listRows = listRows.filter((l) => l.leadStage === drillStage);
  if (drillMonth) listRows = listRows.filter((l) => monthBucket(l.expectedCloseDate) === drillMonth);

  const ageDays = (l: Client) =>
    Math.max(0, Math.round((renderedAt - new Date(l.updatedAt).getTime()) / 86_400_000));

  const list = (
    <Card>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border-soft px-4 py-3">
        <select className={SEL} value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
          <option value="All">All owners</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {userNames[o] ?? o}
            </option>
          ))}
        </select>
        {(drillStage || drillMonth) && (
          <button
            className="text-[12px] font-semibold text-brand-hover"
            onClick={() => {
              setDrillStage(null);
              setDrillMonth(null);
            }}
          >
            Clear drill-down: {drillStage ?? drillMonth}
          </button>
        )}
        <span className="ml-auto text-[12.5px] font-semibold text-subtle">
          {listRows.length} of {leads.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border-soft text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
              {["Lead", "Product interest", "Stage", "Status", "Owner", "Next follow-up", "Age", "Weighted value", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listRows.map((l) => (
              <tr key={l.id} className="border-b border-border-soft transition-colors last:border-0 hover:bg-hover">
                <td className="cursor-pointer px-4 py-2.5" onClick={() => openContact(l.id, "prospects")}>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={l.fullName} size={30} />
                    <div>
                      <div className="text-[13px] font-[650]">{l.fullName}</div>
                      <div className="font-mono text-[11px] text-subtle">#{l.referenceNo ?? l.id.slice(0, 6)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: PRODUCT_COLORS[l.productInterest ?? ""] ?? "var(--slate)" }} />
                  {l.productInterest ?? "—"}
                </td>
                <td className="px-4 py-2.5"><StageBadge stage={l.leadStage} /></td>
                <td className="px-4 py-2.5"><StatusChip status={l.leadStatus} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{(userNames[l.assignedUserId ?? ""] ?? "—").split(" ")[0]}</td>
                <td className="px-4 py-2.5"><FollowPill date={l.nextFollowUpDate} /></td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{ageDays(l)}d</td>
                <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">{peso(weightedValue(l.leadStage, l.estPremium))}</td>
                <td className="px-4 py-2.5">
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      setAdvance({
                        lead: target(l),
                        preset: { stage: nextStage(l.leadStage), status: l.leadStatus ?? "New", label: "Advance from List" },
                      })
                    }
                  >
                    Advance
                  </Btn>
                </td>
              </tr>
            ))}
            {listRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-subtle">
                  No leads match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  /* ---------- forecast ---------- */
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
      <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {[
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
          { val: targetPct + "%", label: `Forecast vs target (${pesoShort(wThisMonth)} / ${pesoShort(TARGET)})` },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-card px-4 py-3">
            <div className={cn("text-[19px] font-bold tabular-nums", s.cls)}>{s.val}</div>
            <div className="text-[11.5px] font-semibold text-subtle">{s.label}</div>
            {i === 3 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand" style={{ width: targetPct + "%" }} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 gap-4 max-[1100px]:grid-cols-1">
        <Card className="col-span-7 max-[1100px]:col-span-1">
          <CardHead iconName="trendUp" title="Weighted funnel" action={<span className="text-[12.5px] font-semibold text-brand-hover">bar = weighted ₱ · click a stage</span>} />
          <div className="px-[18px] pb-[18px] pt-3.5">
            {funnel.map((f) => (
              <button
                key={f.stage}
                onClick={() => {
                  setDrillStage(f.stage);
                  setDrillMonth(null);
                  setView("List");
                }}
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
                onClick={() => {
                  setDrillMonth(b.bucket);
                  setDrillStage(null);
                  setView("List");
                }}
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

      {view === "Board" && board}
      {view === "List" && list}
      {view === "Forecast" && forecast}

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

const SEL =
  "h-8 rounded-md border border-border-strong bg-card px-2 text-[12.5px] outline-none focus:border-brand";

/* ---------- sub-cards ---------- */

function ProposalTracking({
  leads,
  onMarkReceived,
  onMarkSent,
  onGenerate,
}: {
  leads: Client[];
  onMarkReceived: (l: Client) => void;
  onMarkSent: (l: Client) => void;
  onGenerate: (l: Client) => void;
}) {
  const steps = ["Requested", "Received", "Sent", "Decision"];
  const rows = leads.filter((l) => l.leadStage === "Proposal");
  return (
    <Card>
      <CardHead
        iconName="fileText"
        title="Proposal tracking"
        count={rows.length}
        action={<span className="text-[12.5px] font-semibold text-brand-hover">within the Proposal stage</span>}
      />
      <div className="px-[18px] pb-1 pt-2.5 text-[11.5px] text-subtle">
        The proposal-artifact status for leads in the <b className="text-violet">Proposal</b> stage — not a
        separate pipeline.
      </div>
      <div>
        {rows.length === 0 && (
          <div className="px-[18px] py-3 text-[12.5px] text-subtle">No leads in the Proposal stage.</div>
        )}
        {rows.map((l) => {
          const stepIdx = steps.indexOf(l.proposalStatus ?? "");
          return (
            <div key={l.id} className="grid grid-cols-[1.6fr_1.2fr_auto] items-center gap-3.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">
              <div className="flex items-center gap-2.5">
                <Avatar name={l.fullName} size={30} />
                <div>
                  <div className="text-[13px] font-[650]">{l.fullName}</div>
                  <div className="text-[11.5px] text-subtle">{l.productInterest ?? "—"}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {steps.map((s, i) => (
                  <span
                    key={s}
                    title={s}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      stepIdx >= 0 && i < stepIdx ? "bg-brand" : stepIdx === i ? "bg-violet" : "bg-surface-3",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[l.proposalDecision === "Declined" ? "red" : l.proposalStatus === "Received" ? "blue" : l.proposalStatus === "Sent" ? "violet" : "slate"])}>
                  {proposalChipLabel(l.proposalStatus, l.proposalDecision) ?? "Not requested"}
                </span>
                {l.proposalStatus === "Requested" && (
                  <Btn size="sm" onClick={() => onMarkReceived(l)}>
                    Mark Received
                  </Btn>
                )}
                {l.proposalStatus === "Received" && (
                  <Btn size="sm" onClick={() => onMarkSent(l)}>
                    Mark Sent
                  </Btn>
                )}
                {!l.proposalStatus && isIndividualProposalProduct(l.productInterest) && (
                  <Btn size="sm" onClick={() => onGenerate(l)}>
                    Generate Proposal
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FollowUpQueue({
  leads,
  userNames,
  onOpen,
}: {
  leads: Client[];
  userNames: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  const rows = leads
    .filter((l) => l.nextFollowUpDate)
    .sort((a, b) => (a.nextFollowUpDate ?? "").localeCompare(b.nextFollowUpDate ?? ""))
    .slice(0, 6);
  return (
    <Card>
      <CardHead iconName="phone" title="Follow-up queue" count={rows.length} />
      <div>
        {rows.map((l) => (
          <button
            key={l.id}
            onClick={() => onOpen(l.id)}
            className="flex w-full items-center gap-3 border-b border-border-soft px-[18px] py-2.5 text-left transition-colors last:border-0 hover:bg-hover"
          >
            <Avatar name={l.fullName} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-[600]">{l.fullName}</div>
              <div className="text-[11.5px] text-subtle">
                <span style={{ color: PRODUCT_COLORS[l.productInterest ?? ""] }} className="font-semibold">
                  {l.productInterest ?? "—"}
                </span>{" "}
                · {l.leadStage} · {(userNames[l.assignedUserId ?? ""] ?? "—").split(" ")[0]}
              </div>
            </div>
            <FollowPill date={l.nextFollowUpDate} />
          </button>
        ))}
      </div>
    </Card>
  );
}

function ProductInterest({ leads }: { leads: Client[] }) {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const p = l.productInterest ?? "Other";
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([name, n]) => ({ name, pct: Math.round((n / Math.max(leads.length, 1)) * 100), color: PRODUCT_COLORS[name] ?? "#64748b" }))
    .sort((a, b) => b.pct - a.pct);
  return (
    <Card>
      <CardHead iconName="shield" title="Product interest" />
      <div className="px-[18px] pb-4 pt-3.5">
        <div className="mb-4 flex h-3 overflow-hidden rounded-full">
          {rows.map((r) => (
            <div key={r.name} title={r.name} style={{ width: r.pct + "%", background: r.color }} />
          ))}
        </div>
        {rows.map((r) => (
          <div key={r.name} className="mb-2 grid grid-cols-[1fr_90px_38px] items-center gap-2.5 last:mb-0">
            <span className="flex items-center gap-2 text-[12.5px] font-[550]">
              <span className="size-[9px] rounded-[2px]" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full" style={{ width: r.pct + "%", background: r.color }} />
            </span>
            <span className="text-right text-[12px] font-bold tabular-nums">{r.pct}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
