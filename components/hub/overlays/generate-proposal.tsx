"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  generateProposalAction,
  getProposalLeadDefaultsAction,
  recordProposalReceivedAction,
  type ProposalPortalDetail,
  type UploadedProposal,
} from "@/app/(app)/prospects/actions";
import { PAYMENT_FREQUENCIES } from "@/lib/db-enums";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";
import { openPortalWindow } from "./portal-window";

const DETAIL_GROUPS = ["Header", "Principal", "Dependents", "Generate step"] as const;

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
  onDone?: (proposalStatus: string) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<PickedClient | null>(
    clientId && clientName ? { id: clientId, name: clientName } : null,
  );
  const [frequency, setFrequency] = useState("");
  const [needsSettings, setNeedsSettings] = useState(false);
  const [portal, setPortal] = useState<{ url: string; details: ProposalPortalDetail[] } | null>(null);
  const [uploaded, setUploaded] = useState<UploadedProposal | null>(null);

  // Prefill the frequency from what the lead already has on file.
  const pickedId = picked?.id;
  useEffect(() => {
    if (!pickedId) return;
    let live = true;
    void getProposalLeadDefaultsAction(pickedId).then((res) => {
      // Only fill an empty field: the lookup can land after the user has already chosen.
      if (live && res.ok && res.data.paymentFrequency) setFrequency((current) => current || res.data.paymentFrequency!);
    });
    return () => {
      live = false;
    };
  }, [pickedId]);

  const confirm = () => {
    if (!picked || !frequency) return;
    setNeedsSettings(false);
    // Opened inside the click handler, before any await, so pop-up blockers allow it.
    const win = openPortalWindow();
    startTransition(async () => {
      const res = await generateProposalAction(picked.id, frequency);
      if (!res.ok) {
        win?.close();
        setNeedsSettings(res.error.includes("has not been configured"));
        overlays.toast("Couldn’t generate proposal", res.error);
        return;
      }
      if (win) win.location.href = res.data.portalUrl;
      else overlays.toast("Pop-up blocked", "Allow pop-ups for this site, then use Reopen portal.");
      setPortal({ url: res.data.portalUrl, details: res.data.details });
      onDone?.("Requested");
      router.refresh();
    });
  };

  const missingCount = portal ? portal.details.filter((d) => d.missing).length : 0;

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

          <Field label="Payment frequency" required className="mb-3.5">
            <select
              className={INPUT}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="">Select…</option>
              {PAYMENT_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

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
            <Btn variant="primary" disabled={pending || !picked || !frequency} onClick={confirm}>
              {pending ? "Opening…" : "Generate in Pacific Cross"}
            </Btn>
          </div>
        </>
      )}

      {portal && picked && uploaded && (
        <>
          <ProposalUploadedNotice proposal={uploaded} heading="Proposal attached and marked Received" />
          <div className="mt-5 flex items-center justify-end">
            <Btn variant="primary" onClick={onClose}>
              Done
            </Btn>
          </div>
        </>
      )}

      {portal && picked && !uploaded && (
        <>
          {portal.details.length > 0 && (
            <div className="mb-4 rounded-md border border-border-soft">
              <div className="border-b border-border-soft px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.05em] text-subtle">
                Details to encode
              </div>
              {missingCount > 0 && (
                <div role="alert" className="border-b border-amber-border bg-amber-soft px-3.5 py-2 text-[12.5px] font-semibold text-amber">
                  {missingCount} required portal field{missingCount === 1 ? " is" : "s are"} missing
                </div>
              )}
              {DETAIL_GROUPS.map((group) => {
                const rows = portal.details.filter((d) => d.group === group);
                if (rows.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="border-b border-border-soft bg-surface-2 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-subtle">
                      {group}
                    </div>
                    {rows.map((d) => (
                      <div key={d.label} className="flex items-center gap-3 border-b border-border-soft px-3.5 py-2 text-[12.5px] last:border-0">
                        <span className="w-44 shrink-0 text-muted-foreground">
                          {d.label}
                          {d.required && <span className="text-red"> *</span>}
                        </span>
                        {d.missing ? (
                          <span className="min-w-0 flex-1 font-semibold text-amber">
                            Missing — add to the lead before encoding
                          </span>
                        ) : (
                          <span className={`min-w-0 flex-1 truncate ${d.value ? "font-semibold" : "text-faint"}`}>
                            {d.value || d.hint || "—"}
                          </span>
                        )}
                        {d.value && (
                          <button
                            type="button"
                            onClick={() => copy(d.value)}
                            title={`Copy ${d.label.toLowerCase()}`}
                            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                          >
                            <I.copy size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
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
                  setUploaded(res.data);
                  onDone?.("Received");
                  router.refresh();
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

export function ProposalUploadedNotice({
  proposal,
  heading,
  onDone,
}: {
  proposal: UploadedProposal;
  heading: string;
  onDone?: () => void;
}) {
  return (
    <div role="status" className="rounded-md border border-green-border bg-green-soft px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-card text-green">
          <I.check size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">{heading}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground" title={proposal.name}>
            {proposal.name}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <a
          href={`/api/documents/${proposal.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[30px] items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-faint hover:bg-hover"
        >
          <I.eye size={14} /> Preview
        </a>
        {onDone && (
          <Btn size="sm" variant="primary" onClick={onDone}>
            Done
          </Btn>
        )}
      </div>
    </div>
  );
}
