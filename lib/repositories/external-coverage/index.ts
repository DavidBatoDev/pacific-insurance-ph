import type { ExternalCoverageRepository } from "./external-coverage.repository";
import { SupabaseExternalCoverageRepository } from "./external-coverage.repository.supabase";

let instance: ExternalCoverageRepository | null = null;

export function getExternalCoverageRepository(): ExternalCoverageRepository {
  if (!instance) instance = new SupabaseExternalCoverageRepository();
  return instance;
}

export type { ExternalCoverageRepository } from "./external-coverage.repository";
export type {
  ExternalCoverage,
  ExternalCoverageStatus,
  ExternalCoverageType,
  ExternalCoverageUpdate,
  NewExternalCoverage,
} from "./external-coverage.entity";
export { EXTERNAL_COVERAGE_STATUSES, EXTERNAL_COVERAGE_TYPES } from "./external-coverage.entity";
