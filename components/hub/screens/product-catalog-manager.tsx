"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  saveAddOnAction, saveDiscountRuleAction, savePlanOptionAction,
  savePremiumRateAction, saveProductVersionAction,
} from "@/app/(app)/products/actions";
import type {
  CatalogAddOn, CatalogDiscountRule, CatalogPlanOption, CatalogPremiumRate,
  CatalogProduct, CatalogProductVersion, CatalogSnapshot,
} from "@/lib/repositories/products";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { DrawerField } from "../overlays/client-picker";
import { Drawer } from "../overlays/drawer";
import { useOverlays } from "../overlays/overlay-provider";
import { Btn, Card, INPUT } from "../primitives";

type Editor =
  | { kind:"version"; record?:CatalogProductVersion; productId:string }
  | { kind:"plan"; record?:CatalogPlanOption; versionId:string }
  | { kind:"addon"; record?:CatalogAddOn; versionId:string }
  | { kind:"discount"; record?:CatalogDiscountRule; versionId:string }
  | { kind:"rate"; record?:CatalogPremiumRate; versionId:string };

const money=(value:number|null,currency:string|null)=>value==null?"—":new Intl.NumberFormat("en-PH",{
  style:"currency",currency:currency||"PHP",maximumFractionDigits:2,
}).format(value);
const badge=(active:boolean)=><span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold",active?"bg-green-soft text-green":"bg-slate-soft text-slate")}>{active?"Active":"Inactive"}</span>;
const editButton=(onClick:()=>void)=><button onClick={onClick} className="rounded-md px-2 py-1 text-[11.5px] font-semibold text-brand hover:bg-hover">Edit</button>;

export function ProductCatalogManager({products,catalog,canEdit}:{products:CatalogProduct[];catalog:CatalogSnapshot;canEdit:boolean}){
  const activeProduct=products.find(p=>p.active)??products[0];
  const [productId,setProductId]=useState(activeProduct?.id??"");
  const [versionId,setVersionId]=useState("");
  const [rateSearch,setRateSearch]=useState("");
  const [editor,setEditor]=useState<Editor|null>(null);
  const versions=catalog.versions.filter(v=>v.productId===productId);
  const selectedVersion=versions.find(v=>v.id===versionId)??versions[0];
  const vid=selectedVersion?.id??"";
  const plans=catalog.plans.filter(p=>p.productVersionId===vid);
  const addOns=catalog.addOns.filter(a=>a.productVersionId===vid||plans.some(p=>p.id===a.planOptionId));
  const discounts=catalog.discounts.filter(d=>d.productVersionId===vid||plans.some(p=>p.id===d.planOptionId));
  const rates=catalog.rates.filter(r=>r.productVersionId===vid);
  const visibleRates=(()=>{
    const q=rateSearch.trim().toLowerCase();
    return rates.filter(r=>!q||[r.ageBand,r.currency,r.tripType,r.insuredType,r.sourceKey,
      plans.find(p=>p.id===r.planOptionId)?.planName,addOns.find(a=>a.id===r.addOnId)?.name]
      .some(v=>v?.toLowerCase().includes(q))).slice(0,100);
  })();
  if(!products.length)return null;
  return <Card className="mt-6 overflow-hidden">
    <div className="border-b border-border-soft px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[15px] font-bold">Versions, plans & published rates</h2><p className="mt-0.5 text-[12px] text-subtle">Source-dated carrier catalog. This is reference data, not a proposal calculator.</p></div>
        {canEdit&&<Btn variant="primary" onClick={()=>setEditor({kind:"version",productId})}><I.plus size={14}/> New version</Btn>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <select className={INPUT+" max-w-[260px]"} value={productId} onChange={e=>{setProductId(e.target.value);setVersionId("");}}>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.quoteOnly?" · Quote-only":""}{!p.active?" · Inactive":""}</option>)}</select>
        <select className={INPUT+" max-w-[380px]"} value={selectedVersion?.id??""} onChange={e=>setVersionId(e.target.value)}>{versions.map(v=><option key={v.id} value={v.id}>{v.versionName}{!v.active?" · Inactive":""}</option>)}</select>
      </div>
    </div>
    {!selectedVersion?<div className="p-8 text-center text-[13px] text-subtle">No catalog version exists for this product.</div>:<>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-soft bg-surface-2 px-5 py-3">
        <div><div className="flex items-center gap-2 text-[13px] font-semibold">{selectedVersion.versionName}{badge(selectedVersion.active)}</div><div className="mt-1 text-[11.5px] text-subtle">Effective {selectedVersion.effectiveDate??"not dated"} · {selectedVersion.sourceDocument??"No source document"}{selectedVersion.sourceConfirmedCurrentDate?` · current confirmed ${selectedVersion.sourceConfirmedCurrentDate}`:""}</div>{selectedVersion.notes&&<p className="mt-1 max-w-[820px] text-[11.5px] text-muted-foreground">{selectedVersion.notes}</p>}</div>
        {canEdit&&editButton(()=>setEditor({kind:"version",record:selectedVersion,productId}))}
      </div>
      <CatalogSection title="Plans" count={plans.length} onAdd={canEdit?()=>setEditor({kind:"plan",versionId:vid}):undefined}>
        <div className="grid grid-cols-2 gap-2 max-[850px]:grid-cols-1">{plans.map(p=><button key={p.id} onClick={()=>canEdit&&setEditor({kind:"plan",record:p,versionId:vid})} className={cn("rounded-md border border-border-soft px-3 py-2 text-left",canEdit&&"hover:bg-hover",!p.active&&"opacity-55")}><div className="flex items-center justify-between gap-2 text-[12.5px] font-semibold"><span>{p.planName}</span>{badge(p.active)}</div><div className="mt-1 text-[11px] text-subtle">{[p.planFamily,p.coverageTier,p.coverageCurrency,p.maximumCoverage?money(p.maximumCoverage,p.coverageCurrency):null].filter(Boolean).join(" · ")}</div></button>)}</div>
      </CatalogSection>
      <CatalogSection title="Add-ons" count={addOns.length} onAdd={canEdit?()=>setEditor({kind:"addon",versionId:vid}):undefined}>
        <CatalogTable heads={["Name","Eligibility","Premium rule","Status"]}>{addOns.map(a=><tr key={a.id} className="border-t border-border-soft"><Cell strong>{a.name}</Cell><Cell>{a.eligibilityRule??"—"}</Cell><Cell>{a.premiumRule??"—"}</Cell><Cell>{badge(a.active)}{canEdit&&editButton(()=>setEditor({kind:"addon",record:a,versionId:vid}))}</Cell></tr>)}</CatalogTable>
      </CatalogSection>
      <CatalogSection title="Discounts" count={discounts.length} onAdd={canEdit?()=>setEditor({kind:"discount",versionId:vid}):undefined}>
        <CatalogTable heads={["Rule","Value","Eligibility / applies to","Status"]}>{discounts.map(d=><tr key={d.id} className="border-t border-border-soft"><Cell strong>{d.name}</Cell><Cell>{d.discountValue==null?"—":`${d.discountValue}${d.discountType==="Percent"?"%":` ${d.discountType??""}`}`}</Cell><Cell>{[d.eligibilityRule,d.appliesTo].filter(Boolean).join(" · ")||"—"}</Cell><Cell>{badge(d.active)}{canEdit&&editButton(()=>setEditor({kind:"discount",record:d,versionId:vid}))}</Cell></tr>)}</CatalogTable>
      </CatalogSection>
      <CatalogSection title="Published rates" count={rates.length} onAdd={canEdit?()=>setEditor({kind:"rate",versionId:vid}):undefined}>
        <input className={INPUT+" mb-2 max-w-[320px]"} placeholder="Search plan, age, trip or source key…" value={rateSearch} onChange={e=>setRateSearch(e.target.value)}/>
        <CatalogTable heads={["Plan / add-on","Dimensions","Published premium","Source","Status"]}>{visibleRates.map(r=><tr key={r.id} className="border-t border-border-soft"><Cell strong>{plans.find(p=>p.id===r.planOptionId)?.planName??addOns.find(a=>a.id===r.addOnId)?.name??"Version rate"}</Cell><Cell>{[r.ageBand,r.tripType,r.travelDaysMax?`≤ ${r.travelDaysMax} days`:null,r.insuredType].filter(Boolean).join(" · ")||"—"}</Cell><Cell>{money(r.basePremium,r.currency)}<span className="block text-[10.5px] font-normal text-subtle">{r.rateBasis}</span></Cell><Cell>{r.sourceDocument??"—"}{r.sourcePage&&<span className="block text-[10.5px] text-subtle">p. {r.sourcePage}</span>}</Cell><Cell>{badge(r.active)}{canEdit&&editButton(()=>setEditor({kind:"rate",record:r,versionId:vid}))}</Cell></tr>)}</CatalogTable>
        {visibleRates.length<rates.length&&<p className="mt-2 text-[11px] text-subtle">Showing the first 100 matching rows. Refine the search to edit a specific rate.</p>}
      </CatalogSection>
    </>}
    {editor&&<CatalogEditor key={`${editor.kind}-${editor.record?.id??"new"}`} editor={editor} products={products} catalog={catalog} onClose={()=>setEditor(null)}/>}
  </Card>;
}

function CatalogSection({title,count,onAdd,children}:{title:string;count:number;onAdd?:()=>void;children:React.ReactNode}){return <section className="border-b border-border-soft px-5 py-4 last:border-0"><div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{title} <span className="font-mono text-subtle">{count}</span></h3>{onAdd&&<button onClick={onAdd} className="text-[11.5px] font-semibold text-brand hover:text-brand-hover">+ Add</button>}</div>{count?children:<p className="py-3 text-[12px] text-subtle">No {title.toLowerCase()} recorded.</p>}</section>}
function CatalogTable({heads,children}:{heads:string[];children:React.ReactNode}){return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[11.5px]"><thead><tr>{heads.map(h=><th key={h} className="px-2 py-1.5 text-[10px] uppercase tracking-wide text-subtle">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
function Cell({children,strong}:{children:React.ReactNode;strong?:boolean}){return <td className={cn("max-w-[360px] px-2 py-2 align-top text-muted-foreground",strong&&"font-semibold text-foreground")}>{children}</td>}

type Draft=Record<string,string|boolean>;
const s=(v:string|null|undefined)=>v??""; const n=(v:number|null|undefined)=>v==null?"":String(v);
function initial(e:Editor):Draft{switch(e.kind){case"version":return{productId:e.record?.productId??e.productId,versionName:s(e.record?.versionName),effectiveDate:s(e.record?.effectiveDate),expiryDate:s(e.record?.expiryDate),notes:s(e.record?.notes),sourceKey:s(e.record?.sourceKey),sourceDocument:s(e.record?.sourceDocument),confirmed:s(e.record?.sourceConfirmedCurrentDate),active:e.record?.active??true};case"plan":return{versionId:e.record?.productVersionId??e.versionId,name:s(e.record?.planName),family:s(e.record?.planFamily),tier:s(e.record?.coverageTier),currency:s(e.record?.coverageCurrency),coverage:n(e.record?.maximumCoverage),description:s(e.record?.coverageDescription),deductible:s(e.record?.deductibleRange),sourceKey:s(e.record?.sourceKey),active:e.record?.active??true};case"addon":return{versionId:e.record?.productVersionId??e.versionId,planId:s(e.record?.planOptionId),name:s(e.record?.name),description:s(e.record?.description),eligibility:s(e.record?.eligibilityRule),premiumRule:s(e.record?.premiumRule),sourceKey:s(e.record?.sourceKey),active:e.record?.active??true};case"discount":return{versionId:e.record?.productVersionId??e.versionId,planId:s(e.record?.planOptionId),name:s(e.record?.name),type:s(e.record?.discountType??"Percent"),value:n(e.record?.discountValue),eligibility:s(e.record?.eligibilityRule),appliesTo:s(e.record?.appliesTo),notes:s(e.record?.sourceNotes),sourceKey:s(e.record?.sourceKey),active:e.record?.active??true};case"rate":return{versionId:e.record?.productVersionId??e.versionId,planId:s(e.record?.planOptionId),addOnId:s(e.record?.addOnId),ageBand:s(e.record?.ageBand),ageMin:n(e.record?.ageMin),ageMax:n(e.record?.ageMax),currency:s(e.record?.currency??"PHP"),premium:n(e.record?.basePremium),paymentMode:s(e.record?.paymentMode),effectiveDate:s(e.record?.effectiveDate),tripType:s(e.record?.tripType),days:n(e.record?.travelDaysMax),insuredType:s(e.record?.insuredType),rateBasis:s(e.record?.rateBasis??"Per Year"),coverage:n(e.record?.coverageAmount),unit:n(e.record?.coverageUnit),sourceKey:s(e.record?.sourceKey),sourceDocument:s(e.record?.sourceDocument),sourcePage:s(e.record?.sourcePage),sourceEffective:s(e.record?.sourceEffectiveDate),confirmed:s(e.record?.sourceConfirmedCurrentDate),notes:s(e.record?.sourceNotes),active:e.record?.active??true};}}
const num=(v:string)=>v===""?null:Number(v); const nil=(v:string)=>v.trim()||null;
function CatalogEditor({editor,products,catalog,onClose}:{editor:Editor;products:CatalogProduct[];catalog:CatalogSnapshot;onClose:()=>void}){
  const [d,setD]=useState<Draft>(()=>initial(editor));const [pending,startTransition]=useTransition();const router=useRouter();const overlays=useOverlays();const set=(k:string,v:string|boolean)=>setD(x=>({...x,[k]:v}));const plans=catalog.plans.filter(p=>p.productVersionId===String(d.versionId));const addons=catalog.addOns.filter(a=>a.productVersionId===String(d.versionId));
  const save=()=>startTransition(async()=>{let res;const id=editor.record?.id??null;switch(editor.kind){case"version":res=await saveProductVersionAction(id,{productId:String(d.productId),versionName:String(d.versionName),effectiveDate:nil(String(d.effectiveDate)),expiryDate:nil(String(d.expiryDate)),notes:nil(String(d.notes)),sourceKey:nil(String(d.sourceKey)),sourceDocument:nil(String(d.sourceDocument)),sourceConfirmedCurrentDate:nil(String(d.confirmed)),active:Boolean(d.active)});break;case"plan":res=await savePlanOptionAction(id,{productVersionId:String(d.versionId),planName:String(d.name),planFamily:nil(String(d.family)),coverageTier:nil(String(d.tier)),coverageCurrency:nil(String(d.currency)),maximumCoverage:num(String(d.coverage)),coverageDescription:nil(String(d.description)),deductibleRange:nil(String(d.deductible)),sourceKey:nil(String(d.sourceKey)),active:Boolean(d.active)});break;case"addon":res=await saveAddOnAction(id,{productVersionId:String(d.versionId),planOptionId:nil(String(d.planId)),name:String(d.name),description:nil(String(d.description)),eligibilityRule:nil(String(d.eligibility)),premiumRule:nil(String(d.premiumRule)),sourceKey:nil(String(d.sourceKey)),active:Boolean(d.active)});break;case"discount":res=await saveDiscountRuleAction(id,{productVersionId:String(d.versionId),planOptionId:nil(String(d.planId)),name:String(d.name),discountType:nil(String(d.type)),discountValue:num(String(d.value)),eligibilityRule:nil(String(d.eligibility)),appliesTo:nil(String(d.appliesTo)),sourceNotes:nil(String(d.notes)),sourceKey:nil(String(d.sourceKey)),active:Boolean(d.active)});break;case"rate":res=await savePremiumRateAction(id,{productVersionId:String(d.versionId),planOptionId:nil(String(d.planId)),addOnId:nil(String(d.addOnId)),ageBand:nil(String(d.ageBand)),ageMin:num(String(d.ageMin)),ageMax:num(String(d.ageMax)),currency:nil(String(d.currency)),basePremium:num(String(d.premium)),paymentMode:nil(String(d.paymentMode)),effectiveDate:nil(String(d.effectiveDate)),tripType:nil(String(d.tripType)),travelDaysMax:num(String(d.days)),insuredType:nil(String(d.insuredType)),rateBasis:String(d.rateBasis) as "Per Year"|"Per Trip"|"Per Coverage Unit",coverageAmount:num(String(d.coverage)),coverageUnit:num(String(d.unit)),sourceKey:nil(String(d.sourceKey)),sourceDocument:nil(String(d.sourceDocument)),sourcePage:nil(String(d.sourcePage)),sourceEffectiveDate:nil(String(d.sourceEffective)),sourceConfirmedCurrentDate:nil(String(d.confirmed)),sourceNotes:nil(String(d.notes)),active:Boolean(d.active)});break;}if(res.ok){overlays.toast("Catalog saved","The source-dated catalog entry was updated.");router.refresh();onClose();}else overlays.toast("Couldn’t save catalog entry",res.error);});
  const field=(label:string,key:string,opts?:{type?:string;area?:boolean})=><DrawerField label={label} className="mt-3">{opts?.area?<textarea className={INPUT+" min-h-20 py-2"} value={String(d[key]??"")} onChange={e=>set(key,e.target.value)}/>:<input type={opts?.type??"text"} className={INPUT} value={String(d[key]??"")} onChange={e=>set(key,e.target.value)}/>}</DrawerField>;
  const versionSelect=<DrawerField label="Product version" required className="mt-3"><select className={INPUT} value={String(d.versionId??"")} onChange={e=>set("versionId",e.target.value)}>{catalog.versions.map(v=><option key={v.id} value={v.id}>{v.productName} · {v.versionName}</option>)}</select></DrawerField>;
  return <Drawer icon="fileText" title={`${editor.record?"Edit":"New"} ${editor.kind}`} sub="Validated and audit-logged catalog configuration" onClose={onClose} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="primary" disabled={pending} onClick={save}>{pending?"Saving…":"Save"}</Btn></>}>
    {editor.kind==="version"&&<><DrawerField label="Product" required><select className={INPUT} value={String(d.productId)} onChange={e=>set("productId",e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></DrawerField>{field("Version name","versionName")}{field("Effective date","effectiveDate",{type:"date"})}{field("Expiry date","expiryDate",{type:"date"})}{field("Source document","sourceDocument")}{field("Confirmed current date","confirmed",{type:"date"})}{field("Notes","notes",{area:true})}</>}
    {editor.kind==="plan"&&<>{versionSelect}{field("Plan name","name")}{field("Plan family","family")}{field("Coverage tier","tier")}{field("Currency","currency")}{field("Maximum coverage","coverage",{type:"number"})}{field("Coverage description","description",{area:true})}{field("Deductible / area","deductible")}</>}
    {editor.kind==="addon"&&<>{versionSelect}<OptionalPlan d={d} set={set} plans={plans}/>{field("Add-on name","name")}{field("Description","description",{area:true})}{field("Eligibility","eligibility",{area:true})}{field("Premium rule","premiumRule",{area:true})}</>}
    {editor.kind==="discount"&&<>{versionSelect}<OptionalPlan d={d} set={set} plans={plans}/>{field("Rule name","name")}{field("Discount type","type")}{field("Discount value","value",{type:"number"})}{field("Eligibility","eligibility",{area:true})}{field("Applies to","appliesTo",{area:true})}{field("Source notes","notes",{area:true})}</>}
    {editor.kind==="rate"&&<>{versionSelect}<OptionalPlan d={d} set={set} plans={plans}/><DrawerField label="Add-on (optional)" className="mt-3"><select className={INPUT} value={String(d.addOnId)} onChange={e=>set("addOnId",e.target.value)}><option value="">None</option>{addons.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></DrawerField><div className="grid grid-cols-2 gap-x-3">{field("Age band label","ageBand")}{field("Currency","currency")}{field("Minimum age","ageMin",{type:"number"})}{field("Maximum age","ageMax",{type:"number"})}{field("Published premium","premium",{type:"number"})}<DrawerField label="Rate basis" className="mt-3"><select className={INPUT} value={String(d.rateBasis)} onChange={e=>set("rateBasis",e.target.value)}><option>Per Year</option><option>Per Trip</option><option>Per Coverage Unit</option></select></DrawerField>{field("Payment mode","paymentMode")}{field("Effective date","effectiveDate",{type:"date"})}{field("Trip type","tripType")}{field("Max travel days","days",{type:"number"})}{field("Insured type","insuredType")}{field("Coverage amount","coverage",{type:"number"})}{field("Coverage unit","unit",{type:"number"})}{field("Source page","sourcePage")}</div>{field("Source document","sourceDocument")}{field("Source effective date","sourceEffective",{type:"date"})}{field("Confirmed current date","confirmed",{type:"date"})}{field("Source notes","notes",{area:true})}</>}
    {field("Stable source key","sourceKey")}
    <label className="mt-4 flex items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={Boolean(d.active)} onChange={e=>set("active",e.target.checked)}/> Active</label>
  </Drawer>;
}
function OptionalPlan({d,set,plans}:{d:Draft;set:(k:string,v:string|boolean)=>void;plans:CatalogPlanOption[]}){return <DrawerField label="Plan (optional)" className="mt-3"><select className={INPUT} value={String(d.planId??"")} onChange={e=>set("planId",e.target.value)}><option value="">All plans / version-level</option>{plans.map(p=><option key={p.id} value={p.id}>{p.planName}</option>)}</select></DrawerField>}
