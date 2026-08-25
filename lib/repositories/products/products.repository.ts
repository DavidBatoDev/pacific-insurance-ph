import type {
  CatalogAddOn,
  CatalogAddOnInput,
  CatalogAddOnUpdate,
  CatalogDiscountInput,
  CatalogDiscountRule,
  CatalogDiscountUpdate,
  CatalogPlanInput,
  CatalogPlanOption,
  CatalogPlanUpdate,
  CatalogPremiumRate,
  CatalogProduct,
  CatalogProductUpdate,
  CatalogProductVersion,
  CatalogRateInput,
  CatalogRateUpdate,
  CatalogSnapshot,
  CatalogVersionInput,
  CatalogVersionUpdate,
  NewCatalogProduct,
} from "./product.entity";

/** The product catalog repository port. */
export interface ProductsRepository {
  findById(id: string): Promise<CatalogProduct | null>;
  list(): Promise<CatalogProduct[]>;
  listVersions(): Promise<CatalogProductVersion[]>;
  getCatalog(): Promise<CatalogSnapshot>;
  create(input: NewCatalogProduct): Promise<CatalogProduct>;
  update(id: string, input: CatalogProductUpdate): Promise<CatalogProduct>;
  delete(id: string): Promise<void>;
  createVersion(input: CatalogVersionInput): Promise<CatalogProductVersion>;
  updateVersion(id: string, input: CatalogVersionUpdate): Promise<CatalogProductVersion>;
  createPlan(input: CatalogPlanInput): Promise<CatalogPlanOption>;
  updatePlan(id: string, input: CatalogPlanUpdate): Promise<CatalogPlanOption>;
  createAddOn(input: CatalogAddOnInput): Promise<CatalogAddOn>;
  updateAddOn(id: string, input: CatalogAddOnUpdate): Promise<CatalogAddOn>;
  createDiscount(input: CatalogDiscountInput): Promise<CatalogDiscountRule>;
  updateDiscount(id: string, input: CatalogDiscountUpdate): Promise<CatalogDiscountRule>;
  createRate(input: CatalogRateInput): Promise<CatalogPremiumRate>;
  updateRate(id: string, input: CatalogRateUpdate): Promise<CatalogPremiumRate>;
}
