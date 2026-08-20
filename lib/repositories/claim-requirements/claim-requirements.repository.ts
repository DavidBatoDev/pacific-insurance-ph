import type { ClaimRequirement, ClaimRequirementStatus, NewClaimRequirement } from "./claim-requirement.entity";

export interface ClaimRequirementsRepository {
  listByClaim(claimId: string): Promise<ClaimRequirement[]>;
  createMany(items: NewClaimRequirement[]): Promise<ClaimRequirement[]>;
  updateStatus(id: string, status: ClaimRequirementStatus): Promise<ClaimRequirement>;
  updateRequired(id: string, isRequired: boolean): Promise<ClaimRequirement>;
}
