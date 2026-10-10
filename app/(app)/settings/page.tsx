import { SettingsLive } from "@/components/hub/screens/settings-live";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import { getCommissionRatesRepository } from "@/lib/repositories/commission-rates";
import { getUsersRepository } from "@/lib/repositories/users";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getProductsRepository } from "@/lib/repositories/products";
import { getRenewalAutomationRepository } from "@/lib/repositories/renewal-automation";
import { getTemplatesRepository } from "@/lib/repositories/templates";

export const dynamic = "force-dynamic";

/** Settings — role-scoped workspace configuration. */
export default async function Page() {
  const roleScopedPromise = getCurrentUser().then(async (actor) => {
    const role = actor ? toAppRole(actor.role) : "agent";
    const canManageLibrary = role === "admin";
    const canViewRenewalRules = role !== "agent";
    const [libraryDocuments, productVersions, renewalRules, renewalTemplates] = await Promise.all([
      canManageLibrary ? getDocumentLibraryRepository().list() : [],
      canManageLibrary ? getProductsRepository().listVersions() : [],
      canViewRenewalRules ? getRenewalAutomationRepository().listRules() : [],
      // Include stale assignments as well as Email templates for rule review.
      canViewRenewalRules ? getTemplatesRepository().list() : [],
    ]);
    const visibleTemplates = renewalTemplates.filter((template) =>
      template.channel === "Email" || renewalRules.some((rule) => rule.templateId === template.id),
    );
    return { canManageLibrary, libraryDocuments, productVersions, canViewRenewalRules, renewalRules, renewalTemplates: visibleTemplates };
  });
  const [{ rows }, channels, proposalPortal, travelPortal, contacts, commissionRates, roleScoped] = await Promise.all([
    getUsersRepository().list({ limit: 50 }),
    getPaymentChannelsRepository().list(),
    getIntegrationSettingsRepository().getProposalPortal(),
    getIntegrationSettingsRepository().getTravelPortal(),
    getExternalContactsRepository().list(),
    getCommissionRatesRepository().listAll(),
    roleScopedPromise,
  ]);
  return <SettingsLive users={rows} channels={channels} proposalPortal={proposalPortal} travelPortal={travelPortal} contacts={contacts} commissionRates={commissionRates} {...roleScoped} />;
}
