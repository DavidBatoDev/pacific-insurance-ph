import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  IntegrationProvider,
  PacificCrossIntegrationSettings,
  PacificCrossIntegrationSettingsUpdate,
} from "./integration-settings.entity";
import type { IntegrationSettingsRepository } from "./integration-settings.repository";

type IntegrationSettingsRow = Database["public"]["Tables"]["integration_settings"]["Row"];

function toPacificCrossDomain(row: IntegrationSettingsRow): PacificCrossIntegrationSettings {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    portalUrl: row.portal_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link IntegrationSettingsRepository}. */
export class SupabaseIntegrationSettingsRepository implements IntegrationSettingsRepository {
  private async getProvider(provider: IntegrationProvider): Promise<PacificCrossIntegrationSettings | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .select("*")
      .eq("provider", provider)
      .maybeSingle();
    // Keep Settings and lead profiles usable until this optional integration
    // migration has been applied to an environment.
    if (error?.code === "PGRST205") return null;
    if (error) throw toRepositoryError("IntegrationSettingsRepository.getPacificCross", error);
    return data ? toPacificCrossDomain(data) : null;
  }

  async getProposalPortal(): Promise<PacificCrossIntegrationSettings | null> {
    const current = await this.getProvider("pacific_cross_proposal");
    if (current) return current;
    // Rolling-deploy compatibility with migration 0020's original provider key.
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .select("*")
      .eq("provider", "pacific_cross")
      .maybeSingle();
    if (error?.code === "PGRST205") return null;
    if (error) throw toRepositoryError("IntegrationSettingsRepository.getProposalPortal", error);
    return data ? { ...toPacificCrossDomain(data), provider: "pacific_cross_proposal" } : null;
  }

  getTravelPortal(): Promise<PacificCrossIntegrationSettings | null> {
    return this.getProvider("pacific_cross_travel");
  }

  getPacificCross(): Promise<PacificCrossIntegrationSettings | null> {
    return this.getProposalPortal();
  }

  async savePortal(
    input: PacificCrossIntegrationSettingsUpdate,
  ): Promise<PacificCrossIntegrationSettings> {
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .upsert({ provider: input.provider, portal_url: input.portalUrl }, { onConflict: "provider" })
      .select("*")
      .single();
    if (error) throw toRepositoryError("IntegrationSettingsRepository.savePacificCross", error);
    return toPacificCrossDomain(data);
  }

  savePacificCross(
    input: Omit<PacificCrossIntegrationSettingsUpdate, "provider">,
  ): Promise<PacificCrossIntegrationSettings> {
    return this.savePortal({ provider: "pacific_cross_proposal", ...input });
  }
}
