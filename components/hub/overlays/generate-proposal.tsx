"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { generateProposalAction } from "@/app/(app)/prospects/actions";
import { I } from "../icons";
import { Btn, Field } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * Portal-only individual proposal handoff. The Pacific Cross portal remains
 * the calculator and document generator until C2b's approved in-app flow.
 */
export function GenerateProposalModal({
  clientId,
  clientName,
  onClose,
  onDone,
}: {
  clientId?: string;
  clientName?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<PickedClient | null>(
    clientId && clientName ? { id: clientId, name: clientName } : null,
  );
  const [needsSettings, setNeedsSettings] = useState(false);

  const confirm = () => {
    if (!picked) return;
    setNeedsSettings(false);
    startTransition(async () => {
      const res = await generateProposalAction(picked.id);
      if (!res.ok) {
        const missingPortal = res.error.includes("has not been configured");
        setNeedsSettings(missingPortal);
        overlays.toast("Couldn’t generate proposal", res.error);
        return;
      }

      // This is intentionally a browser handoff: C2a does not calculate or
      // produce a PDF in-app. Staff mark the proposal Received only after the
      // carrier portal has actually produced it.
      window.open(res.data.portalUrl, "_blank", "noopener,noreferrer");
      overlays.toast("Pacific Cross opened", `${picked.name} — mark the proposal Received after the illustration is available.`);
      onDone?.();
      router.refresh();
      onClose();
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.fileText size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Generate proposal</h3>
          <div className="text-[12.5px] text-muted-foreground">
            For Select and Blue Royale. This opens Pacific Cross&apos;s generator; status stays unchanged until you mark the finished proposal Received.
          </div>
        </div>
      </div>

      {!(clientId && clientName) && (
        <Field label="Lead / client" required className="mb-3.5">
          <ClientPicker
            value={picked}
            onPick={setPicked}
            onClear={() => setPicked(null)}
            placeholder="Search the Select or Blue Royale lead…"
          />
        </Field>
      )}

      <div className="rounded-md border border-border-soft bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
        The proposal calculator and PDF remain in the Pacific Cross portal for this release. HMO proposals continue through Request Proposal.
      </div>
      {needsSettings && (
        <div className="mt-3 rounded-md border border-amber-border bg-amber-soft px-3.5 py-3 text-[12.5px] text-amber">
          The portal link is not configured. <Link className="font-bold underline" href="/settings">Open Settings → Integrations</Link> to add it.
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2.5">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={pending || !picked} onClick={confirm}>
          {pending ? "Opening…" : "Generate in Pacific Cross"}
        </Btn>
      </div>
    </Modal>
  );
}
