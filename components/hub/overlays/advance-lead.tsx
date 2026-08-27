"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { advanceLeadAction } from "@/app/(app)/prospects/actions";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import {
  STAGE_TONE,
  STATUS_TONE,
  advanceLeadActionDefaults,
  allowedLeadStages,
  allowedLeadStatuses,
  discoveryChecklist,
  formatFollowUpDate,
  formatGaps,
  nextLeadStage,
  type DiscoveryValues,
} from "../lead-config";
import { peso } from "@/lib/format";
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
  /** What specifically triggered this — e.g. "Send brochure: Select Brochure", "Outcome: Reached". */
  detail?: string;
  /** ISO timestamp captured at write time by the same communication-driven callers. */
  occurredAt?: string;
  /** The status as it was immediately before this write — see `LeadAdvanceSuggestion` for why
   * `lead.status` alone isn't reliable for the "before" card. */
  previousStatus?: string | null;
}

/** Identity card — avatar + name/ref + separate Stage and Status badges. Parameterized so the
 * same markup renders both the "before" (current) and "after" (suggested) states without
 * duplicating the badge/avatar JSX. */
function IdentityCard({
  name,
  referenceNo,
  stage,
  status,
}: {
  name: string;
  referenceNo?: string | null;
  stage: string | null;
  status: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-[650]">
          {name}
          {referenceNo && <span className="ml-1.5 font-mono text-[11px] text-subtle">#{referenceNo}</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-[650]", TONE_BADGE[STAGE_TONE[stage ?? ""] ?? "slate"])}>
            {stage ?? "—"}
          </span>
          <span className={cn("rounded-full border px-2 py-px text-[10.5px] font-[650]", TONE_BADGE[STATUS_TONE[status ?? ""] ?? "slate"])}>
            {status ?? "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Small hand-drawn down-arrow connecting the before/after identity cards. `currentColor` +
 * a text-color utility keeps it theme-safe without needing a JS-computed color. */
function TransitionArrow() {
  return (
    <svg width="20" height="28" viewBox="0 0 20 28" fill="none" className="text-border-strong" aria-hidden="true">
      <path d="M10 1 V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 16 L10 23 L16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Hover/click popover on the info icon, revealing what triggered the suggestion. No shared
 * Tooltip/Popover primitive exists in this codebase yet, so this stays self-contained here. */
function TriggerInfoPopover({ detail, occurredAt }: { detail: string; occurredAt?: string }) {
  const [open, setOpen] = useState(false);
  const dateLabel = occurredAt
    ? new Date(occurredAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : null;
  return (
    <div className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-[22px] place-items-center rounded-full border border-border-strong text-subtle hover:bg-hover"
        aria-label="What triggered this suggestion"
      >
        <I.info size={14} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-10 mt-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border-strong bg-card px-2.5 py-2 text-[11.5px] leading-snug shadow-pop">
          <div className="font-[650]">{detail}</div>
          {dateLabel && <div className="mt-0.5 text-faint">Date: {dateLabel}</div>}
        </div>
      )}
    </div>
  );
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
  const actionDefaults = advanceLeadActionDefaults(preset?.label);
  const [note, setNote] = useState(actionDefaults.note);
  const [follow, setFollow] = useState(actionDefaults.followUpDate);
  const [adjusting, setAdjusting] = useState(false);

  // Stage is forward-only: offer the current stage and the next one, never a skip or a
  // backward move. An action-suggested preset stays selectable even if it isn't the
  // immediate next stage, so a triggered suggestion never renders an empty select.
  const stageOptions = useMemo(() => {
    const options = allowedLeadStages(lead.stage);
    if (preset?.stage && !options.includes(preset.stage)) options.push(preset.stage);
    return options;
  }, [lead.stage, preset?.stage]);

  // `Nurturing` is not settable here — it needs a re-engagement date this popup has no field for,
  // so it goes through `Mark as Nurturing` instead (shared rule: `allowedLeadStatuses`). A lead
  // already on hold keeps its own value in the list, otherwise advancing their stage would
  // silently reassign the status out from under them.
  const statusOptions = useMemo(() => {
    const options = allowedLeadStatuses();
    if (lead.status && !options.includes(lead.status)) options.unshift(lead.status);
    return options;
  }, [lead.status]);

  // Moving to Proposal or marking Qualified both claim the lead is quotable, so both have to
  // stand on the four discovery answers. The server enforces this too; showing it here turns
  // a rejection into guidance about exactly what is missing.
  const checklist = discoveryChecklist(lead);
  /** What is on file for a field, formatted — null when nothing is recorded. */
  const recordedValue = (key: keyof DiscoveryValues): string | null => {
    if (key === "estPremium") return lead.estPremium != null ? peso(lead.estPremium) : null;
    const value = lead[key];
    return value == null || value === "" ? null : String(value);
  };
  const gaps = checklist.filter((item) => !item.done);
  const assertsDiscovery =
    (stage === "Proposal" && stage !== lead.stage) || status === "Qualified";
  const blocked = assertsDiscovery && gaps.length > 0;

  const confirm = () => {
    startTransition(async () => {
      const res = await advanceLeadAction({
        clientId: lead.clientId,
        stage,
        status,
        note: note.trim() || undefined,
        nextFollowUpDate: follow || undefined,
      });
      if (res.ok) {
        overlays.toast(
          "Lead advanced",
          `${lead.name} → ${stage} · ${status}${follow ? " · follow-up scheduled" : ""}.`,
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

      <div className="rounded-md border border-border-strong bg-card px-4 py-3.5">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
          Suggested transition
        </div>

        <div className="mt-2.5">
          <IdentityCard
            name={lead.name}
            referenceNo={lead.referenceNo}
            stage={lead.stage}
            status={preset?.previousStatus ?? lead.status}
          />
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1">
          <TransitionArrow />
          {preset?.detail && <TriggerInfoPopover detail={preset.detail} occurredAt={preset.occurredAt} />}
        </div>
        <IdentityCard name={lead.name} referenceNo={lead.referenceNo} stage={stage} status={status} />
      </div>

      {(note || follow) && !adjusting && (
        <div className="mt-3.5 space-y-1 rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5 text-[12px] text-muted-foreground">
          {note && (
            <div>
              <span className="font-semibold text-subtle">Outcome:</span> {note}
            </div>
          )}
          {follow && (
            <div>
              <span className="font-semibold text-subtle">Next follow-up:</span> {formatFollowUpDate(follow)}
            </div>
          )}
        </div>
      )}

      {adjusting && (
        <>
          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
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
                {statusOptions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {lead.status !== "Nurturing" && (
                <div className="mt-1 text-[11px] text-faint">
                  On hold? Use <b>Mark as Nurturing</b> on the profile — it sets the re-engagement date.
                </div>
              )}
            </div>
          </div>

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

          <div className="mt-3.5">
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
        </>
      )}

      {assertsDiscovery && (
        <div
          className={cn(
            "mt-3.5 rounded-md border px-3.5 py-3",
            blocked ? "border-amber-border bg-amber-soft" : "border-green-border bg-green-soft/50",
          )}
        >
          <div className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            Discovery on file
          </div>
          {/* Show what is actually on file, not just a tick — otherwise there is no way to
              tell a wrong value from a missing one without leaving the popup. */}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {checklist.map((item) => (
              <div key={item.key} className="flex items-baseline gap-1.5 text-[12.5px]">
                <I.check
                  size={13}
                  className={cn("shrink-0 translate-y-0.5", item.done ? "text-green" : "text-amber opacity-30")}
                />
                <dt className="text-subtle">{item.label}</dt>
                <dd className={cn("min-w-0 truncate", item.done ? "font-[650]" : "font-[650] text-amber")}>
                  {recordedValue(item.key) ?? "not recorded"}
                </dd>
              </div>
            ))}
          </dl>
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
                  Add missing details
                </Btn>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => setAdjusting(!adjusting)}>
          {adjusting ? "Done adjusting" : "Adjust details"}
        </Btn>
        <Btn variant="primary" disabled={pending || blocked} onClick={confirm}>
          {pending ? "Saving…" : blocked ? "Complete discovery first" : "Accept suggestion"}
        </Btn>
      </div>
    </Modal>
  );
}
