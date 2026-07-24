/** Agency-managed external integration configuration. */
export interface PacificCrossIntegrationSettings {
  id: string;
  portalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PacificCrossIntegrationSettingsUpdate {
  portalUrl: string | null;
}
