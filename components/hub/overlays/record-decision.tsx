"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setProposalStatusAction } from "@/app/(app)/prospects/actions";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { PROPOSAL_DECISIONS, type ProposalDecision } from "../lead-config";
import { Btn } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * `Record decision` — moves `proposal_status` to `Decision` *and* captures which answer
 * came back.
 *
 * It needs its own modal rather than `overlays.confirm()` for the same reason
 * `mark-nurturing.tsx` does: the shared confirm resolves a bare boolean and has nowhere
 * to put a required choice. Without the sub-state, `Decision` recorded only that an
 * answer arrived — "waiting on them" and "they're haggling" looked identical on the
 * board (`../../docs/web/data-model.md:75`).
 */
export function RecordDecisionModal({
  clientId,
  clientName,
  onClose,
  onDone,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<ProposalDecision | "">("");

  const confirm = () =>
    startTransition(async () => {
      if (!decision) return;
      const res = await setProposalStatusAction(clientId, "Decision", decision);
      if (!res.ok) return overlays.toast("Couldn’t record the decision", res.error);
      overlays.toast("Decision recorded", `${clientName} — ${decision}.`);
      onDone?.();
      router.refresh();
      onClose();
    });

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-violet-soft text-violet">
          <I.clipboard size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Record decision</h3>
          <div className="text-[12.5px] text-muted-foreground">
            What came back from {clientName} on this proposal. The stage doesn’t move — advancing to
            Product Selected stays a separate, deliberate step.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {PROPOSAL_DECISIONS.map((option) => {
          const active = decision === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3.5 py-2.5 transition-colors",
                active
                  ? "border-brand bg-brand-soft"
                  : "border-border-strong bg-card hover:bg-hover",
              )}
            >
              <input
                type="radio"
                name="proposal-decision"
                className="mt-0.5 size-3.5 accent-brand"
                checked={active}
                onChange={() => setDecision(option.value)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-[650]">{option.value}</span>
                <span className="block text-[11.5px] text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </div>

      {decision === "Declined" && (
        <p className="mt-3.5 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[11.5px] leading-relaxed text-amber">
          Recording a decline makes <b>Mark Lost</b> available on this lead’s ⋮ menu — the record is
          kept either way, so nothing is deleted.
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={pending || !decision} onClick={confirm}>
          {pending ? "Saving…" : "Save decision"}
        </Btn>
      </div>
    </Modal>
  );
}
