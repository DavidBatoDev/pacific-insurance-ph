import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError, type ListParams, type Paginated } from "../types";
import type { NewUser, User, UserUpdate } from "./user.entity";
import type { UsersRepository } from "./users.repository";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type UserPatch = Database["public"]["Tables"]["users"]["Update"];

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link UsersRepository}. */
export class SupabaseUsersRepository implements UsersRepository {
  async findById(id: string): Promise<User | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw toRepositoryError("UsersRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) throw toRepositoryError("UsersRepository.findByEmail", error);
    return data ? toDomain(data) : null;
  }

  async list(params: ListParams = {}): Promise<Paginated<User>> {
    const {
      limit = 50,
      offset = 0,
      orderBy = "created_at",
      ascending = false,
    } = params;

    const { data, error, count } = await getSupabaseAdmin()
      .from("users")
      .select("*", { count: "exact" })
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (error) throw toRepositoryError("UsersRepository.list", error);
    return { rows: (data ?? []).map(toDomain), total: count ?? 0 };
  }

  async create(input: NewUser): Promise<User> {
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .insert({
        id: input.id,
        full_name: input.fullName,
        email: input.email,
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
      .select("*")
      .single();

    if (error) throw toRepositoryError("UsersRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: UserUpdate): Promise<User> {
    const patch: UserPatch = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.email !== undefined) patch.email = input.email;
    if (input.role !== undefined) patch.role = input.role;
    if (input.status !== undefined) patch.status = input.status;
    if (input.lastLoginAt !== undefined) patch.last_login_at = input.lastLoginAt;

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw toRepositoryError("UsersRepository.update", error);
    return toDomain(data);
  }
}
