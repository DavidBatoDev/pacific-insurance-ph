import { Dashboard } from "@/components/hub/dashboard";
import { getDashboardStats } from "@/lib/queries/dashboard";
import { getRelationshipTouchpoints } from "@/lib/queries/relationship";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimsRepository } from "@/lib/repositories/claims";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";

export const dynamic = "force-dynamic";

/** Dashboard — alerts, KPIs, revenue widget, queues and rail widgets, all live. */
export default async function Page() {
  const [stats, tasks, touchpoints, applications, renewals, claims, travel] = await Promise.all([
    getDashboardStats(),
    getTasksRepository().list(),
    getRelationshipTouchpoints(),
    getApplicationsRepository().list(),
    getRenewalsRepository().list(),
    getClaimsRepository().list(),
    getTravelRepository().list(),
  ]);

  return (
    <Dashboard
      stats={stats}
      tasks={tasks}
      touchpoints={touchpoints}
      queues={{
        applications: applications.filter((a) => a.status !== "Approved"),
        renewals: renewals.filter((r) => !["Renewed", "Lapsed"].includes(r.status)),
        claims: claims.filter((c) => !["Closed", "Rejected", "Credited"].includes(c.status)),
        travel: travel.filter((t) => t.status !== "Policy Issued"),
      }}
    />
  );
}
