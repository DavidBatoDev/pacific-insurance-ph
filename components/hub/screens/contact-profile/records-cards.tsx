"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import type { ClientRelatedCounts } from "@/lib/queries/client-summary";
import type { Client } from "@/lib/repositories/clients/client.entity";
import type { Application } from "@/lib/repositories/applications";
import { I } from "../../icons";
import { useOverlays } from "../../overlays/overlay-provider";
import { Btn, Card, CardHead } from "../../primitives";
import { CollapsibleListCard } from "./collapsible-list-card";

export interface Doc {
  id: string;
  name: string;
  documentType: string | null;
  visibility: string | null;
}

export function AssociatedRecordsCard({ counts }: { counts: ClientRelatedCounts }) {
  const assoc = [
    { label: "Applications", val: counts.applications, icon: "fileText", href: "/applications" },
    { label: "Policies", val: counts.policies, icon: "shield", href: "/policies" },
    { label: "Renewals", val: counts.renewals, icon: "refresh", href: "/renewals" },
    { label: "Claims", val: counts.claims, icon: "clipboard", href: "/claims" },
    { label: "Travel", val: counts.travelRequests, icon: "plane", href: "/travel" },
  ] as const;

  return (
    <Card>
      <CardHead iconName="folder" title="Associated records" />
            <div className="px-[18px] py-2">
              {assoc.map((a) => {
                const Ico = I[a.icon];
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-2.5 border-b border-border-soft py-2.5 transition-colors last:border-0 hover:bg-hover"
                  >
                    <span className="grid size-[28px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                      <Ico size={14} />
                    </span>
                    <span className="flex-1 text-[13px] font-[550]">{a.label}</span>
                    <span className="text-[14px] font-bold tabular-nums">{a.val}</span>
                    <I.chevRight size={14} className="text-faint" />
                  </Link>
                );
              })}
            </div>
    </Card>
  );
}

export function ApplicationDraftsCard({ draftApplications }: { draftApplications: Application[] }) {
  const overlays = useOverlays();
  return (
            <Card>
              <CardHead iconName="fileText" title="Application drafts" count={draftApplications.length} />
              <div className="divide-y divide-border-soft">
                {draftApplications.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-2 px-[18px] py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11.5px] text-subtle">{draft.referenceNo ?? "Draft"}</div>
                      <div className="truncate text-[12.5px] font-semibold">{draft.productName ?? draft.applicationType}</div>
                    </div>
                    <Btn
                      size="sm"
                      onClick={() =>
                        overlays.openWizard({
                          draftApplicationId: draft.id,
                        })
                      }
                    >
                      Continue
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
  );
}

export function ApplicationRequirementsCard({ applications }: { applications: Application[] }) {
  const overlays = useOverlays();
  return (
            <Card>
              <CardHead iconName="clipboard" title="Application requirements" count={applications.length} />
              <div className="divide-y divide-border-soft">
                {applications.map((application) => (
                  <div key={application.id} className="flex items-center gap-2 px-[18px] py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11.5px] text-subtle">{application.referenceNo ?? "Application"}</div>
                      <div className="truncate text-[12.5px] font-semibold">{application.productName ?? application.applicationType}</div>
                    </div>
                    <Btn size="sm" onClick={() => overlays.openApplicationRequirements(application.id)}>
                      View requirements
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
  );
}

export function DocumentsCard({ client, documents }: { client: Client; documents: Doc[] }) {
  const [addDocumentOpen, setAddDocumentOpen] = useState(false);
  return (
    <CollapsibleListCard
      iconName="folder"
      title="Documents"
      count={documents.length}
      open={addDocumentOpen}
      onToggle={() => setAddDocumentOpen((open) => !open)}
      openLabel="Hide the upload form"
      closedLabel="Upload a document"
      panelClassName="px-[18px] py-3"
      panel={<DocumentUploadForm clientId={client.id} />}
    >
            <div>
              {documents.length === 0 && (
                <p className="px-[18px] py-3 text-[12.5px] text-subtle">No documents uploaded yet.</p>
              )}
              {documents.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <span className="grid size-[28px] shrink-0 place-items-center rounded-[8px] bg-surface-3 text-muted-foreground">
                    <I.doc2 size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{d.name}</div>
                    <div className="text-[11px] text-subtle">
                      {[d.documentType, d.visibility].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-brand-hover hover:bg-hover"
                  >
                    <I.download size={13} />
                  </a>
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-subtle hover:bg-hover hover:text-red">
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
    </CollapsibleListCard>
  );
}
