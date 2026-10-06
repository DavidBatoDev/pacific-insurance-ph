"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { attachPolicyPdfAction } from "@/app/(app)/policies/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { fmtDate, peso } from "@/lib/format";
import type { Policy } from "@/lib/repositories/policies";
import { I } from "../../icons";
import { EditPolicyDrawer } from "../../overlays/edit-policy";
import { useOverlays } from "../../overlays/overlay-provider";
import { Card, CardHead, StatusBadge } from "../../primitives";
import type { Doc } from "./records-cards";

/**
 * The client's policies with their filed copies (TO-BE-UPDATE-PLAN.md H1c / H4a): carrier policy
 * number, product and plan, term and status, an Edit action for corrections, and the policy
 * PDF — opened in one click, or attached here when it was logged without one.
 */
export function PoliciesCard({ policies, documents }: { policies: Policy[]; documents: Doc[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [editing, setEditing] = useState<Policy | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHead iconName="shield" title="Policies" count={policies.length} />
      {policies.length === 0 && <p className="px-[18px] py-3 text-[12.5px] text-subtle">No policies logged yet.</p>}
      {policies.map((policy) => {
        const pdf = documents.find((d) => d.policyId === policy.id && d.status !== "Replaced");
        const term = [policy.effectiveDate, policy.expiryDate].some(Boolean)
          ? `${fmtDate(policy.effectiveDate)} – ${fmtDate(policy.expiryDate)}`
          : null;
        return (
          <div key={policy.id} className="border-b border-border-soft px-[18px] py-2.5 last:border-0">
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {policy.policyNumber ? (
                    <span className="truncate font-mono text-[12.5px] font-semibold">{policy.policyNumber}</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-amber">No policy number</span>
                  )}
                  <StatusBadge status={policy.status} />
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                  {[policy.productName, policy.planName].filter(Boolean).join(" · ") || "Product not set"}
                </div>
                <div className="mt-0.5 text-[11px] text-subtle">
                  {[
                    policy.paymentMode,
                    policy.premiumAmount != null ? (policy.currency && policy.currency !== "PHP" ? `${policy.currency} ${policy.premiumAmount.toLocaleString()}` : peso(policy.premiumAmount)) : null,
                    term,
                    policy.referenceNo,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              {pdf ? (
                <a
                  href={`/api/documents/${pdf.id}/download`}
                  title={pdf.name}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-brand-hover hover:bg-hover"
                >
                  <I.download size={13} /> PDF
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setAttachingId((id) => (id === policy.id ? null : policy.id))}
                  className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-hover"
                >
                  {attachingId === policy.id ? "Cancel" : "Attach PDF"}
                </button>
              )}
              <button
                type="button"
                aria-label={`Edit policy ${policy.policyNumber ?? policy.referenceNo ?? ""}`}
                onClick={() => setEditing(policy)}
                className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-hover"
              >
                Edit
              </button>
            </div>
            {attachingId === policy.id && !pdf && (
              <div className="mt-2">
                <PdfUpload
                  clientId={policy.clientId}
                  prompt="Drop the policy PDF here. Remove the carrier password first."
                  onUploaded={async (path, fileName) => {
                    const res = await attachPolicyPdfAction(policy.id, path, fileName);
                    if (res.ok) {
                      overlays.toast("Policy copy attached", fileName);
                      setAttachingId(null);
                      router.refresh();
                    }
                    return res;
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      {editing && <EditPolicyDrawer policy={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
