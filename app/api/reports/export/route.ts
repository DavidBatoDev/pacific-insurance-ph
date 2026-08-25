import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, toAppRole } from "@/lib/auth/permissions";
import { isReportExportFormat, renderReportsExport, REPORT_EXPORT_FORMATS } from "@/lib/exports/reports-export";
import { parseReportFilters } from "@/lib/queries/reports";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL("/login",request.url));
  const role=toAppRole(user.role);
  if(!can(role,"reports","export"))return new NextResponse("You do not have permission to export reports.",{status:403});
  const params=new URL(request.url).searchParams;
  const format=params.get("format")??"xlsx";
  if(!isReportExportFormat(format))return new NextResponse(`Unsupported export format "${format}". Expected one of: ${REPORT_EXPORT_FORMATS.join(", ")}.`,{status:400});
  const filters=parseReportFilters(Object.fromEntries(params.entries()));
  try{
    const {body,contentType,filename,data}=await renderReportsExport(format,filters,{role,userId:user.id});
    await recordAudit({actorId:user.id,action:"export",tableName:"reports",newValue:{format,filename,family:filters.family,period:filters.period,drill:filters.drill,role,recordCount:data.detail.length,detailTotal:data.detailTotal,capped:data.detailCapped}});
    return new NextResponse(typeof body === "string" ? body : new Uint8Array(body),{headers:{"Content-Type":contentType,"Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"no-store"}});
  }catch(error){console.error("Reports export failed:",error);return NextResponse.redirect(new URL(`/reports?family=${filters.family}&period=${filters.period}&exportError=1`,request.url));}
}
