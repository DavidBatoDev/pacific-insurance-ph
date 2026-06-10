import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError, type ListParams, type Paginated } from "../types";
import type { Client, ClientUpdate, NewClient } from "./client.entity";
import type { ClientsRepository } from "./clients.repository";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    createdAt: row.created_at,
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

  async create(input: NewClient): Promise<Client> {
    const { data, error } = await getSupabaseAdmin()
      .from("clients")
      .insert({ full_name: input.fullName, email: input.email ?? null })
      .select("*")
      .single();

    if (error) throw toRepositoryError("ClientsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: ClientUpdate): Promise<Client> {
    const patch: Database["public"]["Tables"]["clients"]["Update"] = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.email !== undefined) patch.email = input.email;

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
}
