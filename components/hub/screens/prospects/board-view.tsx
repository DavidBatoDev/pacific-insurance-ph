"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setProposalStatusAction } from "@/app/(app)/prospects/actions";
import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "@/lib/format";
import { I } from "../../icons";
import { LEAD_BOARD_STAGES, LEAD_STATUSES, PRODUCT_COLORS, proposalChipLabel, STAGE_META, STATUS_TONE } from "../../lead-config";
import { useRecordNav } from "../../nav";
import type { AdvanceLeadPreset } from "../../overlays/advance-lead";
import { useOverlays } from "../../overlays/overlay-provider";
import { Avatar, Card, CardHead } from "../../primitives";
import { FollowPill, StatusChip } from "./badges";
import { FollowUpQueue, ProductInterest, ProposalTracking } from "./widgets";
import type { LeadActivityRow } from "../prospects-live";

/** The kanban Board view: status distribution, stage columns, and sub-cards. */
export function BoardView({
  leads,
  filteredLeads,
  statusCounts,
  weightedTotal,
  userNames,
  activity,
  onAdvance,
}: {
  leads: Client[];
  filteredLeads: Client[];
  statusCounts: Record<string, number>;
  weightedTotal: number;
  userNames: Record<string, string>;
  activity: LeadActivityRow[];
  onAdvance: (lead: Client, preset: AdvanceLeadPreset) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const [, startTransition] = useTransition();

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
    onAdvance(lead, { stage, status: lead.leadStatus ?? "New", label: `Dragged to ${stage}` });
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
            {LEAD_BOARD_STAGES.map((stage) => {
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
  return board;
}
