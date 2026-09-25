import { SettingsLive } from "@/components/hub/screens/settings-live";
import { getIntegrationSettingsRepository } from "@/lib/repositories/integration-settings";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getPaymentChannelsRepository } from "@/lib/repositories/payment-channels";
import { getUsersRepository } from "@/lib/repositories/users";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getProductsRepository } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

/** Settings — 6-tab configuration; Team + Payment Channels are wired. */
export default async function Page() {
  const libraryPromise = getCurrentUser().then(async (actor) => {
    const canManageLibrary = !!actor && toAppRole(actor.role) === "admin";
    const [libraryDocuments, productVersions] = canManageLibrary
      ? await Promise.all([getDocumentLibraryRepository().list(), getProductsRepository().listVersions()])
      : [[], []];
    return { canManageLibrary, libraryDocuments, productVersions };
  });
  const [{ rows }, channels, proposalPortal, travelPortal, contacts, { canManageLibrary, libraryDocuments, productVersions }] = await Promise.all([
    getUsersRepository().list({ limit: 50 }),
    getPaymentChannelsRepository().list(),
    getIntegrationSettingsRepository().getProposalPortal(),
    getIntegrationSettingsRepository().getTravelPortal(),
    getExternalContactsRepository().list(),
    libraryPromise,
  ]);
  return <SettingsLive users={rows} channels={channels} proposalPortal={proposalPortal} travelPortal={travelPortal} contacts={contacts} libraryDocuments={libraryDocuments} productVersions={productVersions} canManageLibrary={canManageLibrary} />;
}
