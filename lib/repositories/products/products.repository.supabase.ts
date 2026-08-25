import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { toRepositoryError } from "../types";
import type {
  CatalogAddOn, CatalogAddOnInput, CatalogAddOnUpdate, CatalogDiscountInput,
  CatalogDiscountRule, CatalogDiscountUpdate, CatalogPlanInput, CatalogPlanOption,
  CatalogPlanUpdate, CatalogPremiumRate, CatalogProduct, CatalogProductUpdate,
  CatalogProductVersion, CatalogRateInput, CatalogRateUpdate, CatalogSnapshot,
  CatalogVersionInput, CatalogVersionUpdate, NewCatalogProduct,
} from "./product.entity";
import type { ProductsRepository } from "./products.repository";

type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  source_key: string | null; quote_only: boolean;
};
type VersionRow = Database["public"]["Tables"]["product_versions"]["Row"] & {
  source_key: string | null; source_document: string | null; source_confirmed_current_date: string | null;
  products?: { name: string } | null;
};
type PlanRow = Database["public"]["Tables"]["plan_options"]["Row"] & { source_key: string | null };
type AddOnRow = Database["public"]["Tables"]["add_ons"]["Row"] & { source_key: string | null };
type DiscountRow = Database["public"]["Tables"]["discount_rules"]["Row"] & {
  source_key: string | null; source_notes: string | null;
};
type RateRow = Database["public"]["Tables"]["premium_tables"]["Row"] & {
  source_key: string | null; add_on_id: string | null; age_min: number | null; age_max: number | null;
  trip_type: string | null; travel_days_max: number | null; insured_type: string | null;
  rate_basis: "Per Year" | "Per Trip" | "Per Coverage Unit"; coverage_amount: number | null;
  coverage_unit: number | null; source_document: string | null; source_page: string | null;
  source_effective_date: string | null; source_confirmed_current_date: string | null; source_notes: string | null;
};

const status = (active?: boolean) => active === false ? "Inactive" : "Active";
const productDomain = (r: ProductRow): CatalogProduct => ({
  id:r.id,name:r.name,category:r.category,provider:r.provider,description:r.description,
  sourceKey:r.source_key,quoteOnly:r.quote_only,active:r.status==="Active",createdAt:r.created_at,updatedAt:r.updated_at,
});
const versionDomain = (r: VersionRow): CatalogProductVersion => ({
  id:r.id,productId:r.product_id,productName:r.products?.name ?? "Unknown product",versionName:r.version_name,
  effectiveDate:r.effective_date,expiryDate:r.expiry_date,notes:r.notes,sourceKey:r.source_key,
  sourceDocument:r.source_document,sourceConfirmedCurrentDate:r.source_confirmed_current_date,active:r.status==="Active",
});
const planDomain = (r: PlanRow): CatalogPlanOption => ({
  id:r.id,productVersionId:r.product_version_id,planName:r.plan_name,planFamily:r.plan_family,
  coverageTier:r.coverage_tier,coverageCurrency:r.coverage_currency,maximumCoverage:r.maximum_coverage,
  coverageDescription:r.coverage_description,deductibleRange:r.deductible_range,sourceKey:r.source_key,active:r.status==="Active",
});
const addOnDomain = (r: AddOnRow): CatalogAddOn => ({
  id:r.id,productVersionId:r.product_version_id,planOptionId:r.plan_option_id,name:r.name,description:r.description,
  eligibilityRule:r.eligibility_rule,premiumRule:r.premium_rule,sourceKey:r.source_key,active:r.status==="Active",
});
const discountDomain = (r: DiscountRow): CatalogDiscountRule => ({
  id:r.id,productVersionId:r.product_version_id,planOptionId:r.plan_option_id,name:r.name,
  discountType:r.discount_type,discountValue:r.discount_value,eligibilityRule:r.eligibility_rule,
  appliesTo:r.applies_to,sourceKey:r.source_key,sourceNotes:r.source_notes,active:r.status==="Active",
});
const rateDomain = (r: RateRow): CatalogPremiumRate => ({
  id:r.id,productVersionId:r.product_version_id,planOptionId:r.plan_option_id,addOnId:r.add_on_id,
  ageBand:r.age_band,ageMin:r.age_min,ageMax:r.age_max,currency:r.currency,basePremium:r.base_premium,
  paymentMode:r.payment_mode,effectiveDate:r.effective_date,tripType:r.trip_type,travelDaysMax:r.travel_days_max,
  insuredType:r.insured_type,rateBasis:r.rate_basis,coverageAmount:r.coverage_amount,coverageUnit:r.coverage_unit,
  sourceKey:r.source_key,sourceDocument:r.source_document,sourcePage:r.source_page,
  sourceEffectiveDate:r.source_effective_date,sourceConfirmedCurrentDate:r.source_confirmed_current_date,
  sourceNotes:r.source_notes,active:r.status==="Active",
});
const generatedKey = (kind: string) => `manual:${kind}:${crypto.randomUUID()}`;

/** supabase-js service-role implementation. New 0037 fields use narrow local row types until types are regenerated post-deploy. */
export class SupabaseProductsRepository implements ProductsRepository {
  async findById(id: string) {
    const {data,error}=await getSupabaseAdmin().from("products").select("*").eq("id",id).maybeSingle();
    if(error) throw toRepositoryError("ProductsRepository.findById",error);
    return data ? productDomain(data as unknown as ProductRow) : null;
  }
  async list() {
    const {data,error}=await getSupabaseAdmin().from("products").select("*").order("category").order("name");
    if(error) throw toRepositoryError("ProductsRepository.list",error);
    return (data??[]).map(r=>productDomain(r as unknown as ProductRow));
  }
  async listVersions() {
    const {data,error}=await getSupabaseAdmin().from("product_versions")
      .select("*, products (name)").order("effective_date",{ascending:false});
    if(error) throw toRepositoryError("ProductsRepository.listVersions",error);
    return (data??[]).map(r=>versionDomain(r as unknown as VersionRow));
  }
  async getCatalog(): Promise<CatalogSnapshot> {
    const db=getSupabaseAdmin();
    const [versions,plans,addOns,discounts,rates]=await Promise.all([
      db.from("product_versions").select("*, products (name)").order("effective_date",{ascending:false}),
      db.from("plan_options").select("*").order("plan_name"), db.from("add_ons").select("*").order("name"),
      db.from("discount_rules").select("*").order("name"), db.from("premium_tables").select("*").order("age_min").limit(2000),
    ]);
    const failed=[versions,plans,addOns,discounts,rates].find(r=>r.error);
    if(failed?.error) throw toRepositoryError("ProductsRepository.getCatalog",failed.error);
    return {
      versions:(versions.data??[]).map(r=>versionDomain(r as unknown as VersionRow)),
      plans:(plans.data??[]).map(r=>planDomain(r as unknown as PlanRow)),
      addOns:(addOns.data??[]).map(r=>addOnDomain(r as unknown as AddOnRow)),
      discounts:(discounts.data??[]).map(r=>discountDomain(r as unknown as DiscountRow)),
      rates:(rates.data??[]).map(r=>rateDomain(r as unknown as RateRow)),
    };
  }
  async create(input: NewCatalogProduct) {
    const payload={name:input.name,category:input.category??null,description:input.description??null,
      quote_only:input.quoteOnly??false,status:status(input.active),source_key:generatedKey("product")};
    const {data,error}=await getSupabaseAdmin().from("products").insert(payload as never).select("*").single();
    if(error) throw toRepositoryError("ProductsRepository.create",error);
    return productDomain(data as unknown as ProductRow);
  }
  async update(id: string,input: CatalogProductUpdate) {
    const patch:Record<string,unknown>={};
    if(input.name!==undefined)patch.name=input.name;if(input.category!==undefined)patch.category=input.category;
    if(input.description!==undefined)patch.description=input.description;if(input.quoteOnly!==undefined)patch.quote_only=input.quoteOnly;
    if(input.active!==undefined)patch.status=status(input.active);
    const {data,error}=await getSupabaseAdmin().from("products").update(patch as never).eq("id",id).select("*").single();
    if(error) throw toRepositoryError("ProductsRepository.update",error);return productDomain(data as unknown as ProductRow);
  }
  async delete(id: string) { const {error}=await getSupabaseAdmin().from("products").delete().eq("id",id);if(error)throw toRepositoryError("ProductsRepository.delete",error); }

  async createVersion(i: CatalogVersionInput) { return this.writeVersion(undefined,i); }
  async updateVersion(id:string,i:CatalogVersionUpdate) { return this.writeVersion(id,i); }
  private async writeVersion(id:string|undefined,i:CatalogVersionUpdate) {
    const p:Record<string,unknown>={};
    if(i.productId!==undefined)p.product_id=i.productId;if(i.versionName!==undefined)p.version_name=i.versionName;
    if(i.effectiveDate!==undefined)p.effective_date=i.effectiveDate;if(i.expiryDate!==undefined)p.expiry_date=i.expiryDate;
    if(i.notes!==undefined)p.notes=i.notes;if(i.sourceDocument!==undefined)p.source_document=i.sourceDocument;
    if(i.sourceConfirmedCurrentDate!==undefined)p.source_confirmed_current_date=i.sourceConfirmedCurrentDate;
    if(i.sourceKey!==undefined)p.source_key=i.sourceKey||generatedKey("version");else if(!id)p.source_key=generatedKey("version");
    if(i.active!==undefined||!id)p.status=status(i.active);
    const q=id?getSupabaseAdmin().from("product_versions").update(p as never).eq("id",id):getSupabaseAdmin().from("product_versions").insert(p as never);
    const {data,error}=await q.select("*, products (name)").single();if(error)throw toRepositoryError("ProductsRepository.writeVersion",error);
    return versionDomain(data as unknown as VersionRow);
  }
  async createPlan(i:CatalogPlanInput){return this.writePlan(undefined,i);} async updatePlan(id:string,i:CatalogPlanUpdate){return this.writePlan(id,i);}
  private async writePlan(id:string|undefined,i:CatalogPlanUpdate){const p:Record<string,unknown>={};
    const map:Record<string,string>={productVersionId:"product_version_id",planName:"plan_name",planFamily:"plan_family",coverageTier:"coverage_tier",coverageCurrency:"coverage_currency",maximumCoverage:"maximum_coverage",coverageDescription:"coverage_description",deductibleRange:"deductible_range",sourceKey:"source_key"};
    for(const [k,v] of Object.entries(map)){const value=i[k as keyof CatalogPlanUpdate];if(value!==undefined)p[v]=k==="sourceKey"&&!value?generatedKey("plan"):value;}if(!id&&!p.source_key)p.source_key=generatedKey("plan");if(i.active!==undefined||!id)p.status=status(i.active);
    const q=id?getSupabaseAdmin().from("plan_options").update(p as never).eq("id",id):getSupabaseAdmin().from("plan_options").insert(p as never);const {data,error}=await q.select("*").single();if(error)throw toRepositoryError("ProductsRepository.writePlan",error);return planDomain(data as unknown as PlanRow);}
  async createAddOn(i:CatalogAddOnInput){return this.writeAddOn(undefined,i);} async updateAddOn(id:string,i:CatalogAddOnUpdate){return this.writeAddOn(id,i);}
  private async writeAddOn(id:string|undefined,i:CatalogAddOnUpdate){const p:Record<string,unknown>={};const map:Record<string,string>={productVersionId:"product_version_id",planOptionId:"plan_option_id",name:"name",description:"description",eligibilityRule:"eligibility_rule",premiumRule:"premium_rule",sourceKey:"source_key"};for(const[k,v]of Object.entries(map)){const value=i[k as keyof CatalogAddOnUpdate];if(value!==undefined)p[v]=k==="sourceKey"&&!value?generatedKey("addon"):value;}if(!id&&!p.source_key)p.source_key=generatedKey("addon");if(i.active!==undefined||!id)p.status=status(i.active);const q=id?getSupabaseAdmin().from("add_ons").update(p as never).eq("id",id):getSupabaseAdmin().from("add_ons").insert(p as never);const{data,error}=await q.select("*").single();if(error)throw toRepositoryError("ProductsRepository.writeAddOn",error);return addOnDomain(data as unknown as AddOnRow);}
  async createDiscount(i:CatalogDiscountInput){return this.writeDiscount(undefined,i);} async updateDiscount(id:string,i:CatalogDiscountUpdate){return this.writeDiscount(id,i);}
  private async writeDiscount(id:string|undefined,i:CatalogDiscountUpdate){const p:Record<string,unknown>={};const map:Record<string,string>={productVersionId:"product_version_id",planOptionId:"plan_option_id",name:"name",discountType:"discount_type",discountValue:"discount_value",eligibilityRule:"eligibility_rule",appliesTo:"applies_to",sourceKey:"source_key",sourceNotes:"source_notes"};for(const[k,v]of Object.entries(map)){const value=i[k as keyof CatalogDiscountUpdate];if(value!==undefined)p[v]=k==="sourceKey"&&!value?generatedKey("discount"):value;}if(!id&&!p.source_key)p.source_key=generatedKey("discount");if(i.active!==undefined||!id)p.status=status(i.active);const q=id?getSupabaseAdmin().from("discount_rules").update(p as never).eq("id",id):getSupabaseAdmin().from("discount_rules").insert(p as never);const{data,error}=await q.select("*").single();if(error)throw toRepositoryError("ProductsRepository.writeDiscount",error);return discountDomain(data as unknown as DiscountRow);}
  async createRate(i:CatalogRateInput){return this.writeRate(undefined,i);} async updateRate(id:string,i:CatalogRateUpdate){return this.writeRate(id,i);}
  private async writeRate(id:string|undefined,i:CatalogRateUpdate){const p:Record<string,unknown>={};const map:Record<string,string>={productVersionId:"product_version_id",planOptionId:"plan_option_id",addOnId:"add_on_id",ageBand:"age_band",ageMin:"age_min",ageMax:"age_max",currency:"currency",basePremium:"base_premium",paymentMode:"payment_mode",effectiveDate:"effective_date",tripType:"trip_type",travelDaysMax:"travel_days_max",insuredType:"insured_type",rateBasis:"rate_basis",coverageAmount:"coverage_amount",coverageUnit:"coverage_unit",sourceKey:"source_key",sourceDocument:"source_document",sourcePage:"source_page",sourceEffectiveDate:"source_effective_date",sourceConfirmedCurrentDate:"source_confirmed_current_date",sourceNotes:"source_notes"};for(const[k,v]of Object.entries(map)){const value=i[k as keyof CatalogRateUpdate];if(value!==undefined)p[v]=k==="sourceKey"&&!value?generatedKey("rate"):value;}if(!id&&!p.source_key)p.source_key=generatedKey("rate");if(!id&&!p.rate_basis)p.rate_basis="Per Year";if(i.active!==undefined||!id)p.status=status(i.active);const q=id?getSupabaseAdmin().from("premium_tables").update(p as never).eq("id",id):getSupabaseAdmin().from("premium_tables").insert(p as never);const{data,error}=await q.select("*").single();if(error)throw toRepositoryError("ProductsRepository.writeRate",error);return rateDomain(data as unknown as RateRow);}
}
