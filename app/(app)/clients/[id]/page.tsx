import { notFound } from "next/navigation";

import { ContactProfile } from "@/components/hub/screens/contact-profile";
import { getClientRelatedCounts } from "@/lib/queries/client-summary";
import { getContactTimeline } from "@/lib/queries/contact-timeline";
import { applyLeadStatusInference, leadInferenceCommunications } from "@/lib/queries/lead-status-inference";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getDependentsRepository } from "@/lib/repositories/dependents";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
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
  // Everything keys off `id` alone, so it all runs in one round; a missing client just discards the rest.
  const [rawClient, inferenceRows, counts, dependents, documents, timeline, templates, owner, pacificCross, applications] = await Promise.all([
    getClientsRepository().findById(id),
    leadInferenceCommunications(id),
    getClientRelatedCounts(id),
    getDependentsRepository().listByClient(id),
    getDocumentsRepository().listByClient(id),
    getContactTimeline(id),
    getTemplatesRepository().list(true),
    getUsersRepository().findAssigneeOfClient(id),
    getIntegrationSettingsRepository().getProposalPortal(),
    getApplicationsRepository().listByClient(id),
  ]);
  if (!rawClient) notFound();
  const client = applyLeadStatusInference(rawClient, inferenceRows);

  return (
    <ContactProfile
      client={client}
      counts={counts}
      dependents={dependents}
      documents={documents}
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
