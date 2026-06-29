import Link from "next/link";
import { notFound } from "next/navigation";

import { addDependentAction, removeDependentAction } from "@/app/(app)/clients/actions";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { I } from "@/components/hub/icons";
import { Avatar, Card, CardHead, StatusBadge } from "@/components/hub/primitives";
import { getActivity } from "@/lib/activity/read";
import { getClientRelatedCounts } from "@/lib/queries/client-summary";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getDependentsRepository } from "@/lib/repositories/dependents";
import { getDocumentsRepository } from "@/lib/repositories/documents";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientsRepository().findById(id);
  if (!client) notFound();

  const [counts, dependents, documents, activity] = await Promise.all([
    getClientRelatedCounts(id),
    getDependentsRepository().listByClient(id),
    getDocumentsRepository().listByClient(id),
    getActivity("client", id, 50),
  ]);

  const contactRows: [string, string | null][] = [
    ["Email", client.email],
    ["Mobile", client.mobileNumber],
    ["Date of birth", fmtDate(client.dateOfBirth)],
    ["Address", client.address],
    ["Lead source", client.leadSource],
    ["Preferred channel", client.preferredChannel],
  ];

  const tiles = [
    { label: "Policies", val: counts.policies, icon: I.shield, href: "/policies" },
    { label: "Applications", val: counts.applications, icon: I.fileText, href: "/applications" },
    { label: "Renewals", val: counts.renewals, icon: I.refresh, href: "/renewals" },
    { label: "Claims", val: counts.claims, icon: I.clipboard, href: "/claims" },
    { label: "Travel", val: counts.travelRequests, icon: I.plane, href: "/travel" },
    { label: "Documents", val: counts.documents, icon: I.folder, href: "/documents" },
  ];

  return (
    <div>
      <Link href="/clients" className="mb-3 inline-block text-[12.5px] font-semibold text-subtle hover:text-foreground">
        ← Clients
      </Link>

      {/* Record header */}
      <div className="mb-4 flex flex-wrap items-start gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <Avatar name={client.fullName} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">{client.fullName}</h1>
          <div className="mt-0.5 font-mono text-[12.5px] text-muted-foreground">{client.referenceNo}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-[22px] items-center rounded-full border border-slate-soft bg-slate-soft px-2.5 text-[11.5px] font-[650] text-slate">
              {client.clientType}
            </span>
            {client.vipStatus && (
              <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-amber-border bg-amber-soft px-2.5 text-[11.5px] font-[650] text-amber">
                <I.star size={12} /> VIP
              </span>
            )}
            <StatusBadge status={client.status} />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href={`/clients/${id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3.5 text-[13px] font-semibold transition-colors hover:bg-hover"
          >
            <I.edit size={15} /> Edit
          </Link>
          <DeleteClientButton id={id} />
        </div>
      </div>

      {/* Related records */}
      <div className="mb-4 grid grid-cols-6 gap-3 max-[900px]:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          >
            <t.icon size={16} className="text-brand" />
            <span className="text-[20px] font-[760] leading-none tabular-nums">{t.val}</span>
            <span className="text-[12px] font-[550] text-muted-foreground">{t.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4 max-[1100px]:grid-cols-1">
        {/* Left column */}
        <div className="col-span-7 flex flex-col gap-4 max-[1100px]:col-span-1">
          <Card>
            <CardHead iconName="user" title="Contact details" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5 px-[18px] py-4 max-[600px]:grid-cols-1">
              {contactRows.map(([label, val]) => (
                <div key={label}>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-subtle">{label}</dt>
                  <dd className="mt-0.5 text-[13px]">{val || "—"}</dd>
                </div>
              ))}
            </dl>
            {client.notes && (
              <div className="border-t border-border-soft px-[18px] py-4">
                <dt className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-subtle">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-[13px] text-muted-foreground">{client.notes}</dd>
              </div>
            )}
          </Card>

          {/* Dependents */}
          <Card>
            <CardHead iconName="users" title="Dependents" count={dependents.length} />
            <div>
              {dependents.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">No dependents yet.</p>
              )}
              {dependents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-b border-border-soft px-[18px] py-3 last:border-b-0"
                >
                  <Avatar name={d.fullName} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{d.fullName}</div>
                    <div className="text-[11.5px] text-subtle">
                      {[d.relationship, d.dateOfBirth ? fmtDate(d.dateOfBirth) : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <form action={removeDependentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="clientId" value={id} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-[12px] font-semibold text-subtle hover:bg-hover hover:text-red"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <form
              action={addDependentAction}
              className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-end gap-2.5 border-t border-border-soft px-[18px] py-3.5 max-[700px]:grid-cols-1"
            >
              <input type="hidden" name="clientId" value={id} />
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-subtle">Full name</span>
                <input name="fullName" required placeholder="Name" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-subtle">Relationship</span>
                <input name="relationship" placeholder="e.g. Spouse" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-subtle">Date of birth</span>
                <input name="dateOfBirth" type="date" className={inputCls} />
              </label>
              <button
                type="submit"
                className="inline-flex h-[34px] items-center gap-1 rounded-md border border-transparent bg-brand px-3 text-[12.5px] font-semibold text-on-brand hover:bg-brand-hover"
              >
                <I.plus size={14} /> Add
              </button>
            </form>
          </Card>

          {/* Documents */}
          <Card>
            <CardHead iconName="folder" title="Documents" count={documents.length} />
            <div>
              {documents.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">No documents yet.</p>
              )}
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-b border-border-soft px-[18px] py-3 last:border-b-0"
                >
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-surface-3 text-muted-foreground">
                    <I.doc2 size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">{d.name}</div>
                    <div className="text-[11.5px] text-subtle">
                      {[d.documentType, d.visibility].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-hover hover:bg-hover hover:text-brand"
                  >
                    <I.download size={13} /> Download
                  </a>
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-[12px] font-semibold text-subtle hover:bg-hover hover:text-red"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <div className="border-t border-border-soft px-[18px] py-3.5">
              <DocumentUploadForm clientId={id} />
            </div>
          </Card>
        </div>

        {/* Right column — activity timeline */}
        <div className="col-span-5 max-[1100px]:col-span-1">
          <Card>
            <CardHead iconName="clock" title="Activity" count={activity.length} />
            <div className="py-1.5">
              {activity.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">No activity yet.</p>
              )}
              {activity.map((a, idx) => (
                <div key={a.id} className="relative flex gap-3 px-[18px] py-2.5">
                  <div className="relative flex shrink-0 flex-col items-center">
                    <div className="z-10 grid size-[28px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                      <I.clock size={14} />
                    </div>
                    {idx < activity.length - 1 && (
                      <div className="absolute -bottom-[18px] left-1/2 top-[28px] w-0.5 -translate-x-1/2 bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-1.5">
                    <div className="text-[13px] leading-snug">{a.summary}</div>
                    <div className="mt-0.5 text-[11.5px] text-subtle">
                      {[a.actorName, fmtDateTime(a.createdAt)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
