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
  // Queue filters are pushed to SQL and bounded — the cards render ≤6 rows each.
  const [stats, tasks, touchpoints, applications, renewals, claims, travel] = await Promise.all([
    getDashboardStats(),
    getTasksRepository().list({ limit: 60 }),
    getRelationshipTouchpoints(),
    getApplicationsRepository().list({ statusNotIn: ["Approved", "Lead"], limit: 12 }),
    getRenewalsRepository().list({ statusNotIn: ["Renewed", "Lapsed"], limit: 12 }),
    getClaimsRepository().list({ statusNotIn: ["Closed", "Rejected", "Credited"], limit: 12 }),
    getTravelRepository().list({ statusNotIn: ["Policy Issued"], limit: 12 }),
  ]);

  return (
    <Dashboard
      stats={stats}
      tasks={tasks}
      touchpoints={touchpoints}
      queues={{ applications, renewals, claims, travel }}
    />
  );
}
