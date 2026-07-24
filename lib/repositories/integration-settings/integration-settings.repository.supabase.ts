import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  PacificCrossIntegrationSettings,
  PacificCrossIntegrationSettingsUpdate,
} from "./integration-settings.entity";
import type { IntegrationSettingsRepository } from "./integration-settings.repository";

type IntegrationSettingsRow = Database["public"]["Tables"]["integration_settings"]["Row"];

function toPacificCrossDomain(row: IntegrationSettingsRow): PacificCrossIntegrationSettings {
  return {
    id: row.id,
    portalUrl: row.portal_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link IntegrationSettingsRepository}. */
export class SupabaseIntegrationSettingsRepository implements IntegrationSettingsRepository {
  async getPacificCross(): Promise<PacificCrossIntegrationSettings | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .select("*")
      .eq("provider", "pacific_cross")
      .maybeSingle();
    // Keep Settings and lead profiles usable until this optional integration
    // migration has been applied to an environment.
    if (error?.code === "PGRST205") return null;
    if (error) throw toRepositoryError("IntegrationSettingsRepository.getPacificCross", error);
    return data ? toPacificCrossDomain(data) : null;
  }

  async savePacificCross(
    input: PacificCrossIntegrationSettingsUpdate,
  ): Promise<PacificCrossIntegrationSettings> {
    const { data, error } = await getSupabaseAdmin()
      .from("integration_settings")
      .upsert({ provider: "pacific_cross", portal_url: input.portalUrl }, { onConflict: "provider" })
      .select("*")
      .single();
    if (error) throw toRepositoryError("IntegrationSettingsRepository.savePacificCross", error);
    return toPacificCrossDomain(data);
  }
}
