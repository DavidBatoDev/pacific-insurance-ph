"use client";

import Link from "next/link";
import { useState } from "react";

import { DeleteClientButton } from "@/components/clients/delete-client-button";
import type { Client } from "@/lib/repositories/clients/client.entity";
import type { Application } from "@/lib/repositories/applications";
import { I, type IconName } from "../../icons";
import { isIndividualProposalProduct, STAGE_TONE, STATUS_TONE } from "../../lead-config";
import { useOverlays } from "../../overlays/overlay-provider";
import { Avatar, Btn, Pill } from "../../primitives";

/** Identity row, ⋮ record menu, action cluster and nurture chips. */
export function ProfileHeader({
  client,
  origin,
  isLead,
  convertReady,
  owner,
  applications,
  draftApplications,
  onAdvance,
  onNurturing,
  onConvert,
  onConvertConfirm,
  onMarkLost,
  onGenerateProposal,
  onRequestProposal,
  focusEmail,
  focusCall,
}: {
  client: Client;
  origin: "clients" | "prospects";
  isLead: boolean;
  convertReady: boolean;
  owner: string | null;
  applications: Application[];
  draftApplications: Application[];
  onAdvance: () => void;
  onNurturing: () => void;
  /** The sanctioned convert (Product Selected or later). */
  onConvert: () => void;
  /** The early convert behind the skip confirmation. */
  onConvertConfirm: () => void;
  onMarkLost: () => void;
  onGenerateProposal: () => void;
  onRequestProposal: () => void;
  focusEmail: (templateName?: string) => void;
  focusCall: () => void;
}) {
  const overlays = useOverlays();
  const [menuOpen, setMenuOpen] = useState(false);

  const NURTURE: { label: string; icon: IconName; run: () => void }[] = [
    { label: "Log Email", icon: "mail", run: () => focusEmail("New inquiry response") },
    { label: "Send Brochure", icon: "folder", run: () => focusEmail("Send brochure") },
    { label: "Send Intake Form", icon: "clipboard", run: () => focusEmail("Send application form") },
    {
      label: isIndividualProposalProduct(client.productInterest) ? "Generate Proposal" : "Request Proposal",
      icon: "fileText",
      run: () => (isIndividualProposalProduct(client.productInterest) ? onGenerateProposal() : onRequestProposal()),
    },
    ...(isLead && client.proposalStatus === "Received"
      ? [{ label: "Log Proposal Email", icon: "send" as IconName, run: () => focusEmail("Proposal / Quote Delivery") }]
      : []),
    // One `Log Call`, not three (../docs/web/lead-workflow.md §4) — same form the composer tab uses.
    { label: "Log Call", icon: "phone", run: focusCall },
  ];

  return (
      <div className="relative mb-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        {/* Record-level actions (edit / delete) live behind the ⋮ so they don't sit next to the
            everyday ones — pr-9 keeps the row clear of the absolutely-placed trigger. */}
        <div className="absolute right-4 top-4 z-30">
          <button
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <I.more size={17} />
          </button>
          {menuOpen && (
            <>
              {/* Click-away catcher, below the menu but above the page. */}
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-[200px] overflow-hidden rounded-md border border-border bg-card py-1 shadow-pop">
                <Link
                  href={`/clients/${client.id}/edit${origin === "prospects" ? "?from=prospects" : ""}`}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover"
                >
                  <I.edit size={15} className="text-subtle" /> Edit
                </Link>
                {/* A draft already resuming this same lead is the one path forward — starting a
                    second, unrelated wizard here would leave two open application rows on one
                    person instead of continuing the one that exists. */}
                {isLead && !convertReady && draftApplications.length === 0 && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onConvertConfirm();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover"
                  >
                    <I.arrowRight size={15} className="text-subtle" /> Convert to Application…
                  </button>
                )}
                {/* Two routes to Lost. `Unresponsive` is the spec's
                    (docs/lead-stage-status.md:48,51); a declined proposal is a deliberate
                    extension, because a client who explicitly said no would otherwise have to be
                    aged out by the no-reply inference to be dispositioned at all. Same
                    hide-when-ineligible precedent as `Mark as Nurturing` below. */}
                {isLead && (client.leadStatus === "Unresponsive" || client.proposalDecision === "Declined") && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onMarkLost();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] text-red transition-colors hover:bg-red-soft"
                  >
                    <I.x size={15} /> Mark Lost
                  </button>
                )}
                <DeleteClientButton
                  id={client.id}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] text-red transition-colors hover:bg-red-soft disabled:opacity-60"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-4 pr-9">
          <Avatar name={client.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">{client.fullName}</h1>
              {/* Lifecycle type sits inline with the ID as subtle gray text — deliberately
                  NOT a colored pill, so it doesn't compete with the lead stage/status chips. */}
              <span className="font-mono text-[12px] text-subtle">
                #{client.referenceNo ?? client.id.slice(0, 6)} · {client.lifecycleStage}
              </span>
              {/* Identity only — name, record id, and the two read-only chips. Every button lives
                  in the action cluster below, so this row never mixes controls with the chips and
                  never strands one on its own line when it wraps. */}
              {isLead && (
                <>
                  <Pill tone={STAGE_TONE[client.leadStage ?? ""] ?? "slate"}>{client.leadStage}</Pill>
                  <Pill tone={STATUS_TONE[client.leadStatus ?? ""] ?? "slate"} dot>
                    {client.leadStatus}
                  </Pill>
                </>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              {client.email && (
                <span className="inline-flex items-center gap-1.5">
                  <I.mail size={13} /> {client.email}
                </span>
              )}
              {owner && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={owner} size={18} /> {owner} · Owner
                </span>
              )}
            </div>
          </div>
          {/* Every action for this record, in one cluster: the lead-lifecycle ones first, then the
              application CTAs. On narrower widths (tablet) the whole cluster drops to its own
              full-width row instead of crushing the identity column; it sits inline only when
              there's room (xl). */}
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 xl:w-auto">
            {/* No `Email` / `Log Call` buttons here: the nurture chip row directly below already
                surfaces both, and two controls for one action is the duplication this header had
                (../docs/web/contact-profile.md — "One set of buttons, not two"). */}
            {isLead && (
              <>
                <Btn onClick={onAdvance}>
                  <I.trendUp size={15} /> Advance
                </Btn>
                {/* Contextual at `Qualified` only (../docs/web/contact-profile.md): a hold is a
                    deliberate call on a lead who is ready but not now, and it is the sole route
                    into `Nurturing` — the Advance popup can't capture the re-engagement date. */}
                {client.leadStatus === "Qualified" && (
                  <Btn onClick={onNurturing}>
                    <I.clock size={15} /> Mark as Nurturing
                  </Btn>
                )}
              </>
            )}
            {/* Only the sanctioned convert (at Product Selected or later) gets to be the primary
                action; before that it lives in the ⋮ menu behind a skip confirmation. Hidden once
                a draft exists — Convert starts a brand-new wizard with no draftApplicationId, so
                saving it would create a second application row instead of continuing the one
                already open; Continue Application below is the only path in that case. */}
            {isLead && convertReady && draftApplications.length === 0 && (
              <Btn variant="primary" onClick={onConvert}>
                <I.arrowRight size={15} /> Convert to Application
              </Btn>
            )}
            {applications.length > 0 && (
              <Btn onClick={() => overlays.openApplicationRequirements(applications[0].id)}>
                <I.clipboard size={15} /> Requirements
              </Btn>
            )}
            {draftApplications.length > 0 && (
              <Btn
                variant="primary"
                onClick={() => {
                  const draft = draftApplications[0];
                  overlays.openWizard({
                    draftApplicationId: draft.id,
                  });
                }}
              >
                <I.arrowRight size={15} /> Continue Application
              </Btn>
            )}
          </div>
        </div>

        {/* nurture chips */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-soft pt-3.5">
          {NURTURE.map((n) => {
            const Ico = I[n.icon];
            return (
              <button
                key={n.label}
                onClick={n.run}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <Ico size={14} /> {n.label}
              </button>
            );
          })}
        </div>
      </div>
  );
}
