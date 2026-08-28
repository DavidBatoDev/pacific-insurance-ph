"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { LeadAdvanceSuggestion } from "@/app/(app)/clients/engage-actions";
import type { TimelineEntry } from "@/lib/queries/contact-timeline";
import type { ClientRelatedCounts } from "@/lib/queries/client-summary";
import type { Client } from "@/lib/repositories/clients/client.entity";
import type { Application } from "@/lib/repositories/applications";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { I } from "../icons";
import { canConvertLead } from "../lead-config";
import { AdvanceLeadModal, type AdvanceLeadPreset } from "../overlays/advance-lead";
import { ConvertConfirmModal } from "../overlays/convert-confirm";
import { GenerateProposalModal } from "../overlays/generate-proposal";
import { MarkLostModal } from "../overlays/mark-lost";
import { MarkNurturingModal } from "../overlays/mark-nurturing";
import { useOverlays } from "../overlays/overlay-provider";
import { RecordDecisionModal } from "../overlays/record-decision";
import { RequestProposalModal } from "../overlays/request-proposal";
import { ContactComposer, type ComposerTab } from "./contact-profile/composer";
import { ContactPropertiesCard, DependentsCard, StateFlagsCard, type Dependent } from "./contact-profile/identity-cards";
import { ProfileHeader } from "./contact-profile/profile-header";
import { ProposalCard } from "./contact-profile/proposal-card";
import {
  ApplicationDraftsCard,
  ApplicationRequirementsCard,
  AssociatedRecordsCard,
  DocumentsCard,
  type Doc,
} from "./contact-profile/records-cards";
import { ContactTimeline } from "./contact-profile/timeline";

/**
 * Contact Profile — the unified record view for one contact (see
 * web/contact-profile.md). One record per person; only the lifecycle stage
 * changes. The cards live in ./contact-profile/; this parent owns the
 * composer focus state, the modal switches, and the three-column layout.
 */

interface Props {
  client: Client;
  counts: ClientRelatedCounts;
  dependents: Dependent[];
  documents: Doc[];
  timeline: TimelineEntry[];
  templates: EmailTemplate[];
  userNames: Record<string, string>;
  pacificCrossPortalUrl: string | null;
  origin: "clients" | "prospects";
  applications: Application[];
  draftApplications: Application[];
}

export function ContactProfile({
  client,
  counts,
  dependents,
  documents,
  timeline,
  templates,
  userNames,
  pacificCrossPortalUrl,
  origin,
  applications,
  draftApplications,
}: Props) {
  const router = useRouter();
  const overlays = useOverlays();

  const isLead = client.lifecycleStage === "Lead";
  const owner = userNames[client.assignedUserId ?? ""] ?? null;

  /* ---------- composer focus state ---------- */
  const composerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ComposerTab>("Email");
  // The call and email forms own their own state (LogCallForm / EmailForm); focusCall/focusEmail
  // bump these to remount them fresh, same mechanism.
  const [callFormKey, setCallFormKey] = useState(0);
  const [emailFormKey, setEmailFormKey] = useState(0);
  const [initialEmailTemplate, setInitialEmailTemplate] = useState<string | undefined>(undefined);

  /* ---------- modal switches ---------- */
  const [advanceOpen, setAdvanceOpen] = useState<(AdvanceLeadPreset & Partial<LeadAdvanceSuggestion>) | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [generateProposalOpen, setGenerateProposalOpen] = useState(false);
  const [nurturingOpen, setNurturingOpen] = useState(false);
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [recordDecisionOpen, setRecordDecisionOpen] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);

  // Converting is the Product-Selected payoff; earlier is possible but has to be deliberate.
  const convertReady = canConvertLead(client.leadStage);
  /** `skipAhead` is set only by the confirm dialog — the server rejects the convert without it. */
  const openConvertWizard = (skipAhead = false) =>
    overlays.openWizard({
      convertClientId: client.id,
      convertClientName: client.fullName,
      productInterest: client.productInterest,
      email: client.email,
      dob: client.dateOfBirth,
      familySize: client.familySize,
      coverageTier: client.coverageTier,
      mobileNumber: client.mobileNumber,
      referenceNo: client.referenceNo,
      ...(skipAhead ? { confirmedSkip: true } : {}),
    });

  /** Nurture chips: focus the inline composer with a template preselected. */
  const focusEmail = (templateName?: string) => {
    setTab("Email");
    setInitialEmailTemplate(templateName);
    setEmailFormKey((k) => k + 1);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  /** Land on the discovery inputs: they only render for a Reached call, so remount preset to it. */
  const focusCall = () => {
    setTab("Log Call");
    setCallFormKey((k) => k + 1);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <Link href={origin === "prospects" ? "/prospects" : "/clients"} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-subtle hover:text-foreground">
        <I.arrowRight size={14} className="rotate-180" /> {origin === "prospects" ? "Prospects" : "Clients"}
      </Link>

      <ProfileHeader
        client={client}
        origin={origin}
        isLead={isLead}
        convertReady={convertReady}
        owner={owner}
        applications={applications}
        draftApplications={draftApplications}
        onAdvance={() => setAdvanceOpen({ label: "Advance from profile" })}
        onNurturing={() => setNurturingOpen(true)}
        onConvert={() => openConvertWizard()}
        onConvertConfirm={() => setConvertConfirmOpen(true)}
        onMarkLost={() => setMarkLostOpen(true)}
        onGenerateProposal={() => setGenerateProposalOpen(true)}
        onRequestProposal={() => setProposalOpen(true)}
        focusEmail={focusEmail}
        focusCall={focusCall}
      />

      <div className="grid grid-cols-12 items-start gap-4 max-[1200px]:grid-cols-1">
        {/* ---------- left: identity ---------- */}
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ContactPropertiesCard client={client} />
          <StateFlagsCard client={client} />
          <DependentsCard client={client} dependents={dependents} />
        </div>

        {/* ---------- center: composer + timeline ---------- */}
        <div className="col-span-6 flex flex-col gap-4 max-[1200px]:col-span-1">
          <ContactComposer
            client={client}
            templates={templates}
            tab={tab}
            setTab={setTab}
            composerRef={composerRef}
            emailFormKey={emailFormKey}
            callFormKey={callFormKey}
            initialEmailTemplate={initialEmailTemplate}
            onAdvanceSuggestion={setAdvanceOpen}
          />
          <ContactTimeline timeline={timeline} />
        </div>

        {/* ---------- right: associated records ---------- */}
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          {isLead && (
            <ProposalCard
              client={client}
              pacificCrossPortalUrl={pacificCrossPortalUrl}
              onGenerate={() => setGenerateProposalOpen(true)}
              onRequest={() => setProposalOpen(true)}
              onLogEmail={() => focusEmail("Proposal / Quote Delivery")}
              onRecordDecision={() => setRecordDecisionOpen(true)}
            />
          )}
          <AssociatedRecordsCard counts={counts} />
          {draftApplications.length > 0 && <ApplicationDraftsCard draftApplications={draftApplications} />}
          {applications.length > 0 && <ApplicationRequirementsCard applications={applications} />}
          <DocumentsCard client={client} documents={documents} />
        </div>
      </div>

      {/* ---------- overlays ---------- */}
      {advanceOpen && (
        <AdvanceLeadModal
          lead={{
            clientId: client.id,
            name: client.fullName,
            referenceNo: client.referenceNo,
            stage: advanceOpen.currentStage ?? client.leadStage,
            status: advanceOpen.currentStatus ?? client.leadStatus,
            estPremium: client.estPremium,
            familySize: client.familySize,
            productInterest: client.productInterest,
            coverageTier: client.coverageTier,
          }}
          preset={advanceOpen}
          onClose={() => setAdvanceOpen(null)}
          onCompleteDiscovery={focusCall}
        />
      )}
      {convertConfirmOpen && (
        <ConvertConfirmModal
          lead={{
            name: client.fullName,
            stage: client.leadStage,
            proposalStatus: client.proposalStatus,
            proposalDecision: client.proposalDecision,
          }}
          onClose={() => setConvertConfirmOpen(false)}
          onConfirm={() => openConvertWizard(true)}
        />
      )}
      {proposalOpen && (
        <RequestProposalModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setProposalOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
      {generateProposalOpen && (
        <GenerateProposalModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setGenerateProposalOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
      {nurturingOpen && (
        <MarkNurturingModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setNurturingOpen(false)}
        />
      )}
      {markLostOpen && (
        <MarkLostModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setMarkLostOpen(false)}
        />
      )}
      {recordDecisionOpen && (
        <RecordDecisionModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setRecordDecisionOpen(false)}
        />
      )}
    </div>
  );
}
