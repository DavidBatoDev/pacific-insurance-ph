import { isSelectProduct } from "./select-variant";

export type ProductInterestResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Server-side rule for every product-interest write. Accepts a blank value (cleared), the record's
 * current value unchanged (kept even if that product is no longer active), or an active catalog
 * product name, returned in its catalog spelling. A Select variant name is recorded as "Select",
 * the same as Log Call; the variant itself is stored separately.
 */
export function resolveProductInterest(
  value: string | null | undefined,
  activeProducts: readonly string[],
  current?: string | null,
): ProductInterestResult {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { ok: true, value: null };
  if (current != null && trimmed === current.trim()) return { ok: true, value: current };
  const wanted = isSelectProduct(trimmed) ? "select" : trimmed.toLowerCase();
  const match = activeProducts.find((name) => name.trim().toLowerCase() === wanted);
  return match
    ? { ok: true, value: match }
    : { ok: false, error: "Choose a product interest from the list of active products." };
}
