"use client";

import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { isIndividualProposalProduct, PRODUCT_COLORS, proposalChipLabel } from "../../lead-config";
import { Avatar, Btn, Card, CardHead, Pill } from "../../primitives";
import { FollowPill } from "./badges";

/* ---------- Board-view sub-cards ---------- */

export function ProposalTracking({
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
                <Pill tone={l.proposalDecision === "Declined" ? "red" : l.proposalStatus === "Received" ? "blue" : l.proposalStatus === "Sent" ? "violet" : "slate"}>
                  {proposalChipLabel(l.proposalStatus, l.proposalDecision) ?? "Not requested"}
                </Pill>
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

export function FollowUpQueue({
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

export function ProductInterest({ leads }: { leads: Client[] }) {
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
