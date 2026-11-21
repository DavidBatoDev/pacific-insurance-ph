"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ensureTravelCollectionAction, getTravelWorkflowAction, recordTravelApplicationCopyAction, recordTravelPolicyAction, updateTravelRequirementAction, updateTravelWorkflowAction, type TravelWorkflowPayload } from "@/app/(app)/travel/actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { RequirementStatusDot, requirementRowTone } from "@/components/hub/requirement-status";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { openPortalWindow } from "./portal-window";
import { Modal } from "./modal";
import { TRAVEL_PAYMENT_METHODS } from "@/lib/db-enums";
import { Btn, Field, INPUT, StatusBadge } from "../primitives";
import { I } from "../icons";
import { useOverlays } from "./overlay-provider";
import { usePersona } from "../persona";
import { TravelReferenceAttachments } from "./travel-reference-attachments";
import type { DocumentRecord } from "@/lib/repositories/documents";
import type { Payment } from "@/lib/repositories/payments";
import { money } from "@/lib/format";
import { TRAVEL_PAYMENT_PROOF_REQUIREMENT, travelClientProofDocuments } from "@/lib/travel/client-payment-proof";
import { useVerifyPaymentForm } from "./verify-payment";

function postIssuanceDocuments(documents: DocumentRecord[], documentType: string) {
  return documents
    .filter((document) => document.documentType === documentType && document.status !== "Archived" && document.filePath)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

function PersonalPackDocuments({ documents }: { documents: DocumentRecord[] }) {
  if (!documents.length) return <p className="text-[11px] text-muted-foreground">Not attached</p>;
  return <div className="space-y-1">{documents.map((document) => (
    <a key={document.id} href={`/api/documents/${document.id}/download`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-sm px-1 py-1 text-[11.5px] font-semibold text-brand-hover hover:bg-hover hover:underline">
      <span className="min-w-0 truncate">{document.name}</span><span className="shrink-0">Download</span>
    </a>
  ))}</div>;
}

/** Records the client's payment on one collection with the shared Verify Payment form. */
function TravelCollectionForm({ payment, existingProofDocuments, onCancel, onSaved }: {
  payment: Payment;
  existingProofDocuments: DocumentRecord[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const form = useVerifyPaymentForm(payment, onSaved, { existingProofDocuments });
  return <div className="mt-3 border-t border-border-soft pt-3">
    {form.fields}
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      {form.missing.length > 0 && <p className="mr-auto text-[11.5px] text-muted-foreground">Still needed: {form.missing.join(", ")}</p>}
      <Btn onClick={onCancel} disabled={form.pending}>Cancel</Btn>
      <Btn variant="primary" disabled={!form.canSave} onClick={form.save}><I.check size={14} /> {form.submitLabel}</Btn>
    </div>
  </div>;
}

export function TravelWorkflowModal({ travelRequestId, onClose }: { travelRequestId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  // Server rules narrowed by the "View as" persona: the pack is Admin/Staff-only; everything else
  // follows the permission matrix (Agents edit their own clients; the server enforces assignment).
  const canEdit = persona.can("travel", "edit");
  const canEditPayments = persona.can("payments", "edit");
  const [payload, setPayload] = useState<TravelWorkflowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canFilePack = canEdit && persona.role !== "agent" && !!payload?.canFilePostIssuance;
  const [pending, startTransition] = useTransition();
  const [portalStatus, setPortalStatus] = useState("Not Started");
  const [paymentStatus, setPaymentStatus] = useState("Not Yet");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [portalRef, setPortalRef] = useState("");
  const [portalAmount, setPortalAmount] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyNumberError, setPolicyNumberError] = useState<string | null>(null);
  const policyNumberRef = useRef<HTMLInputElement>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [collectionRefreshError, setCollectionRefreshError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [creatingCollection, startCreatingCollection] = useTransition();

  useEffect(() => {
    // A superseded load must not overwrite fields the user has already edited.
    let current = true;
    getTravelWorkflowAction(travelRequestId).then((result) => {
      if (!current) return;
      if (!result.ok) return setError(result.error);
      setPayload(result.data);
      setPortalStatus(result.data.travel.portalProcessingStatus);
      setPaymentStatus(result.data.travel.portalPaymentStatus);
      setPaymentMethod(result.data.travel.portalPaymentMethod ?? "");
      setPortalRef(result.data.travel.portalPaymentReference ?? "");
      setPortalAmount(result.data.travel.portalPaymentAmount?.toString() ?? "");
      setPolicyNumber(result.data.travel.policyNumber ?? "");
    });
    return () => {
      current = false;
    };
  }, [travelRequestId]);

  const save = () => {
    if (portalStatus === "Issued" && !policyNumber.trim()) {
      setPolicyNumberError("Enter the policy number the Travel portal issued before marking it Issued.");
      policyNumberRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const result = await updateTravelWorkflowAction(travelRequestId, {
        portalProcessingStatus: portalStatus,
        portalPaymentStatus: paymentStatus,
        portalPaymentMethod: paymentMethod || null,
        portalPaymentReference: portalRef || null,
        portalPaymentAmount: portalAmount ? Number(portalAmount) : null,
        policyNumber: policyNumber.trim() || null,
        status: portalStatus === "Issued" ? "Policy Issued" : payload?.travel.status,
      });
      if (!result.ok) return overlays.toast("Couldn’t update Travel request", result.error);
      setPayload((current) => current ? { ...current, travel: result.data } : current);
      router.refresh();
      overlays.toast("Travel workflow updated");
    });
  };

  // A recorded collection reloads only the ledger and its proof originals; unsaved portal fields and
  // the rest of the workflow are left exactly as the user has them.
  const refreshCollection = async () => {
    const result = await getTravelWorkflowAction(travelRequestId).catch(
      (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : "The refresh didn’t reach the server." }),
    );
    if (!result.ok) return setCollectionRefreshError(result.error);
    setCollectionRefreshError(null);
    setPayload((current) => current ? { ...current, payments: result.data.payments, documents: result.data.documents, requirements: result.data.requirements } : current);
  };

  const createCollection = () => startCreatingCollection(async () => {
    setCollectionError(null);
    const result = await ensureTravelCollectionAction(travelRequestId).catch(
      (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : "The request didn’t reach the server." }),
    );
    if (!result.ok) return setCollectionError(result.error);
    setPayload((current) => current ? {
      ...current,
      payments: current.payments.some((item) => item.id === result.data.id) ? current.payments : [...current.payments, result.data],
    } : current);
    router.refresh();
  });

  // Optimistic: the row shows the new status at once and the save runs in the background. A failed
  // save restores the previous status — unless a newer pick for that row has superseded it.
  const latestStatusPick = useRef<Record<string, number>>({});
  const setRequirement = async (id: string, status: "Pending" | "Received" | "Incomplete" | "Verified") => {
    const previous = payload?.requirements.find((item) => item.id === id)?.status;
    const pick = (latestStatusPick.current[id] ?? 0) + 1;
    latestStatusPick.current[id] = pick;
    setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, status } : item) } : current);
    const result = await updateTravelRequirementAction(travelRequestId, id, status).catch(
      (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : "The save didn’t reach the server." }),
    );
    if (!result.ok) {
      if (latestStatusPick.current[id] === pick && previous) {
        setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, status: previous } : item) } : current);
      }
      return overlays.toast("Couldn’t update requirement", result.error);
    }
    router.refresh();
  };
  const policyDocuments = payload ? postIssuanceDocuments(payload.documents, "Travel Policy") : [];
  const applicationCopyDocuments = payload ? postIssuanceDocuments(payload.documents, "Travel Application Copy") : [];


  return <Modal onClose={onClose} maxWidth={820}>
    {!payload ? <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">{error ?? "Loading Travel workflow…"}</div> : <div>
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-brand-hover"><I.plane size={17} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Travel workflow</span></div><h3 className="mt-1 text-[17px] font-bold">{payload.travel.referenceNo ?? "Travel request"} · {payload.travel.clientName}</h3><p className="mt-1 text-[12px] text-muted-foreground">{payload.travel.destination} · {payload.travel.departureDate} to {payload.travel.returnDate}</p></div><StatusBadge status={payload.travel.status} /></div>

      {!canEdit && <div className="mt-4 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">Read-only. Viewing as {persona.roleLabel} — this role can’t update Travel requests.</div>}
      {payload.travel.carrierFormMatchStatus === "Unavailable" && <div className="mt-4 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">The Library has no approved blank Travel application form for this product, so this request isn’t linked to one.</div>}

      <div className="mt-5 rounded-md border border-border-soft p-3"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Travelers</div>{payload.travelers.map((traveler) => <div key={traveler.id} className="border-b border-border-soft py-2 last:border-0"><div className="text-[13px] font-semibold">{traveler.fullName}</div><div className="text-[11.5px] text-muted-foreground">{traveler.dateOfBirth ?? "DOB missing"} · {traveler.idType ?? "ID"} {traveler.idNumber ?? "missing"}</div><div className="text-[11.5px] text-muted-foreground">Beneficiary: {traveler.beneficiaryName ?? "Not recorded"}</div></div>)}</div>

      <section aria-labelledby="travel-client-collection" className="mt-4 rounded-md border border-border-soft p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div id="travel-client-collection" className="text-[11px] font-bold uppercase text-subtle">Client collection · Client → agency</div>
          <a href={`/payments?travelRequestId=${travelRequestId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-hover hover:underline"><I.arrowUpRight size={13} /> Open in Payments</a>
        </div>
        <p className="text-[11px] text-muted-foreground">What the client paid the agency. Recording it doesn’t buy or issue the TravelSafe policy.</p>
        {collectionRefreshError && <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">
          <span>Client payment saved, but the collection list couldn’t refresh: {collectionRefreshError}</span>
          <Btn size="sm" onClick={() => void refreshCollection()}>Retry refresh</Btn>
        </div>}
        {payload.payments.length ? <div className="mt-2">{payload.payments.map((payment) => {
          const editing = editingPaymentId === payment.id;
          return <div key={payment.id} className="border-b border-border-soft py-2.5 last:border-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{payment.referenceNo ?? "Client collection"}</div>
                <div className="text-[11.5px] text-muted-foreground">{payment.amount != null ? money(payment.amount, payment.currency) : "Amount not set"}{payment.orNumber ? ` · OR ${payment.orNumber}` : ""}</div>
              </div>
              <StatusBadge status={payment.status} />
              {canEditPayments && payment.status !== "Verified" && !editing && <Btn size="sm" onClick={() => setEditingPaymentId(payment.id)}><I.peso size={13} /> Record client payment</Btn>}
            </div>
            {editing && <TravelCollectionForm
              key={`${payment.id}:${payment.updatedAt}`}
              payment={payment}
              existingProofDocuments={travelClientProofDocuments(payload.documents, payload.requirements)}
              onCancel={() => setEditingPaymentId(null)}
              onSaved={() => {
                setEditingPaymentId(null);
                void refreshCollection();
              }}
            />}
          </div>;
        })}</div> : <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border-strong px-3 py-2.5">
          <span className="text-[12px] text-muted-foreground">No client collection for this trip yet.</span>
          {canEditPayments && <Btn size="sm" disabled={creatingCollection} onClick={createCollection}>{creatingCollection ? "Creating…" : "Create client collection"}</Btn>}
        </div>}
        {collectionError && <p role="alert" className="mt-2 text-[11.5px] text-red">Couldn’t create the client collection: {collectionError}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Communications are logged/prepared only; the app does not deliver them without an email provider.</p>
      </section>

      <div className="mt-4 rounded-md border border-border-soft p-3">
        <div className="mb-1 flex items-center justify-between gap-3"><div className="text-[11px] font-bold uppercase text-subtle">Portal payment · Agency → Pacific Cross</div>{payload.portalUrl ? <button type="button" onClick={() => openPortalWindow(payload.portalUrl ?? undefined, "pacific-cross-travel-portal")} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-hover"><I.arrowUpRight size={13} /> Open Travel portal</button> : <a href="/settings" className="text-[12px] font-semibold text-amber">Configure portal in Settings</a>}</div>
        <p className="mb-3 text-[11px] text-muted-foreground">Records the agency’s purchase on TravelSafe, not the client’s payment.</p>
        <div className="grid grid-cols-5 gap-2">
          <Field label="Portal payment status"><select aria-label="Portal payment status" className={INPUT} disabled={!canEdit} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option>Not Yet</option><option>Prepaid</option></select></Field>
          <Field label="Portal payment method"><select aria-label="Portal payment method" className={INPUT} disabled={!canEdit} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="">—</option>{TRAVEL_PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></Field>
          <Field label="Portal reference"><input aria-label="Portal reference" className={INPUT} disabled={!canEdit} value={portalRef} onChange={(event) => setPortalRef(event.target.value)} placeholder="Portal reference" /></Field>
          <Field label="Portal amount"><input aria-label="Portal amount" className={INPUT} disabled={!canEdit} inputMode="decimal" value={portalAmount} onChange={(event) => setPortalAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Portal amount" /></Field>
          <Field label="Portal status"><select aria-label="Portal status" className={INPUT} disabled={!canEdit} value={portalStatus} onChange={(event) => { const value = event.target.value; setPortalStatus(value); if (value !== "Issued") setPolicyNumberError(null); }}><option>Not Started</option><option>Processing</option><option>Issued</option><option>Failed</option></select></Field>
        </div>
        <div className="mt-2 max-w-md">
          <Field label="Policy number">
            <input
              ref={policyNumberRef}
              aria-label="Policy number"
              className={INPUT}
              disabled={!canEdit}
              value={policyNumber}
              onChange={(event) => { setPolicyNumber(event.target.value); if (policyNumberError) setPolicyNumberError(null); }}
              placeholder={portalStatus === "Issued" ? "Policy number (required)" : "Policy number"}
              aria-invalid={policyNumberError ? true : undefined}
              aria-describedby={policyNumberError ? "travel-policy-number-error" : undefined}
            />
            {policyNumberError && <p id="travel-policy-number-error" role="alert" className="mt-1 text-[11.5px] text-red">{policyNumberError}</p>}
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">The carrier purchase remains manual. Portal credentials are held outside this app.</p>
      </div>
      <div className="mt-4 rounded-md border border-border-soft p-3">
        <div className="text-[11px] font-bold uppercase text-subtle">Post-issuance pack</div>
        {!canFilePack && <p className="mt-2 text-[11px] text-muted-foreground">Read-only. Admin or Staff file the issued policy and carrier application copy.</p>}
        <div className="mt-3 space-y-4">
          <div>
            <div className="text-[12.5px] font-semibold">Issued policy</div>
            {canFilePack && <div className="mt-2">
              <PdfUpload clientId={payload.travel.clientId} prompt={policyDocuments.length ? "Policy PDF attached — upload another…" : "Upload the issued policy PDF…"} onUploaded={async (path, fileName) => {
                const result = await recordTravelPolicyAction(travelRequestId, path, fileName);
                if (result.ok) {
                  setPayload((current) => current ? {
                    ...current,
                    documents: [result.data.document, ...current.documents.filter((document) => document.id !== result.data.document.id)],
                    requirements: result.data.requirementId
                      ? current.requirements.map((item) => item.id === result.data.requirementId ? { ...item, status: "Received" } : item)
                      : current.requirements,
                  } : current);
                  overlays.toast("Travel policy attached");
                  router.refresh();
                }
                return result;
              }} />
            </div>}
            <div className="mt-2"><PersonalPackDocuments documents={policyDocuments} /></div>
          </div>

          <div className="border-t border-border-soft pt-3">
            <div className="text-[12.5px] font-semibold">Carrier application copy</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Returned after purchase; this is separate from the signed intake form.</p>
            {canFilePack && <div className="mt-2">
              <PdfUpload clientId={payload.travel.clientId} prompt={applicationCopyDocuments.length ? "Carrier application copy attached — upload another…" : "Upload the carrier's completed application PDF…"} onUploaded={async (path, fileName) => {
                const result = await recordTravelApplicationCopyAction(travelRequestId, path, fileName);
                if (result.ok) {
                  setPayload((current) => current ? {
                    ...current,
                    documents: [result.data, ...current.documents.filter((document) => document.id !== result.data.id)],
                  } : current);
                  overlays.toast("Travel application copy attached");
                  router.refresh();
                }
                return result;
              }} />
            </div>}
            <div className="mt-2"><PersonalPackDocuments documents={applicationCopyDocuments} /></div>
          </div>

          <TravelReferenceAttachments
            travelRequestId={travelRequestId}
            travelLabel={`${payload.travel.referenceNo ?? "Travel request"} · ${payload.travel.clientName ?? "client"}`}
            canEdit={canFilePack}
            attachments={payload.referenceAttachments}
            libraryReferences={payload.referenceDocuments}
            onChange={(referenceAttachments) => setPayload((current) => current ? { ...current, referenceAttachments } : current)}
          />
        </div>
      </div>


      <div className="mt-4">
        <div className="mb-2 text-[11px] font-bold uppercase text-subtle">Requirements and completed originals</div>
        <div className="space-y-2">{payload.requirements.map((item) => <div key={item.id} className={`rounded-md border p-3 transition-colors ${requirementRowTone(item.status)}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <RequirementStatusDot status={item.status} className="max-sm:hidden" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold">{item.documentName === TRAVEL_PAYMENT_PROOF_REQUIREMENT ? "Client payment proof" : item.documentName}{!item.isRequired && <span className="ml-1 font-normal text-muted-foreground">Optional</span>}</div>
              <div className="text-[11px] text-muted-foreground">{item.documentName === TRAVEL_PAYMENT_PROOF_REQUIREMENT ? "Client → agency. Attaching a file does not record receipt of payment; record the collection above." : item.appliesTo}</div>
            </div>
            <select aria-label={`Status for ${item.documentName === TRAVEL_PAYMENT_PROOF_REQUIREMENT ? "Client payment proof" : item.documentName}`} className={`${INPUT} sm:w-44 sm:shrink-0`} disabled={!canEdit} value={item.status} onChange={(event) => void setRequirement(item.id, event.target.value as typeof item.status)}>
              <option>Pending</option><option>Received</option><option>Incomplete</option><option>Verified</option>
            </select>
          </div>
          {canEdit && <div className="mt-2 sm:pl-10">
            <DocumentUploadForm
              clientId={payload.travel.clientId}
              travelRequestId={travelRequestId}
              requirementId={item.id}
              requirementLabel={`${payload.travel.referenceNo ?? "Travel request"} · ${payload.travel.clientName} · ${item.documentName}${item.appliesTo ? ` · ${item.appliesTo}` : ""}`}
              requirement={item}
              sourceLibraryDocumentId={item.documentName.includes("application form") ? payload.travel.carrierFormLibraryId ?? undefined : undefined}
              onAttached={(receipt) => {
                latestStatusPick.current[item.id] = (latestStatusPick.current[item.id] ?? 0) + 1;
                setPayload((current) => current ? {
                  ...current,
                  requirements: current.requirements.map((requirement) => requirement.id === item.id ? { ...requirement, status: receipt.requirementStatus } : requirement),
                  documents: [receipt.document, ...current.documents.filter((document) => document.id !== receipt.document.id)],
                } : current);
                // Refresh the checklist only: never reset unsaved portal/payment fields.
                void getTravelWorkflowAction(travelRequestId).then((result) => {
                  if (result.ok) setPayload((current) => current ? { ...current, requirements: result.data.requirements, documents: result.data.documents } : current);
                  else overlays.toast("Document attached; checklist refresh failed", result.error);
                }).catch(() => overlays.toast("Document attached", "Reopen the workflow to refresh the complete checklist."));
                router.refresh();
              }}
            />
          </div>}
        </div>)}</div>
      </div>
    </div>}
    <div className="mt-5 flex justify-end gap-2 border-t border-border-soft pt-4"><Btn onClick={onClose}>Close</Btn>{canEdit && <Btn variant="primary" disabled={!payload || pending} onClick={save}>Save workflow</Btn>}</div>
  </Modal>;
}
