/**
 * Domain types for the configurable product catalog (design products.jsx §13).
 * Categories are the fixed taxonomy on products.category; linked-record counts
 * come from lib/queries/product-usage.ts.
 */

export const PRODUCT_CATEGORIES = [
  "Primary Medical",
  "Group Medical",
  "Second-Layer Medical",
  "Travel Insurance",
  "Other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface CatalogProduct {
  id: string;
  name: string;
  category: string | null;
  provider: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogProductVersion {
  id: string;
  productId: string;
  productName: string;
  versionName: string;
  effectiveDate: string | null;
  expiryDate: string | null;
  active: boolean;
}

export interface NewCatalogProduct {
  name: string;
  category?: string | null;
  description?: string | null;
  active?: boolean;
}

export interface CatalogProductUpdate {
  name?: string;
  category?: string | null;
  description?: string | null;
  active?: boolean;
}
