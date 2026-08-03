import type { ApplicationRequirement, ApplicationRequirementStatus, NewApplicationRequirement } from "./application-requirement.entity";

export interface ApplicationRequirementsRepository {
  listByApplication(applicationId: string): Promise<ApplicationRequirement[]>;
  createMany(items: NewApplicationRequirement[]): Promise<ApplicationRequirement[]>;
  updateStatus(id: string, status: ApplicationRequirementStatus): Promise<ApplicationRequirement>;
  updateRequired(id: string, isRequired: boolean): Promise<ApplicationRequirement>;
}
