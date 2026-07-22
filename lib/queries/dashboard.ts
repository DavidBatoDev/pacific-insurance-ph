import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Dashboard aggregates (design dashboard.jsx / dash-widgets.jsx, wired):
 * alert counts, KPI counts, the revenue-awaiting-collection widget, and the
 * recent activity feed. Queues reuse the operations repositories.
 */

export interface DashboardStats {
  alerts: {
    renewalsDue30: number;
    claimsAwaitingDocs: number;
    travelAwaitingPayment: number;
    appsMissingRequirements: number;
  };
  kpis: {
    activeClients: number;
    activePolicies: number;
    applicationsInProgress: number;
    openClaims: number;
    upcomingRenewals: number;
    openTravel: number;
  };
  revenue: {
    total: number;
    rows: { source: "Applications" | "Renewals" | "Travel"; amount: number; count: number }[];
  };
  /** 6-month new-record trend per KPI (sparkline + delta vs previous month). */
  trends: Record<keyof DashboardStats["kpis"], KpiTrend>;
  activity: { id: string; type: string; summary: string; actorName: string | null; when: string }[];
}

export interface KpiTrend {
  spark: number[];
  delta: string;
  dir: "up" | "down" | "flat";
}

/** Bucket created_at timestamps into counts for the last `months` months. */
function monthlyTrend(rows: { created_at: string }[] | null, months = 6): KpiTrend {
  const now = new Date();
  const spark = Array.from({ length: months }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    return (rows ?? []).filter((r) => {
      const t = new Date(r.created_at);
      return t >= m && t < next;
    }).length;
  });
  const diff = spark[months - 1] - spark[months - 2];
  return {
    spark,
    delta: diff > 0 ? `+${diff}` : String(diff),
    dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const s = getSupabaseAdmin();
  const head = { count: "exact" as const, head: true };
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const sixMonthsAgo = new Date(Date.now() - 183 * 86_400_000).toISOString();
  const trendOf = (table: "clients" | "policies" | "applications" | "claims" | "renewals" | "travel_requests") =>
    s.from(table).select("created_at").gte("created_at", sixMonthsAgo).limit(2000);

  const [
    renewalsDue30,
    claimsDocs,
    travelAwaiting,
    appsMissing,
    clients,
    policies,
    apps,
    claims,
    renewals,
    travel,
    awaitingPayments,
    activityRows,
    tClients,
    tPolicies,
    tApps,
    tClaims,
    tRenewals,
    tTravel,
  ] = await Promise.all([
    s.from("renewals").select("*", head).lte("renewal_due_date", in30).gte("renewal_due_date", today)
      .not("status", "in", '("Renewed","Paid","Lapsed")'),
    s.from("claims").select("*", head).eq("status", "Documents Pending"),
    s.from("travel_requests").select("*", head).eq("status", "Awaiting Payment"),
    s.from("applications").select("*", head).eq("status", "Missing Requirements"),
    s.from("clients").select("*", head).in("lifecycle_stage", ["Client", "Policyholder", "Renewal"]),
    s.from("policies").select("*", head).eq("status", "Active"),
    s.from("applications").select("*", head).not("status", "in", '("Approved","Lead")'),
    s.from("claims").select("*", head).not("status", "in", '("Closed","Rejected","Credited")'),
    s.from("renewals").select("*", head).not("status", "in", '("Renewed","Lapsed")'),
    s.from("travel_requests").select("*", head).neq("status", "Policy Issued"),
    s.from("payments").select("amount, application_id, renewal_id, travel_request_id").in("status", ["Awaiting", "Overdue"]),
    s.from("activity_timeline")
      .select("id, summary, activity_type, created_at, actor:users (full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    trendOf("clients"),
    trendOf("policies"),
    trendOf("applications"),
    trendOf("claims"),
    trendOf("renewals"),
    trendOf("travel_requests"),
  ]);

  const revenueRows = { Applications: { amount: 0, count: 0 }, Renewals: { amount: 0, count: 0 }, Travel: { amount: 0, count: 0 } };
  for (const p of awaitingPayments.data ?? []) {
    const bucket = p.application_id ? "Applications" : p.renewal_id ? "Renewals" : p.travel_request_id ? "Travel" : null;
    if (!bucket) continue;
    revenueRows[bucket].amount += p.amount ?? 0;
    revenueRows[bucket].count += 1;
  }

  return {
    alerts: {
      renewalsDue30: renewalsDue30.count ?? 0,
      claimsAwaitingDocs: claimsDocs.count ?? 0,
      travelAwaitingPayment: travelAwaiting.count ?? 0,
      appsMissingRequirements: appsMissing.count ?? 0,
    },
    kpis: {
      activeClients: clients.count ?? 0,
      activePolicies: policies.count ?? 0,
      applicationsInProgress: apps.count ?? 0,
      openClaims: claims.count ?? 0,
      upcomingRenewals: renewals.count ?? 0,
      openTravel: travel.count ?? 0,
    },
    revenue: {
      total: Object.values(revenueRows).reduce((a, r) => a + r.amount, 0),
      rows: (["Applications", "Renewals", "Travel"] as const).map((source) => ({
        source,
        amount: revenueRows[source].amount,
        count: revenueRows[source].count,
      })),
    },
    trends: {
      activeClients: monthlyTrend(tClients.data),
      activePolicies: monthlyTrend(tPolicies.data),
      applicationsInProgress: monthlyTrend(tApps.data),
      openClaims: monthlyTrend(tClaims.data),
      upcomingRenewals: monthlyTrend(tRenewals.data),
      openTravel: monthlyTrend(tTravel.data),
    },
    activity: (activityRows.data ?? []).map((a) => ({
      id: a.id,
      type: a.activity_type ?? "",
      summary: a.summary,
      actorName: (a.actor as { full_name: string } | null)?.full_name ?? null,
      when: new Date(a.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    })),
  };
}
