import type { IntegrationSettingsRepository } from "./integration-settings.repository";
import { SupabaseIntegrationSettingsRepository } from "./integration-settings.repository.supabase";

let instance: IntegrationSettingsRepository | null = null;

/** Resolve the agency-wide integration settings repository. */
export function getIntegrationSettingsRepository(): IntegrationSettingsRepository {
  if (!instance) instance = new SupabaseIntegrationSettingsRepository();
  return instance;
}

export type { IntegrationSettingsRepository } from "./integration-settings.repository";
export type {
  IntegrationProvider,
  PacificCrossIntegrationSettings,
  PacificCrossIntegrationSettingsUpdate,
} from "./integration-settings.entity";
export { INTEGRATION_PROVIDERS } from "./integration-settings.entity";
