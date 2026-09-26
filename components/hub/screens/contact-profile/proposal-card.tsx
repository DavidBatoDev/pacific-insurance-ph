"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { recordProposalReceivedAction, setProposalStatusAction } from "@/app/(app)/prospects/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import type { Client } from "@/lib/repositories/clients/client.entity";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { isIndividualProposalProduct, proposalStatusLine } from "../../lead-config";
import { useOverlays } from "../../overlays/overlay-provider";
import { openPortalWindow } from "../../overlays/portal-window";
import { Btn, Card, CardHead } from "../../primitives";
import type { Doc } from "./records-cards";

/** Lead-only proposal tracking card (stage-gated actions per proposal status). */
export function ProposalCard({
  client,
  pacificCrossPortalUrl,
  proposalDocument,
  onGenerate,
  onRequest,
  onLogEmail,
  onRecordDecision,
}: {
  client: Client;
  pacificCrossPortalUrl: string | null;
  /** Most recent uploaded illustrative proposal, if any. */
  proposalDocument: Doc | null;
  onGenerate: () => void;
  onRequest: () => void;
  /** Focus the composer preset to the proposal-delivery template. */
  onLogEmail: () => void;
  onRecordDecision: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [proposalMarking, setProposalMarking] = useState<string | null>(null);

  const markProposal = (status: string) => {
    setProposalMarking(status);
    startTransition(async () => {
      const res = await setProposalStatusAction(client.id, status);
      if (res.ok) overlays.toast(`Proposal ${status.toLowerCase()}`, `${client.fullName} — proposal marked ${status}.`);
      else overlays.toast("Couldn’t update proposal", res.error);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHead iconName="fileText" title="Proposal tracking" />
              <div className="px-[18px] py-3.5">
                <div className="mb-3 flex items-center gap-1.5">
                  {["Requested", "Received", "Sent", "Decision"].map((s, i) => {
                    const idx = ["Requested", "Received", "Sent", "Decision"].indexOf(client.proposalStatus ?? "");
                    return (
                      <span
                        key={s}
                        title={s}
                        className={cn("h-1.5 flex-1 rounded-full", idx >= 0 && i < idx ? "bg-brand" : idx === i ? "bg-violet" : "bg-surface-3")}
                      />
                    );
                  })}
                </div>
                <div className="mb-3 text-[12.5px] text-muted-foreground">
                  {client.proposalStatus
                    ? proposalStatusLine(client.proposalStatus, client.proposalDecision, client.productInterest)
                    : `No proposal ${isIndividualProposalProduct(client.productInterest) ? "generated" : "requested"} yet.`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pacificCrossPortalUrl && (
                    <button
                      type="button"
                      onClick={() => openPortalWindow(pacificCrossPortalUrl)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      <I.arrowUpRight size={14} /> Open Pacific Cross portal
                    </button>
                  )}
                  {!pacificCrossPortalUrl && isIndividualProposalProduct(client.productInterest) && (
                    <Link
                      href="/settings"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-amber-border bg-amber-soft px-3 text-[12.5px] font-semibold text-amber transition-colors hover:bg-hover"
                    >
                      <I.settings size={14} /> Configure portal in Settings
                    </Link>
                  )}
                  {client.leadStage === "Proposal" && !client.proposalStatus && (
                    <Btn size="sm" onClick={() => (isIndividualProposalProduct(client.productInterest) ? onGenerate() : onRequest())}>
                      {isIndividualProposalProduct(client.productInterest) ? "Generate proposal" : "Request proposal"}
                    </Btn>
                  )}
                  {client.leadStage === "Proposal" && client.proposalStatus === "Requested" && (
                    <Btn size="sm" disabled={pending} onClick={() => markProposal("Received")}>
                      {pending && proposalMarking === "Received" ? "Marking received…" : "Mark Received without PDF"}
                    </Btn>
                  )}
                  {client.leadStage === "Proposal" && client.proposalStatus === "Received" && (
                    <>
                      <Btn size="sm" variant="primary" onClick={onLogEmail}>
                        Log Proposal Email
                      </Btn>
                      <Btn size="sm" disabled={pending} onClick={() => markProposal("Sent")}>
                        {pending && proposalMarking === "Sent" ? "Marking sent…" : "Mark Sent"}
                      </Btn>
                    </>
                  )}
                  {client.leadStage === "Proposal" && client.proposalStatus === "Sent" && (
                    <Btn size="sm" onClick={onRecordDecision}>
                      Record decision
                    </Btn>
                  )}
                  {/* Already decided, but still negotiable — let staff correct or move it on. */}
                  {client.leadStage === "Proposal" && client.proposalStatus === "Decision" && (
                    <Btn size="sm" onClick={onRecordDecision}>
                      Update decision
                    </Btn>
                  )}
                </div>
                {client.leadStage === "Proposal" && client.proposalStatus === "Requested" && (
                  <div className="mt-3">
                    <PdfUpload
                      clientId={client.id}
                      prompt="Upload the proposal PDF…"
                      onUploaded={async (path, fileName) => {
                        const res = await recordProposalReceivedAction(client.id, path, fileName);
                        if (res.ok) {
                          overlays.toast("Proposal received", `${client.fullName} — PDF attached and marked Received.`);
                          router.refresh();
                        }
                        return res;
                      }}
                    />
                  </div>
                )}
                {proposalDocument && client.proposalStatus && client.proposalStatus !== "Requested" && (
                  <a
                    href={`/api/documents/${proposalDocument.id}/download`}
                    className="mt-3 flex items-center gap-2 rounded-md border border-border-soft px-3 py-2 text-[12.5px] font-semibold text-brand-hover transition-colors hover:bg-hover"
                  >
                    <I.fileText size={15} className="shrink-0" />
                    <span className="truncate">{proposalDocument.name}</span>
                  </a>
                )}
                {client.leadStage !== "Proposal" && client.proposalStatus && (
                  <p className="mt-2 text-[11.5px] text-faint">
                    Proposal actions are available once this lead reaches the <b>Proposal</b> stage.
                  </p>
                )}
                {client.leadStage === "Proposal" && client.proposalStatus === "Received" && (
                  <p className="mt-2 text-[11.5px] text-faint">
                    Click <b>Mark Sent</b>{" "}
                    once you&apos;ve actually sent this to the client yourself — the app doesn&apos;t deliver
                    emails yet.
                  </p>
                )}
              </div>
    </Card>
  );
}
