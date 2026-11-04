"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  generateClaimRequirementsAction,
  getClaimRequirementsAction,
  getMissingClaimDocumentsDraftAction,
  updateClaimIntakeAction,
  type ClaimRequirementsPayload,
} from "@/app/(app)/claims/actions";
import { listSubmissionRecordsAction } from "@/app/(app)/submissions/actions";
import { CLAIM_WORKFLOW_STEPS, claimWorkflowProgress, isClaimStepUnlocked, type ClaimStepNumber } from "@/lib/claims/workflow";
import { CLAIM_SUBMISSION_MODES } from "@/lib/db-enums";
import { fmtDate, peso } from "@/lib/format";
import { checklistForClaimType } from "@/lib/repositories/claim-requirements/claim-requirement.entity";
import { countsAsCompleted, type SubmissionRecord } from "@/lib/submissions/submission-email";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { ClaimRequirementsPanel } from "./claim-requirements-panel";
import { useFileClaimForm } from "./file-claim";
import { MissingDocumentsEmail } from "./missing-documents-email";
import { useOverlays } from "./overlay-provider";
import { SubmissionRecordCard } from "./submission-record";
import { SubmissionStep } from "./submission-step";
import { Section } from "./wizard/steps-1";
import { StepActionBar, WorkflowFooter, WorkflowShell } from "./workflow-shell";

const STEP_HEADINGS: Record<ClaimStepNumber, { title: string; sub: string }> = {
  1: { title: "Claim details", sub: "Who is claiming, against which policy, and how the claim reached you." },
  2: { title: "Requirements", sub: "Collect and verify the claim documents for the checklist." },
  3: { title: "Email Pacific Cross", sub: "Send the complete claim to Pacific Cross Claims." },
};

/** Claim statuses that mean Pacific Cross already has the claim. */
const SUBMITTED_OR_LATER: Record<string, true> = {
  Submitted: true, "Pending Review": true, "Compliance Required": true, Approved: true, Rejected: true, Credited: true,
};

/**
 * Pacific Cross has the claim: its own status/date says so, or a Gmail-accepted (or historical
 * log-only) submission exists. Prepared, failed and unknown sends never count.
 */
function hasSubmitted(claim: ClaimRequirementsPayload["claim"], records: SubmissionRecord[]): boolean {
  return !!SUBMITTED_OR_LATER[claim.status] || !!claim.claimSubmittedDate || records.some(countsAsCompleted);
}

/** Step 1 for a new claim: the File claim form, with its own pinned action bar. */
function NewClaimStep({ onCancel, onFiled }: { onCancel: () => void; onFiled: (payload: ClaimRequirementsPayload) => void }) {
  const form = useFileClaimForm(({ claim, requirements }) => onFiled({ claim, requirements }));
  return (
    <>
      {form.fields}
      <StepActionBar onBack={onCancel} backLabel="Cancel" missing={form.missing} note="The checklist is created with the claim">
        <Btn variant="primary" disabled={!form.canSave} onClick={form.save}><I.clipboard size={14} /> {form.submitLabel}</Btn>
      </StepActionBar>
    </>
  );
}

/**
 * Claim workflow (modals.md §6, TO-BE-UPDATE-PLAN.md H7a–f): Claim details → Requirements → Email
 * Pacific Cross, in the same wizard-style frame as the application workflow. Opened with no claim
 * by "File claim"; opened with one from the claims list, on the step its records have reached.
 */
export function ClaimWorkflowModal({ claimId: initialClaimId, onClose }: { claimId?: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [claimId, setClaimId] = useState<string | null>(initialClaimId ?? null);
  const [payload, setPayload] = useState<ClaimRequirementsPayload | null>(null);
  const [sent, setSent] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(!!initialClaimId);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ClaimStepNumber>(1);
  const [composing, setComposing] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadSent = useCallback(async (id: string) => {
    const result = await listSubmissionRecordsAction("claim", id);
    if (result.ok) setSent(result.data);
    return result.ok ? result.data : [];
  }, []);

  useEffect(() => {
    if (!initialClaimId) return;
    let active = true;
    Promise.all([getClaimRequirementsAction(initialClaimId), listSubmissionRecordsAction("claim", initialClaimId)]).then(([result, records]) => {
      if (!active) return;
      if (!result.ok) {
        setError(result.error);
      } else {
        const submissions = records.ok ? records.data : [];
        setPayload(result.data);
        setSent(submissions);
        const outstandingCount = result.data.requirements.filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete")).length;
        const opening = claimWorkflowProgress({ claimExists: true, outstanding: outstandingCount, submitted: hasSubmitted(result.data.claim, submissions) });
        setStep(Math.min(opening.current, 3) as ClaimStepNumber);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [initialClaimId]);

  const claim = payload?.claim ?? null;
  const requirements = payload?.requirements ?? [];
  const checklistType = checklistForClaimType(claim?.claimType ?? null);
  const outstanding = requirements.filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete"));
  const submitted = !!claim && hasSubmitted(claim, sent);
  const flow = claimWorkflowProgress({ claimExists: !!claim, outstanding: outstanding.length, submitted });
  const go = (n: ClaimStepNumber) => { setComposing(false); setStep(n); };
  const lockedReason: Record<ClaimStepNumber, string> = { 1: "", 2: "File the claim first", 3: "Collect the required documents first" };

  const saveIntake = (patch: { submissionMode?: string | null; documentsReceivedDate?: string | null }) => {
    if (!payload || !claimId) return;
    const previous = payload.claim;
    setPayload((current) => current && { ...current, claim: { ...current.claim, ...patch } });
    void updateClaimIntakeAction(claimId, patch).then((result) => {
      if (!result.ok) {
        setPayload((current) => current && {
          ...current,
          claim: { ...current.claim, submissionMode: previous.submissionMode, documentsReceivedDate: previous.documentsReceivedDate },
        });
        return overlays.toast("Couldn’t update claim intake", result.error);
      }
      router.refresh();
    });
  };

  const generate = () =>
    startTransition(async () => {
      if (!claimId) return;
      const result = await generateClaimRequirementsAction(claimId);
      if (!result.ok) return overlays.toast("Couldn’t generate checklist", result.error);
      setPayload((current) => current && { ...current, requirements: result.data });
      router.refresh();
      overlays.toast("Checklist generated", `${result.data.length} requirement${result.data.length === 1 ? "" : "s"} added from the ${checklistType} NOC checklist.`);
    });

  const [requesting, setRequesting] = useState(false);

  const refreshAfterSubmission = async (id: string) => {
    const [result] = await Promise.all([getClaimRequirementsAction(id), loadSent(id)]);
    if (result.ok) setPayload(result.data);
    router.refresh();
  };

  const body = (() => {
    if (step === 1) {
      if (!claim) {
        return (
          <NewClaimStep
            onCancel={onClose}
            onFiled={(filed) => {
              setClaimId(filed.claim.id);
              setPayload(filed);
              setSent([]);
              setStep(2);
            }}
          />
        );
      }
      return (
        <>
          <Section title="Claim" state={{ status: "done", label: claim.referenceNo ?? "Filed" }}>
            <div className="text-[12.5px]">
              {([
                ["Claimant", claim.clientName ?? "—"],
                ["Claim type", claim.claimType ?? "—"],
                ["Policy", claim.policyRef ?? "Not linked"],
                ["Incident date", fmtDate(claim.incidentDate)],
                ["Amount claimed", claim.amountClaimed != null ? peso(claim.amountClaimed) : "—"],
                ["Status", claim.status],
              ] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-border-soft py-1.5 last:border-0">
                  <span className="font-semibold uppercase tracking-[0.03em] text-subtle">{label}</span>
                  <span className="font-[600]">{value}</span>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title="Intake"
            state={claim.submissionMode && claim.documentsReceivedDate ? { status: "done", label: "Complete" } : { status: "todo", label: "Incomplete" }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="How it arrived">
                <select aria-label="How it arrived" className={INPUT} value={claim.submissionMode ?? ""} onChange={(e) => saveIntake({ submissionMode: e.target.value || null })}>
                  <option value="">—</option>
                  {CLAIM_SUBMISSION_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Documents received">
                <input aria-label="Documents received" className={INPUT} type="date" value={claim.documentsReceivedDate ?? ""} onChange={(e) => saveIntake({ documentsReceivedDate: e.target.value || null })} />
              </Field>
            </div>
          </Section>
        </>
      );
    }
    if (!claim || !claimId) return null;
    if (step === 2) {
      return (
        <>
          {requesting && (
            <MissingDocumentsEmail load={() => getMissingClaimDocumentsDraftAction(claimId)} onClose={() => setRequesting(false)} />
          )}
          {requirements.length === 0 && (
            <div className="mb-4 rounded-md border border-dashed border-border-strong px-4 py-8 text-center">
              <p className="text-[13px] font-semibold">No checklist generated yet</p>
              {checklistType ? (
                <>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">This {claim.claimType} claim uses the {checklistType} NOC checklist.</p>
                  <div className="mt-4 flex justify-center">
                    <Btn variant="primary" disabled={pending} onClick={generate}><I.clipboard size={14} /> Generate checklist</Btn>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {claim.claimType === "Travel"
                    ? "Travel claims: nothing to generate — work from the TravelSafe NOC form directly."
                    : "This claim’s type has no checklist template. Pick a claim type below."}
                </p>
              )}
            </div>
          )}
          <ClaimRequirementsPanel
            claimId={claimId}
            clientId={claim.clientId}
            claimType={claim.claimType}
            recordLabel={`${claim.referenceNo ?? "Claim"} · ${claim.clientName ?? "Client"}`}
            requirements={requirements}
            onChange={(next, nextType) =>
              setPayload((current) =>
                current && {
                  ...current,
                  requirements: typeof next === "function" ? next(current.requirements) : next,
                  claim: nextType ? { ...current.claim, claimType: nextType } : current.claim,
                },
              )
            }
          />
        </>
      );
    }
    if (composing || !submitted) {
      return (
        <SubmissionStep
          embedded
          kind="claim"
          id={claimId}
          backLabel={submitted ? "Cancel resubmission" : "Back to requirements"}
          onBack={() => (submitted ? setComposing(false) : go(2))}
          onSubmitted={() => {
            setComposing(false);
            void refreshAfterSubmission(claimId);
          }}
        />
      );
    }
    return sent.length
      ? <SubmissionRecordCard records={sent} />
      : <p className="text-[12.5px] text-muted-foreground">Submitted to Pacific Cross{claim.claimSubmittedDate ? ` on ${fmtDate(claim.claimSubmittedDate)}` : ""}. No email is recorded in the CRM for it.</p>;
  })();

  const footer = (() => {
    if (!claim) return null; // the new-claim form pins its own action bar
    const back = step > 1 ? <Btn onClick={() => go((step - 1) as ClaimStepNumber)}><I.chevRight size={15} className="rotate-180" /> Back</Btn> : <Btn onClick={onClose}>Close</Btn>;
    if (step === 1) {
      return (
        <WorkflowFooter back={back} note={`${claim.referenceNo ?? "Claim"} · ${claim.status}`}>
          <Btn variant="primary" onClick={() => go(2)}>Continue <I.chevRight size={15} /></Btn>
        </WorkflowFooter>
      );
    }
    if (step === 2) {
      return (
        <WorkflowFooter
          back={back}
          missing={outstanding.length && !flow.done[3] ? [`${outstanding.length} required document${outstanding.length === 1 ? "" : "s"}`] : []}
          note="All required documents are in"
        >
          <Btn variant="primary" disabled={!flow.done[2] && !flow.done[3]} onClick={() => go(3)}>Continue <I.chevRight size={15} /></Btn>
        </WorkflowFooter>
      );
    }
    if (composing || !submitted) return null; // SubmissionStep has its own footer
    const lastSent = sent.find(countsAsCompleted);
    const submittedOn = claim.claimSubmittedDate ?? lastSent?.occurredAt;
    return (
      <WorkflowFooter back={back} note={submittedOn ? `Submitted to Pacific Cross on ${fmtDate(submittedOn)}` : `Claim ${claim.status}`}>
        <Btn onClick={() => setComposing(true)}><I.send size={14} /> Resubmit</Btn>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </WorkflowFooter>
    );
  })();

  return (
    <WorkflowShell
      label="Claim workflow"
      title={claim?.clientName ?? "New claim"}
      subtitle={claim ? `${claim.referenceNo ?? "Claim"} · ${claim.claimType ?? "Unspecified type"}` : "File a claim for a client"}
      status={claim ? { label: "Claim status", value: claim.status } : null}
      active={step}
      onSelect={(n) => go(n as ClaimStepNumber)}
      onClose={onClose}
      steps={CLAIM_WORKFLOW_STEPS.map((s) => ({
        n: s.n,
        label: s.label,
        done: flow.done[s.n],
        locked: !isClaimStepUnlocked(flow, s.n),
        lockedReason: lockedReason[s.n],
      }))}
      heading={claim && step === 1 ? { title: "Claim details", sub: "Filed — intake details stay editable here." } : STEP_HEADINGS[step]}
      headerAction={step === 2 && outstanding.length > 0 && (
        <Btn size="sm" disabled={requesting} onClick={() => setRequesting(true)} title="Opens an email to the client listing the outstanding documents, for review before sending">
          <I.mail size={13} /> Request missing documents
        </Btn>
      )}
      loading={loading ? "Loading the claim…" : null}
      error={error ? { title: "Claim unavailable", message: error } : null}
      footer={footer}
    >
      {body}
    </WorkflowShell>
  );
}
