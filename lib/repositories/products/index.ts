import type { ProductsRepository } from "./products.repository";
import { SupabaseProductsRepository } from "./products.repository.supabase";

let instance: ProductsRepository | null = null;

/** Resolve the product catalog repository. */
export function getProductsRepository(): ProductsRepository {
  if (!instance) {
    instance = new SupabaseProductsRepository();
  }
  return instance;
}

export type { ProductsRepository } from "./products.repository";
export type {
  CatalogProduct,
  NewCatalogProduct,
  CatalogProductUpdate,
  CatalogProductVersion,
  CatalogSnapshot,
  CatalogPlanOption,
  CatalogAddOn,
  CatalogDiscountRule,
  CatalogPremiumRate,
  CatalogVersionInput,
  CatalogVersionUpdate,
  CatalogPlanInput,
  CatalogPlanUpdate,
  CatalogAddOnInput,
  CatalogAddOnUpdate,
  CatalogDiscountInput,
  CatalogDiscountUpdate,
  CatalogRateInput,
  CatalogRateUpdate,
  CatalogRateBasis,
  ProductCategory,
} from "./product.entity";
export { PRODUCT_CATEGORIES } from "./product.entity";
