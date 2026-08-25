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
  const actor = await getCurrentUser();
  const canManageLibrary = !!actor && toAppRole(actor.role) === "admin";
  const [{ rows }, channels, proposalPortal, travelPortal, contacts, libraryDocuments, productVersions] = await Promise.all([
    getUsersRepository().list({ limit: 50 }),
    getPaymentChannelsRepository().list(),
    getIntegrationSettingsRepository().getProposalPortal(),
    getIntegrationSettingsRepository().getTravelPortal(),
    getExternalContactsRepository().list(),
    canManageLibrary ? getDocumentLibraryRepository().list() : Promise.resolve([]),
    canManageLibrary ? getProductsRepository().listVersions() : Promise.resolve([]),
  ]);
  return <SettingsLive users={rows} channels={channels} proposalPortal={proposalPortal} travelPortal={travelPortal} contacts={contacts} libraryDocuments={libraryDocuments} productVersions={productVersions} canManageLibrary={canManageLibrary} />;
}
