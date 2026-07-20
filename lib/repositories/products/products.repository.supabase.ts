import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  CatalogProduct,
  CatalogProductUpdate,
  NewCatalogProduct,
} from "./product.entity";
import type { ProductsRepository } from "./products.repository";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function toDomain(row: ProductRow): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    description: row.description,
    active: row.status === "Active",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** supabase-js (service role) implementation of {@link ProductsRepository}. */
export class SupabaseProductsRepository implements ProductsRepository {
  async findById(id: string): Promise<CatalogProduct | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw toRepositoryError("ProductsRepository.findById", error);
    return data ? toDomain(data) : null;
  }

  async list(): Promise<CatalogProduct[]> {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw toRepositoryError("ProductsRepository.list", error);
    return (data ?? []).map(toDomain);
  }

  async create(input: NewCatalogProduct): Promise<CatalogProduct> {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .insert({
        name: input.name,
        category: input.category ?? null,
        description: input.description ?? null,
        ...(input.active === false ? { status: "Inactive" } : {}),
      })
      .select("*")
      .single();
    if (error) throw toRepositoryError("ProductsRepository.create", error);
    return toDomain(data);
  }

  async update(id: string, input: CatalogProductUpdate): Promise<CatalogProduct> {
    const patch: Database["public"]["Tables"]["products"]["Update"] = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.category !== undefined) patch.category = input.category;
    if (input.description !== undefined) patch.description = input.description;
    if (input.active !== undefined) patch.status = input.active ? "Active" : "Inactive";

    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw toRepositoryError("ProductsRepository.update", error);
    return toDomain(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdmin().from("products").delete().eq("id", id);
    if (error) throw toRepositoryError("ProductsRepository.delete", error);
  }
}
