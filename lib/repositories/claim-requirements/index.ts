import type { ClaimRequirementsRepository } from "./claim-requirements.repository";
import { SupabaseClaimRequirementsRepository } from "./claim-requirements.repository.supabase";

let instance: ClaimRequirementsRepository | null = null;

export function getClaimRequirementsRepository(): ClaimRequirementsRepository {
  if (!instance) instance = new SupabaseClaimRequirementsRepository();
  return instance;
}

export type { ClaimRequirementsRepository } from "./claim-requirements.repository";
export type {
  ClaimRequirement,
  ClaimRequirementStatus,
  NewClaimRequirement,
  ClaimChecklistType,
} from "./claim-requirement.entity";
export { CLAIM_REQUIREMENT_STATUSES, CLAIM_CHECKLIST_TYPES } from "./claim-requirement.entity";
