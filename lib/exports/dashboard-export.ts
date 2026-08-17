import "server-only";

import * as XLSX from "xlsx";

import { getDashboardStats, type DashboardStats } from "@/lib/queries/dashboard";
import { getRelationshipTouchpoints } from "@/lib/queries/relationship";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClaimsRepository } from "@/lib/repositories/claims";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getUsersRepository } from "@/lib/repositories/users";
import { buildSheet, FMT, toCsv, toDateOnly, type CellValue } from "./sheet-utils";

/**
 * Dashboard export — turns the same data the Dashboard renders into an .xlsx /
 * .ods workbook or a .csv summary.
 *
 * Queue sheets deliberately carry more than the 5–6 rows each card shows: the
 * screen is a triage view, the export is a working document. Status filters are
 * kept identical to `app/(app)/dashboard/page.tsx` so the export can never
 * disagree with the page about what "open" means — only about how many rows.
 */

export const EXPORT_FORMATS = ["xlsx", "ods", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function isExportFormat(value: string | null): value is ExportFormat {
  return value != null && (EXPORT_FORMATS as readonly string[]).includes(value);
}

/** Row cap per queue sheet. Above this the subtitle says the sheet is capped. */
const ROW_CAP = 500;

const BRAND = "Pacific Insurance PH";

/** Display labels for the six KPIs, shared by the Summary and Trends sheets. */
const KPI_LABELS: { key: keyof DashboardStats["kpis"]; label: string }[] = [
  { key: "activeClients", label: "Active clients" },
  { key: "activePolicies", label: "Active policies" },
  { key: "applicationsInProgress", label: "Applications in progress" },
  { key: "openClaims", label: "Open claims" },
  { key: "upcomingRenewals", label: "Upcoming renewals" },
  { key: "openTravel", label: "Open travel requests" },
];

const ALERT_LABELS: { key: keyof DashboardStats["alerts"]; label: string }[] = [
  { key: "renewalsDue30", label: "Renewals due within 30 days" },
  { key: "claimsAwaitingDocs", label: "Claims awaiting documents" },
  { key: "travelAwaitingPayment", label: "Travel requests awaiting payment" },
  { key: "appsMissingRequirements", label: "Applications missing requirements" },
];

export interface DashboardExportData {
  stats: DashboardStats;
  applications: Awaited<ReturnType<ReturnType<typeof getApplicationsRepository>["list"]>>;
  renewals: Awaited<ReturnType<ReturnType<typeof getRenewalsRepository>["list"]>>;
  claims: Awaited<ReturnType<ReturnType<typeof getClaimsRepository>["list"]>>;
  travel: Awaited<ReturnType<ReturnType<typeof getTravelRepository>["list"]>>;
  tasks: Awaited<ReturnType<ReturnType<typeof getTasksRepository>["list"]>>;
  touchpoints: Awaited<ReturnType<typeof getRelationshipTouchpoints>>;
  /** `assignedUserId` → full name; Applications carry only the id. */
  userNames: Map<string, string>;
  generatedAt: Date;
}

/**
 * Fetch everything the workbook needs. Status filters mirror the dashboard page
 * exactly; only `limit` differs.
 */
export async function gatherDashboardExportData(): Promise<DashboardExportData> {
  const [stats, applications, renewals, claims, travel, tasks, touchpoints, users] =
    await Promise.all([
      getDashboardStats(),
      getApplicationsRepository().list({ statusNotIn: ["Approved", "Lead"], limit: ROW_CAP }),
      getRenewalsRepository().list({ statusNotIn: ["Renewed", "Lapsed"], limit: ROW_CAP }),
      getClaimsRepository().list({ statusNotIn: ["Closed", "Rejected", "Credited"], limit: ROW_CAP }),
      getTravelRepository().list({ statusNotIn: ["Policy Issued"], limit: ROW_CAP }),
      getTasksRepository().list({ limit: ROW_CAP }),
      getRelationshipTouchpoints(),
      getUsersRepository().list({ limit: 200 }),
    ]);

  return {
    stats,
    applications,
    renewals,
    claims,
    travel,
    tasks,
    touchpoints,
    userNames: new Map(users.rows.map((u) => [u.id, u.fullName])),
    generatedAt: new Date(),
  };
}

const stamp = (d: Date) =>
  d.toLocaleString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** `Showing N records` — or a capped warning when the query hit the ceiling. */
const scopeNote = (count: number) =>
  count >= ROW_CAP
    ? `Showing the first ${ROW_CAP} records (capped)`
    : `Showing ${count} record${count === 1 ? "" : "s"}`;

const yesNo = (v: boolean | null | undefined) => (v ? "Yes" : "No");

/**
 * The headline figures as flat Section / Metric / Value rows.
 *
 * Shared by the Summary sheet and the CSV export so the two can never disagree
 * about what "the dashboard summary" is.
 */
export function buildSummaryRows(stats: DashboardStats): [string, string, number][] {
  return [
    ...ALERT_LABELS.map(
      ({ key, label }) => ["Alerts", label, stats.alerts[key]] as [string, string, number],
    ),
    ...KPI_LABELS.map(
      ({ key, label }) => ["Key metrics", label, stats.kpis[key]] as [string, string, number],
    ),
    ...stats.revenue.rows.map(
      (r) => ["Revenue awaiting collection", `${r.source} — amount`, r.amount] as [string, string, number],
    ),
    ...stats.revenue.rows.map(
      (r) => ["Revenue awaiting collection", `${r.source} — records`, r.count] as [string, string, number],
    ),
    ["Revenue awaiting collection", "Total awaiting collection", stats.revenue.total],
  ];
}

/**
 * Summary sheet — three labelled blocks separated by spacer rows. Built as a
 * raw AoA rather than via `buildSheet` because it is a stack of little tables
 * with their own headers, not one uniform grid.
 */
function summarySheet(data: DashboardExportData): XLSX.WorkSheet {
  const { stats, generatedAt } = data;
  const aoa: CellValue[][] = [];
  /** Cells to format, collected while building so no index has to be re-derived. */
  const formats: { r: number; c: number; z: string }[] = [];
  const push = (...rows: CellValue[][]) => aoa.push(...rows);

  push(
    [`${BRAND} — Dashboard summary`],
    [`Generated ${stamp(generatedAt)} · Figures reflect all open records at this moment`],
    [],
    ["ALERTS"],
    ["Alert", "Count"],
  );
  for (const { key, label } of ALERT_LABELS) {
    formats.push({ r: aoa.length, c: 1, z: FMT.INT });
    push([label, stats.alerts[key]]);
  }

  push([], ["KEY METRICS"], ["Metric", "Current", "Change vs last month", "Direction"]);
  for (const { key, label } of KPI_LABELS) {
    formats.push({ r: aoa.length, c: 1, z: FMT.INT });
    push([label, stats.kpis[key], stats.trends[key].delta, stats.trends[key].dir]);
  }

  push([], ["REVENUE AWAITING COLLECTION"], ["Source", "Amount", "Records"]);
  for (const row of stats.revenue.rows) {
    formats.push({ r: aoa.length, c: 1, z: FMT.PESO }, { r: aoa.length, c: 2, z: FMT.INT });
    push([row.source, row.amount, row.count]);
  }
  formats.push({ r: aoa.length, c: 1, z: FMT.PESO }, { r: aoa.length, c: 2, z: FMT.INT });
  push(["Total", stats.revenue.total, stats.revenue.rows.reduce((a, r) => a + r.count, 0)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  for (const { r, c, z } of formats) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) cell.z = z;
  }

  ws["!cols"] = [{ wch: 38 }, { wch: 18 }, { wch: 22 }, { wch: 14 }];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];
  return ws;
}

/**
 * Trends sheet — the six-month sparkline arrays as a real grid, so the numbers
 * can be charted natively. Kept off the Summary sheet, which would otherwise
 * need six extra columns nothing else uses.
 */
function trendsSheet(data: DashboardExportData): XLSX.WorkSheet {
  const { stats, generatedAt } = data;
  // Same six-month window `monthlyTrend` buckets into (lib/queries/dashboard.ts).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(generatedAt.getFullYear(), generatedAt.getMonth() - (5 - i), 1);
    return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
  });

  return buildSheet({
    title: `${BRAND} — 6-month trend`,
    subtitle: `Generated ${stamp(generatedAt)} · New records created per month`,
    columns: [
      { header: "Metric", width: 30 },
      ...months.map((m) => ({ header: m, width: 13, format: FMT.INT })),
      { header: "Change vs last month", width: 22 },
      { header: "Direction", width: 12 },
    ],
    rows: KPI_LABELS.map(({ key, label }) => [
      label,
      ...stats.trends[key].spark,
      stats.trends[key].delta,
      stats.trends[key].dir,
    ]),
  });
}

function applicationsSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.applications;
  return buildSheet({
    title: `${BRAND} — Applications requiring action`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Excludes Approved and Lead · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Reference", width: 18 },
      { header: "Client", width: 26 },
      { header: "Product", width: 24 },
      { header: "Type", width: 20 },
      { header: "Status", width: 22 },
      { header: "Assigned to", width: 20 },
      { header: "Date started", width: 14, format: FMT.DATE },
      { header: "Date submitted", width: 15, format: FMT.DATE },
      { header: "Est. premium", width: 16, format: FMT.PESO },
      { header: "Reqs required", width: 14, format: FMT.INT },
      { header: "Reqs verified", width: 14, format: FMT.INT },
      { header: "Remote sale", width: 12 },
    ],
    rows: rows.map((a) => [
      a.referenceNo,
      a.clientName,
      a.productName,
      a.applicationType,
      a.status,
      a.assignedUserId ? (data.userNames.get(a.assignedUserId) ?? null) : null,
      toDateOnly(a.dateStarted),
      toDateOnly(a.dateSubmitted),
      a.estimatedPremium,
      a.requirementProgress.required,
      a.requirementProgress.verified,
      yesNo(a.remoteSale),
    ]),
    emptyMessage: "No applications require action.",
  });
}

function renewalsSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.renewals;
  return buildSheet({
    title: `${BRAND} — Renewals queue`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Excludes Renewed and Lapsed · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Reference", width: 18 },
      { header: "Client", width: 26 },
      { header: "Policy ref", width: 18 },
      { header: "Policy no.", width: 18 },
      { header: "Premium", width: 16, format: FMT.PESO },
      { header: "Renewal due", width: 14, format: FMT.DATE },
      { header: "Policy expiry", width: 14, format: FMT.DATE },
      { header: "Status", width: 20 },
      { header: "Early payer", width: 12 },
    ],
    rows: rows.map((r) => [
      r.referenceNo,
      r.clientName,
      r.policyRef,
      r.policyNumber,
      r.premiumAmount,
      toDateOnly(r.renewalDueDate),
      toDateOnly(r.policyExpiryDate),
      r.status,
      yesNo(r.earlyPaymentFlag),
    ]),
    emptyMessage: "No renewals in the queue.",
  });
}

function claimsSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.claims;
  return buildSheet({
    title: `${BRAND} — Claims requiring action`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Excludes Closed, Rejected and Credited · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Reference", width: 18 },
      { header: "Client", width: 26 },
      { header: "Group", width: 22 },
      { header: "Policy ref", width: 18 },
      { header: "Claim type", width: 20 },
      { header: "Incident date", width: 14, format: FMT.DATE },
      { header: "Status", width: 22 },
      { header: "Amount claimed", width: 16, format: FMT.PESO },
      { header: "Amount approved", width: 16, format: FMT.PESO },
      { header: "Currency", width: 10 },
    ],
    rows: rows.map((c) => [
      c.referenceNo,
      c.clientName,
      c.groupName,
      c.policyRef,
      c.claimType,
      toDateOnly(c.incidentDate),
      c.status,
      c.amountClaimed,
      c.amountApproved,
      c.currency,
    ]),
    emptyMessage: "No claims require action.",
  });
}

function travelSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.travel;
  return buildSheet({
    title: `${BRAND} — Travel insurance queue`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Excludes Policy Issued · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Reference", width: 18 },
      { header: "Client", width: 26 },
      { header: "Destination", width: 22 },
      { header: "Departure", width: 14, format: FMT.DATE },
      { header: "Return", width: 14, format: FMT.DATE },
      { header: "Travellers", width: 11, format: FMT.INT },
      { header: "Status", width: 20 },
      { header: "Quoted premium", width: 16, format: FMT.PESO },
      { header: "Portal payment", width: 18 },
      { header: "Policy no.", width: 18 },
    ],
    rows: rows.map((t) => [
      t.referenceNo,
      t.clientName,
      t.destination,
      toDateOnly(t.departureDate),
      toDateOnly(t.returnDate),
      t.travelerCount,
      t.status,
      t.quotedPremium,
      t.portalPaymentStatus,
      t.policyNumber,
    ]),
    emptyMessage: "No open travel requests.",
  });
}

function tasksSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.tasks;
  return buildSheet({
    title: `${BRAND} — Tasks`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Excludes Cancelled · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Title", width: 40 },
      { header: "Tag", width: 16 },
      { header: "Client", width: 26 },
      { header: "Linked record", width: 20 },
      { header: "Assignee", width: 20 },
      { header: "Due date", width: 14, format: FMT.DATE },
      { header: "Priority", width: 12 },
      { header: "Status", width: 16 },
      { header: "Done", width: 8 },
    ],
    rows: rows.map((t) => [
      t.title,
      t.tag,
      t.clientName,
      t.linkedRecordRef,
      t.assigneeName,
      toDateOnly(t.dueDate),
      t.priority,
      t.status,
      yesNo(t.done),
    ]),
    emptyMessage: "No tasks.",
  });
}

function touchpointsSheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.touchpoints;
  return buildSheet({
    title: `${BRAND} — Relationship touchpoints`,
    subtitle: `Generated ${stamp(data.generatedAt)} · Birthdays, anniversaries and re-nurture within the next 45 days · ${scopeNote(rows.length)}`,
    columns: [
      { header: "Client", width: 26 },
      { header: "Type", width: 16 },
      { header: "Detail", width: 34 },
      { header: "When", width: 16 },
      { header: "Days until", width: 12, format: FMT.INT },
      { header: "Email", width: 30 },
    ],
    rows: rows.map((t) => [t.name, t.type, t.sub, t.when, t.daysUntil, t.email]),
    emptyMessage: "No upcoming touchpoints.",
  });
}

function activitySheet(data: DashboardExportData): XLSX.WorkSheet {
  const rows = data.stats.activity;
  return buildSheet({
    title: `${BRAND} — Recent activity`,
    subtitle: `Generated ${stamp(data.generatedAt)} · The ${rows.length} most recent timeline entries`,
    columns: [
      { header: "When", width: 22 },
      { header: "Type", width: 24 },
      { header: "Summary", width: 60 },
      { header: "Actor", width: 22 },
    ],
    rows: rows.map((a) => [a.when, a.type, a.summary, a.actorName]),
    emptyMessage: "No recent activity.",
  });
}

/** Assemble the multi-sheet workbook. */
function buildWorkbook(data: DashboardExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const sheets: [string, XLSX.WorkSheet][] = [
    ["Summary", summarySheet(data)],
    ["Trends", trendsSheet(data)],
    ["Applications", applicationsSheet(data)],
    ["Renewals", renewalsSheet(data)],
    ["Claims", claimsSheet(data)],
    ["Travel", travelSheet(data)],
    ["Tasks", tasksSheet(data)],
    ["Touchpoints", touchpointsSheet(data)],
    ["Activity", activitySheet(data)],
  ];
  for (const [name, ws] of sheets) XLSX.utils.book_append_sheet(wb, ws, name);
  return wb;
}

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv; charset=utf-8",
};

export interface RenderedExport {
  body: ArrayBuffer | string;
  contentType: string;
  filename: string;
}

/**
 * Render the dashboard export in the requested format.
 *
 * CSV is deliberately the summary table only — a single header row and flat
 * Section/Metric/Value rows. It is hand-serialised rather than routed through
 * SheetJS, because `bookType: "csv"` would emit sheet 1 verbatim, merged title
 * rows and spacer rows included, which is the opposite of a simple table.
 */
export async function renderDashboardExport(format: ExportFormat): Promise<RenderedExport> {
  const data = await gatherDashboardExportData();
  const date = data.generatedAt.toISOString().slice(0, 10);
  const filename = `pacific-dashboard-${date}.${format}`;

  if (format === "csv") {
    const body = toCsv([
      ["Section", "Metric", "Value"],
      ...buildSummaryRows(data.stats),
    ]);
    return { body, contentType: CONTENT_TYPES.csv, filename };
  }

  // `type: "array"` yields an ArrayBuffer, which is a clean `BodyInit`; Node's
  // Buffer is not assignable to it under the DOM lib types Next ships.
  const body = XLSX.write(buildWorkbook(data), {
    type: "array",
    bookType: format,
    cellDates: true,
  }) as ArrayBuffer;

  return { body, contentType: CONTENT_TYPES[format], filename };
}
