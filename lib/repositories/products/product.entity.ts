/** Domain types for the configurable, source-dated carrier catalog. */

export const PRODUCT_CATEGORIES = [
  "Primary Medical", "Group Medical", "Second-Layer Medical", "Travel Insurance", "Other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type CatalogRateBasis = "Per Year" | "Per Trip" | "Per Coverage Unit";

export interface CatalogProduct {
  id: string; name: string; category: string | null; provider: string | null;
  description: string | null; sourceKey: string | null; quoteOnly: boolean; active: boolean;
  createdAt: string; updatedAt: string;
}
export interface CatalogProductVersion {
  id: string; productId: string; productName: string; versionName: string;
  effectiveDate: string | null; expiryDate: string | null; notes: string | null;
  sourceKey: string | null; sourceDocument: string | null;
  sourceConfirmedCurrentDate: string | null; active: boolean;
}
export interface CatalogPlanOption {
  id: string; productVersionId: string; planName: string; planFamily: string | null;
  coverageTier: string | null; coverageCurrency: string | null; maximumCoverage: number | null;
  coverageDescription: string | null; deductibleRange: string | null; sourceKey: string | null; active: boolean;
}
export interface CatalogAddOn {
  id: string; productVersionId: string | null; planOptionId: string | null; name: string;
  description: string | null; eligibilityRule: string | null; premiumRule: string | null;
  sourceKey: string | null; active: boolean;
}
export interface CatalogDiscountRule {
  id: string; productVersionId: string | null; planOptionId: string | null; name: string;
  discountType: string | null; discountValue: number | null; eligibilityRule: string | null;
  appliesTo: string | null; sourceKey: string | null; sourceNotes: string | null; active: boolean;
}
export interface CatalogPremiumRate {
  id: string; productVersionId: string; planOptionId: string | null; addOnId: string | null;
  ageBand: string | null; ageMin: number | null; ageMax: number | null; currency: string | null;
  basePremium: number | null; paymentMode: string | null; effectiveDate: string | null;
  tripType: string | null; travelDaysMax: number | null; insuredType: string | null;
  rateBasis: CatalogRateBasis; coverageAmount: number | null; coverageUnit: number | null;
  sourceKey: string | null; sourceDocument: string | null; sourcePage: string | null;
  sourceEffectiveDate: string | null; sourceConfirmedCurrentDate: string | null;
  sourceNotes: string | null; active: boolean;
}
export interface CatalogSnapshot {
  versions: CatalogProductVersion[]; plans: CatalogPlanOption[]; addOns: CatalogAddOn[];
  discounts: CatalogDiscountRule[]; rates: CatalogPremiumRate[];
}

export interface NewCatalogProduct {
  name: string; category?: string | null; description?: string | null;
  quoteOnly?: boolean; active?: boolean;
}
export type CatalogProductUpdate = Partial<NewCatalogProduct>;
export interface CatalogVersionInput {
  productId: string; versionName: string; effectiveDate?: string | null; expiryDate?: string | null;
  notes?: string | null; sourceKey?: string | null; sourceDocument?: string | null;
  sourceConfirmedCurrentDate?: string | null; active?: boolean;
}
export type CatalogVersionUpdate = Partial<CatalogVersionInput>;
export interface CatalogPlanInput {
  productVersionId: string; planName: string; planFamily?: string | null; coverageTier?: string | null;
  coverageCurrency?: string | null; maximumCoverage?: number | null; coverageDescription?: string | null;
  deductibleRange?: string | null; sourceKey?: string | null; active?: boolean;
}
export type CatalogPlanUpdate = Partial<CatalogPlanInput>;
export interface CatalogAddOnInput {
  productVersionId?: string | null; planOptionId?: string | null; name: string;
  description?: string | null; eligibilityRule?: string | null; premiumRule?: string | null;
  sourceKey?: string | null; active?: boolean;
}
export type CatalogAddOnUpdate = Partial<CatalogAddOnInput>;
export interface CatalogDiscountInput {
  productVersionId?: string | null; planOptionId?: string | null; name: string;
  discountType?: string | null; discountValue?: number | null; eligibilityRule?: string | null;
  appliesTo?: string | null; sourceKey?: string | null; sourceNotes?: string | null; active?: boolean;
}
export type CatalogDiscountUpdate = Partial<CatalogDiscountInput>;
export interface CatalogRateInput {
  productVersionId: string; planOptionId?: string | null; addOnId?: string | null;
  ageBand?: string | null; ageMin?: number | null; ageMax?: number | null; currency?: string | null;
  basePremium?: number | null; paymentMode?: string | null; effectiveDate?: string | null;
  tripType?: string | null; travelDaysMax?: number | null; insuredType?: string | null;
  rateBasis?: CatalogRateBasis; coverageAmount?: number | null; coverageUnit?: number | null;
  sourceKey?: string | null; sourceDocument?: string | null; sourcePage?: string | null;
  sourceEffectiveDate?: string | null; sourceConfirmedCurrentDate?: string | null;
  sourceNotes?: string | null; active?: boolean;
}
export type CatalogRateUpdate = Partial<CatalogRateInput>;
