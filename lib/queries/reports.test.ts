import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        limit: async () => {
          const data = source.tables[table] ?? [];
          return { data, error: null, count: data.length };
        },
      }),
    }),
  }),
}));

import { renderReportsExport } from "@/lib/exports/reports-export";
import { getReportsData, type ReportFilters, type ReportScope, type ReportsData } from "./reports";

const AGENT = "agent-1";
const OTHER = "agent-2";
const agentScope: ReportScope = { role: "agent", userId: AGENT };
const adminScope: ReportScope = { role: "admin", userId: "admin-1" };
const filters = (family: ReportFilters["family"], drill: string | null = null): ReportFilters => ({ family, period: "month", drill });

const renewal = (id: string, status: string, due: string, owner = AGENT) => ({
  id,
  reference_no: `RN-${id}`,
  client_id: `client-${id}`,
  policy_id: `policy-${id}`,
  status,
  renewal_due_date: due,
  created_at: "2026-01-02T00:00:00.000Z",
  clients: { first_name: "Client", last_name: id, assigned_user_id: owner },
  policies: { reference_no: `POL-${id}`, policy_number: `PN-${id}`, premium_amount: 1000, currency: "PHP", assigned_user_id: owner },
});

/** November 2026 is the frozen "month" period. */
const RENEWALS = [
  renewal("paid-1", "Paid", "2026-11-05"),
  renewal("paid-2", "Paid", "2026-11-08"),
  renewal("renewed-1", "Renewed", "2026-11-10"),
  renewal("lapsed-1", "Lapsed", "2026-11-12"),
  renewal("upcoming-1", "Upcoming", "2026-11-25"),
  renewal("old-renewed", "Renewed", "2026-10-15"),
  renewal("next-paid", "Paid", "2026-12-15"),
  renewal("other-renewed", "Renewed", "2026-11-11", OTHER),
  renewal("other-paid", "Paid", "2026-11-13", OTHER),
];
const RETAINED_IDS = ["paid-1", "paid-2", "renewed-1"];

const stat = (data: ReportsData, label: string) => data.stats.find((s) => s.label === label);
const RETENTION_CHART = "Retained vs lapsed · by due date";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T04:00:00.000Z"));
  source.tables = {
    users: [{ id: AGENT, full_name: "Ana Agent" }, { id: OTHER, full_name: "Ben Other" }],
    renewals: RENEWALS,
    policies: [{
      id: "pol-1",
      reference_no: "PO-pol-1",
      client_id: "client-pol-1",
      assigned_user_id: AGENT,
      status: "Active",
      effective_date: "2026-11-03",
      created_at: "2026-01-02T00:00:00.000Z",
      premium_amount: 5000,
      currency: "PHP",
      product_versions: { product: { name: "Select" } },
      clients: { first_name: "Client", last_name: "pol-1", assigned_user_id: AGENT },
    }],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("renewal retention reporting", () => {
  it("counts Paid and Renewed as retained within the period and the agent's scope", async () => {
    const data = await getReportsData(filters("renewal"), agentScope);

    expect(stat(data, "Renewal rate")?.value).toBe(75);
    expect(stat(data, "Retained")).toMatchObject({ value: 3, drill: "outcome:retained" });
    expect(stat(data, "Lapsed")).toMatchObject({ value: 1, drill: "status:Lapsed" });
    expect(stat(data, "Due in period")?.value).toBe(5);
    expect(data.detailTotal).toBe(5);
  });

  it("uses the same retention rate on the Overview family", async () => {
    const data = await getReportsData(filters("overview"), agentScope);
    expect(stat(data, "Renewal rate")).toMatchObject({ value: 75, family: "renewal" });
  });

  it("includes other agents' in-period outcomes only for agency-wide scope", async () => {
    const data = await getReportsData(filters("renewal"), adminScope);
    expect(stat(data, "Retained")?.value).toBe(5);
    expect(stat(data, "Lapsed")?.value).toBe(1);
    expect(stat(data, "Renewal rate")?.value).toBeCloseTo((5 / 6) * 100, 10);
    expect(stat(data, "Due in period")?.value).toBe(7);
  });

  it("groups Paid and Renewed into one Retained chart bar with the retained drill", async () => {
    const chart = (await getReportsData(filters("renewal"), agentScope)).charts.find((c) => c.title === RETENTION_CHART);

    expect(chart?.points).toHaveLength(2);
    expect(chart?.points).toContainEqual({ label: "Retained", count: 3, amounts: { PHP: 3000, USD: 0, EUR: 0 }, drill: "outcome:retained" });
    expect(chart?.points).toContainEqual({ label: "Lapsed", count: 1, amounts: { PHP: 1000, USD: 0, EUR: 0 }, drill: "status:Lapsed" });
  });

  it("outcome:retained drills to exactly the in-scope retained cycles with their original statuses", async () => {
    const data = await getReportsData(filters("renewal", "outcome:retained"), agentScope);

    expect(data.detailTotal).toBe(3);
    expect(data.detail.map((r) => r.id).sort()).toEqual([...RETAINED_IDS].sort());
    expect(data.detail.map((r) => [r.id, r.status])).toEqual([
      ["renewed-1", "Renewed"],
      ["paid-2", "Paid"],
      ["paid-1", "Paid"],
    ]);
  });

  it("keeps exact status, month and agent drills unchanged", async () => {
    const ids = async (drill: string) => (await getReportsData(filters("renewal", drill), agentScope)).detail.map((r) => r.id).sort();

    expect(await ids("status:Renewed")).toEqual(["renewed-1"]);
    expect(await ids("status:Paid")).toEqual(["paid-1", "paid-2"]);
    expect(await ids("status:Lapsed")).toEqual(["lapsed-1"]);
    expect(await ids("month:2026-11")).toEqual(["lapsed-1", "paid-1", "paid-2", "renewed-1", "upcoming-1"]);
    expect(await ids("agent:Ben Other")).toEqual([]);
  });

  it("reports a zero rate when no cycle in the period is retained or lapsed", async () => {
    source.tables.renewals = [renewal("upcoming-1", "Upcoming", "2026-11-25"), renewal("awaiting-1", "Awaiting Payment", "2026-11-06")];
    const data = await getReportsData(filters("renewal"), agentScope);

    expect(stat(data, "Renewal rate")?.value).toBe(0);
    expect(stat(data, "Retained")?.value).toBe(0);
    expect(stat(data, "Lapsed")?.value).toBe(0);
    expect(data.charts.find((c) => c.title === RETENTION_CHART)?.points).toEqual([]);
    expect(stat(await getReportsData(filters("overview"), agentScope), "Renewal rate")?.value).toBe(0);
  });

  it("does not let an outcome drill filter other families", async () => {
    const plain = await getReportsData(filters("sales"), agentScope);
    const drilled = await getReportsData(filters("sales", "outcome:retained"), agentScope);

    expect(plain.detailTotal).toBe(1);
    expect(drilled.detail).toEqual(plain.detail);
  });

  it("exports the same retention metrics and retained detail to CSV", async () => {
    const result = await renderReportsExport("csv", filters("renewal", "outcome:retained"), agentScope);
    const lines = String(result.body).replace(/^\uFEFF/, "").split("\r\n");

    expect(lines).toContain("Renewal rate,,75,");
    expect(lines).toContain("Retained,,3,");
    expect(lines).toContain("Lapsed,,1,");
    expect(lines).toContain("Due in period,,5,");

    const header = lines.indexOf("Reference,Client,Product / record,Agent,Date,Status,Currency,Amount,Note");
    expect(header).toBeGreaterThan(-1);
    const detail = lines.slice(header + 1).map((line) => line.split(","));
    expect(detail.map((cells) => [cells[0], cells[5]])).toEqual([
      ["RN-renewed-1", "Renewed"],
      ["RN-paid-2", "Paid"],
      ["RN-paid-1", "Paid"],
    ]);
    expect(result.data.detailTotal).toBe(3);
  });
});
