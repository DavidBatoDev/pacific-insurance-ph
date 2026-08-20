"use client";

import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useTransition } from "react";

import {
  activateRequirementPhaseAction,
  getApplicationRequirementsAction,
  requestMissingDocumentsAction,
  updateApplicationRequirementRequiredAction,
  updateApplicationRequirementStatusAction,
  type ApplicationRequirementsPayload,
} from "@/app/(app)/applications/actions";
import { APPLICATION_REQUIREMENT_STATUSES, type ApplicationRequirement, type ApplicationRequirementStatus, type RequirementPhase } from "@/lib/repositories/application-requirements/application-requirement.entity";
import { cn } from "@/lib/utils";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { I } from "../icons";
import { Btn, StatusBadge } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

const statusTone: Record<ApplicationRequirementStatus, string> = {
  Pending: "border-border-soft bg-card",
  Received: "border-blue-border bg-blue-soft/50",
  Incomplete: "border-red-border bg-red-soft/50",
  Verified: "border-green-border bg-green-soft/50",
};

export function ApplicationRequirementsModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [payload, setPayload] = useState<ApplicationRequirementsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    getApplicationRequirementsAction(applicationId).then((result) => {
      if (!active) return;
      if (result.ok) setPayload(result.data);
      else setError(result.error);
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

  const update = (item: ApplicationRequirement, status: ApplicationRequirementStatus) =>
    startTransition(async () => {
      const result = await updateApplicationRequirementStatusAction(applicationId, item.id, status);
      if (!result.ok) return overlays.toast("Couldn’t update requirement", result.error);
      setPayload((current) => current && {
        ...current,
        requirements: current.requirements.map((requirement) => requirement.id === item.id ? result.data : requirement),
      });
      router.refresh();
      overlays.toast("Requirement updated", `${item.documentName} is now ${status}.`);
    });

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

  return (
    <Modal onClose={onClose} maxWidth={660}>
      {loading ? (
        <div className="grid min-h-52 place-items-center text-[13px] text-muted-foreground">Loading requirements…</div>
      ) : error || !payload ? (
        <div className="py-8 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-red-soft text-red"><I.alertTri size={20} /></div>
          <h3 className="mt-3 text-[16px] font-bold">Requirements unavailable</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{error ?? "The application could not be loaded."}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-brand-hover"><I.clipboard size={17} /><span className="text-[11px] font-bold uppercase tracking-[.09em]">Application requirements</span></div>
              <h3 className="mt-1 text-[17px] font-bold tracking-[-.015em]">{payload.clientName}</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{payload.application.referenceNo ?? "Application"} · {payload.application.productName ?? payload.application.applicationType}</p>
            </div>
            <StatusBadge status={payload.application.status} />
          </div>

          <div className="mt-5 rounded-md border border-border-soft bg-surface-2 px-4 py-3">
            <div className="flex items-end justify-between gap-3"><div><div className="text-[12px] font-semibold">Verified package</div><div className="mt-0.5 text-[11.5px] text-muted-foreground">{complete} of {required.length} required documents verified</div></div><div className="text-[17px] font-bold tabular-nums text-brand-hover">{progress}%</div></div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border-soft"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {phaseGroups.map(({ phase, items }) => (
              <Fragment key={phase ?? "__none"}>
                {phase && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border-soft bg-surface-2 px-3 py-2">
                    <div>
                      <div className="text-[12px] font-semibold">{phase}</div>
                      {items.every((item) => !item.isRequired) && (
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          Not requested yet — these {items.length} become outstanding once the group accepts the proposal.
                        </div>
                      )}
                    </div>
                    {items.every((item) => !item.isRequired) && (
                      <Btn disabled={pending} onClick={() => activatePhase(phase)}>Mark agreed</Btn>
                    )}
                  </div>
                )}
                {items.map((item) => (
              <div key={item.id} className={cn("rounded-md border px-3 py-2.5", statusTone[item.status])}><div className="flex items-center gap-3">
                <div className={cn("grid size-7 shrink-0 place-items-center rounded-full", item.status === "Verified" ? "bg-green text-white" : "bg-card text-muted-foreground")}><I.check size={14} /></div>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{item.documentName}{!item.isRequired && <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>}</div>{(item.appliesTo || item.notes) && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.appliesTo ?? item.notes}</div>}<label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><input type="checkbox" checked={item.isRequired} disabled={pending} onChange={() => toggleRequired(item)} /> Count as required</label></div>
                <select aria-label={`Status for ${item.documentName}`} disabled={pending} value={item.status} onChange={(event) => update(item, event.target.value as ApplicationRequirementStatus)} className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12px] font-semibold outline-none focus:border-brand disabled:opacity-60">
                  {APPLICATION_REQUIREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div><div className="mt-2 pl-10"><DocumentUploadForm clientId={payload.application.clientId} applicationId={applicationId} requirementId={item.id} sourceLibraryDocumentId={item.documentName.toLowerCase().includes("application form") ? payload.carrierForms.find((form) => form.personName === item.appliesTo)?.documentLibraryId ?? undefined : undefined} /></div></div>
                ))}
              </Fragment>
            ))}
            {!requirements.length && <div className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-[12.5px] text-muted-foreground">No template requirements were configured when this application was created.</div>}
          </div>
        </div>
      )}
      {!loading && payload && <div className="mt-5 flex items-center justify-between border-t border-border-soft pt-4"><div className="text-[11.5px] text-muted-foreground">{outstanding.length ? `${outstanding.length} required item${outstanding.length === 1 ? "" : "s"} still need attention` : "No required documents are outstanding"}</div><div className="flex gap-2"><Btn onClick={onClose}>Close</Btn><Btn variant="primary" disabled={pending || !outstanding.length} onClick={request}><I.mail size={14} /> Log missing-document request</Btn></div></div>}
    </Modal>
  );
}
