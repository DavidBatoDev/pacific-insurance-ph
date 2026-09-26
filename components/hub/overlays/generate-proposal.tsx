"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  generateProposalAction,
  recordProposalReceivedAction,
  type ProposalPortalDetail,
} from "@/app/(app)/prospects/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { I } from "../icons";
import { Btn, Field } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";
import { openPortalWindow } from "./portal-window";

/**
 * Individual proposal handoff: the Pacific Cross portal opens in a pop-up (it can't
 * be embedded — its session cookies are SameSite=Lax), and the modal stays open so
 * the generated PDF can be uploaded straight back.
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
  const [portal, setPortal] = useState<{ url: string; details: ProposalPortalDetail[] } | null>(null);

  const confirm = () => {
    if (!picked) return;
    setNeedsSettings(false);
    // Opened inside the click handler, before any await, so pop-up blockers allow it.
    const win = openPortalWindow();
    startTransition(async () => {
      const res = await generateProposalAction(picked.id);
      if (!res.ok) {
        win?.close();
        setNeedsSettings(res.error.includes("has not been configured"));
        overlays.toast("Couldn’t generate proposal", res.error);
        return;
      }
      if (win) win.location.href = res.data.portalUrl;
      else overlays.toast("Pop-up blocked", "Allow pop-ups for this site, then use Reopen portal.");
      setPortal({ url: res.data.portalUrl, details: res.data.details });
      router.refresh();
    });
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => overlays.toast("Copied", value));
  };

  return (
    <Modal onClose={onClose} maxWidth={portal ? 560 : 460}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.fileText size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Generate proposal</h3>
          <div className="text-[12.5px] text-muted-foreground">
            {portal && picked ? picked.name : "For Select and Blue Royale."}
          </div>
        </div>
      </div>

      {!portal && (
        <>
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
        </>
      )}

      {portal && picked && (
        <>
          {portal.details.length > 0 && (
            <div className="mb-4 rounded-md border border-border-soft">
              <div className="border-b border-border-soft px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.05em] text-subtle">
                Details to encode
              </div>
              {portal.details.map((d) => (
                <div key={`${d.label}-${d.value}`} className="flex items-center gap-3 border-b border-border-soft px-3.5 py-2 text-[12.5px] last:border-0">
                  <span className="w-36 shrink-0 text-muted-foreground">{d.label}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{d.value}</span>
                  <button
                    type="button"
                    onClick={() => copy(d.value)}
                    title={`Copy ${d.label.toLowerCase()}`}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                  >
                    <I.copy size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Field label="Generated proposal" className="mb-1">
            <PdfUpload
              clientId={picked.id}
              prompt="Upload the proposal PDF from the portal…"
              onUploaded={async (path, fileName) => {
                const res = await recordProposalReceivedAction(picked.id, path, fileName);
                if (res.ok) {
                  overlays.toast("Proposal received", `${picked.name} — PDF attached and marked Received.`);
                  onDone?.();
                  router.refresh();
                  onClose();
                }
                return res;
              }}
            />
          </Field>

          <div className="mt-5 flex items-center justify-between gap-2.5">
            <Btn onClick={() => openPortalWindow(portal.url)}>
              <I.arrowUpRight size={14} /> Reopen portal
            </Btn>
            <Btn onClick={onClose}>Upload later</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
