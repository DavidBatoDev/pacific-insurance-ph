"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { advanceLeadAction } from "@/app/(app)/prospects/actions";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import {
  LEAD_STATUSES,
  STAGE_TONE,
  STATUS_TONE,
  allowedLeadStages,
  discoveryChecklist,
  formatGaps,
  nextLeadStage,
  type DiscoveryValues,
} from "../lead-config";
import { Avatar, Btn, TONE_BADGE } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * Advance Lead popup (modals.md §9) — the single confirmation for EVERY lead
 * stage/status change: Kanban drag, list-row Advance, nurture-action chaining.
 * Nothing moves silently; confirming runs the one transition server action.
 */

export interface AdvanceLeadTarget extends DiscoveryValues {
  clientId: string;
  name: string;
  referenceNo: string | null;
  stage: string | null;
  status: string | null;
}

export interface AdvanceLeadPreset {
  stage?: string;
  status?: string;
  /** Human label of what triggered this (e.g. "Dragged to Discovery"). */
  label?: string;
}

export function AdvanceLeadModal({
  lead,
  preset,
  onClose,
  onDone,
  onCompleteDiscovery,
}: {
  lead: AdvanceLeadTarget;
  preset?: AdvanceLeadPreset;
  onClose: () => void;
  onDone?: () => void;
  /** Send the user to where discovery details are captured (the Log Call composer). */
  onCompleteDiscovery?: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  // Open on the move this popup is named after: an action-supplied stage wins, otherwise
  // suggest the next stage. At the final stage there is nothing to advance to, so hold.
  const initialStage = preset?.stage ?? nextLeadStage(lead.stage) ?? lead.stage ?? "New Lead";
  const [stage, setStage] = useState(initialStage);
  // Reaching Proposal *is* the discovery-complete moment, so the status it implies is
  // pre-selected — one confirm now does what a separate button used to.
  const [status, setStatus] = useState(
    preset?.status ??
      (initialStage === "Proposal" && initialStage !== lead.stage ? "Qualified" : lead.status ?? "New"),
  );
  const [note, setNote] = useState("");
  const [follow, setFollow] = useState("");
  const [markLost, setMarkLost] = useState(false);

  // Stage is forward-only: offer the current stage and the next one, never a skip or a
  // backward move. An action-suggested preset stays selectable even if it isn't the
  // immediate next stage, so a triggered suggestion never renders an empty select.
  const stageOptions = useMemo(() => {
    const options = allowedLeadStages(lead.stage);
    if (preset?.stage && !options.includes(preset.stage)) options.push(preset.stage);
    return options;
  }, [lead.stage, preset?.stage]);

  // Moving to Proposal or marking Qualified both claim the lead is quotable, so both have to
  // stand on the four discovery answers. The server enforces this too; showing it here turns
  // a rejection into guidance about exactly what is missing.
  const checklist = discoveryChecklist(lead);
  const gaps = checklist.filter((item) => !item.done);
  const assertsDiscovery =
    (stage === "Proposal" && stage !== lead.stage) || status === "Qualified";
  const blocked = !markLost && assertsDiscovery && gaps.length > 0;

  const confirm = () => {
    startTransition(async () => {
      const res = await advanceLeadAction({
        clientId: lead.clientId,
        stage,
        status,
        note: note.trim() || undefined,
        nextFollowUpDate: follow || undefined,
        markLost,
      });
      if (res.ok) {
        overlays.toast(
          markLost ? "Lead marked lost" : "Lead advanced",
          markLost
            ? `${lead.name} moved to Lost — kept on the record for re-nurture.`
            : `${lead.name} → ${stage} · ${status}${follow ? " · follow-up scheduled" : ""}.`,
        );
        router.refresh();
        onDone?.();
        onClose();
      } else {
        overlays.toast("Couldn’t advance lead", res.error);
      }
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.trendUp size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Advance lead</h3>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2.5 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
        <Avatar name={lead.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-[650]">
            {lead.name}
            {lead.referenceNo && (
              <span className="ml-1.5 font-mono text-[11px] text-subtle">#{lead.referenceNo}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-[650]", TONE_BADGE[STAGE_TONE[lead.stage ?? ""] ?? "slate"])}>
              {lead.stage ?? "—"}
            </span>
            <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-[650]", TONE_BADGE[STATUS_TONE[lead.status ?? ""] ?? "slate"])}>
              {lead.status ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className={cn("grid grid-cols-2 gap-3.5", markLost && "pointer-events-none opacity-40")}>
        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            Stage
          </label>
          <select
            className="h-9 w-full rounded-md border border-border-strong bg-card px-2.5 text-[13.5px] outline-none focus:border-brand"
            value={stage}
            onChange={(e) => {
              const value = e.target.value;
              setStage(value);
              // Keep the implied status visible rather than overriding it silently at confirm.
              if (value === "Proposal" && value !== lead.stage) setStatus("Qualified");
            }}
          >
            {stageOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            Status
          </label>
          <select
            className="h-9 w-full rounded-md border border-border-strong bg-card px-2.5 text-[13.5px] outline-none focus:border-brand"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {!markLost && assertsDiscovery && (
        <div
          className={cn(
            "mt-3.5 rounded-md border px-3.5 py-3",
            blocked ? "border-amber-border bg-amber-soft" : "border-green-border bg-green-soft/50",
          )}
        >
          <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            Discovery on file
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {checklist.map((item) => (
              <span
                key={item.label}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[12.5px]",
                  item.done ? "text-green" : "font-[650] text-amber",
                )}
              >
                <I.check size={13} className={item.done ? "" : "opacity-30"} />
                {item.label}
              </span>
            ))}
          </div>
          {blocked && (
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[12px] leading-snug text-amber">
                A quote needs {formatGaps(gaps.map((gap) => gap.label))}. Log a reached call to add
                {gaps.length === 1 ? " it" : " them"}.
              </span>
              {onCompleteDiscovery && (
                <Btn
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    onClose();
                    onCompleteDiscovery();
                  }}
                >
                  Complete discovery
                </Btn>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3.5">
        <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
          Outcome note
        </label>
        <textarea
          className="min-h-[70px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          placeholder="What happened? Logged to the timeline…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className={cn("mt-3.5", markLost && "pointer-events-none opacity-40")}>
        <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
          Next follow-up
        </label>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none focus:border-brand"
          value={follow}
          onChange={(e) => setFollow(e.target.value)}
        />
      </div>

      <button
        onClick={() => setMarkLost(!markLost)}
        className={cn(
          "mt-4 flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
          markLost
            ? "border-red bg-red-soft text-red"
            : "border-border-strong text-muted-foreground hover:bg-hover",
        )}
      >
        <span
          className={cn(
            "grid size-[18px] place-items-center rounded-md border-[1.6px]",
            markLost ? "border-red bg-red text-white" : "border-border-strong text-transparent",
          )}
        >
          {markLost && <I.check size={13} />}
        </span>
        Mark Lost — archives from queues, keeps history for re-nurture
      </button>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={pending || blocked}
          onClick={confirm}
          className={markLost ? "border-transparent bg-red text-white hover:bg-red/90" : undefined}
        >
          {pending ? "Saving…" : markLost ? "Mark Lost" : "Confirm advance"}
        </Btn>
      </div>
    </Modal>
  );
}
