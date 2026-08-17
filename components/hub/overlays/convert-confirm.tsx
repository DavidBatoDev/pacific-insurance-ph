"use client";

import { I } from "../icons";
import { CONVERT_READY_STAGE, stagesSkippedByConvert } from "../lead-config";
import { Btn } from "../primitives";
import { Modal } from "./modal";

/**
 * Skip-ahead confirmation for `Convert to Application` (docs/lead-stage-status-example.md Step 5:
 * converting is what happens *after* the client picks a plan at `Product Selected`). Reaching the
 * wizard earlier stays possible — a walk-in may genuinely be ready today — but it has to be
 * deliberate, and it has to name what is being jumped over. The server refuses the convert unless
 * this dialog is what opened the wizard.
 */

/** Joins stage labels without lowercasing them — they are proper labels, unlike `formatGaps`. */
function listAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Where the proposal actually stands, in Eman's words rather than the enum's. */
function proposalLine(
  status: string | null | undefined,
  name: string,
  decision?: string | null,
): string {
  switch (status) {
    case "Requested":
      return "A proposal has been requested but hasn’t come back from Pacific Cross yet.";
    case "Received":
      return `The proposal is back but was never sent to ${name}.`;
    case "Sent":
      return `The proposal went to ${name}, but no decision has been logged.`;
    case "Decision":
      // Naming the decision matters most in the decline case — converting someone who
      // turned the proposal down is exactly the mistake this dialog exists to catch.
      switch (decision) {
        case "Declined":
          return `${name} declined this proposal. Converting anyway will start an application they have already turned down.`;
        case "Negotiating":
          return `${name} is still negotiating terms — nothing has been agreed yet.`;
        case "Awaiting Decision":
          return `The proposal is with ${name} and no answer has come back yet.`;
        default:
          return "A decision is logged, but the lead hasn’t been advanced to Product Selected.";
      }
    default:
      return "There is no proposal on file at all.";
  }
}

export function ConvertConfirmModal({
  lead,
  onClose,
  onConfirm,
}: {
  lead: { name: string; stage: string | null; proposalStatus: string | null; proposalDecision?: string | null };
  onClose: () => void;
  /** Open the wizard with the skip already authorised. */
  onConfirm: () => void;
}) {
  const skipped = stagesSkippedByConvert(lead.stage);

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-amber-soft text-amber">
          <I.alertTri size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Convert before {CONVERT_READY_STAGE}?</h3>
        </div>
      </div>

      <div className="rounded-md border border-amber-border bg-amber-soft px-3.5 py-3">
        <p className="text-[13px] leading-relaxed">
          {lead.name} is at <span className="font-[650]">{lead.stage ?? "—"}</span>. Converting now
          skips{" "}
          <span className="font-[650]">{skipped.length ? listAnd(skipped) : "the remaining stages"}</span>.
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber">
          {proposalLine(lead.proposalStatus, lead.name, lead.proposalDecision)}
        </p>
      </div>

      <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        The record flips to <span className="font-[650]">Applicant</span> once the wizard creates the
        application, and the lead leaves the pipeline board. Saving a draft along the way changes
        nothing. Do this only if {lead.name} has already chosen a plan.
      </p>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          className="border-transparent bg-amber text-white hover:bg-amber/90"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          Convert anyway
        </Btn>
      </div>
    </Modal>
  );
}
