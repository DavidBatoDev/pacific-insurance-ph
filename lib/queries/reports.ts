import "server-only";

import type { AppRole } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const REPORT_FAMILIES = ["overview", "sales", "commission", "agents", "conversion", "renewal"] as const;
export const REPORT_PERIODS = ["ytd", "quarter", "month"] as const;
export type ReportFamily = (typeof REPORT_FAMILIES)[number];
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export type Currency = "PHP" | "USD" | "EUR";
export type MoneyTotals = Record<Currency, number>;

export interface ReportFilters { family: ReportFamily; period: ReportPeriod; drill: string | null }
export interface ReportScope { role: AppRole; userId: string }
export interface ReportChartPoint { label: string; count: number; amounts: MoneyTotals; drill: string }
export interface ReportStat { label: string; value?: number; amounts?: MoneyTotals; comparison?: string; family?: ReportFamily; drill?: string }
export interface ReportDetailRow {
  id: string; href: string; reference: string; client: string; product: string;
  agent: string; date: string | null; status: string; currency: Currency | null;
  amount: number | null; secondaryAmount?: number | null; note?: string;
}
export interface ReportsData {
  filters: ReportFilters; periodLabel: string; comparisonLabel: string; stats: ReportStat[];
  charts: { title: string; points: ReportChartPoint[]; restricted?: boolean }[];
  detail: ReportDetailRow[]; detailTotal: number; detailCapped: boolean;
  canSeeAgentCommission: boolean; sourceCapped: boolean; sourceCapNotice: string | null;
}

export const REPORT_DETAIL_CAP = 500;
const EMPTY_MONEY = (): MoneyTotals => ({ PHP: 0, USD: 0, EUR: 0 });
const currency = (value: string | null | undefined): Currency =>
  value === "USD" || value === "EUR" ? value : "PHP";
const addMoney = (totals: MoneyTotals, value: number | null | undefined, code?: string | null) => {
  totals[currency(code)] += Number(value ?? 0);
};
const inRange = (value: string | null | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date < end;
};
const person = (row: { first_name: string; last_name: string } | null | undefined) =>
  row ? `${row.first_name} ${row.last_name}`.trim() : "—";

export function parseReportFilters(input: Record<string, string | string[] | undefined>): ReportFilters {
  const one = (key: string) => Array.isArray(input[key]) ? input[key]?.[0] : input[key];
  const familyValue = one("family");
  const periodValue = one("period");
  return {
    family: REPORT_FAMILIES.includes(familyValue as ReportFamily) ? familyValue as ReportFamily : "overview",
    period: REPORT_PERIODS.includes(periodValue as ReportPeriod) ? periodValue as ReportPeriod : "ytd",
    drill: one("drill")?.slice(0, 100) || null,
  };
}

export function reportRange(period: ReportPeriod, now = new Date()) {
  const year = now.getFullYear(); const month = now.getMonth();
  if (period === "month") {
    const start = new Date(year, month, 1), end = new Date(year, month + 1, 1);
    const previousStart = new Date(year, month - 1, 1), previousEnd = start;
    return { start, end, previousStart, previousEnd, label: start.toLocaleDateString("en-PH", { month: "long", year: "numeric" }), comparisonLabel: "previous month" };
  }
  if (period === "quarter") {
    const q = Math.floor(month / 3), start = new Date(year, q * 3, 1), end = new Date(year, q * 3 + 3, 1);
    const previousStart = new Date(year, q * 3 - 3, 1), previousEnd = start;
    return { start, end, previousStart, previousEnd, label: `Q${q + 1} ${year}`, comparisonLabel: "previous quarter" };
  }
  const start = new Date(year, 0, 1), end = new Date(year, month, now.getDate() + 1);
  const previousStart = new Date(year - 1, 0, 1), previousEnd = new Date(year - 1, month, now.getDate() + 1);
  return { start, end, previousStart, previousEnd, label: `Year to date ${year}`, comparisonLabel: "prior-year YTD" };
}

type Client = { id:string; reference_no:string|null; first_name:string; last_name:string; assigned_user_id:string|null; created_at:string; lead_stage:string|null; lead_status:string|null; lifecycle_stage:string; product_interest:string|null };
type User = { id:string; full_name:string };
type ProductJoin = { product:{ name:string }|null }|null;
type Policy = { id:string; reference_no:string|null; client_id:string; assigned_user_id:string|null; status:string; effective_date:string|null; created_at:string; premium_amount:number|null; currency:string|null; product_versions:ProductJoin; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null };
type Application = { id:string; reference_no:string|null; client_id:string; assigned_user_id:string|null; status:string; policy_id:string|null; policy_issued_date:string|null; date_submitted:string|null; created_at:string; estimated_premium:number|null; product_versions:ProductJoin; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null };
type Travel = { id:string; reference_no:string|null; client_id:string; assigned_user_id:string|null; status:string; updated_at:string; created_at:string; quoted_premium:number|null; currency:string|null; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null };
type Payment = { id:string; reference_no:string|null; client_id:string|null; policy_id:string|null; status:string; payment_date:string|null; amount:number|null; currency:string|null; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null; policies:{reference_no:string|null;assigned_user_id:string|null}|null };
type Commission = { id:string; client_id:string|null; policy_id:string|null; or_number:string|null; voucher_status:string; created_at:string; updated_at:string; paid_date:string|null; received_date:string|null; follow_up_date:string|null; amount:number|null; estimated_amount:number|null; currency:string|null; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null; policies:{reference_no:string|null;premium_amount:number|null;assigned_user_id:string|null}|null; external_contacts:{name:string}|null };
type Renewal = { id:string; reference_no:string|null; client_id:string; policy_id:string; status:string; renewal_due_date:string|null; created_at:string; clients:{first_name:string;last_name:string;assigned_user_id:string|null}|null; policies:{reference_no:string|null;policy_number:string|null;premium_amount:number|null;currency:string|null;assigned_user_id:string|null}|null };

const nameFor = (users: Map<string,string>, id: string|null|undefined) => id ? users.get(id) ?? "Unassigned" : "Unassigned";
const ownerOf = (row: { assigned_user_id?:string|null; clients?:{assigned_user_id:string|null}|null; policies?:{assigned_user_id:string|null}|null }) => row.assigned_user_id ?? row.policies?.assigned_user_id ?? row.clients?.assigned_user_id ?? null;
const permitted = (scope: ReportScope, row: Parameters<typeof ownerOf>[0]) => scope.role !== "agent" || ownerOf(row) === scope.userId;
const pointMap = (rows: { label:string; amount?:number|null; currency?:string|null; drill:string }[]) => {
  const map = new Map<string, ReportChartPoint>();
  for (const row of rows) {
    const point = map.get(row.label) ?? { label: row.label, count: 0, amounts: EMPTY_MONEY(), drill: row.drill };
    point.count += 1; addMoney(point.amounts, row.amount, row.currency); map.set(row.label, point);
  }
  return [...map.values()];
};
const delta = (current: MoneyTotals, previous: MoneyTotals) => {
  const parts = (["PHP","USD","EUR"] as Currency[]).filter((c) => current[c] || previous[c]).map((c) => {
    if (!previous[c]) return `${c} new`;
    const pct = ((current[c] - previous[c]) / previous[c]) * 100;
    return `${c} ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  });
  return parts.join(" · ") || "No prior activity";
};

export async function getReportsData(filters: ReportFilters, scope: ReportScope): Promise<ReportsData> {
  const db = getSupabaseAdmin();
  const [clientsQ, usersQ, policiesQ, appsQ, travelQ, paymentsQ, commissionsQ, renewalsQ] = await Promise.all([
    db.from("clients").select("id,reference_no,first_name,last_name,assigned_user_id,created_at,lead_stage,lead_status,lifecycle_stage,product_interest",{count:"exact"}).limit(5000),
    db.from("users").select("id,full_name",{count:"exact"}).limit(5000),
    db.from("policies").select("id,reference_no,client_id,assigned_user_id,status,effective_date,created_at,premium_amount,currency,product_versions(product:products(name)),clients(first_name,last_name,assigned_user_id)",{count:"exact"}).limit(5000),
    db.from("applications").select("id,reference_no,client_id,assigned_user_id,status,policy_id,policy_issued_date,date_submitted,created_at,estimated_premium,product_versions(product:products(name)),clients(first_name,last_name,assigned_user_id)",{count:"exact"}).limit(5000),
    db.from("travel_requests").select("id,reference_no,client_id,assigned_user_id,status,updated_at,created_at,quoted_premium,currency,clients(first_name,last_name,assigned_user_id)",{count:"exact"}).limit(5000),
    db.from("payments").select("id,reference_no,client_id,policy_id,status,payment_date,amount,currency,clients(first_name,last_name,assigned_user_id),policies(reference_no,assigned_user_id)",{count:"exact"}).limit(5000),
    db.from("commissions").select("id,client_id,policy_id,or_number,voucher_status,created_at,updated_at,paid_date,received_date,follow_up_date,amount,estimated_amount,currency,clients(first_name,last_name,assigned_user_id),policies(reference_no,premium_amount,assigned_user_id),external_contacts(name)",{count:"exact"}).limit(5000),
    db.from("renewals").select("id,reference_no,client_id,policy_id,status,renewal_due_date,created_at,clients(first_name,last_name,assigned_user_id),policies(reference_no,policy_number,premium_amount,currency,assigned_user_id)",{count:"exact"}).limit(5000),
  ]);
  const failure = [clientsQ, usersQ, policiesQ, appsQ, travelQ, paymentsQ, commissionsQ, renewalsQ].find((q) => q.error)?.error;
  if (failure) throw new Error(`Reports query failed: ${failure.message}`);
  const sourceCounts:[string,number|null][]=[["contacts",clientsQ.count],["users",usersQ.count],["policies",policiesQ.count],["applications",appsQ.count],["travel",travelQ.count],["payments",paymentsQ.count],["commissions",commissionsQ.count],["renewals",renewalsQ.count]];
  const cappedSources=sourceCounts.filter(([,count])=>(count??0)>5000).map(([name])=>name);
  const sourceCapped=cappedSources.length>0;
  const sourceCapNotice=sourceCapped?`Source data exceeded 5,000 rows for ${cappedSources.join(", ")}; aggregate totals may be incomplete.`:null;
  const clients = (clientsQ.data ?? []) as Client[], users = new Map(((usersQ.data ?? []) as User[]).map((u) => [u.id,u.full_name]));
  const policies = ((policiesQ.data ?? []) as unknown as Policy[]).filter((r) => permitted(scope,r));
  const apps = ((appsQ.data ?? []) as unknown as Application[]).filter((r) => permitted(scope,r));
  const travel = ((travelQ.data ?? []) as unknown as Travel[]).filter((r) => permitted(scope,r));
  const payments = ((paymentsQ.data ?? []) as unknown as Payment[]).filter((r) => permitted(scope,r));
  const commissions = ((commissionsQ.data ?? []) as unknown as Commission[]).filter((r) => permitted(scope,r));
  const renewals = ((renewalsQ.data ?? []) as unknown as Renewal[]).filter((r) => permitted(scope,r));
  const visibleClients = clients.filter((r) => permitted(scope,r));
  const range = reportRange(filters.period);
  const currentPayments = payments.filter((p) => p.status === "Verified" && inRange(p.payment_date,range.start,range.end));
  const priorPayments = payments.filter((p) => p.status === "Verified" && inRange(p.payment_date,range.previousStart,range.previousEnd));
  const revenue = EMPTY_MONEY(), priorRevenue = EMPTY_MONEY();
  currentPayments.forEach((p) => addMoney(revenue,p.amount,p.currency)); priorPayments.forEach((p) => addMoney(priorRevenue,p.amount,p.currency));

  const issuedPolicies = policies.filter((p) => p.status !== "Pending" && inRange(p.effective_date ?? p.created_at,range.start,range.end));
  const issuedApps = apps.filter((a) => a.status === "Approved" && !a.policy_id && inRange(a.policy_issued_date ?? a.date_submitted ?? a.created_at,range.start,range.end));
  const issuedTravel = travel.filter((t) => t.status === "Policy Issued" && inRange(t.updated_at ?? t.created_at,range.start,range.end));
  const priorIssuedPolicies = policies.filter((p) => p.status !== "Pending" && inRange(p.effective_date ?? p.created_at,range.previousStart,range.previousEnd));
  const priorIssuedTravel = travel.filter((t) => t.status === "Policy Issued" && inRange(t.updated_at ?? t.created_at,range.previousStart,range.previousEnd));
  const sales = [
    ...issuedPolicies.map((p) => ({ id:p.id,href:"/policies",reference:p.reference_no??"—",client:person(p.clients),product:p.product_versions?.product?.name??"Policy",agent:nameFor(users,ownerOf(p)),date:p.effective_date??p.created_at,status:p.status,currency:currency(p.currency),amount:p.premium_amount,kind:"Policy" })),
    ...issuedApps.map((a) => ({ id:a.id,href:"/applications",reference:a.reference_no??"—",client:person(a.clients),product:a.product_versions?.product?.name??a.status,agent:nameFor(users,ownerOf(a)),date:a.policy_issued_date??a.date_submitted??a.created_at,status:a.status,currency:null,amount:null,kind:"Application" })),
    ...issuedTravel.map((t) => ({ id:t.id,href:"/travel",reference:t.reference_no??"—",client:person(t.clients),product:"Travel",agent:nameFor(users,ownerOf(t)),date:t.updated_at,status:t.status,currency:currency(t.currency),amount:t.quoted_premium,kind:"Travel" })),
  ];
  const salesMoney=EMPTY_MONEY(); sales.forEach((r)=>addMoney(salesMoney,r.amount,r.currency));
  const priorSalesMoney=EMPTY_MONEY(); priorIssuedPolicies.forEach((r)=>addMoney(priorSalesMoney,r.premium_amount,r.currency)); priorIssuedTravel.forEach((r)=>addMoney(priorSalesMoney,r.quoted_premium,r.currency));
  const commissionDate=(c:Commission)=>c.voucher_status==="Paid"?(c.paid_date??c.updated_at):c.voucher_status==="Received"?(c.received_date??c.updated_at):c.voucher_status==="Issue / Follow-Up Required"?(c.follow_up_date??c.updated_at):c.voucher_status==="Voucher Pending"?c.updated_at:c.created_at;
  const commissionRows = commissions.filter((c)=>inRange(commissionDate(c),range.start,range.end)).map((c)=>{
    const own=ownerOf(c)===scope.userId, hidden=scope.role==="staff"&&!own;
    return { id:c.id,href:"/payments?tab=commissions",reference:c.or_number??"—",client:person(c.clients),product:c.policies?.reference_no??"Policy",agent:nameFor(users,ownerOf(c)),date:commissionDate(c),status:c.voucher_status,currency:currency(c.currency),amount:hidden?null:(c.amount??c.estimated_amount),secondaryAmount:hidden?null:c.estimated_amount,note:hidden?"Commission amount hidden for another agent":c.external_contacts?.name??undefined };
  });
  const commissionMoney=EMPTY_MONEY(); commissions.filter((c)=>inRange(commissionDate(c),range.start,range.end)).forEach((c)=>addMoney(commissionMoney,c.amount??c.estimated_amount,c.currency));
  const conversion = visibleClients.filter((c)=>inRange(c.created_at,range.start,range.end));
  const renewalRows = renewals.filter((r)=>inRange(r.renewal_due_date,range.start,range.end)).map((r)=>({id:r.id,href:"/renewals",reference:r.reference_no??r.policies?.reference_no??"—",client:person(r.clients),product:r.policies?.policy_number??"Policy",agent:nameFor(users,ownerOf(r)),date:r.renewal_due_date,status:r.status,currency:currency(r.policies?.currency),amount:r.policies?.premium_amount??null}));
  const retained=renewalRows.filter((r)=>r.status==="Renewed").length, lapsed=renewalRows.filter((r)=>r.status==="Lapsed").length;
  const canSeeAgentCommission=scope.role==="admin";

  let stats:ReportStat[]=[], charts:ReportsData["charts"]=[], detail:ReportDetailRow[]=[];
  if(filters.family==="overview"){
    stats=[{label:"Verified premium revenue",amounts:revenue,comparison:delta(revenue,priorRevenue),family:"sales"},{label:"Active clients",value:visibleClients.filter((c)=>["Client","Policyholder","Renewal"].includes(c.lifecycle_stage)).length,family:"agents"},{label:"Issued records",value:sales.length,family:"sales"},{label:"Renewal rate",value:retained+lapsed?retained/(retained+lapsed)*100:0,family:"renewal"}];
    charts=[{title:"Verified premium revenue by month",points:pointMap(currentPayments.map((p)=>({label:new Date(p.payment_date!).toLocaleDateString("en-PH",{month:"short"}),amount:p.amount,currency:p.currency,drill:`month:${p.payment_date!.slice(0,7)}`})))},{title:"Product mix · issued-record count",points:pointMap(sales.map((r)=>({label:r.product,drill:`product:${r.product}`})))}];
    detail=currentPayments.map((p)=>({id:p.id,href:"/payments",reference:p.reference_no??"—",client:person(p.clients),product:p.policies?.reference_no??"Payment",agent:nameFor(users,ownerOf(p)),date:p.payment_date,status:p.status,currency:currency(p.currency),amount:p.amount}));
  } else if(filters.family==="sales"){
    stats=[{label:"Premium",amounts:salesMoney,comparison:delta(salesMoney,priorSalesMoney)},{label:"Policies issued",value:sales.length},{label:"Average premium",amounts:(()=>{const m=EMPTY_MONEY(); (["PHP","USD","EUR"] as Currency[]).forEach(c=>m[c]=sales.filter(r=>r.currency===c&&r.amount!=null).length?salesMoney[c]/sales.filter(r=>r.currency===c&&r.amount!=null).length:0);return m;})()},{label:"Travel issued",value:issuedTravel.length,drill:"kind:Travel"}];
    charts=[{title:"Sales by month",points:pointMap(sales.map(r=>({label:new Date(r.date).toLocaleDateString("en-PH",{month:"short"}),amount:r.amount,currency:r.currency,drill:`month:${r.date.slice(0,7)}`})))},{title:"Sales by product",points:pointMap(sales.map(r=>({label:r.product,amount:r.amount,currency:r.currency,drill:`product:${r.product}`})))},{title:"Sales by agent",points:pointMap(sales.map(r=>({label:r.agent,amount:r.amount,currency:r.currency,drill:`agent:${r.agent}`})))}]; detail=sales;
  } else if(filters.family==="commission"){
    const count=(s:string)=>commissionRows.filter(r=>r.status===s).length;
    stats=[{label:"Commission",amounts:commissionMoney},{label:"Requested",value:count("Voucher Pending"),drill:"status:Voucher Pending"},{label:"Follow-up",value:count("Issue / Follow-Up Required"),drill:"status:Issue / Follow-Up Required"},{label:"Received / Paid",value:count("Received")+count("Paid")}];
    charts=[{title:"Commission by status",points:pointMap(commissionRows.map(r=>({label:r.status,amount:r.amount,currency:r.currency,drill:`status:${r.status}`})))},{title:"Commission by agent",restricted:!canSeeAgentCommission,points:canSeeAgentCommission?pointMap(commissionRows.map(r=>({label:r.agent,amount:r.amount,currency:r.currency,drill:`agent:${r.agent}`}))):[]}]; detail=commissionRows;
  } else if(filters.family==="agents"){
    const agentNames=scope.role==="agent"?[nameFor(users,scope.userId)]:[...new Set([...sales.map(r=>r.agent),...conversion.map(c=>nameFor(users,c.assigned_user_id))])];
    const points=agentNames.map(name=>{const ownedSales=sales.filter(r=>r.agent===name), amounts=EMPTY_MONEY();ownedSales.forEach(r=>addMoney(amounts,r.amount,r.currency));return {label:name,count:ownedSales.length,amounts,drill:`agent:${name}`};});
    stats=[{label:"Agents",value:agentNames.length},{label:"Leads worked",value:conversion.length},{label:"Policies",value:sales.length},{label:"Commission",amounts:scope.role==="staff"?EMPTY_MONEY():commissionMoney}]; charts=[{title:"Agent performance · issued records",points}]; detail=sales;
  } else if(filters.family==="conversion"){
    const stages=["New Lead","Contacted","Discovery","Proposal","Product Selected","Application Started","Converted"];
    const stage=(c:Client)=>c.lead_status==="Lost"?"Lost":c.lifecycle_stage==="Lead"?(c.lead_stage??"New Lead"):c.lifecycle_stage==="Applicant"?"Application Started":["Client","Policyholder","Renewal"].includes(c.lifecycle_stage)?"Converted":c.lifecycle_stage;
    const points=stages.map(label=>({label,count:conversion.filter(c=>stage(c)===label).length,amounts:EMPTY_MONEY(),drill:`stage:${label}`})); const converted=points.at(-1)?.count??0;
    stats=[{label:"New contacts",value:conversion.length},{label:"Converted",value:converted,drill:"stage:Converted"},{label:"Overall conversion",value:conversion.length?converted/conversion.length*100:0},{label:"Lost",value:conversion.filter(c=>c.lead_status==="Lost").length,drill:"status:Lost"}];charts=[{title:"Current lifecycle stage · contacts created in period",points}];detail=conversion.map(c=>({id:c.id,href:`/clients/${c.id}`,reference:c.reference_no??"—",client:person(c),product:c.product_interest??"—",agent:nameFor(users,c.assigned_user_id),date:c.created_at,status:stage(c),currency:null,amount:null,note:c.lead_status??undefined}));
  } else {
    stats=[{label:"Renewal rate",value:retained+lapsed?retained/(retained+lapsed)*100:0},{label:"Retained",value:retained,drill:"status:Renewed"},{label:"Lapsed",value:lapsed,drill:"status:Lapsed"},{label:"Due in period",value:renewalRows.length}];charts=[{title:"Retained vs lapsed · by due date",points:pointMap(renewalRows.filter(r=>["Renewed","Lapsed"].includes(r.status)).map(r=>({label:r.status,amount:r.amount,currency:r.currency,drill:`status:${r.status}`})))},{title:"Renewals by month",points:pointMap(renewalRows.map(r=>({label:new Date(r.date!).toLocaleDateString("en-PH",{month:"short"}),amount:r.amount,currency:r.currency,drill:`month:${r.date!.slice(0,7)}`})))}];detail=renewalRows;
  }
  if(filters.drill){const [kind,...rest]=filters.drill.split(":"),value=rest.join(":");detail=detail.filter(r=>kind==="status"?r.status===value:kind==="agent"?r.agent===value:kind==="product"?r.product===value:kind==="month"?r.date?.slice(0,7)===value:kind==="kind"?r.product===value:kind==="stage"?r.status===value:true);}
  detail.sort((a,b)=>(b.date??"").localeCompare(a.date??"")); const detailTotal=detail.length;
  return {filters,periodLabel:range.label,comparisonLabel:range.comparisonLabel,stats,charts,detail:detail.slice(0,REPORT_DETAIL_CAP),detailTotal,detailCapped:detailTotal>REPORT_DETAIL_CAP,canSeeAgentCommission,sourceCapped,sourceCapNotice};
}
