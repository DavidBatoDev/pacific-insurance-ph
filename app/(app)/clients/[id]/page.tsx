import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";

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
  // Linked incoming correspondence inherits the client's real server-side ownership boundary.
  const [actor, rawClient] = await Promise.all([getCurrentUser(), getClientsRepository().findById(id)]);
  if (!actor || actor.status !== "Active" || !rawClient || (toAppRole(actor.role) === "agent" && rawClient.assignedUserId !== actor.id)) notFound();
  const [inferenceRows, counts, dependents, documents, timeline, templates, owner, pacificCross, applications, policies] = await Promise.all([
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
  ]);
  const client = applyLeadStatusInference(rawClient, inferenceRows);

  return (
    <ContactProfile
      client={client}
      counts={counts}
      dependents={dependents}
      documents={documents}
      policies={policies}
      timeline={timeline}
      templates={templates}
      userNames={owner ? { [owner.id]: owner.fullName } : {}}
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
