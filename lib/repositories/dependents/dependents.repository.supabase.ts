import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { Dependent, DependentUpdate, NewDependent } from "./dependent.entity";
import type { DependentsRepository } from "./dependents.repository";

type DependentRow = Database["public"]["Tables"]["dependents"]["Row"];
type DependentPatch = Database["public"]["Tables"]["dependents"]["Update"];

function toDomain(row: DependentRow): Dependent {
  return {
    id: row.id,
    primaryClientId: row.primary_client_id,
    policyId: row.policy_id,
    fullName: row.full_name,
    relationship: row.relationship,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    email: row.email,
    mobileNumber: row.mobile_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link DependentsRepository}. */
export class SupabaseDependentsRepository implements DependentsRepository {
  async listByClient(clientId: string): Promise<Dependent[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("dependents")
      .select("*")
      .eq("primary_client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) throw toRepositoryError("DependentsRepository.listByClient", error);
    return (data ?? []).map(toDomain);
  }

  async findById(id: string): Promise<Dependent | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("dependents")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError("DependentsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async create(input: NewDependent): Promise<Dependent> {
    const { data, error } = await getSupabaseAdmin()
      .from("dependents")
      .insert({
        primary_client_id: input.primaryClientId,
        full_name: input.fullName,
        relationship: input.relationship ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        email: input.email ?? null,
        mobile_number: input.mobileNumber ?? null,
        notes: input.notes ?? null,
        policy_id: input.policyId ?? null,
      })
      .select("*")
      .single();

    if (error) throw toRepositoryError("DependentsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: DependentUpdate): Promise<Dependent> {
    const patch: DependentPatch = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.relationship !== undefined) patch.relationship = input.relationship;
    if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
    if (input.gender !== undefined) patch.gender = input.gender;
    if (input.email !== undefined) patch.email = input.email;
    if (input.mobileNumber !== undefined) patch.mobile_number = input.mobileNumber;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.policyId !== undefined) patch.policy_id = input.policyId;

    const { data, error } = await getSupabaseAdmin()
      .from("dependents")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw toRepositoryError("DependentsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("dependents")
      .delete()
      .eq("id", id);

    if (error) throw toRepositoryError("DependentsRepository.delete", error);
  }
}
