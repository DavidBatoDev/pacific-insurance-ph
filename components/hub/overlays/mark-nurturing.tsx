"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markNurturingAction } from "@/app/(app)/prospects/actions";
import { I } from "../icons";
import { Btn } from "../primitives";
import { DRAWER_INPUT, DrawerField } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * `Mark as Nurturing` — the only way into `lead_status = Nurturing`
 * (`docs/lead-stage-status.md`: "a deliberate hold, not a decay"; `docs/web/contact-profile.md`
 * puts the trigger on the profile header while the lead is `Qualified`).
 *
 * It needs its own modal rather than `overlays.confirm()` because the re-engagement date is
 * **required** — the shared confirm resolves a bare boolean and has nowhere to put one. That date
 * becomes `next_follow_up_date`, which is what the Prospects follow-up queue reads, so it is the
 * difference between parking a lead and losing one.
 */
export function MarkNurturingModal({
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
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const confirm = () =>
    startTransition(async () => {
      const res = await markNurturingAction({
        clientId,
        reEngagementDate: date,
        note: note.trim() || undefined,
      });
      if (!res.ok) return overlays.toast("Couldn’t put the lead on hold", res.error);
      overlays.toast("Lead on hold", `${clientName} is nurturing — re-engage on ${date}.`);
      onDone?.();
      router.refresh();
      onClose();
    });

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-violet-soft text-violet">
          <I.clock size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Mark as nurturing</h3>
          <div className="text-[12.5px] text-muted-foreground">
            A long-term hold for a lead who is interested but not ready. The stage doesn’t move —
            only the status.
          </div>
        </div>
      </div>

      <DrawerField
        label="Re-engagement date"
        required
        hint="Puts the lead back in the follow-up queue on this date. A hold without one just goes quiet."
      >
        <input className={DRAWER_INPUT} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </DrawerField>
      <DrawerField label="Note" className="mt-3.5">
        <textarea
          className="min-h-[100px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why they’re on hold — budget timing, waiting on a spouse, renewal date…"
        />
      </DrawerField>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-faint">
        Logging a call or message with {clientName} while they’re on hold brings them back to
        Qualified automatically — the discovery details already on file are kept.
      </p>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={pending || !date} onClick={confirm}>
          {pending ? "Saving…" : "Mark as nurturing"}
        </Btn>
      </div>
    </Modal>
  );
}
