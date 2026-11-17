import { notFound } from "next/navigation";
import { assertRecordAccess } from "@/lib/auth/agent-scope";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { STAFF_ROLE_LABELS } from "@/lib/auth/staff-email";
import { filterCommissionVoucherDocuments } from "@/lib/commissions/access";
import { isCommissionVoucher } from "@/lib/commissions/voucher";

import { ContactProfile } from "@/components/hub/screens/contact-profile";
import { getClientRelatedCounts } from "@/lib/queries/client-summary";
import { getContactTimeline } from "@/lib/queries/contact-timeline";
import { applyLeadStatusInference, leadInferenceCommunications } from "@/lib/queries/lead-status-inference";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getDependentsRepository } from "@/lib/repositories/dependents";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { getPoliciesRepository } from "@/lib/repositories/policies";
import { getTemplatesRepository } from "@/lib/repositories/templates";
import { getUsersRepository } from "@/lib/repositories/users";

export const dynamic = "force-dynamic";

/**
 * Contact Profile — the unified record view for one contact (lead or client;
 * same record, only the lifecycle stage changes).
 */
export default async function ContactProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  // Agents only open their own book (Phase J9); linked incoming correspondence inherits this boundary.
  await assertRecordAccess("client", id).catch(() => notFound());
  const [actor, rawClient] = await Promise.all([getCurrentUser(), getClientsRepository().findById(id)]);
  if (!actor || actor.status !== "Active" || !rawClient) notFound();
  const [inferenceRows, counts, dependents, documents, timeline, templates, owner, pacificCross, applications, policies, team] = await Promise.all([
    leadInferenceCommunications(id),
    getClientRelatedCounts(id),
    getDependentsRepository().listByClient(id),
    getDocumentsRepository().listByClient(id),
    getContactTimeline(id),
    getTemplatesRepository().list(true),
    getUsersRepository().findAssigneeOfClient(id),
    getIntegrationSettingsRepository().getProposalPortal(),
    getApplicationsRepository().listByClient(id),
    getPoliciesRepository().listByClient(id),
    // Only a real Admin may reassign (permissions.md); nobody else receives the team list.
    toAppRole(actor.role) === "admin" ? getUsersRepository().list({ limit: 200, orderBy: "full_name", ascending: true }) : Promise.resolve(null),
  ]);
  const agentOptions = team
    ? team.rows.filter((user) => user.status === "Active").map((user) => ({ id: user.id, label: `${user.fullName} · ${STAFF_ROLE_LABELS[user.role] ?? user.role}` }))
    : null;
  const client = applyLeadStatusInference(rawClient, inferenceRows);
  const visibleDocuments = (await filterCommissionVoucherDocuments(documents, actor))
    .map((doc) => isCommissionVoucher(doc) ? { ...doc, filePath: null } : doc);

  return (
    <ContactProfile
      client={client}
      counts={counts}
      dependents={dependents}
      documents={visibleDocuments}
      policies={policies}
      timeline={timeline}
      templates={templates}
      userNames={owner ? { [owner.id]: owner.fullName } : {}}
      agentOptions={agentOptions}
      pacificCrossPortalUrl={pacificCross?.portalUrl ?? null}
      origin={from === "prospects" || client.lifecycleStage === "Lead" ? "prospects" : "clients"}
      applications={applications.filter((application) => application.status !== "Lead")}
      draftApplications={applications.filter(
        (application) =>
          application.status === "Lead" &&
          !!application.wizardState &&
          typeof application.wizardState === "object" &&
          !Array.isArray(application.wizardState),
      )}
    />
  );
}
