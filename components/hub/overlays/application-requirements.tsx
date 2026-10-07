"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  activateRequirementPhaseAction,
  createApplicationPaymentAction,
  getApplicationRequirementsAction,
  logBillingSentAction,
  logPacificCrossReplyAction,
  recordApplicationProposalAction,
  requestMissingDocumentsAction,
  updateApplicationRequirementRequiredAction,
  updateApplicationRequirementStatusAction,
  type ApplicationRequirementsPayload,
} from "@/app/(app)/applications/actions";
import type { Payment } from "@/lib/repositories/payments";
import { APPLICATION_REQUIREMENT_STATUSES, type ApplicationRequirement, type ApplicationRequirementStatus, type RequirementPhase } from "@/lib/repositories/application-requirements/application-requirement.entity";
import { cn } from "@/lib/utils";
import { RequirementStatusDot, requirementRowTone } from "@/components/hub/requirement-status";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { PdfUpload } from "@/components/documents/pdf-upload";
import type { SubmissionRecord } from "@/lib/submissions/submission-email";
import { APPLICATION_WORKFLOW_STEPS, isStepUnlocked, workflowProgress, type WorkflowStepNumber } from "@/lib/applications/workflow";
import { fmtDate, peso } from "@/lib/format";
import { I } from "../icons";
import { AREA, Btn, Field, INPUT, StatusBadge } from "../primitives";
import { usePolicyCopyForm, type PolicyFromApplication } from "./issue-policy";
import { useOverlays } from "./overlay-provider";
import { SubmissionRecordCard } from "./submission-record";
import { SubmissionStep } from "./submission-step";
import { useVerifyPaymentForm } from "./verify-payment";
import { Section } from "./wizard/steps-1";
import type { SectionState } from "./wizard/wizard-data";
import { Checkpoint, StepActionBar, WorkflowShell } from "./workflow-shell";

/** Payment step, verification half: the Payments page's Verify form, rendered in the step. */
function VerifyPaymentInline({ payment, onBack, onSaved }: { payment: Payment; onBack: () => void; onSaved: () => void }) {
  const form = useVerifyPaymentForm(payment, onSaved);
  return (
    <>
      {form.fields}
      <StepActionBar onBack={onBack} missing={form.missing} note={`${payment.status} · ${payment.amount != null ? peso(payment.amount) : ""}`}>
        <Btn variant="primary" disabled={!form.canSave} onClick={form.save}><I.check size={14} /> {form.submitLabel}</Btn>
      </StepActionBar>
    </>
  );
}

/** Log policy copy step: the standalone drawer's form, prefilled from the application. */
function PolicyCopyInline({ fromApplication, onBack, onSaved }: { fromApplication: PolicyFromApplication; onBack: () => void; onSaved: () => void }) {
  const form = usePolicyCopyForm({ fromApplication, onSaved });
  return (
    <>
      {form.fields}
      <StepActionBar onBack={onBack} missing={form.missing} note="Closes the application">
        <Btn variant="primary" disabled={!form.canSave} onClick={form.save}><I.shield size={14} /> {form.submitLabel}</Btn>
      </StepActionBar>
    </>
  );
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

type ReplyKind = "Conforme to sign" | "More requirements" | "Note";

/**
 * Step 3: what Pacific Cross sent back after the submission. Eman logs it by hand (the CRM has no
 * inbox): conformes and extra requirements become checklist rows the client must return, and the
 * illustrative proposal — the final billing — unlocks Payment. A lead-stage proposal counts.
 */
function PacificCrossReplyStep({
  payload,
  applicationId,
  outstanding,
  onChanged,
  onOpenRequirements,
  onResubmit,
}: {
  payload: ApplicationRequirementsPayload;
  applicationId: string;
  outstanding: ApplicationRequirement[];
  onChanged: () => Promise<unknown>;
  onOpenRequirements: () => void;
  onResubmit: () => void;
}) {
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<ReplyKind>("Conforme to sign");
  const [conformes, setConformes] = useState<("CAC" | "TAL")[]>([]);
  const [items, setItems] = useState("");
  const [note, setNote] = useState("");
  const [received, setReceived] = useState(todayIso());
  const { proposal, replies } = payload;
  const requested = outstanding.filter((item) => item.appliesTo === "Requested by Pacific Cross" || /\((CAC|TAL)\)/.test(item.documentName));

  const canLog = !pending && (kind === "Conforme to sign" ? conformes.length > 0 : kind === "More requirements" ? items.trim().length > 0 : note.trim().length > 0);
  const logReply = () =>
    startTransition(async () => {
      const result = await logPacificCrossReplyAction(applicationId, {
        kind, conformes, items: items.split("\n"), note, receivedDate: received,
      });
      if (!result.ok) return overlays.toast("Couldn’t log the reply", result.error);
      overlays.toast("Reply logged", result.data.added ? `${result.data.added} item${result.data.added === 1 ? "" : "s"} added to the checklist for the client.` : "Added to the timeline.");
      setConformes([]); setItems(""); setNote("");
      await onChanged();
    });

  return (
    <div className="flex flex-1 flex-col">
      <Section
        title="Illustrative proposal (final billing)"
        state={proposal ? { status: "done", label: "On file" } : { status: "todo", label: "Needed" }}
      >
        {proposal ? (
          <div className="flex items-center justify-between gap-3 text-[12.5px]">
            <div className="min-w-0">
              <div className="truncate font-semibold">{proposal.name}</div>
              <div className="text-muted-foreground">Received {fmtWhen(proposal.uploadedAt)}</div>
            </div>
            <a href={`/api/documents/${proposal.id}/download`} target="_blank" rel="noreferrer" className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold hover:bg-hover">
              <I.download size={13} /> Open
            </a>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Pacific Cross emails the illustrative proposal once it has evaluated the application. Upload it here — it is the billing the client pays.
            </p>
            <PdfUpload
              clientId={payload.application.clientId}
              prompt="Drop the illustrative proposal PDF here, or click to choose."
              onUploaded={async (path, fileName) => {
                const result = await recordApplicationProposalAction(applicationId, { path, fileName });
                if (result.ok) { overlays.toast("Proposal filed", "Payment is unlocked once nothing is outstanding."); await onChanged(); }
                return result;
              }}
            />
          </>
        )}
      </Section>

      {requested.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-border bg-amber-soft/50 px-3.5 py-3 text-[12.5px]">
          <div className="font-semibold">Waiting on the client — {requested.length} item{requested.length === 1 ? "" : "s"} Pacific Cross asked for</div>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">{requested.map((item) => <li key={item.id}>{item.documentName}</li>)}</ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn size="sm" onClick={onOpenRequirements}>Open the checklist</Btn>
            <span className="self-center text-[11.5px] text-muted-foreground">Once they’re in, send them back with <button type="button" className="font-semibold text-brand-hover hover:underline" onClick={onResubmit}>Resubmit</button> on step 2.</span>
          </div>
        </div>
      )}

      <Section title="Replies from Pacific Cross" state={replies.length ? { status: "done", label: `${replies.length} logged` } : undefined}>
        {replies.length > 0 && (
          <ul className="mb-4 space-y-2">
            {replies.map((reply: SubmissionRecord) => (
              <li key={reply.id} className="rounded-md border border-border-soft bg-surface-2 px-3 py-2 text-[12.5px]">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{reply.summary?.replace(/^Pacific Cross reply — /, "") ?? "Reply"}</span>
                  <span className="shrink-0 text-muted-foreground">{fmtWhen(reply.occurredAt)}</span>
                </div>
                {reply.body && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{reply.body}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="text-[12px] font-semibold">Log a reply</div>
        <div role="radiogroup" aria-label="Reply type" className="mt-2 flex flex-wrap gap-2">
          {(["Conforme to sign", "More requirements", "Note"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors", kind === option ? "border-brand bg-brand-soft text-brand-hover" : "border-border-strong text-muted-foreground hover:bg-hover")}
            >
              {option}
            </button>
          ))}
        </div>
        {kind === "Conforme to sign" && (
          <div className="mt-3 flex flex-wrap gap-4 text-[12.5px]">
            {([["CAC", "CAC — Client Application for Coverage (pre-existing conditions)"], ["TAL", "TAL — Treatment Area Limitation (discount)"]] as const).map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input type="checkbox" checked={conformes.includes(value)} onChange={(event) => setConformes((current) => event.target.checked ? [...current, value] : current.filter((c) => c !== value))} />
                {label}
              </label>
            ))}
          </div>
        )}
        {kind === "More requirements" && (
          <Field label="What Pacific Cross asked for" hint="One per line — each becomes a checklist item for the client." className="mt-3">
            <textarea aria-label="Requested items" className={AREA} rows={3} value={items} onChange={(event) => setItems(event.target.value)} placeholder={"Medical questionnaire — diabetes\nAttending physician’s statement"} />
          </Field>
        )}
        <div className="mt-3 grid grid-cols-[1fr_170px] gap-3">
          <Field label={kind === "Note" ? "Note" : "Note (optional)"}>
            <input aria-label="Reply note" className={INPUT} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What the email said" />
          </Field>
          <Field label="Received">
            <input aria-label="Reply received" type="date" className={INPUT} value={received} onChange={(event) => setReceived(event.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Btn disabled={!canLog} onClick={logReply}><I.plus size={14} /> Log reply</Btn>
        </div>
      </Section>
    </div>
  );
}

/** Payment checkpoint 2: the billing and payment channels, ready to paste to the client. */
function BillingToClient({
  payload,
  payment,
  applicationId,
  onChanged,
}: {
  payload: ApplicationRequirementsPayload;
  payment: Payment;
  applicationId: string;
  onChanged: () => Promise<unknown>;
}) {
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const firstName = payload.clientName.split(" ")[0];
  const product = payload.application.productName ?? "Pacific Cross";
  const [subject, setSubject] = useState(`Your ${product} billing — ${payload.application.referenceNo ?? ""}`.trim());
  const [body, setBody] = useState(
    [
      `Hi ${firstName},`,
      "",
      `Attached is your illustrative proposal from Pacific Cross. The premium due is ${payment.amount != null ? peso(payment.amount) : "as stated in the proposal"}${payload.application.preferredPaymentMode ? ` (${payload.application.preferredPaymentMode})` : ""}.`,
      "",
      "You can pay through any of these channels:",
      ...(payload.paymentChannels.length ? payload.paymentChannels.map((channel) => `- ${channel}`) : ["- (payment channels)"]),
      "",
      "Please send me a screenshot or the payment slip once paid, and I’ll forward it to Pacific Cross.",
      "",
      "Thank you!",
    ].join("\n"),
  );
  const sent = payload.billingSent;
  const copy = () =>
    void navigator.clipboard
      .writeText(`${payload.clientEmail ? `To: ${payload.clientEmail}\n` : ""}Subject: ${subject}\n\n${body}`)
      .then(() => overlays.toast("Email copied", "Paste it into a message to the client and attach the proposal."))
      .catch(() => overlays.toast("Couldn’t copy", "Select the text and copy it instead."));
  const markSent = () =>
    startTransition(async () => {
      const result = await logBillingSentAction(applicationId, { subject, body });
      if (!result.ok) return overlays.toast("Couldn’t log it", result.error);
      overlays.toast("Billing logged as sent", "Nothing was delivered from the CRM.");
      await onChanged();
    });

  return (
    <Section title="Billing sent to client" state={sent ? { status: "done", label: `Sent ${fmtWhen(sent.occurredAt)}` } : { status: "todo", label: "Not sent yet" }}>
      {sent ? (
        <p className="text-[12.5px] text-muted-foreground">
          Logged {fmtWhen(sent.occurredAt)}{sent.senderName ? ` by ${sent.senderName}` : ""}: “{sent.subject}”.{" "}
          <button type="button" className="font-semibold text-brand-hover hover:underline" onClick={() => overlays.openPaymentLinks()}>Send payment instructions again</button>
        </p>
      ) : (
        <>
          <Field label="Subject">
            <input aria-label="Billing subject" className={INPUT} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </Field>
          <Field label="Message" className="mt-3">
            <textarea aria-label="Billing message" className={cn(AREA, "text-[13px]")} rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {payload.proposal && (
              <a href={`/api/documents/${payload.proposal.id}/download`} target="_blank" rel="noreferrer" className="mr-auto text-[12px] font-semibold text-brand-hover hover:underline">
                Open the proposal to attach
              </a>
            )}
            <Btn size="sm" onClick={copy}><I.copy size={13} /> Copy email text</Btn>
            <Btn size="sm" disabled={pending} onClick={markSent}><I.send size={13} /> Mark as sent</Btn>
          </div>
        </>
      )}
    </Section>
  );
}

const STEP_HEADINGS: Record<WorkflowStepNumber, { title: string; sub: string }> = {
  1: { title: "Requirements", sub: "Collect and verify every required document from the client." },
  2: { title: "Email Pacific Cross", sub: "Send the complete package to Pacific Cross New Business." },
  3: { title: "Pacific Cross reply", sub: "Log what Pacific Cross sent back — conformes, extra requirements, and the illustrative proposal." },
  4: { title: "Payment", sub: "Send the billing, collect proof of payment, and record Pacific Cross’s service invoice." },
  5: { title: "Log policy copy", sub: "File the issued policy — the client becomes a policyholder." },
};

/**
 * The application workflow after the wizard (TO-BE-UPDATE-PLAN.md H7e follow-up): Requirements →
 * Email Pacific Cross → Pacific Cross reply → Payment → Log policy copy, laid out like the New
 * Application wizard. Each step's state comes from the records (checklist, logged emails and
 * replies, the illustrative proposal, payment, policy); payment and policy render the Payments
 * page's and the Log policy copy drawer's shared forms inline.
 */
export function ApplicationRequirementsModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [payload, setPayload] = useState<ApplicationRequirementsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<WorkflowStepNumber | null>(null);
  const [composing, setComposing] = useState(false);
  const [amount, setAmount] = useState("");

  const reload = useCallback(async () => {
    const result = await getApplicationRequirementsAction(applicationId);
    if (result.ok) setPayload(result.data);
    else setError(result.error);
    setLoading(false);
    return result.ok ? result.data : null;
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    getApplicationRequirementsAction(applicationId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setPayload(result.data);
        const outstandingCount = result.data.requirements.filter((item) => item.isRequired && (item.status === "Pending" || item.status === "Incomplete")).length;
        const opening = workflowProgress({
          outstanding: outstandingCount,
          submitted: result.data.submissions.length > 0,
          proposalOnFile: !!result.data.proposal,
          paymentStatus: result.data.payment?.status ?? null,
          policyLinked: !!result.data.policy,
        });
        setStep(Math.min(opening.current, 5) as WorkflowStepNumber);
        const estimate = result.data.payment?.amount ?? result.data.application.estimatedPremium;
        setAmount(estimate != null ? String(Math.round(estimate)) : "");
      } else setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [applicationId]);

  const requirements = payload?.requirements ?? [];
  const required = requirements.filter((item) => item.isRequired);
  /**
   * Ordered gates. BC Flexi's list is two sequential phases; everything else has a single null
   * phase and renders exactly as before. Preserves the snapshot's own ordering rather than
   * re-sorting, so sort_order still drives the sequence inside each gate.
   */
  const phaseGroups = requirements.reduce<{ phase: string | null; items: ApplicationRequirement[] }[]>((groups, item) => {
    const last = groups[groups.length - 1];
    if (last && last.phase === (item.phase ?? null)) last.items.push(item);
    else groups.push({ phase: item.phase ?? null, items: [item] });
    return groups;
  }, []);

  const activatePhase = (phase: string) =>
    startTransition(async () => {
      const result = await activateRequirementPhaseAction(applicationId, phase as RequirementPhase);
      if (!result.ok) { overlays.toast("Couldn't activate that phase", result.error); return; }
      const refreshed = await getApplicationRequirementsAction(applicationId);
      if (refreshed.ok) setPayload(refreshed.data);
      overlays.toast("Phase activated", `${result.data.activated} requirement${result.data.activated === 1 ? "" : "s"} now outstanding`);
    });
  const complete = required.filter((item) => item.status === "Verified").length;
  const outstanding = required.filter((item) => item.status === "Pending" || item.status === "Incomplete");
  const progress = required.length ? Math.round((complete / required.length) * 100) : 0;

  // Optimistic: show the new status at once, save in the background, and restore the previous
  // status only if the save fails and no newer pick for that row has superseded it.
  const latestStatusPick = useRef<Record<string, number>>({});
  const setRowStatus = (id: string, status: ApplicationRequirementStatus) =>
    setPayload((current) => current && {
      ...current,
      requirements: current.requirements.map((requirement) => requirement.id === id ? { ...requirement, status } : requirement),
    });
  const update = async (item: ApplicationRequirement, status: ApplicationRequirementStatus) => {
    const pick = (latestStatusPick.current[item.id] ?? 0) + 1;
    latestStatusPick.current[item.id] = pick;
    setRowStatus(item.id, status);
    const result = await updateApplicationRequirementStatusAction(applicationId, item.id, status).catch(
      (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : "The save didn’t reach the server." }),
    );
    if (!result.ok) {
      if (latestStatusPick.current[item.id] === pick) setRowStatus(item.id, item.status);
      return overlays.toast("Couldn’t update requirement", result.error);
    }
    router.refresh();
  };

  const toggleRequired = (item: ApplicationRequirement) =>
    startTransition(async () => {
      const result = await updateApplicationRequirementRequiredAction(applicationId, item.id, !item.isRequired);
      if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
      setPayload((current) => current && {
        ...current,
        requirements: current.requirements.map((requirement) => requirement.id === item.id ? result.data : requirement),
      });
      router.refresh();
    });

  const request = () =>
    startTransition(async () => {
      const result = await requestMissingDocumentsAction(applicationId);
      if (!result.ok) return overlays.toast("Couldn’t log follow-up", result.error);
      overlays.toast("Follow-up logged", `${result.data.outstanding} outstanding document${result.data.outstanding === 1 ? "" : "s"} recorded; nothing was delivered.`);
    });

  const payment = payload?.payment ?? null;
  const policy = payload?.policy ?? null;
  const submissions = payload?.submissions ?? [];
  const flow = workflowProgress({
    outstanding: outstanding.length,
    submitted: submissions.length > 0,
    proposalOnFile: !!payload?.proposal,
    paymentStatus: payment?.status ?? null,
    policyLinked: !!policy,
  });
  const active: WorkflowStepNumber = step ?? 1;
  const lockedReason: Record<WorkflowStepNumber, string> = {
    1: "",
    2: "Finish the requirements first",
    3: "Email Pacific Cross first",
    4: "Waiting on Pacific Cross’s illustrative proposal",
    5: "Verify the payment first",
  };
  const go = (n: WorkflowStepNumber) => { setComposing(false); setStep(n); };

  const createPayment = () =>
    startTransition(async () => {
      const value = Number(amount.replace(/[^0-9.]/g, ""));
      const result = await createApplicationPaymentAction(applicationId, { amount: value });
      if (!result.ok) return overlays.toast("Couldn’t create the payment request", result.error);
      overlays.toast(payment ? "Amount updated" : "Payment request created", `${peso(value)} — now on the Payments page as Awaiting.`);
      await reload();
      router.refresh();
    });

  const body = (() => {
    if (!payload) return null;
    if (active === 1) {
      return (
        <>
          <div className="rounded-md border border-border-soft bg-surface-2 px-4 py-3">
            <div className="flex items-end justify-between gap-3"><div><div className="text-[12px] font-semibold">Verified package</div><div className="mt-0.5 text-[11.5px] text-muted-foreground">{complete} of {required.length} required documents verified</div></div><div className="text-[17px] font-bold tabular-nums text-brand-hover">{progress}%</div></div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="mt-4 space-y-2">
            {phaseGroups.map(({ phase, items }) => (
              <Fragment key={phase ?? "__none"}>
                {phase && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-2 px-3 py-2">
                    <div>
                      <div className="text-[12px] font-semibold">{phase}</div>
                      {items.every((item) => !item.isRequired) && <div className="mt-0.5 text-[11.5px] text-muted-foreground">Not requested yet</div>}
                    </div>
                    {items.every((item) => !item.isRequired) && <Btn disabled={pending} onClick={() => activatePhase(phase)}>Mark agreed</Btn>}
                  </div>
                )}
                {items.map((item) => (
                  <div key={item.id} className={cn("rounded-md border px-3 py-2.5", requirementRowTone(item.status))}>
                    <div className="flex items-center gap-3">
                      <RequirementStatusDot status={item.status} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}</div>
                        {(item.appliesTo || item.notes) && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.appliesTo ?? item.notes}</div>}
                        <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={item.isRequired} disabled={pending} onChange={() => toggleRequired(item)} /> Count as required</label>
                      </div>
                      <select aria-label={`Status for ${item.documentName}`} value={item.status} onChange={(event) => void update(item, event.target.value as ApplicationRequirementStatus)} className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12px] font-semibold outline-none focus:border-brand disabled:opacity-60">
                        {APPLICATION_REQUIREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </div>
                    <div className="mt-2 pl-10">
                      <DocumentUploadForm
                        clientId={payload.application.clientId}
                        applicationId={applicationId}
                        requirementId={item.id}
                        onUploaded={() => void reload()}
                        sourceLibraryDocumentId={item.documentName.toLowerCase().includes("application form") ? payload.carrierForms.find((form) => form.personName === item.appliesTo)?.documentLibraryId ?? undefined : undefined}
                      />
                    </div>
                  </div>
                ))}
              </Fragment>
            ))}
            {!requirements.length && <div className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-[12.5px] text-muted-foreground">No requirements.</div>}
          </div>
        </>
      );
    }
    if (active === 2) {
      if (composing || !submissions.length) {
        return (
          <SubmissionStep
            embedded
            kind="application"
            id={applicationId}
            backLabel={submissions.length ? "Cancel resubmission" : "Back to requirements"}
            onBack={() => (submissions.length ? setComposing(false) : go(1))}
            onSubmitted={() => {
              setComposing(false);
              void reload().then((data) => { if (data) setStep(3); });
              router.refresh();
            }}
          />
        );
      }
      return <SubmissionRecordCard records={submissions} />;
    }
    if (active === 3) {
      return (
        <PacificCrossReplyStep
          payload={payload}
          applicationId={applicationId}
          outstanding={outstanding}
          onChanged={reload}
          onOpenRequirements={() => go(1)}
          onResubmit={() => { setStep(2); setComposing(true); }}
        />
      );
    }
    if (active === 4) {
      const awaiting = !payment || payment.status === "Awaiting" || payment.status === "Overdue";
      const billingState: SectionState = payment
        ? { status: "done", label: `${payment.amount != null ? peso(payment.amount) : "Amount"} requested` }
        : { status: "todo", label: amount ? "Ready to create" : "Amount needed" };
      const proofIn = !!payment && (payment.status === "Received" || payment.status === "Verified" || !!payment.proofDocumentId);
      return (
        <div className="flex flex-1 flex-col">
          <Section title="Checkpoints">
            <ul>
              <Checkpoint done={!!payment} label="Billed amount recorded" detail={payment?.amount != null ? peso(payment.amount) : undefined} />
              <Checkpoint done={!!payload.billingSent} label="Billing sent to client" detail={payload.billingSent ? fmtWhen(payload.billingSent.occurredAt) : undefined} />
              <Checkpoint done={proofIn} label="Proof of payment received" detail="screenshot, bank slip or provisional receipt" />
              <Checkpoint done={!!payment?.sentToPacificCross} label="Proof sent to Pacific Cross" />
              <Checkpoint done={payment?.status === "Verified"} label="Service invoice (OR) recorded" detail={payment?.orNumber ?? undefined} />
            </ul>
          </Section>
          <Section title="Pacific Cross billing" state={billingState}>
            {payment && (
              <div className="mb-4 text-[12.5px]">
                {([
                  ["Payment", payment.referenceNo ?? "—"],
                  ["Amount", payment.amount != null ? peso(payment.amount) : "—"],
                  ["Status", <StatusBadge key="status" status={payment.status} />],
                  ["Proof of payment", payment.proofDocumentId ? "On file" : "Not yet"],
                  ...(payment.status === "Verified"
                    ? ([["Service invoice (OR)", payment.orNumber ?? "—"], ["Method", payment.paymentMethod ?? "—"], ["Paid", fmtDate(payment.paymentDate)]] as const)
                    : []),
                ] as const).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-border-soft py-1.5 last:border-0">
                    <span className="font-semibold uppercase tracking-[0.03em] text-subtle">{label}</span>
                    <span className="font-[600]">{value}</span>
                  </div>
                ))}
              </div>
            )}
            {awaiting && (
              <Field
                label="Premium billed by Pacific Cross (₱)"
                required
                hint={payment ? "Correct it if Pacific Cross’s billing changed." : "From Pacific Cross’s billing — prefilled from the application’s estimate."}
              >
                <div className="flex gap-2">
                  <input aria-label="Premium billed by Pacific Cross" className={INPUT} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0" />
                  {payment && <Btn disabled={pending || !amount || Number(amount.replace(/[^0-9.]/g, "")) === payment.amount} onClick={createPayment}>Update amount</Btn>}
                </div>
              </Field>
            )}
            <p className="mt-3 text-[12px] text-muted-foreground">
              {!payment ? (
                "Creating the request adds it to the Payments page as Awaiting and moves the application to Awaiting Payment."
              ) : payment.status === "Verified" ? (
                "Payment verified — the application is Approved and commission tracking has started."
              ) : (
                <>
                  Once the client pays, attach the proof below and mark it sent to Pacific Cross; verify it when Pacific Cross issues the service invoice.
                </>
              )}
            </p>
          </Section>
          {payment && <BillingToClient key={payment.id} payload={payload} payment={payment} applicationId={applicationId} onChanged={reload} />}
          {payment && payment.status !== "Verified" && (
            <VerifyPaymentInline
              key={`${payment.id}:${payment.status}`}
              payment={payment}
              onBack={() => go(3)}
              onSaved={() => void reload()}
            />
          )}
        </div>
      );
    }
    // Step 5
    if (policy) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-border bg-green-soft/50 px-4 py-5 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-green text-white"><I.shield size={20} /></div>
            <div className="mt-3 text-[16px] font-bold">{payload.clientName} is now a policyholder</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">The application is closed out; renewals and claims now hang off this policy.</p>
          </div>
          <div className="rounded-md border border-border-soft bg-surface-2 px-3.5 py-3 text-[12.5px]">
            {([
              ["Policy", policy.policyNumber ?? policy.referenceNo ?? "—"],
              ["Product", policy.productName ?? "—"],
              ["Premium", policy.premiumAmount != null ? peso(policy.premiumAmount) : "—"],
              ["Effective", fmtDate(policy.effectiveDate)],
              ["Expiry", fmtDate(policy.expiryDate)],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-border-soft py-1.5 last:border-0">
                <span className="font-semibold uppercase tracking-[0.03em] text-subtle">{label}</span>
                <span className="font-[600]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <PolicyCopyInline
        onBack={() => go(4)}
        onSaved={() => void reload()}
        fromApplication={{
          applicationId,
          referenceNo: payload.application.referenceNo,
          client: { id: payload.application.clientId, name: payload.clientName, email: payload.clientEmail ?? undefined },
          productVersionId: payload.application.productVersionId,
          productName: payload.application.productName,
          planOptionId: payload.application.planOptionId,
          premium: payment?.amount ?? payload.application.estimatedPremium,
          paymentMode: payload.application.preferredPaymentMode,
        }}
      />
    );
  })();

  const footer = (() => {
    if (!payload) return <Btn onClick={onClose}>Close</Btn>;
    const back = active > 1 ? <Btn onClick={() => go((active - 1) as WorkflowStepNumber)}><I.chevRight size={15} className="rotate-180" /> Back</Btn> : <Btn onClick={onClose}>Close</Btn>;
    let note = "";
    let primary: React.ReactNode = null;
    if (active === 1) {
      note = outstanding.length ? `${outstanding.length} required item${outstanding.length === 1 ? "" : "s"} still need attention` : "All required documents are in";
      primary = (
        <Btn variant="primary" disabled={!flow.done[1] && !flow.done[2]} title={outstanding.length ? "Every required item must be received or verified first" : undefined} onClick={() => go(2)}>
          Continue <I.chevRight size={15} />
        </Btn>
      );
    } else if (active === 2) {
      if (composing || !submissions.length) return null; // SubmissionStep has its own footer
      note = `Sent ${fmtDate(submissions[0].occurredAt)}${payload.application.dateSubmitted ? ` · submitted ${fmtDate(payload.application.dateSubmitted)}` : ""}`;
      primary = (
        <>
          <Btn onClick={() => setComposing(true)}><I.send size={14} /> Resubmit</Btn>
          <Btn variant="primary" onClick={() => go(3)}>Continue <I.chevRight size={15} /></Btn>
        </>
      );
    } else if (active === 3) {
      const missing = [
        ...(!payload.proposal ? ["illustrative proposal"] : []),
        ...(outstanding.length ? [`${outstanding.length} checklist item${outstanding.length === 1 ? "" : "s"} from the client`] : []),
      ];
      note = missing.length ? "" : `Proposal on file${payload.replies.length ? ` · ${payload.replies.length} repl${payload.replies.length === 1 ? "y" : "ies"} logged` : ""}`;
      primary = <Btn variant="primary" disabled={!flow.done[3] && !flow.done[4]} onClick={() => go(4)}>Continue <I.chevRight size={15} /></Btn>;
      return (
        <>
          {back}
          <span className="flex-1 text-[11.5px] text-faint">{missing.length ? <span className="text-amber">Still needed: {missing.join(", ")}</span> : note}</span>
          <div className="flex gap-2">{primary}</div>
        </>
      );
    } else if (active === 4) {
      if (!payment) {
        note = "Record the premium on Pacific Cross’s illustrative proposal";
        primary = <Btn variant="primary" disabled={pending || !amount} onClick={createPayment}><I.peso size={14} /> Create payment request</Btn>;
      } else if (payment.status !== "Verified") {
        return null; // VerifyPaymentInline has its own action bar
      } else {
        note = `Verified · service invoice ${payment.orNumber ?? "—"}`;
        primary = <Btn variant="primary" onClick={() => go(5)}>Continue <I.chevRight size={15} /></Btn>;
      }
    } else if (policy) {
      note = `Policy logged ${fmtDate(payload.application.policyIssuedDate)}`;
      primary = (
        <>
          <Btn onClick={onClose}>Close</Btn>
          <Btn variant="primary" onClick={() => { onClose(); router.push(`/clients/${payload.application.clientId}`); }}><I.user size={14} /> Open client profile</Btn>
        </>
      );
    } else {
      return null; // PolicyCopyInline has its own action bar
    }
    return (
      <>
        {back}
        <span className="flex-1 text-[11.5px] text-faint">{note}</span>
        <div className="flex gap-2">{primary}</div>
      </>
    );
  })();

  return (
    <WorkflowShell
      label="Application workflow"
      title={payload?.clientName ?? "Application"}
      subtitle={payload ? `${payload.application.referenceNo ?? "Application"} · ${payload.application.productName ?? payload.application.applicationType}` : null}
      status={payload ? { label: "Application status", value: payload.application.status } : null}
      active={active}
      onSelect={(n) => go(n as WorkflowStepNumber)}
      onClose={onClose}
      steps={APPLICATION_WORKFLOW_STEPS.map((s) => ({
        n: s.n,
        label: s.label,
        done: !!payload && flow.done[s.n],
        locked: !payload || !isStepUnlocked(flow, s.n),
        lockedReason: lockedReason[s.n],
      }))}
      heading={STEP_HEADINGS[active]}
      headerAction={active === 1 && outstanding.length > 0 && (
        <Btn size="sm" disabled={pending} onClick={request} title="Logs an email to the client listing the outstanding documents">
          <I.mail size={13} /> Request missing documents
        </Btn>
      )}
      loading={loading ? "Loading the application…" : null}
      error={error || !payload ? { title: "Application unavailable", message: error ?? "The application could not be loaded." } : null}
      footer={footer}
    >
      {body}
    </WorkflowShell>
  );
}
