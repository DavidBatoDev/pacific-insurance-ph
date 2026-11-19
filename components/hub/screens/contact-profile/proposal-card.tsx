"use client";

import Image from "next/image";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  replaceProposalPdfAction,
  setProposalStatusAction,
  type UploadedProposal,
} from "@/app/(app)/prospects/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { isIndividualProposalProduct, isProposalAccepted, proposalStatusLine } from "../../lead-config";
import { ProposalReceiptUpload, ProposalUploadedNotice } from "../../overlays/generate-proposal";
import { useOverlays } from "../../overlays/overlay-provider";
import { openPortalWindow } from "../../overlays/portal-window";
import { Btn, Card, CardHead, TONE_TEXT } from "../../primitives";
import type { Tone } from "../../tone";
import type { Doc } from "./records-cards";

/**
 * Lead-only proposal tracking card. Actions follow `proposal_status`, not `lead_stage`: Generate
 * Proposal is offered at every stage (header menu), so a Requested/Received proposal on a
 * Product Selected lead must still be trackable here.
 */
export function ProposalCard({
  client,
  pacificCrossPortalUrl,
  proposalDocument,
  onGenerate,
  onRequest,
  onEmailProposal,
  onRecordDecision,
  onStatusChange,
}: {
  client: Client;
  pacificCrossPortalUrl: string | null;
  /** Most recent uploaded illustrative proposal, if any. */
  proposalDocument: Doc | null;
  onGenerate: () => void;
  onRequest: () => void;
  /** Open the proposal-delivery email with the current proposal attached, for review + Send. */
  onEmailProposal: () => void;
  onRecordDecision: () => void;
  onStatusChange: (proposalStatus: string) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [proposalMarking, setProposalMarking] = useState<string | null>(null);
  const [status, setOptimisticStatus] = useOptimistic(client.proposalStatus);
  const [replacing, setReplacing] = useState(false);
  const [uploaded, setUploaded] = useState<{
    proposal: UploadedProposal;
    heading: string;
    base: Doc | null;
    confirming: boolean;
  } | null>(null);
  // Our upload stands in for the stale `proposalDocument` prop until the refresh swaps it.
  const shownDocument = uploaded && uploaded.base === proposalDocument ? uploaded.proposal : proposalDocument;

  const markProposal = (next: string) => {
    setProposalMarking(next);
    startTransition(async () => {
      setOptimisticStatus(next);
      const res = await setProposalStatusAction(client.id, next);
      if (res.ok) {
        onStatusChange(next);
        overlays.toast(`Proposal ${next.toLowerCase()}`, `${client.fullName} — proposal marked ${next}.`);
      } else overlays.toast("Couldn’t update proposal", res.error);
      router.refresh();
    });
  };

  const showUploaded = (proposal: UploadedProposal, heading: string) =>
    setUploaded({ proposal, heading, base: proposalDocument, confirming: true });

  const STEPS = ["Requested", "Received", "Sent", "Decision"];
  // Advancing past Proposal is the acceptance, so the tracker completes and stops asking for a decision.
  const accepted = isProposalAccepted(status, client.proposalDecision, client.leadStage);
  const stepIndex = accepted ? STEPS.length : STEPS.indexOf(status ?? "");
  const individual = isIndividualProposalProduct(client.productInterest);
  const stepBar = (
    <div className="flex items-center gap-1.5" aria-label={`Proposal ${accepted ? "accepted" : status ?? "not started"}`}>
      {STEPS.map((s, i) => (
        <span key={s} title={s} className={cn("h-1.5 flex-1 rounded-full", stepIndex >= 0 && i < stepIndex ? "bg-brand" : stepIndex === i ? "bg-violet" : "bg-surface-3")} />
      ))}
    </div>
  );
  const statusText = status
    ? proposalStatusLine(status, status === "Decision" ? client.proposalDecision : null, client.productInterest, accepted)
    : `No proposal ${individual ? "generated" : "requested"} yet.`;
  // The shared line reads "<state> — <product> quote."; the card shows the state in its tone, then the quote.
  const [statusHead, statusDetail] = (() => {
    const [head, ...rest] = statusText.split(" — ");
    return [head.replace(/\.$/, ""), rest.length ? rest.join(" — ").replace(/\.$/, "") : null] as const;
  })();
  const statusTone: Tone = !status ? "slate"
    : client.proposalDecision === "Declined" && status === "Decision" ? "red"
      : accepted ? "green" : status === "Received" ? "blue" : "violet";
  const portalSettingsLink = !pacificCrossPortalUrl && individual ? (
    <Link href="/settings" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-border bg-amber-soft px-3 text-[12.5px] font-semibold text-amber transition-colors hover:bg-hover">
      <I.settings size={14} /> Configure portal in Settings
    </Link>
  ) : null;
  const markSent = () => markProposal("Sent");
  const markingSent = pending && proposalMarking === "Sent";
  const recipient = client.email;
  const otherActions = [
    client.leadStage === "Proposal" && !status && (
      <Btn key="start" size="sm" onClick={() => (individual ? onGenerate() : onRequest())}>{individual ? "Generate proposal" : "Request proposal"}</Btn>
    ),
    status === "Requested" && (
      <Btn key="received" size="sm" disabled={pending} onClick={() => markProposal("Received")}>
        {pending && proposalMarking === "Received" ? "Marking received…" : "Mark Received without PDF"}
      </Btn>
    ),
    !accepted && status === "Sent" && <Btn key="decide" size="sm" onClick={onRecordDecision}>Record decision</Btn>,
    !accepted && status === "Decision" && <Btn key="update" size="sm" onClick={onRecordDecision}>Update decision</Btn>,
  ].filter(Boolean);
  const receiptUpload = (!status || status === "Requested") && !uploaded?.confirming ? (
    <ProposalReceiptUpload
      clientId={client.id}
      defaultFrequency={client.paymentFrequency}
      prompt="Upload proposal"
      onUploaded={(proposal) => {
        showUploaded(proposal, "Proposal attached and marked Received");
        onStatusChange("Received");
        overlays.toast("Proposal received", `${client.fullName}: PDF attached and marked Received.`);
        router.refresh();
      }}
    />
  ) : null;
  const uploadedNotice = uploaded?.confirming ? (
    <ProposalUploadedNotice proposal={uploaded.proposal} heading={uploaded.heading} onDone={() => setUploaded({ ...uploaded, confirming: false })} />
  ) : null;
  const hasFiledProposal = !uploaded?.confirming && !!shownDocument && !!status && status !== "Requested";
  const documentRow = hasFiledProposal && shownDocument ? (
    <div className="flex items-stretch overflow-hidden rounded-md border border-border-soft">
      <a href={`/api/documents/${shownDocument.id}/download`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-[12.5px] font-semibold text-brand-hover transition-colors hover:bg-hover">
        <I.fileText size={15} className="shrink-0" />
        <span className="truncate">{shownDocument.name}</span>
      </a>
      {!replacing && (
        <button type="button" onClick={() => setReplacing(true)} className="shrink-0 border-l border-border-soft px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground">
          Replace
        </button>
      )}
    </div>
  ) : null;
  const replaceUpload = replacing && hasFiledProposal ? (
    <div>
      <PdfUpload
        clientId={client.id}
        prompt="Upload the corrected PDF; the current one is kept as Replaced"
        onUploaded={async (path, fileName) => {
          const res = await replaceProposalPdfAction(client.id, path, fileName);
          if (res.ok) {
            setReplacing(false);
            showUploaded(res.data, "Proposal PDF replaced");
            overlays.toast("Proposal PDF replaced", `${client.fullName}: the previous PDF is kept as Replaced.`);
            router.refresh();
          }
          return res;
        }}
      />
      <div className="mt-1.5 flex justify-end">
        <Btn size="sm" variant="ghost" onClick={() => setReplacing(false)}>Cancel</Btn>
      </div>
    </div>
  ) : null;
  // The quote recorded at upload ("Quotation X · Annual · Grand total PHP Y") and the lead stage,
  // shown as label / value rows under the PDF.
  const stageValue = client.leadStage !== "Proposal" && status ? client.leadStage ?? "New Lead" : null;
  const noteParts = hasFiledProposal && shownDocument === proposalDocument && proposalDocument?.notes ? proposalDocument.notes.split(" · ") : [];
  const details = [
    { label: "Payment", value: noteParts.find((p) => p === "Annual" || p === "Semi-annual") },
    { label: "Grand total", value: noteParts.find((p) => p.startsWith("Grand total "))?.replace("Grand total ", "") },
    { label: "Quotation", value: noteParts.find((p) => p.startsWith("Quotation "))?.replace("Quotation ", "") },
    { label: "Lead stage", value: stageValue ?? undefined },
  ].filter((d): d is { label: string; value: string } => !!d.value);

  return (
    <Card>
      <CardHead iconName="fileText" title="Proposal tracking" />
      <div className="flex flex-col gap-3 px-[18px] py-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 self-center text-[14.5px] font-semibold leading-snug text-foreground">
            <span className={TONE_TEXT[statusTone]}>{statusHead}</span>
            {statusDetail && <span className="font-medium text-muted-foreground"> · {statusDetail}</span>}
          </p>
          {pacificCrossPortalUrl && (
            <button type="button" onClick={() => openPortalWindow(pacificCrossPortalUrl)} title="Open Pacific Cross portal" aria-label="Open Pacific Cross portal"
              className="relative grid size-16 shrink-0 place-items-center content-center gap-1 rounded-md border border-border-strong bg-card text-[11px] font-semibold text-muted-foreground shadow-xs transition-colors hover:border-faint hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
              <Image src="/pacific-cross-logo.png" alt="" width={30} height={30} className="size-[30px] rounded-[5px]" />
              Portal
              <I.arrowUpRight size={11} className="absolute right-1 top-1 text-subtle" />
            </button>
          )}
        </div>
        {stepBar}
        {portalSettingsLink}
        {status === "Received" && !accepted && (
          <div className="rounded-md border border-border-soft bg-surface-2 p-3">
            <p className="truncate text-[11.5px] text-muted-foreground" title={recipient ?? undefined}>
              Send to <span className="font-medium text-foreground">{recipient ?? "no email on file"}</span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Btn size="sm" variant="primary" onClick={onEmailProposal}>Email</Btn>
              <Btn size="sm" disabled={pending} onClick={markSent} title="Record a proposal you sent outside the CRM. This is not Gmail evidence.">
                {markingSent ? "Marking…" : "Mark sent"}
              </Btn>
            </div>
          </div>
        )}
        {otherActions.length > 0 && <div className="flex flex-wrap gap-2">{otherActions}</div>}
        {receiptUpload}
        {uploadedNotice}
        {documentRow}
        {replaceUpload}
        {details.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
            {details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="text-right font-semibold tabular-nums text-foreground">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Card>
  );
}
