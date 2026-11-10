import "server-only";

import { getProductsRepository } from "@/lib/repositories/products";
import { resolveProductInterest, type ProductInterestResult } from "./product-interest";

/** Names of active catalog products, alphabetical. */
export async function listActiveProductNames(): Promise<string[]> {
  const products = await getProductsRepository().list();
  return products.filter((product) => product.active).map((product) => product.name).sort((a, b) => a.localeCompare(b));
}

/** {@link resolveProductInterest} against the live catalog. A catalog read failure rejects the write. */
export async function checkProductInterest(value: string | null | undefined, current?: string | null): Promise<ProductInterestResult> {
  let active: string[];
  try {
    active = await listActiveProductNames();
  } catch {
    return { ok: false, error: "Products could not be loaded, so the product interest wasn't saved. Try again." };
  }
  return resolveProductInterest(value, active, current);
}
