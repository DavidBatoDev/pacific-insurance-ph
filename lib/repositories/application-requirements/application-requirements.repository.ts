import type { ApplicationRequirement, ApplicationRequirementStatus, NewApplicationRequirement, RequirementPhase } from "./application-requirement.entity";

export interface ApplicationRequirementsRepository {
  listByApplication(applicationId: string): Promise<ApplicationRequirement[]>;
  createMany(items: NewApplicationRequirement[]): Promise<ApplicationRequirement[]>;
  updateStatus(id: string, status: ApplicationRequirementStatus): Promise<ApplicationRequirement>;
  updateRequired(id: string, isRequired: boolean): Promise<ApplicationRequirement>;
  /** Flip every item in one phase to required — used when a group accepts the proposal. */
  activatePhase(applicationId: string, phase: RequirementPhase): Promise<ApplicationRequirement[]>;
}
