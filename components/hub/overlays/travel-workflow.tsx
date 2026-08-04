"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getTravelWorkflowAction, updateTravelRequirementAction, updateTravelWorkflowAction, type TravelWorkflowPayload } from "@/app/(app)/travel/actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DRAWER_INPUT } from "./client-picker";
import { Modal } from "./modal";
import { Btn, StatusBadge } from "../primitives";
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

  useEffect(() => {
    getTravelWorkflowAction(travelRequestId).then((result) => {
      if (!result.ok) return setError(result.error);
      setPayload(result.data);
      setPortalStatus(result.data.travel.portalProcessingStatus);
      setPaymentStatus(result.data.travel.portalPaymentStatus);
      setPortalRef(result.data.travel.portalPaymentReference ?? "");
      setPortalAmount(result.data.travel.portalPaymentAmount?.toString() ?? "");
    });
  }, [travelRequestId]);

  const save = () => startTransition(async () => {
    const result = await updateTravelWorkflowAction(travelRequestId, {
      portalProcessingStatus: portalStatus,
      portalPaymentStatus: paymentStatus,
      portalPaymentReference: portalRef || null,
      portalPaymentAmount: portalAmount ? Number(portalAmount) : null,
      status: portalStatus === "Issued" ? "Policy Issued" : payload?.travel.status,
    });
    if (!result.ok) return overlays.toast("Couldn’t update Travel request", result.error);
    setPayload((current) => current ? { ...current, travel: result.data } : current);
    router.refresh();
    overlays.toast("Travel workflow updated");
  });

  const setRequirement = (id: string, status: "Pending" | "Received" | "Incomplete" | "Verified") => startTransition(async () => {
    const result = await updateTravelRequirementAction(travelRequestId, id, status);
    if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
    setPayload((current) => current ? { ...current, requirements: current.requirements.map((item) => item.id === id ? { ...item, status } : item) } : current);
    router.refresh();
  });

  return <Modal onClose={onClose} maxWidth={820}>
    {!payload ? <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">{error ?? "Loading Travel workflow…"}</div> : <div>
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-brand-hover"><I.plane size={17} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Travel workflow</span></div><h3 className="mt-1 text-[17px] font-bold">{payload.travel.referenceNo ?? "Travel request"} · {payload.travel.clientName}</h3><p className="mt-1 text-[12px] text-muted-foreground">{payload.travel.destination} · {payload.travel.departureDate} to {payload.travel.returnDate}</p></div><StatusBadge status={payload.travel.status} /></div>

      {payload.travel.carrierFormMatchStatus === "Unavailable" && <div className="mt-4 rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">No active approved Travel application form matches this product. The request remains usable; no attachment is being implied.</div>}

      <div className="mt-5 grid grid-cols-2 gap-4"><div className="rounded-md border border-border-soft p-3"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Travelers</div>{payload.travelers.map((traveler) => <div key={traveler.id} className="border-b border-border-soft py-2 last:border-0"><div className="text-[13px] font-semibold">{traveler.fullName}</div><div className="text-[11.5px] text-muted-foreground">{traveler.dateOfBirth ?? "DOB missing"} · {traveler.idType ?? "ID"} {traveler.idNumber ?? "missing"}</div><div className="text-[11.5px] text-muted-foreground">Beneficiary: {traveler.beneficiaryName ?? "Not recorded"}</div></div>)}</div><div className="rounded-md border border-border-soft p-3"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Collection</div>{payload.payments.length ? payload.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between py-1 text-[12.5px]"><span>{payment.referenceNo ?? "Expected payment"}</span><StatusBadge status={payment.status} /></div>) : <div className="text-[12px] text-muted-foreground">No expected payment yet.</div>}<p className="mt-3 text-[11px] text-muted-foreground">Communications are logged/prepared only; the app does not deliver them without an email provider.</p></div></div>

      <div className="mt-4 rounded-md border border-border-soft p-3"><div className="mb-3 text-[11px] font-bold uppercase text-subtle">Portal processing</div><div className="grid grid-cols-4 gap-2"><select className={DRAWER_INPUT} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option>Not Yet</option><option>Prepaid</option></select><input className={DRAWER_INPUT} value={portalRef} onChange={(event) => setPortalRef(event.target.value)} placeholder="Portal reference" /><input className={DRAWER_INPUT} inputMode="decimal" value={portalAmount} onChange={(event) => setPortalAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="Portal amount" /><select className={DRAWER_INPUT} value={portalStatus} onChange={(event) => setPortalStatus(event.target.value)}><option>Not Started</option><option>Processing</option><option>Issued</option><option>Failed</option></select></div></div>

      <div className="mt-4"><div className="mb-2 text-[11px] font-bold uppercase text-subtle">Requirements and completed originals</div><div className="space-y-2">{payload.requirements.map((item) => <div key={item.id} className="rounded-md border border-border-soft p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1 font-normal text-muted-foreground">Optional</span>}</div><div className="text-[11px] text-muted-foreground">{item.appliesTo}</div></div><select aria-label={`Status for ${item.documentName}`} className={`${DRAWER_INPUT} sm:w-44 sm:shrink-0`} value={item.status} disabled={pending} onChange={(event) => setRequirement(item.id, event.target.value as typeof item.status)}><option>Pending</option><option>Received</option><option>Incomplete</option><option>Verified</option></select></div><div className="mt-2"><DocumentUploadForm clientId={payload.travel.clientId} travelRequestId={travelRequestId} requirementId={item.id} sourceLibraryDocumentId={item.documentName.includes("application form") ? payload.travel.carrierFormLibraryId ?? undefined : undefined} /></div></div>)}</div></div>
    </div>}
    <div className="mt-5 flex justify-end gap-2 border-t border-border-soft pt-4"><Btn onClick={onClose}>Close</Btn><Btn variant="primary" disabled={!payload || pending} onClick={save}>Save workflow</Btn></div>
  </Modal>;
}
