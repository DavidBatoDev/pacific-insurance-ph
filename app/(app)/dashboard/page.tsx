import { Dashboard } from "@/components/hub/dashboard";
import { getAgentScope } from "@/lib/auth/agent-scope";
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
  // An Agent sees only their own book (Phase J9); Admin/Staff get null and the whole agency.
  const ownerUserId = await getAgentScope();
  const [stats, tasks, touchpoints, applications, renewals, claims, travel, leadApplications] = await Promise.all([
    getDashboardStats(ownerUserId),
    getTasksRepository().list({ limit: 60, ownerUserId }),
    getRelationshipTouchpoints(undefined, ownerUserId),
    getApplicationsRepository().list({ statusNotIn: ["Approved", "Lead"], limit: 12, ownerUserId }),
    getRenewalsRepository().list({ statusNotIn: ["Renewed", "Lapsed"], limit: 12, ownerUserId }),
    getClaimsRepository().list({ statusNotIn: ["Closed", "Rejected", "Credited"], limit: 12, ownerUserId }),
    getTravelRepository().list({ statusNotIn: ["Policy Issued"], limit: 12, ownerUserId }),
    // Wizard drafts are stored as Lead applications carrying their form in wizard_state.
    getApplicationsRepository().list({ statusIn: ["Lead"], limit: 12, ownerUserId }),
  ]);
  const drafts = leadApplications
    .filter((a) => !!a.wizardState && typeof a.wizardState === "object" && !Array.isArray(a.wizardState))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <Dashboard
      stats={stats}
      tasks={tasks}
      touchpoints={touchpoints}
      queues={{ applications, renewals, claims, travel, drafts }}
    />
  );
}
