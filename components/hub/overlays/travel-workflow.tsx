"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getTravelWorkflowAction, recordTravelPolicyAction, updateTravelRequirementAction, updateTravelWorkflowAction, type TravelWorkflowPayload } from "@/app/(app)/travel/actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { RequirementStatusDot, requirementRowTone } from "@/components/hub/requirement-status";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { openPortalWindow } from "./portal-window";
import { Modal } from "./modal";
import { Btn, Field, INPUT, StatusBadge } from "../primitives";
import { I } from "../icons";
import { useOverlays } from "./overlay-provider";

export function TravelWorkflowModal({ travelRequestId, onClose }: { travelRequestId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [payload, setPayload] = useState<TravelWorkflowPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [portalStatus, setPortalStatus] = useState("Not Started");
  const [paymentStatus, setPaymentStatus] = useState("Not Yet");
  const [portalRef, setPortalRef] = useState("");
  const [portalAmount, setPortalAmount] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyUploaded, setPolicyUploaded] = useState(false);
  const [policyNumberError, setPolicyNumberError] = useState<string | null>(null);
  const policyNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A superseded load must not overwrite fields the user has already edited.
    let current = true;
    getTravelWorkflowAction(travelRequestId).then((result) => {
      if (!current) return;
      if (!result.ok) return setError(result.error);
      setPayload(result.data);
      setPortalStatus(result.data.travel.portalProcessingStatus);
      setPaymentStatus(result.data.travel.portalPaymentStatus);
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

  // Optimistic: the row shows the new status at once and the save runs in the background. A failed
  // save restores the previous status — unless a newer pick for that row has superseded it.
  const latestStatusPick = useRef<Record<string, number>>({});
  const setRequirement = async (id: string, status: "Pending" | "Received" | "Incomplete" | "Verified") => {
    const previous = payload?.requirements.find((item) => item.id === id)?.status;
    const pick = (latestStatusPick.current[id] ?? 0) + 1;
    latestStatusPick.current[id] = pick;
    setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, status } : item) } : current);
    const result = await updateTravelRequirementAction(travelRequestId, id, status);
    if (!result.ok) {
      if (latestStatusPick.current[id] === pick && previous) {
        setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, status: previous } : item) } : current);
      }
      return overlays.toast("Couldn’t update requirement", result.error);
    }
    router.refresh();
  };

  return <Modal onClose={onClose} maxWidth={820}>
    {!payload ? <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">{error ?? "Loading Travel workflow…"}</div> : <div>
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-brand-hover"><I.plane size={17} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Travel workflow</span></div><h3 className="mt-1 text-[17px] font-bold">{payload.travel.referenceNo ?? "Travel request"} · {payload.travel.clientName}</h3><p className="mt-1 text-[12px] text-muted-foreground">{payload.travel.destination} · {payload.travel.departureDate} to {payload.travel.returnDate}</p></div><StatusBadge status={payload.travel.status} /></div>

      {payload.travel.carrierFormMatchStatus === "Unavailable" && <div className="mt-4 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">No active approved Travel application form matches this product.</div>}

      <div className="mt-5 grid grid-cols-2 gap-4"><div className="rounded-md border border-border-soft p-3"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Travelers</div>{payload.travelers.map((traveler) => <div key={traveler.id} className="border-b border-border-soft py-2 last:border-0"><div className="text-[13px] font-semibold">{traveler.fullName}</div><div className="text-[11.5px] text-muted-foreground">{traveler.dateOfBirth ?? "DOB missing"} · {traveler.idType ?? "ID"} {traveler.idNumber ?? "missing"}</div><div className="text-[11.5px] text-muted-foreground">Beneficiary: {traveler.beneficiaryName ?? "Not recorded"}</div></div>)}</div><div className="rounded-md border border-border-soft p-3"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Collection</div>{payload.payments.length ? payload.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between py-1 text-[12.5px]"><span>{payment.referenceNo ?? "Expected payment"}</span><StatusBadge status={payment.status} /></div>) : <div className="text-[12px] text-muted-foreground">No expected payment yet.</div>}<p className="mt-3 text-[11px] text-muted-foreground">Communications are logged/prepared only; the app does not deliver them without an email provider.</p></div></div>

      <div className="mt-4 rounded-md border border-border-soft p-3">
        <div className="mb-3 flex items-center justify-between gap-3"><div className="text-[11px] font-bold uppercase text-subtle">Portal processing</div>{payload.portalUrl ? <button type="button" onClick={() => openPortalWindow(payload.portalUrl ?? undefined, "pacific-cross-travel-portal")} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-hover"><I.arrowUpRight size={13} /> Open Travel portal</button> : <a href="/settings" className="text-[12px] font-semibold text-amber">Configure portal in Settings</a>}</div>
        <div className="grid grid-cols-4 gap-2">
          <Field label="Payment status"><select aria-label="Payment status" className={INPUT} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option>Not Yet</option><option>Prepaid</option></select></Field>
          <Field label="Portal reference"><input aria-label="Portal reference" className={INPUT} value={portalRef} onChange={(event) => setPortalRef(event.target.value)} placeholder="Portal reference" /></Field>
          <Field label="Portal amount"><input aria-label="Portal amount" className={INPUT} inputMode="decimal" value={portalAmount} onChange={(event) => setPortalAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Portal amount" /></Field>
          <Field label="Portal status"><select aria-label="Portal status" className={INPUT} value={portalStatus} onChange={(event) => { const value = event.target.value; setPortalStatus(value); if (value !== "Issued") setPolicyNumberError(null); }}><option>Not Started</option><option>Processing</option><option>Issued</option><option>Failed</option></select></Field>
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 max-[680px]:grid-cols-1">
          <Field label="Policy number">
            <input
              ref={policyNumberRef}
              aria-label="Policy number"
              className={INPUT}
              value={policyNumber}
              onChange={(event) => { setPolicyNumber(event.target.value); if (policyNumberError) setPolicyNumberError(null); }}
              placeholder={portalStatus === "Issued" ? "Policy number (required)" : "Policy number"}
              aria-invalid={policyNumberError ? true : undefined}
              aria-describedby={policyNumberError ? "travel-policy-number-error" : undefined}
            />
            {policyNumberError && <p id="travel-policy-number-error" role="alert" className="mt-1 text-[11.5px] text-red">{policyNumberError}</p>}
          </Field>
          <PdfUpload clientId={payload.travel.clientId} prompt={policyUploaded ? "Policy PDF attached — upload another…" : "Upload the issued policy PDF…"} onUploaded={async (path, fileName) => {
            const result = await recordTravelPolicyAction(travelRequestId, path, fileName);
            if (result.ok) {
              setPolicyUploaded(true);
              overlays.toast("Travel policy attached");
              const requirementId = result.data.requirementId;
              if (requirementId) setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === requirementId ? { ...item, status: "Received" } : item) } : current);
              router.refresh();
            }
            return result;
          }} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">The carrier purchase remains manual. Portal credentials are held outside this app.</p>
      </div>

      <div className="mt-4"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Requirements and completed originals</div><div className="space-y-2">{payload.requirements.map((item) => <div key={item.id} className={`rounded-md border p-3 transition-colors ${requirementRowTone(item.status)}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><RequirementStatusDot status={item.status} className="max-sm:hidden" /><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1 font-normal text-muted-foreground">Optional</span>}</div><div className="text-[11px] text-muted-foreground">{item.appliesTo}</div></div><select aria-label={`Status for ${item.documentName}`} className={`${INPUT} sm:w-44 sm:shrink-0`} value={item.status} onChange={(event) => void setRequirement(item.id, event.target.value as typeof item.status)}><option>Pending</option><option>Received</option><option>Incomplete</option><option>Verified</option></select></div><div className="mt-2 sm:pl-10"><DocumentUploadForm clientId={payload.travel.clientId} travelRequestId={travelRequestId} requirementId={item.id} sourceLibraryDocumentId={item.documentName.includes("application form") ? payload.travel.carrierFormLibraryId ?? undefined : undefined} /></div></div>)}</div></div>
    </div>}
    <div className="mt-5 flex justify-end gap-2 border-t border-border-soft pt-4"><Btn onClick={onClose}>Close</Btn><Btn variant="primary" disabled={!payload || pending} onClick={save}>Save workflow</Btn></div>
  </Modal>;
}
