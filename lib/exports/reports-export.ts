import "server-only";

import * as XLSX from "xlsx";

import type { ReportScope } from "@/lib/queries/reports";
import { getReportsData, parseReportFilters, type Currency, type ReportFilters } from "@/lib/queries/reports";
import { buildSheet, FMT, toCsv, toDateOnly } from "./sheet-utils";

export const REPORT_EXPORT_FORMATS=["xlsx","ods","csv"] as const;
export type ReportExportFormat=(typeof REPORT_EXPORT_FORMATS)[number];
export const isReportExportFormat=(value:string|null):value is ReportExportFormat=>value!=null&&(REPORT_EXPORT_FORMATS as readonly string[]).includes(value);
const currencyFormat:Record<Currency,string>={PHP:FMT.PESO,USD:'"US$"#,##0.00',EUR:'"€"#,##0.00'};

export async function renderReportsExport(format:ReportExportFormat,filters:ReportFilters,scope:ReportScope){
  const data=await getReportsData(filters,scope);
  const generated=new Date();
  const stamp=generated.toLocaleString("en-PH",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
  const title=`Pacific Insurance PH — ${filters.family[0].toUpperCase()+filters.family.slice(1)} report`;
  const scopeNote=`${data.periodLabel}${filters.drill?` · ${filters.drill.replace(":",": ")}`:""} · ${data.detailCapped?`first 500 of ${data.detailTotal} records (capped)`: `${data.detailTotal} records`} · generated ${stamp}${data.sourceCapNotice?` · WARNING: ${data.sourceCapNotice}`:""}`;
  const summaryRows:unknown[][]=[[title],[scopeNote],[],["Metric","Currency","Value","Comparison"]];
  for(const stat of data.stats){
    if(stat.amounts){for(const code of ["PHP","USD","EUR"] as Currency[]){if(stat.amounts[code])summaryRows.push([stat.label,code,stat.amounts[code],stat.comparison??""])}}
    else summaryRows.push([stat.label,"",stat.value??0,stat.comparison??""]);
  }
  summaryRows.push([], ["Reference","Client","Product / record","Agent","Date","Status","Currency","Amount","Note"]);
  for(const row of data.detail) summaryRows.push([row.reference,row.client,row.product,row.agent,row.date??"",row.status,row.currency??"",row.amount??"",row.note??""]);
  const basename=`reports-${filters.family}-${filters.period}-${generated.toISOString().slice(0,10)}`;
  if(format==="csv") return {body:toCsv(summaryRows),contentType:"text/csv; charset=utf-8",filename:`${basename}.csv`,data};

  const wb=XLSX.utils.book_new();
  const summary=buildSheet({title,subtitle:scopeNote,columns:[{header:"Metric",width:30},{header:"Currency",width:12},{header:"Value",width:18},{header:"Comparison",width:28}],rows:data.stats.flatMap(stat=>stat.amounts?(["PHP","USD","EUR"] as Currency[]).filter(c=>stat.amounts![c]).map(c=>[stat.label,c,stat.amounts![c],stat.comparison??""]):[[stat.label,"",stat.value??0,stat.comparison??""]])});
  XLSX.utils.book_append_sheet(wb,summary,"Summary");
  const detail=buildSheet({title:`${title} — detail`,subtitle:scopeNote,columns:[{header:"Reference",width:18},{header:"Client",width:26},{header:"Product / record",width:24},{header:"Agent",width:20},{header:"Date",width:14,format:FMT.DATE},{header:"Status",width:24},{header:"Currency",width:10},{header:"Amount",width:18},{header:"Note",width:36}],rows:data.detail.map(row=>[row.reference,row.client,row.product,row.agent,toDateOnly(row.date),row.status,row.currency,row.amount,row.note])});
  data.detail.forEach((row,index)=>{if(!row.currency||row.amount==null)return;const cell=detail[XLSX.utils.encode_cell({r:4+index,c:7})];if(cell)cell.z=currencyFormat[row.currency]});
  XLSX.utils.book_append_sheet(wb,detail,"Detail");
  const bookType=format==="ods"?"ods":"xlsx";
  const body=XLSX.write(wb,{type:"buffer",bookType,compression:true}) as Buffer;
  return {body,contentType:format==="ods"?"application/vnd.oasis.opendocument.spreadsheet":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",filename:`${basename}.${format}`,data};
}

export { parseReportFilters };
