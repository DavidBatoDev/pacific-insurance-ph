"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getProductUsageCounts } from "@/lib/queries/product-usage";
import {
  getProductsRepository,
  type CatalogAddOn,
  type CatalogAddOnInput,
  type CatalogAddOnUpdate,
  type CatalogDiscountInput,
  type CatalogDiscountRule,
  type CatalogDiscountUpdate,
  type CatalogPlanInput,
  type CatalogPlanOption,
  type CatalogPlanUpdate,
  type CatalogPremiumRate,
  type CatalogProduct,
  type CatalogProductUpdate,
  type CatalogProductVersion,
  type CatalogRateInput,
  type CatalogRateUpdate,
  type CatalogVersionInput,
  type CatalogVersionUpdate,
  type NewCatalogProduct,
  PRODUCT_CATEGORIES,
} from "@/lib/repositories/products";
import type { Json } from "@/lib/supabase/types";

async function requireProductAdmin(action: "create" | "edit" | "delete") {
  const actor = await getActor();
  if (!can(toAppRole(actor.role), "products", action)) {
    throw new Error("Product changes are reserved for Admins.");
  }
  return actor;
}

const required = (value: string | undefined, label: string) => {
  const clean = value?.trim();
  if (!clean) throw new Error(`${label} is required.`);
  if (clean.length > 160) throw new Error(`${label} must be 160 characters or fewer.`);
  return clean;
};
const optional = (value: string | null | undefined, max = 1000) => {
  if (value === undefined) return undefined;
  const clean = value?.trim() || null;
  if (clean && clean.length > max) throw new Error(`Text must be ${max} characters or fewer.`);
  return clean;
};
const dateValue = (value: string | null | undefined, label: string) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
};
const numberValue = (value: number | null | undefined, label: string) => {
  if (value === undefined || value === null) return value;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative number.`);
  return value;
};
const sourceKey = (value: string | null | undefined) => {
  const clean = optional(value, 200);
  if (clean && !/^[a-z0-9][a-z0-9:._-]*$/.test(clean)) {
    throw new Error("Source key may contain lowercase letters, numbers, colon, period, underscore and hyphen only.");
  }
  return clean;
};
const checkAges = (min?: number | null, max?: number | null) => {
  numberValue(min, "Minimum age"); numberValue(max, "Maximum age");
  if ((min != null && !Number.isInteger(min)) || (max != null && !Number.isInteger(max))) {
    throw new Error("Age bounds must be whole numbers.");
  }
  if (min != null && max != null && min > max) throw new Error("Minimum age cannot exceed maximum age.");
  if ((min ?? 0) > 120 || (max ?? 0) > 120) throw new Error("Age must be 120 or lower.");
};
const recordId = (value: string, label: string) => {
  const clean = required(value, label);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)) {
    throw new Error(`${label} is invalid.`);
  }
  return clean;
};
const choice = (value: string | null | undefined, label: string, allowed: readonly string[]) => {
  const clean = optional(value, 40);
  if (clean && !allowed.includes(clean)) throw new Error(`${label} is invalid.`);
  return clean;
};
const category = (value: string | null | undefined) => {
  if (value == null) return value;
  if (!PRODUCT_CATEGORIES.some((item) => item === value)) throw new Error("Product category is invalid.");
  return value;
};

async function auditCatalogMutation<T>(tableName: string, recordId: string, value: T, actorId: string, created: boolean) {
  await recordAudit({ actorId, action: created ? "create" : "update", tableName, recordId, newValue: value as unknown as Json });
  revalidatePath("/products");
}

export async function createProductAction(
  input: NewCatalogProduct,
): Promise<ActionResult<CatalogProduct>> {
  try {
    const actor = await requireProductAdmin("create");
    const created = await getProductsRepository().create({
      ...input, name: required(input.name, "Product name"), category: category(input.category), description: optional(input.description),
    });
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
    const updated = await getProductsRepository().update(id, {
      ...patch,
      ...(patch.name !== undefined ? { name: required(patch.name, "Product name") } : {}),
      ...(patch.category !== undefined ? { category: category(patch.category) } : {}),
      ...(patch.description !== undefined ? { description: optional(patch.description) } : {}),
    });
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

export async function saveProductVersionAction(id: string | null, input: CatalogVersionInput): Promise<ActionResult<CatalogProductVersion>> {
  try {
    const actor=await requireProductAdmin(id ? "edit" : "create");
    const clean={...input,productId:recordId(input.productId,"Product"),versionName:required(input.versionName,"Version name"),
      effectiveDate:dateValue(input.effectiveDate,"Effective date"),expiryDate:dateValue(input.expiryDate,"Expiry date"),
      sourceConfirmedCurrentDate:dateValue(input.sourceConfirmedCurrentDate,"Confirmed-current date"),notes:optional(input.notes),
      sourceDocument:optional(input.sourceDocument,300),sourceKey:sourceKey(input.sourceKey)};
    if(clean.effectiveDate&&clean.expiryDate&&clean.effectiveDate>clean.expiryDate)throw new Error("Expiry date cannot precede effective date.");
    const saved=id?await getProductsRepository().updateVersion(id,clean as CatalogVersionUpdate):await getProductsRepository().createVersion(clean);
    await auditCatalogMutation("product_versions",saved.id,saved,actor.id,!id);return{ok:true,data:saved};
  }catch(e){return{ok:false,error:e instanceof Error?e.message:"Failed to save version."};}
}
export async function savePlanOptionAction(id:string|null,input:CatalogPlanInput):Promise<ActionResult<CatalogPlanOption>>{
  try{const actor=await requireProductAdmin(id?"edit":"create");const clean={...input,productVersionId:recordId(input.productVersionId,"Product version"),planName:required(input.planName,"Plan name"),planFamily:optional(input.planFamily,160),coverageTier:optional(input.coverageTier,160),coverageCurrency:optional(input.coverageCurrency,3)?.toUpperCase()??null,maximumCoverage:numberValue(input.maximumCoverage,"Maximum coverage"),coverageDescription:optional(input.coverageDescription),deductibleRange:optional(input.deductibleRange,300),sourceKey:sourceKey(input.sourceKey)};if(clean.coverageCurrency&&!/^[A-Z]{3}$/.test(clean.coverageCurrency))throw new Error("Currency must be a three-letter code.");const saved=id?await getProductsRepository().updatePlan(id,clean as CatalogPlanUpdate):await getProductsRepository().createPlan(clean);await auditCatalogMutation("plan_options",saved.id,saved,actor.id,!id);return{ok:true,data:saved};}catch(e){return{ok:false,error:e instanceof Error?e.message:"Failed to save plan."};}}
export async function saveAddOnAction(id:string|null,input:CatalogAddOnInput):Promise<ActionResult<CatalogAddOn>>{
  try{const actor=await requireProductAdmin(id?"edit":"create");if(!input.productVersionId&&!input.planOptionId)throw new Error("Choose a product version or plan.");const clean={...input,name:required(input.name,"Add-on name"),description:optional(input.description),eligibilityRule:optional(input.eligibilityRule),premiumRule:optional(input.premiumRule),sourceKey:sourceKey(input.sourceKey)};const saved=id?await getProductsRepository().updateAddOn(id,clean as CatalogAddOnUpdate):await getProductsRepository().createAddOn(clean);await auditCatalogMutation("add_ons",saved.id,saved,actor.id,!id);return{ok:true,data:saved};}catch(e){return{ok:false,error:e instanceof Error?e.message:"Failed to save add-on."};}}
export async function saveDiscountRuleAction(id:string|null,input:CatalogDiscountInput):Promise<ActionResult<CatalogDiscountRule>>{
  try{const actor=await requireProductAdmin(id?"edit":"create");if(!input.productVersionId&&!input.planOptionId)throw new Error("Choose a product version or plan.");const clean={...input,name:required(input.name,"Discount name"),discountType:optional(input.discountType,80),discountValue:numberValue(input.discountValue,"Discount value"),eligibilityRule:optional(input.eligibilityRule),appliesTo:optional(input.appliesTo,300),sourceKey:sourceKey(input.sourceKey),sourceNotes:optional(input.sourceNotes)};const saved=id?await getProductsRepository().updateDiscount(id,clean as CatalogDiscountUpdate):await getProductsRepository().createDiscount(clean);await auditCatalogMutation("discount_rules",saved.id,saved,actor.id,!id);return{ok:true,data:saved};}catch(e){return{ok:false,error:e instanceof Error?e.message:"Failed to save discount."};}}
export async function savePremiumRateAction(id:string|null,input:CatalogRateInput):Promise<ActionResult<CatalogPremiumRate>>{
  try{const actor=await requireProductAdmin(id?"edit":"create");checkAges(input.ageMin,input.ageMax);if(input.basePremium==null)throw new Error("Published premium is required.");if(!input.planOptionId&&!input.addOnId)throw new Error("Choose a plan or add-on for the rate.");const days=numberValue(input.travelDaysMax,"Travel day limit");if(days!=null&&!Number.isInteger(days))throw new Error("Travel day limit must be a whole number.");const clean={...input,productVersionId:recordId(input.productVersionId,"Product version"),ageBand:optional(input.ageBand,100),currency:optional(input.currency,3)?.toUpperCase()??null,basePremium:numberValue(input.basePremium,"Premium"),paymentMode:choice(input.paymentMode,"Payment mode",["Annual","Semi-Annual"]),effectiveDate:dateValue(input.effectiveDate,"Effective date"),tripType:choice(input.tripType,"Trip type",["Single Trip","Multi-Trip"]),travelDaysMax:days,insuredType:choice(input.insuredType,"Insured type",["Individual","Family"]),rateBasis:choice(input.rateBasis,"Rate basis",["Per Year","Per Trip","Per Coverage Unit"]) as CatalogRateInput["rateBasis"],coverageAmount:numberValue(input.coverageAmount,"Coverage amount"),coverageUnit:numberValue(input.coverageUnit,"Coverage unit"),sourceKey:sourceKey(input.sourceKey),sourceDocument:optional(input.sourceDocument,300),sourcePage:optional(input.sourcePage,50),sourceEffectiveDate:dateValue(input.sourceEffectiveDate,"Source effective date"),sourceConfirmedCurrentDate:dateValue(input.sourceConfirmedCurrentDate,"Confirmed-current date"),sourceNotes:optional(input.sourceNotes)};if(clean.currency&&!/^[A-Z]{3}$/.test(clean.currency))throw new Error("Currency must be a three-letter code.");if(clean.rateBasis==="Per Trip"&&!clean.travelDaysMax)throw new Error("Per-trip rates require a travel day limit.");const saved=id?await getProductsRepository().updateRate(id,clean as CatalogRateUpdate):await getProductsRepository().createRate(clean as CatalogRateInput);await auditCatalogMutation("premium_tables",saved.id,saved,actor.id,!id);return{ok:true,data:saved};}catch(e){return{ok:false,error:e instanceof Error?e.message:"Failed to save rate."};}}

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
