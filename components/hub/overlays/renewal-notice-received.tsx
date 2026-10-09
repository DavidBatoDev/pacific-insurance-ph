"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markRenewalNoticeReceivedAction } from "@/app/(app)/renewals/actions";
import type { Renewal } from "@/lib/repositories/renewals";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

export function RenewalNoticeReceivedModal({ renewal, onClose }: { renewal: Renewal; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(() => renewal.noticeReceivedDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }));
  const [error, setError] = useState<string | null>(null);

  const save = () => startTransition(async () => {
    setError(null);
    const result = await markRenewalNoticeReceivedAction(renewal.id, date);
    if (!result.ok) {
      setError(result.error);
      overlays.toast("Couldn't record notice receipt", result.error);
      return;
    }
    overlays.toast("Notice receipt recorded", `${renewal.policyNumber ?? renewal.policyRef ?? "Policy"} · ${date}`);
    router.refresh();
    onClose();
  });

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand">
          <I.fileText size={20} />
        </div>
        <h3 className="text-[16px] font-bold tracking-[-0.01em]">
          {renewal.noticeReceivedDate ? "Edit receipt date" : "Mark notice received"}
        </h3>
      </div>
      <p className="mb-4 text-[13px] text-muted-foreground">
        {renewal.clientName ?? "Client"} · {renewal.policyNumber ?? renewal.policyRef ?? "Policy"}
      </p>
      <Field label="Notice received date" required>
        <input
          className={INPUT}
          type="date"
          aria-label="Notice received date"
          required
          value={date}
          disabled={pending}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {error && <p role="alert" className="mt-2 text-[13px] text-red">{error}</p>}
      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose} disabled={pending}>Cancel</Btn>
        <Btn variant="primary" disabled={pending || !date} onClick={save}>
          {pending ? "Saving…" : "Save receipt date"}
        </Btn>
      </div>
    </Modal>
  );
}
