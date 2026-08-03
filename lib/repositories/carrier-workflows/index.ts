import type { CarrierWorkflowsRepository } from "./carrier-workflows.repository";
import { SupabaseCarrierWorkflowsRepository } from "./carrier-workflows.repository.supabase";

let instance: CarrierWorkflowsRepository | null = null;
export function getCarrierWorkflowsRepository(): CarrierWorkflowsRepository {
  return instance ??= new SupabaseCarrierWorkflowsRepository();
}

export type { ApplicationDependentInput, CarrierFormAssignmentInput, CarrierFormAssignmentRecord, TravelerInput, TravelerRecord, TravelRequirementInput, TravelRequirementRecord } from "./carrier-workflow.entity";
