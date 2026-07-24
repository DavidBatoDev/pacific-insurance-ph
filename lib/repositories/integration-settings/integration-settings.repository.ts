import type {
  PacificCrossIntegrationSettings,
  PacificCrossIntegrationSettingsUpdate,
} from "./integration-settings.entity";

/** Repository port for agency-wide external integration configuration. */
export interface IntegrationSettingsRepository {
  getPacificCross(): Promise<PacificCrossIntegrationSettings | null>;
  savePacificCross(
    input: PacificCrossIntegrationSettingsUpdate,
  ): Promise<PacificCrossIntegrationSettings>;
}
