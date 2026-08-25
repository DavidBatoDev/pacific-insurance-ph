import type {
  PacificCrossIntegrationSettings,
  PacificCrossIntegrationSettingsUpdate,
} from "./integration-settings.entity";

/** Repository port for agency-wide external integration configuration. */
export interface IntegrationSettingsRepository {
  getProposalPortal(): Promise<PacificCrossIntegrationSettings | null>;
  getTravelPortal(): Promise<PacificCrossIntegrationSettings | null>;
  savePortal(
    input: PacificCrossIntegrationSettingsUpdate,
  ): Promise<PacificCrossIntegrationSettings>;
  /** Compatibility name for the proposal-generator integration. */
  getPacificCross(): Promise<PacificCrossIntegrationSettings | null>;
  savePacificCross(
    input: Omit<PacificCrossIntegrationSettingsUpdate, "provider">,
  ): Promise<PacificCrossIntegrationSettings>;
}
