"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getProductUsageCounts } from "@/lib/queries/product-usage";
import {
  getProductsRepository,
  type CatalogProduct,
  type CatalogProductUpdate,
  type NewCatalogProduct,
} from "@/lib/repositories/products";
import type { Json } from "@/lib/supabase/types";

async function requireProductAdmin(action: "create" | "edit" | "delete") {
  const actor = await getActor();
  if (!can(toAppRole(actor.role), "products", action)) {
    throw new Error("Product changes are reserved for Admins.");
  }
  return actor;
}

export async function createProductAction(
  input: NewCatalogProduct,
): Promise<ActionResult<CatalogProduct>> {
  try {
    const actor = await requireProductAdmin("create");
    if (!input.name?.trim()) return { ok: false, error: "Product name is required." };
    const created = await getProductsRepository().create({ ...input, name: input.name.trim() });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "products",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
    revalidatePath("/products");
    return { ok: true, data: created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create product." };
  }
}

export async function updateProductAction(
  id: string,
  patch: CatalogProductUpdate,
): Promise<ActionResult<CatalogProduct>> {
  try {
    const actor = await requireProductAdmin("edit");
    const updated = await getProductsRepository().update(id, patch);
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "products",
      recordId: id,
      newValue: updated as unknown as Json,
    });
    revalidatePath("/products");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update product." };
  }
}

/**
 * Delete guardrail (design §13): a product with linked records can't be
 * deleted — the caller is told to deactivate instead. Historical data is
 * always preserved.
 */
export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireProductAdmin("delete");
    const usage = await getProductUsageCounts();
    if ((usage[id] ?? 0) > 0) {
      return {
        ok: false,
        error: "This product is linked to existing records — deactivate it instead to preserve history.",
      };
    }
    await getProductsRepository().delete(id);
    await recordAudit({ actorId: actor.id, action: "delete", tableName: "products", recordId: id });
    revalidatePath("/products");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete product." };
  }
}
