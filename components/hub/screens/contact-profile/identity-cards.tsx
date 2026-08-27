"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addDependentAction, removeDependentAction } from "@/app/(app)/clients/actions";
import { toggleContactFlagAction } from "@/app/(app)/clients/engage-actions";
import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { fmtDate, peso } from "@/lib/format";
import { I } from "../../icons";
import { useOverlays } from "../../overlays/overlay-provider";
import { Avatar, Card, CardHead, INPUT } from "../../primitives";
import { CollapsibleListCard } from "./collapsible-list-card";

export interface Dependent {
  id: string;
  fullName: string;
  relationship: string | null;
  dateOfBirth: string | null;
}

/** Left column: contact properties, state flags, dependents. */
export function ContactPropertiesCard({ client }: { client: Client }) {
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  return (
    <Card>
      <CardHead
        iconName="user"
        title="Contact properties"
        action={
          <button
            aria-label={propertiesOpen ? "Collapse contact properties" : "Expand contact properties"}
            aria-expanded={propertiesOpen}
            onClick={() => setPropertiesOpen((open) => !open)}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <I.chevDown size={16} className={cn("transition-transform", propertiesOpen && "rotate-180")} />
          </button>
        }
      />
            <dl
              className={cn(
                "grid grid-cols-1 gap-3 px-[18px] py-4 max-[1200px]:grid-cols-2",
                !propertiesOpen && "hidden",
              )}
            >
              {(
                [
                  ["Email", client.email],
                  ["Phone", client.mobileNumber],
                  ["Preferred channel", client.preferredChannel],
                  ["Source", client.leadSource],
                  // The four discovery answers a quote needs, shown together so it is obvious
                  // at a glance which are still outstanding (they gate the move to Proposal).
                  ["Product interest", client.productInterest],
                  ["Budget / est. premium", client.estPremium != null ? peso(client.estPremium) : null],
                  ["Family size", client.familySize != null ? String(client.familySize) : null],
                  ["Coverage tier", client.coverageTier],
                  ["Lifecycle stage", client.lifecycleStage],
                  ["Date of birth", fmtDate(client.dateOfBirth)],
                  ["Address", client.address],
                  ["Record ID", client.referenceNo],
                  ["Created", fmtDate(client.createdAt)],
                ] as [string, string | null][]
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.03em] text-subtle">{k}</dt>
                  <dd className="mt-0.5 break-words text-[13px]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
    </Card>
  );
}

export function StateFlagsCard({ client }: { client: Client }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const toggleFlag = (flag: "earlyPayer" | "doNotContact", value: boolean) =>
    startTransition(async () => {
      const res = await toggleContactFlagAction({ clientId: client.id, flag, value });
      if (!res.ok) overlays.toast("Couldn’t update flag", res.error);
      router.refresh();
    });

  return (
    <Card>
      <CardHead iconName="settings" title="State flags" />
            <div className="px-[18px] py-3">
              {(
                [
                  ["earlyPayer", "Early payer", "Suppresses renewal reminders", client.earlyPayer],
                  ["doNotContact", "Lost / Do not contact", "Archives from queues, keeps history", client.doNotContact],
                ] as const
              ).map(([flag, label, sub, value]) => (
                <div key={flag} className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-[600]">{label}</div>
                    <div className="text-[11.5px] text-subtle">{sub}</div>
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => toggleFlag(flag, !value)}
                    className={cn(
                      "relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors",
                      value ? "bg-brand" : "bg-border-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-all",
                        value ? "left-[20px]" : "left-[2px]",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
    </Card>
  );
}

export function DependentsCard({ client, dependents }: { client: Client; dependents: Dependent[] }) {
  // Entry form starts collapsed: on a new lead the list is empty, so leaving it
  // open makes the card mostly input controls for records that don't exist yet.
  const [addDependentOpen, setAddDependentOpen] = useState(false);
  return (
    <CollapsibleListCard
      iconName="users"
      title="Dependents"
      count={dependents.length}
      open={addDependentOpen}
      onToggle={() => setAddDependentOpen((open) => !open)}
      openLabel="Hide the add-dependent form"
      closedLabel="Add a dependent"
      panel={
            <form action={addDependentAction} className="flex flex-col gap-2 px-[18px] py-3">
              <input type="hidden" name="clientId" value={client.id} />
              <input name="fullName" required placeholder="Full name" className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="relationship" placeholder="Relationship" className={INPUT} />
                <input name="dateOfBirth" type="date" className={INPUT} />
              </div>
              <button
                type="submit"
                className="inline-flex h-[32px] items-center justify-center gap-1 rounded-md border border-transparent bg-brand px-3 text-[12.5px] font-semibold text-on-brand hover:bg-brand-hover"
              >
                <I.plus size={14} /> Add dependent
              </button>
            </form>
      }
    >
            <div>
              {dependents.length === 0 && (
                <p className="px-[18px] py-3 text-[12.5px] text-subtle">No dependents added yet.</p>
              )}
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <Avatar name={d.fullName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">{d.fullName}</div>
                    <div className="text-[11px] text-subtle">
                      {[d.relationship, d.dateOfBirth ? fmtDate(d.dateOfBirth) : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <form action={removeDependentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-subtle hover:bg-hover hover:text-red">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
    </CollapsibleListCard>
  );
}
