import type { ApplicationRequirementsRepository } from "./application-requirements.repository";
import { SupabaseApplicationRequirementsRepository } from "./application-requirements.repository.supabase";

let instance: ApplicationRequirementsRepository | null = null;

export function getApplicationRequirementsRepository(): ApplicationRequirementsRepository {
  if (!instance) instance = new SupabaseApplicationRequirementsRepository();
  return instance;
}

export type { ApplicationRequirementsRepository } from "./application-requirements.repository";
export type {
  ApplicationRequirement,
  ApplicationRequirementStatus,
  NewApplicationRequirement,
  RequirementPhase,
} from "./application-requirement.entity";
export { APPLICATION_REQUIREMENT_STATUSES, REQUIREMENT_PHASES } from "./application-requirement.entity";
