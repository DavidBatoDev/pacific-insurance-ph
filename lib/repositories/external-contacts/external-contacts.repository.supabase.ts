import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type { ExternalContact, ExternalContactUpdate, NewExternalContact } from "./external-contact.entity";
import type { ExternalContactFilters, ExternalContactsRepository } from "./external-contacts.repository";

type Row = Database["public"]["Tables"]["external_contacts"]["Row"];

const toDomain = (row: Row): ExternalContact => ({
  id: row.id, name: row.name, organization: row.organization, role: row.role,
  contactType: row.contact_type, department: row.department, email: row.email,
  phone: row.phone, status: row.status as ExternalContact["status"],
  effectiveDate: row.effective_date, endDate: row.end_date,
  lastVerifiedDate: row.last_verified_date, replacementContactId: row.replacement_contact_id,
  notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at,
});

const toRow = (input: NewExternalContact | ExternalContactUpdate) => ({
  ...(input.name !== undefined ? { name: input.name } : {}),
  ...(input.organization !== undefined ? { organization: input.organization } : {}),
  ...(input.role !== undefined ? { role: input.role } : {}),
  ...(input.contactType !== undefined ? { contact_type: input.contactType } : {}),
  ...(input.department !== undefined ? { department: input.department } : {}),
  ...(input.email !== undefined ? { email: input.email } : {}),
  ...(input.phone !== undefined ? { phone: input.phone } : {}),
  ...(input.status !== undefined ? { status: input.status } : {}),
  ...(input.effectiveDate !== undefined ? { effective_date: input.effectiveDate } : {}),
  ...(input.endDate !== undefined ? { end_date: input.endDate } : {}),
  ...(input.lastVerifiedDate !== undefined ? { last_verified_date: input.lastVerifiedDate } : {}),
  ...(input.replacementContactId !== undefined ? { replacement_contact_id: input.replacementContactId } : {}),
  ...(input.notes !== undefined ? { notes: input.notes } : {}),
});

export class SupabaseExternalContactsRepository implements ExternalContactsRepository {
  async findById(id: string) {
    const { data, error } = await getSupabaseAdmin().from("external_contacts").select("*").eq("id", id).maybeSingle();
    if (error) throw toRepositoryError("ExternalContactsRepository.findById", error);
    return data ? toDomain(data) : null;
  }
  async list(filters: ExternalContactFilters = {}) {
    let query = getSupabaseAdmin().from("external_contacts").select("*");
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.contactTypes?.length) query = query.in("contact_type", filters.contactTypes);
    if (filters.departments?.length) query = query.in("department", filters.departments);
    const { data, error } = await query.order("department").order("name");
    if (error) throw toRepositoryError("ExternalContactsRepository.list", error);
    return (data ?? []).map(toDomain);
  }
  async create(input: NewExternalContact) {
    const { data, error } = await getSupabaseAdmin().from("external_contacts").insert(toRow(input) as Database["public"]["Tables"]["external_contacts"]["Insert"]).select("*").single();
    if (error) throw toRepositoryError("ExternalContactsRepository.create", error);
    return toDomain(data);
  }
  async update(id: string, input: ExternalContactUpdate) {
    const { data, error } = await getSupabaseAdmin().from("external_contacts").update(toRow(input)).eq("id", id).select("*").single();
    if (error) throw toRepositoryError("ExternalContactsRepository.update", error);
    return toDomain(data);
  }
}
