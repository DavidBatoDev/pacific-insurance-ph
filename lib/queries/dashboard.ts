import "server-only";

import { ownerScopedSelect, ownerScopeFilter } from "@/lib/repositories/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type AwaitingPaymentRow = Pick<
  Database["public"]["Tables"]["payments"]["Row"],
  "amount" | "currency" | "application_id" | "renewal_id" | "travel_request_id"
>;

/**
 * Dashboard aggregates:
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
    /** Awaiting amounts per currency (e.g. { PHP: 3099724, USD: 1200 }); never merged (DH15). */
    totals: Record<string, number>;
    rows: {
      source: "Applications" | "Renewals" | "Travel";
      amounts: Record<string, number>;
      count: number;
    }[];
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

/**
 * `ownerUserId` (from `getAgentScope()`) narrows every count, sum, trend and the activity feed to
 * that agent's book; null keeps the whole agency.
 */
export async function getDashboardStats(ownerUserId: string | null = null): Promise<DashboardStats> {
  const s = getSupabaseAdmin();
  const head = { count: "exact" as const, head: true };
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Agent scope: child rows inner-join their client; clients filter their own owner column.
  const scoped = (select: string) => ownerScopedSelect(select, ownerUserId);
  const ownChild = <Q extends { eq(column: string, value: string): Q }>(query: Q) => ownerScopeFilter(query, ownerUserId);
  const ownClients = <Q extends { eq(column: string, value: string): Q }>(query: Q) =>
    ownerUserId ? query.eq("assigned_user_id", ownerUserId) : query;

  const sixMonthsAgo = new Date(Date.now() - 183 * 86_400_000).toISOString();
  const trendOf = (table: "policies" | "applications" | "claims" | "renewals" | "travel_requests") =>
    ownChild(s.from(table).select(scoped("created_at")).gte("created_at", sixMonthsAgo))
      .limit(2000)
      .returns<{ created_at: string }[]>();

  const recentActivity = async () => {
    let query = s.from("activity_timeline")
      .select("id, summary, activity_type, created_at, actor:users (full_name)")
      .order("created_at", { ascending: false })
      .limit(8);
    if (ownerUserId) {
      // Activity rows reference their client by scope_type/scope_id (no FK), so match the agent's client ids.
      const { data: ownedClients } = await s.from("clients").select("id").eq("assigned_user_id", ownerUserId);
      query = query.eq("scope_type", "client").in("scope_id", (ownedClients ?? []).map((c) => c.id));
    }
    return query;
  };

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
    ownChild(s.from("renewals").select(scoped("*"), head).lte("renewal_due_date", in30).gte("renewal_due_date", today)
      .not("status", "in", '("Renewed","Paid","Lapsed")')),
    ownChild(s.from("claims").select(scoped("*"), head).eq("status", "Documents Pending")),
    ownChild(s.from("travel_requests").select(scoped("*"), head).eq("status", "Awaiting Payment")),
    ownChild(s.from("applications").select(scoped("*"), head).eq("status", "Missing Requirements")),
    ownClients(s.from("clients").select("*", head).in("lifecycle_stage", ["Client", "Policyholder", "Renewal"]).eq("status", "Active")),
    ownChild(s.from("policies").select(scoped("*"), head).eq("status", "Active")),
    ownChild(s.from("applications").select(scoped("*"), head).not("status", "in", '("Approved","Lead")')),
    ownChild(s.from("claims").select(scoped("*"), head).not("status", "in", '("Closed","Rejected","Credited")')),
    ownChild(s.from("renewals").select(scoped("*"), head).not("status", "in", '("Renewed","Lapsed")')),
    ownChild(s.from("travel_requests").select(scoped("*"), head).neq("status", "Policy Issued")),
    ownChild(s.from("payments").select(scoped("amount, currency, application_id, renewal_id, travel_request_id"))
      .in("status", ["Awaiting", "Overdue"])).returns<AwaitingPaymentRow[]>(),
    recentActivity(),
    ownClients(s.from("clients").select("created_at").gte("created_at", sixMonthsAgo)).limit(2000),
    trendOf("policies"),
    trendOf("applications"),
    trendOf("claims"),
    trendOf("renewals"),
    trendOf("travel_requests"),
  ]);

  const revenueRows: Record<"Applications" | "Renewals" | "Travel", { amounts: Record<string, number>; count: number }> = {
    Applications: { amounts: {}, count: 0 },
    Renewals: { amounts: {}, count: 0 },
    Travel: { amounts: {}, count: 0 },
  };
  const revenueTotals: Record<string, number> = {};
  for (const p of awaitingPayments.data ?? []) {
    const bucket = p.application_id ? "Applications" : p.renewal_id ? "Renewals" : p.travel_request_id ? "Travel" : null;
    if (!bucket) continue;
    const currency = p.currency ?? "PHP";
    const amount = p.amount ?? 0;
    revenueRows[bucket].amounts[currency] = (revenueRows[bucket].amounts[currency] ?? 0) + amount;
    revenueTotals[currency] = (revenueTotals[currency] ?? 0) + amount;
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
      totals: revenueTotals,
      rows: (["Applications", "Renewals", "Travel"] as const).map((source) => ({
        source,
        amounts: revenueRows[source].amounts,
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
