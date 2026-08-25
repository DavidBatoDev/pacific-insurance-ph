import { ReportsScreen } from "@/components/hub/screens/reports";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getReportsData, parseReportFilters } from "@/lib/queries/reports";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const user=await getCurrentUser();
  if(!user) redirect("/login");
  const role=toAppRole(user.role);
  if(!can(role,"reports","view")) redirect("/dashboard");
  const data=await getReportsData(parseReportFilters(await searchParams),{role,userId:user.id});
  return <ReportsScreen data={data}/>;
}
