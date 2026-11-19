"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  generateProposalAction,
  getProposalLeadDefaultsAction,
  recordProposalReceivedAction,
  type ProposalPortalDetail,
  type ProposalResultDetails,
  type UploadedProposal,
} from "@/app/(app)/prospects/actions";
import type { ActionResult } from "@/lib/actions/context";
import { PAYMENT_FREQUENCIES } from "@/lib/db-enums";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { cn } from "@/lib/utils";
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
  // The portal pop-up, watched so the modal can prompt for the PDF once Eman closes it.
  // Reading `closed` works cross-origin; the portal sends no Cross-Origin-Opener-Policy.
  const portalWindow = useRef<Window | null>(null);
  const [portalClosed, setPortalClosed] = useState(false);
  const [watching, setWatching] = useState(0);
  useEffect(() => {
    if (!watching) return;
    const timer = setInterval(() => {
      if (portalWindow.current?.closed) {
        clearInterval(timer);
        setPortalClosed(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [watching]);
  const watchPortal = (win: Window | null) => {
    portalWindow.current = win;
    setPortalClosed(false);
    if (win) setWatching((current) => current + 1);
  };

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
      if (win) {
        win.location.href = res.data.portalUrl;
        watchPortal(win);
      }
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
                            {d.hint ?? "Missing: add it to the lead before encoding"}
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

          {portalClosed && (
            <div role="status" className="mb-3 rounded-md border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-[12.5px]">
              Portal closed. Got the proposal PDF? Drop it below to mark the proposal Received.
            </div>
          )}
          <ProposalReceiptUpload
            clientId={picked.id}
            defaultFrequency={frequency}
            prompt="Upload the proposal PDF from the portal…"
            onUploaded={(proposal) => {
              overlays.toast("Proposal received", `${picked.name}: PDF attached and marked Received.`);
              setUploaded(proposal);
              onDone?.("Received");
              router.refresh();
            }}
          />

          <div className="mt-5 flex items-center justify-between gap-2.5">
            <Btn onClick={() => watchPortal(openPortalWindow(portal.url))}>
              <I.arrowUpRight size={14} /> Reopen portal
            </Btn>
            <Btn onClick={onClose}>Upload later</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

/**
 * Upload the carrier's proposal PDF and mark it Received, with the quote read off the portal's
 * Generate step (all optional): quotation number, payment mode and grand total.
 */
export function ProposalReceiptUpload({
  clientId,
  defaultFrequency,
  prompt,
  onUploaded,
}: {
  clientId: string;
  defaultFrequency?: string | null;
  prompt: string;
  onUploaded: (proposal: UploadedProposal) => void;
}) {
  const [quotationNo, setQuotationNo] = useState("");
  const [mode, setMode] = useState(defaultFrequency ?? "");
  const [total, setTotal] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const fieldId = useId();
  const upload = async (path: string, fileName: string): Promise<ActionResult<unknown>> => {
    const amount = total.trim() ? Number(total.replace(/,/g, "")) : null;
    const result: ProposalResultDetails = { quotationNo, paymentFrequency: mode || undefined, grandTotal: amount != null && Number.isFinite(amount) ? amount : null };
    const res = await recordProposalReceivedAction(clientId, path, fileName, result);
    if (res.ok) onUploaded(res.data);
    return res;
  };
  // Payment mode and the optional quote sit above the drop zone because a dropped file uploads at once.
  return (
    <div className="@container">
      <div className={cn("mb-2.5 grid gap-2.5", quoteOpen && "@sm:grid-cols-3")}>
        <Field label="Payment mode" htmlFor={`${fieldId}-mode`}>
          <select id={`${fieldId}-mode`} className={INPUT} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Not set</option>
            {PAYMENT_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        {quoteOpen && (
          <>
            <Field label="Quotation no." htmlFor={`${fieldId}-quote`}>
              <input id={`${fieldId}-quote`} className={INPUT} value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} placeholder="A0201403-…" maxLength={64} />
            </Field>
            <Field label="Grand total (PHP)" htmlFor={`${fieldId}-total`}>
              <input id={`${fieldId}-total`} className={INPUT} inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="8,613.00" />
            </Field>
          </>
        )}
      </div>
      <button type="button" aria-expanded={quoteOpen} onClick={() => setQuoteOpen((open) => !open)} className="mb-2.5 text-[12px] font-semibold text-brand-hover underline-offset-2 hover:underline">
        {quoteOpen ? "Hide quote details" : "Add quote details"}
      </button>
      <PdfUpload clientId={clientId} prompt={prompt} onUploaded={upload} />
    </div>
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
