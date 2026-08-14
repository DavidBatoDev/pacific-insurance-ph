"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markLostAction } from "@/app/(app)/prospects/actions";
import { I } from "../icons";
import { Btn } from "../primitives";
import { DrawerField } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * Mark Lost — the only way into `lifecycle_stage = Lost`. Moved out of the
 * Advance-Lead popup: advancing and losing a lead are opposite workflows and
 * shouldn't share a confirm. Lives behind the ⋮ menu on Contact Profile,
 * immediately before Delete.
 */
export function MarkLostModal({
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
  const [note, setNote] = useState("");

  const confirm = () =>
    startTransition(async () => {
      const res = await markLostAction({ clientId, note: note.trim() || undefined });
      if (!res.ok) return overlays.toast("Couldn’t mark lead lost", res.error);
      overlays.toast("Lead marked lost", `${clientName} moved to Lost — kept on the record for re-nurture.`);
      onDone?.();
      router.refresh();
      onClose();
    });

  return (
    <Modal onClose={onClose} maxWidth={440}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-red-soft text-red">
          <I.x size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Mark lost</h3>
          <div className="text-[12.5px] text-muted-foreground">
            Archives {clientName} from active queues. History is kept for re-nurture — this isn’t a delete.
          </div>
        </div>
      </div>

      <DrawerField label="Note" hint="Optional — why this lead didn’t convert.">
        <textarea
          className="min-h-[100px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened? Logged to the timeline…"
        />
      </DrawerField>

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={pending}
          onClick={confirm}
          className="border-transparent bg-red text-white hover:bg-red/90"
        >
          {pending ? "Saving…" : "Mark Lost"}
        </Btn>
      </div>
    </Modal>
  );
}
