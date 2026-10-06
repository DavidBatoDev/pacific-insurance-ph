"use client";

import type { ClientOpenWork } from "@/app/(app)/applications/wizard-actions";
import { fmtDate } from "@/lib/format";
import { I } from "../../icons";
import { Btn } from "../../primitives";

/**
 * "This client already has open work" (2026-10-06). Shown inside the wizard when an existing
 * client is picked who already has a draft, an open travel request or an application in
 * progress, so staff continue that record instead of creating a competing second one.
 */
export function OpenWorkDialog({
  clientName,
  work,
  productName,
  onContinueDraft,
  onOpenTravel,
  onOpenApplication,
  onStartNew,
}: {
  clientName: string;
  work: ClientOpenWork;
  /** The product the wizard is set to; a draft of the same product is offered first. */
  productName: string;
  onContinueDraft: (draftId: string) => void;
  onOpenTravel: (travelRequestId: string) => void;
  onOpenApplication: (applicationId: string) => void;
  onStartNew: () => void;
}) {
  const sameProductDraft = work.drafts.find((draft) => draft.productName && draft.productName === productName);
  const rows = [
    ...work.drafts.map((draft) => ({
      key: `d-${draft.id}`,
      title: `Draft ${draft.referenceNo ?? ""} · ${draft.productName ?? "No product yet"}`,
      sub: [draft.destination, `saved ${fmtDate(draft.savedAt)}`].filter(Boolean).join(" · "),
      action: "Continue draft",
      primary: draft.id === sameProductDraft?.id,
      run: () => onContinueDraft(draft.id),
    })),
    ...work.travelRequests.map((request) => ({
      key: `t-${request.id}`,
      title: `Travel request ${request.referenceNo ?? ""} · ${request.destination ?? "—"}`,
      sub: [request.departureDate && `${fmtDate(request.departureDate)} – ${fmtDate(request.returnDate)}`, request.status].filter(Boolean).join(" · "),
      action: "Open travel request",
      primary: false,
      run: () => onOpenTravel(request.id),
    })),
    ...work.applications.map((application) => ({
      key: `a-${application.id}`,
      title: `Application ${application.referenceNo ?? ""} · ${application.productName ?? "—"}`,
      sub: application.status,
      action: "Open requirements",
      primary: false,
      run: () => onOpenApplication(application.id),
    })),
  ];
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/30 p-6" role="dialog" aria-label={`${clientName} already has open work`}>
      <div className="w-full max-w-[560px] rounded-xl border border-border bg-card p-5 shadow-pop">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-soft text-amber">
            <I.alertTri size={17} />
          </span>
          <div>
            <h3 className="text-[16px] font-bold tracking-[-0.01em]">{clientName} already has open work</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Continue it instead of starting a second application, so nothing is duplicated.
            </p>
          </div>
        </div>
        <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 rounded-md border border-border-soft px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{row.title}</div>
                {row.sub && <div className="truncate text-[11.5px] text-muted-foreground">{row.sub}</div>}
              </div>
              <Btn size="sm" variant={row.primary ? "primary" : "default"} onClick={row.run}>
                {row.action}
              </Btn>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Btn onClick={onStartNew}>Start a new one anyway</Btn>
        </div>
      </div>
    </div>
  );
}
