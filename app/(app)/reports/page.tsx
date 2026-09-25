import { ReportsScreen } from "@/components/hub/screens/reports";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getReportsData, parseReportFilters, type ReportScope } from "@/lib/queries/reports";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const filters = parseReportFilters(await searchParams);
  const userPromise = getCurrentUser();
  // The report queries don't depend on the user — scope is applied to the rows after
  // fetching — so they start alongside the user lookup. Nothing renders until the
  // permission check below passes; an unresolved user gets the narrowest scope.
  const scope: Promise<ReportScope> = userPromise.then((u) => (u ? { role: toAppRole(u.role), userId: u.id } : { role: "agent", userId: "" }));
  const dataPromise = getReportsData(filters, scope);
  dataPromise.catch(() => {});

  const user = await userPromise;
  if(!user) redirect("/login");
  const role=toAppRole(user.role);
  if(!can(role,"reports","view")) redirect("/dashboard");
  const data = await dataPromise;
  return <ReportsScreen data={data}/>;
}
