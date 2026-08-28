"use client";

import type { Client } from "@/lib/repositories/clients/client.entity";
import { peso } from "@/lib/format";
import { monthBucket, nextStage, PRODUCT_COLORS, weightedValue } from "../../lead-config";
import { useRecordNav } from "../../nav";
import type { AdvanceLeadPreset } from "../../overlays/advance-lead";
import { Avatar, Btn, Card, SEL_SM } from "../../primitives";
import { FollowPill, StageBadge, StatusChip } from "./badges";

/** The List view: owner filter + drill-down over the filtered leads table. */
export function ListView({
  leads,
  filteredLeads,
  userNames,
  renderedAt,
  ownerF,
  setOwnerF,
  drillStage,
  drillMonth,
  onClearDrill,
  onAdvance,
}: {
  leads: Client[];
  filteredLeads: Client[];
  userNames: Record<string, string>;
  /** Parent mount time — keeps Age stable across view toggles. */
  renderedAt: number;
  ownerF: string;
  setOwnerF: (owner: string) => void;
  drillStage: string | null;
  drillMonth: string | null;
  onClearDrill: () => void;
  onAdvance: (lead: Client, preset: AdvanceLeadPreset) => void;
}) {
  const { openContact } = useRecordNav();
  const owners = ["All", ...new Set(leads.map((l) => l.assignedUserId ?? ""))].filter(Boolean);

  let listRows = filteredLeads;
  if (ownerF !== "All") listRows = listRows.filter((l) => l.assignedUserId === ownerF);
  if (drillStage) listRows = listRows.filter((l) => l.leadStage === drillStage);
  if (drillMonth) listRows = listRows.filter((l) => monthBucket(l.expectedCloseDate) === drillMonth);

  const ageDays = (l: Client) =>
    Math.max(0, Math.round((renderedAt - new Date(l.updatedAt).getTime()) / 86_400_000));

  const list = (
    <Card>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border-soft px-4 py-3">
        <select className={SEL_SM} value={ownerF} onChange={(e) => setOwnerF(e.target.value)}>
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
            onClick={onClearDrill}
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
                      onAdvance(l, { stage: nextStage(l.leadStage), status: l.leadStatus ?? "New", label: "Advance from List" })
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
  return list;
}
