import type { ApplicationDependentInput, CarrierFormAssignmentInput, CarrierFormAssignmentRecord, TravelerInput, TravelerRecord, TravelRequirementInput, TravelRequirementRecord } from "./carrier-workflow.entity";

export interface CarrierWorkflowsRepository {
  saveApplicationDependents(applicationId: string, clientId: string, people: ApplicationDependentInput[]): Promise<Array<ApplicationDependentInput & { id: string }>>;
  replaceApplicationCarrierForms(applicationId: string, assignments: CarrierFormAssignmentInput[]): Promise<void>;
  listApplicationCarrierForms(applicationId: string): Promise<CarrierFormAssignmentRecord[]>;
  replaceTravelers(travelRequestId: string, travelers: TravelerInput[]): Promise<void>;
  replaceTravelRequirements(travelRequestId: string, requirements: TravelRequirementInput[]): Promise<void>;
  listTravelers(travelRequestId: string): Promise<TravelerRecord[]>;
  listTravelRequirements(travelRequestId: string): Promise<TravelRequirementRecord[]>;
  updateTravelRequirement(id: string, status: TravelRequirementRecord["status"]): Promise<void>;
}
