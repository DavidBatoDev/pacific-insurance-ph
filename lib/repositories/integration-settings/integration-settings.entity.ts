export const INTEGRATION_PROVIDERS = ["pacific_cross_proposal", "pacific_cross_travel"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

/** Agency-managed external portal configuration. Credentials deliberately live elsewhere. */
export interface PacificCrossIntegrationSettings {
  id: string;
  provider: IntegrationProvider;
  portalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PacificCrossIntegrationSettingsUpdate {
  provider: IntegrationProvider;
  portalUrl: string | null;
}
