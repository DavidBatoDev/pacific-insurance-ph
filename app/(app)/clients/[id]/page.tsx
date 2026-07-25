import { notFound } from "next/navigation";

import { ContactProfile } from "@/components/hub/screens/contact-profile";
import { getClientRelatedCounts } from "@/lib/queries/client-summary";
import { getContactTimeline } from "@/lib/queries/contact-timeline";
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
 * same record, only the lifecycle stage changes). Design contact-profile.jsx.
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
  const client = await getClientsRepository().findById(id);
  if (!client) notFound();

  const [counts, dependents, documents, timeline, templates, users, pacificCross, applications] = await Promise.all([
    getClientRelatedCounts(id),
    getDependentsRepository().listByClient(id),
    getDocumentsRepository().listByClient(id),
    getContactTimeline(id),
    getTemplatesRepository().list(true),
    getUsersRepository().list({ limit: 50 }),
    getIntegrationSettingsRepository().getPacificCross(),
    getApplicationsRepository().listByClient(id),
  ]);

  return (
    <ContactProfile
      client={client}
      counts={counts}
      dependents={dependents}
      documents={documents}
      timeline={timeline}
      templates={templates}
      userNames={Object.fromEntries(users.rows.map((u) => [u.id, u.fullName]))}
      pacificCrossPortalUrl={pacificCross?.portalUrl ?? null}
      origin={from === "prospects" || client.lifecycleStage === "Lead" ? "prospects" : "clients"}
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
