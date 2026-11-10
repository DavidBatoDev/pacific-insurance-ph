"use client";

import { useEffect, useState } from "react";

import { listProductInterestOptionsAction } from "@/app/(app)/clients/engage-actions";

// One request per page load, shared by every form that renders this picker.
let productsRequest: Promise<string[]> | null = null;
function loadProducts(): Promise<string[]> {
  productsRequest ??= listProductInterestOptionsAction()
    .then((result) => {
      if (!result.ok) throw new Error(result.error);
      return result.data;
    })
    .catch((error) => {
      productsRequest = null; // allow a retry on the next mount
      throw error;
    });
  return productsRequest;
}

/**
 * Product-interest picker shared by New Lead, Log Call and the client form. Options are the
 * active catalog products, so exact-name rules (proposal routing, coverage tiers, Select variant,
 * wizard product match) always receive a real product name. A stored value outside the list stays
 * selectable as "(old value)" so editing never silently blanks it.
 */
export function ProductInterestSelect({
  value,
  onChange,
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  className?: string;
}) {
  const [products, setProducts] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadProducts()
      .then((names) => { if (active) setProducts(names); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const known = products?.includes(value) ?? false;
  return (
    <select name={name} className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-busy={!products && !failed}>
      <option value="">{failed ? "Products unavailable — reopen to retry" : products ? "Choose a product…" : "Loading products…"}</option>
      {products?.map((product) => (
        <option key={product} value={product}>
          {product}
        </option>
      ))}
      {value && !known && <option value={value}>{products ? `${value} (old value)` : value}</option>}
    </select>
  );
}
