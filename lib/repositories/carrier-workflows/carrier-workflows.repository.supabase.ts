import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { toRepositoryError } from "../types";
import type { ApplicationDependentInput, CarrierFormAssignmentInput, CarrierFormAssignmentRecord, TravelerInput, TravelerRecord, TravelRequirementInput, TravelRequirementRecord } from "./carrier-workflow.entity";
import type { CarrierWorkflowsRepository } from "./carrier-workflows.repository";

export class SupabaseCarrierWorkflowsRepository implements CarrierWorkflowsRepository {
  async listApplicationCarrierForms(applicationId: string): Promise<CarrierFormAssignmentRecord[]> {
    const { data, error } = await getSupabaseAdmin().from("application_carrier_forms").select("*").eq("application_id", applicationId).order("created_at");
    if (error) throw toRepositoryError("CarrierWorkflows.listApplicationCarrierForms", error);
    return (data ?? []).map((row) => ({ id: row.id, applicationId: row.application_id, dependentId: row.dependent_id, personName: row.person_name_snapshot, variant: row.form_variant, ageBand: row.age_band as CarrierFormAssignmentRecord["ageBand"], documentLibraryId: row.document_library_id, matchStatus: row.match_status as CarrierFormAssignmentRecord["matchStatus"] }));
  }

  async listTravelers(travelRequestId: string): Promise<TravelerRecord[]> {
    const { data, error } = await getSupabaseAdmin().from("travelers").select("*").eq("travel_request_id", travelRequestId).order("sort_order");
    if (error) throw toRepositoryError("CarrierWorkflows.listTravelers", error);
    return (data ?? []).map((row) => ({ id: row.id, travelRequestId: row.travel_request_id, fullName: row.full_name, dateOfBirth: row.date_of_birth, nationality: row.nationality, gender: row.gender, contactNumber: row.contact_number, idType: row.id_type, idNumber: row.id_number, planOptionId: row.plan_option_id, beneficiaryName: row.beneficiary_name, beneficiaryBirthdate: row.beneficiary_birthdate, beneficiaryRelation: row.beneficiary_relation, beneficiaryContact: row.beneficiary_contact, sortOrder: row.sort_order }));
  }

  async listTravelRequirements(travelRequestId: string): Promise<TravelRequirementRecord[]> {
    const { data, error } = await getSupabaseAdmin().from("travel_request_requirements").select("*").eq("travel_request_id", travelRequestId).order("sort_order");
    if (error) throw toRepositoryError("CarrierWorkflows.listTravelRequirements", error);
    return (data ?? []).map((row) => ({ id: row.id, travelRequestId: row.travel_request_id, documentName: row.document_name, appliesTo: row.applies_to, notes: row.notes, isRequired: row.is_required, sortOrder: row.sort_order, status: row.status as TravelRequirementRecord["status"] }));
  }

  async updateTravelRequirement(id: string, status: TravelRequirementRecord["status"]) {
    const { error } = await getSupabaseAdmin().from("travel_request_requirements").update({ status }).eq("id", id);
    if (error) throw toRepositoryError("CarrierWorkflows.updateTravelRequirement", error);
  }

  async saveApplicationDependents(applicationId: string, clientId: string, people: ApplicationDependentInput[]) {
    const db = getSupabaseAdmin();
    const saved: Array<ApplicationDependentInput & { id: string }> = [];
    for (const person of people.filter((item) => item.name.trim())) {
      let id = person.id ?? null;
      if (id) {
        const { error } = await db.from("dependents").update({
          full_name: person.name.trim(), relationship: person.relationship ?? null,
          date_of_birth: person.dateOfBirth ?? null, email: person.email ?? null,
        }).eq("id", id).eq("primary_client_id", clientId);
        if (error) throw toRepositoryError("CarrierWorkflows.saveApplicationDependents.update", error);
      } else {
        const { data, error } = await db.from("dependents").insert({
          primary_client_id: clientId, full_name: person.name.trim(),
          relationship: person.relationship ?? null, date_of_birth: person.dateOfBirth ?? null,
          email: person.email ?? null,
        }).select("id").single();
        if (error) throw toRepositoryError("CarrierWorkflows.saveApplicationDependents.create", error);
        id = data.id;
      }
      const { error: linkError } = await db.from("application_dependents").upsert({
        application_id: applicationId, dependent_id: id,
        pre_existing_status: person.preExistingStatus ?? null,
        medical_notes: person.medicalNotes ?? null,
        smoker_status: person.smokerStatus || null,
        height_inches: person.heightInches ?? null,
        weight_lbs: person.weightLbs ?? null,
      });
      if (linkError) throw toRepositoryError("CarrierWorkflows.saveApplicationDependents.link", linkError);
      saved.push({ ...person, id });
    }
    return saved;
  }

  async replaceApplicationCarrierForms(applicationId: string, assignments: CarrierFormAssignmentInput[]) {
    const db = getSupabaseAdmin();
    const { error: deleteError } = await db.from("application_carrier_forms").delete().eq("application_id", applicationId);
    if (deleteError) throw toRepositoryError("CarrierWorkflows.replaceApplicationCarrierForms.delete", deleteError);
    if (!assignments.length) return;
    const { error } = await db.from("application_carrier_forms").insert(assignments.map((item) => ({
      application_id: applicationId, dependent_id: item.dependentId ?? null,
      person_name_snapshot: item.personName, form_variant: item.variant ?? null,
      age_band: item.ageBand, document_library_id: item.documentLibraryId ?? null,
      match_status: item.matchStatus,
    })));
    if (error) throw toRepositoryError("CarrierWorkflows.replaceApplicationCarrierForms", error);
  }

  async replaceTravelers(travelRequestId: string, travelers: TravelerInput[]) {
    const db = getSupabaseAdmin();
    const { error: deleteError } = await db.from("travelers").delete().eq("travel_request_id", travelRequestId);
    if (deleteError) throw toRepositoryError("CarrierWorkflows.replaceTravelers.delete", deleteError);
    if (!travelers.length) return;
    const { error } = await db.from("travelers").insert(travelers.map((item, index) => ({
      travel_request_id: travelRequestId, full_name: item.fullName.trim(),
      date_of_birth: item.dateOfBirth ?? null, nationality: item.nationality ?? null,
      gender: item.gender ?? null, contact_number: item.contactNumber ?? null,
      id_type: item.idType ?? null, id_number: item.idNumber ?? null,
      plan_option_id: item.planOptionId ?? null, beneficiary_name: item.beneficiaryName ?? null,
      beneficiary_birthdate: item.beneficiaryBirthdate ?? null,
      beneficiary_relation: item.beneficiaryRelation ?? null,
      beneficiary_contact: item.beneficiaryContact ?? null, sort_order: index,
    })));
    if (error) throw toRepositoryError("CarrierWorkflows.replaceTravelers", error);
  }

  async replaceTravelRequirements(travelRequestId: string, requirements: TravelRequirementInput[]) {
    const db = getSupabaseAdmin();
    const { error: deleteError } = await db.from("travel_request_requirements").delete().eq("travel_request_id", travelRequestId);
    if (deleteError) throw toRepositoryError("CarrierWorkflows.replaceTravelRequirements.delete", deleteError);
    if (!requirements.length) return;
    const { error } = await db.from("travel_request_requirements").insert(requirements.map((item, index) => ({
      travel_request_id: travelRequestId, document_name: item.documentName,
      applies_to: item.appliesTo ?? null, notes: item.notes ?? null,
      is_required: item.isRequired ?? true, sort_order: item.sortOrder ?? index * 10,
    })));
    if (error) throw toRepositoryError("CarrierWorkflows.replaceTravelRequirements", error);
  }
}
