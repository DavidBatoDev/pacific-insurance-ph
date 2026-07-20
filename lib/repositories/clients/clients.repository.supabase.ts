import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError, type ListParams, type Paginated } from "../types";
import type { Client, ClientUpdate, NewClient } from "./client.entity";
import type { ClientsRepository, DuplicateProbe } from "./clients.repository";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
type ClientPatch = Database["public"]["Tables"]["clients"]["Update"];

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(" "),
    dateOfBirth: row.date_of_birth,
    email: row.email,
    mobileNumber: row.mobile_number,
    address: row.address,
    preferredChannel: row.preferred_channel,
    clientType: row.client_type,
    vipStatus: row.vip_status,
    leadSource: row.lead_source,
    assignedUserId: row.assigned_user_id,
    status: row.status,
    notes: row.notes,
    lifecycleStage: row.lifecycle_stage as Client["lifecycleStage"],
    leadStage: row.lead_stage,
    leadStatus: row.lead_status,
    proposalStatus: row.proposal_status,
    productInterest: row.product_interest,
    estPremium: row.est_premium,
    expectedCloseDate: row.expected_close_date,
    nextFollowUpDate: row.next_follow_up_date,
    earlyPayer: row.early_payer,
    doNotContact: row.do_not_contact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link ClientsRepository}. */
export class SupabaseClientsRepository implements ClientsRepository {
  async findById(id: string): Promise<Client | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError("ClientsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(params: ListParams = {}): Promise<Paginated<Client>> {
    const {
      limit = 50,
      offset = 0,
      orderBy = "created_at",
      ascending = false,
    } = params;

    const { data, error, count } = await getSupabaseAdmin()
      .from("clients")
      .select("*", { count: "exact" })
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw toRepositoryError("ClientsRepository.list", error);
    return { rows: (data ?? []).map(toDomain), total: count ?? 0 };
  }

  async listLeads(): Promise<Client[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .select("*")
      .eq("lifecycle_stage", "Lead")
      .order("created_at", { ascending: true });

    if (error) throw toRepositoryError("ClientsRepository.listLeads", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewClient): Promise<Client> {
    // Build the insert payload, omitting undefined columns so DB defaults apply.
    const payload: ClientInsert = {
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: input.dateOfBirth ?? null,
      email: input.email ?? null,
      mobile_number: input.mobileNumber ?? null,
      address: input.address ?? null,
      preferred_channel: input.preferredChannel ?? null,
      lead_source: input.leadSource ?? null,
      assigned_user_id: input.assignedUserId ?? null,
      notes: input.notes ?? null,
    };
    if (input.clientType !== undefined) payload.client_type = input.clientType;
    if (input.vipStatus !== undefined) payload.vip_status = input.vipStatus;
    if (input.status !== undefined) payload.status = input.status;
    if (input.lifecycleStage !== undefined) payload.lifecycle_stage = input.lifecycleStage;
    if (input.leadStage !== undefined) payload.lead_stage = input.leadStage;
    if (input.leadStatus !== undefined) payload.lead_status = input.leadStatus;
    if (input.proposalStatus !== undefined) payload.proposal_status = input.proposalStatus;
    if (input.productInterest !== undefined) payload.product_interest = input.productInterest;
    if (input.estPremium !== undefined) payload.est_premium = input.estPremium;
    if (input.expectedCloseDate !== undefined) payload.expected_close_date = input.expectedCloseDate;
    if (input.nextFollowUpDate !== undefined) payload.next_follow_up_date = input.nextFollowUpDate;

    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw toRepositoryError("ClientsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: ClientUpdate): Promise<Client> {
    const patch: ClientPatch = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName;
    if (input.lastName !== undefined) patch.last_name = input.lastName;
    if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
    if (input.email !== undefined) patch.email = input.email;
    if (input.mobileNumber !== undefined) patch.mobile_number = input.mobileNumber;
    if (input.address !== undefined) patch.address = input.address;
    if (input.preferredChannel !== undefined) patch.preferred_channel = input.preferredChannel;
    if (input.clientType !== undefined) patch.client_type = input.clientType;
    if (input.vipStatus !== undefined) patch.vip_status = input.vipStatus;
    if (input.leadSource !== undefined) patch.lead_source = input.leadSource;
    if (input.assignedUserId !== undefined) patch.assigned_user_id = input.assignedUserId;
    if (input.status !== undefined) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.lifecycleStage !== undefined) patch.lifecycle_stage = input.lifecycleStage;
    if (input.leadStage !== undefined) patch.lead_stage = input.leadStage;
    if (input.leadStatus !== undefined) patch.lead_status = input.leadStatus;
    if (input.proposalStatus !== undefined) patch.proposal_status = input.proposalStatus;
    if (input.productInterest !== undefined) patch.product_interest = input.productInterest;
    if (input.estPremium !== undefined) patch.est_premium = input.estPremium;
    if (input.expectedCloseDate !== undefined) patch.expected_close_date = input.expectedCloseDate;
    if (input.nextFollowUpDate !== undefined) patch.next_follow_up_date = input.nextFollowUpDate;
    if (input.earlyPayer !== undefined) patch.early_payer = input.earlyPayer;
    if (input.doNotContact !== undefined) patch.do_not_contact = input.doNotContact;

    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw toRepositoryError("ClientsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) throw toRepositoryError("ClientsRepository.delete", error);
  }

  async search(query: string, limit = 20): Promise<Client[]> {
    // Strip characters that would break the PostgREST `or` filter grammar.
    const term = query.replace(/[,()%*]/g, " ").trim();
    if (!term) return [];
    const like = `%${term}%`;

    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .select("*")
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},mobile_number.ilike.${like},reference_no.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw toRepositoryError("ClientsRepository.search", error);
    return (data ?? []).map(toDomain);
  }

  async findPotentialDuplicates(input: DuplicateProbe): Promise<Client[]> {
    const found = new Map<string, Client>();

    const orParts: string[] = [];
    if (input.email) orParts.push(`email.eq.${input.email}`);
    if (input.mobileNumber) orParts.push(`mobile_number.eq.${input.mobileNumber}`);

    if (orParts.length) {
      const { data, error } = await getSupabaseAdmin()
        .from("clients")
        .select("*")
        .or(orParts.join(","))
        .limit(10);
      if (error) throw toRepositoryError("ClientsRepository.findPotentialDuplicates", error);
      for (const row of data ?? []) found.set(row.id, toDomain(row));
    }

    if (input.firstName && input.lastName && input.dateOfBirth) {
      const { data, error } = await getSupabaseAdmin()
        .from("clients")
        .select("*")
        .ilike("first_name", input.firstName)
        .ilike("last_name", input.lastName)
        .eq("date_of_birth", input.dateOfBirth)
        .limit(10);
      if (error) throw toRepositoryError("ClientsRepository.findPotentialDuplicates", error);
      for (const row of data ?? []) found.set(row.id, toDomain(row));
    }

    return [...found.values()];
  }
}
