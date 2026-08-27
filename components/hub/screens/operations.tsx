"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markRenewalNoticeSentAction } from "@/app/(app)/renewals/actions";
import type { Application } from "@/lib/repositories/applications";
import type { Claim } from "@/lib/repositories/claims";
import type { Policy } from "@/lib/repositories/policies";
import type { Renewal } from "@/lib/repositories/renewals";
import type { TravelRequest } from "@/lib/repositories/travel";
import { peso, pesoShort } from "@/lib/format";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { useOverlays } from "../overlays/overlay-provider";
import { Avatar, Btn, DueCell, StatusBadge } from "../primitives";
import { ClientCell, Row, Td } from "../table";
import { ListScreen } from "./list-screen";

/**
 * Wired operations list screens (design screens.jsx / screens-extra.jsx):
 * Applications, Policies, Renewals, Claims, Travel over real repository rows.
 * Row click opens the contact; primary actions open the page-modal drawers.
 */

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - today.getTime()) / 86_400_000);
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** Clickable Group Account chip (design screens.jsx group cross-link). */
function GroupChip({ id, name }: { id: string | null; name: string }) {
  const { openGroup } = useRecordNav();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (id) openGroup(id);
      }}
      title={`Open group account — ${name}`}
      className="inline-flex h-[21px] max-w-[150px] items-center gap-1 truncate rounded-full border border-blue-border bg-blue-soft px-2 text-[11px] font-[650] text-blue transition-opacity hover:opacity-80"
    >
      <I.building size={11} className="shrink-0" /> <span className="truncate">{name}</span>
    </button>
  );
}

/* ------------------------------- Applications ------------------------------ */
type CompletenessState = "Complete" | "In review" | "Missing" | "Not initialized" | "Draft";

function applicationCompleteness(application: Application) {
  const progress = application.requirementProgress;
  if (!progress.initialized) {
    const state: CompletenessState = application.status === "Lead" ? "Draft" : "Not initialized";
    return { state, label: state, countLabel: null, sort: state === "Draft" ? -2 : -1 };
  }

  const complete = progress.required === 0 || progress.verified === progress.required;
  const state: CompletenessState = complete
    ? "Complete"
    : progress.pending > 0 || progress.incomplete > 0
      ? "Missing"
      : "In review";
  const countLabel = progress.required === 0
    ? "No required items"
    : `${progress.verified}/${progress.required} complete`;
  const sort = progress.required === 0 ? 100 : (progress.verified / progress.required) * 100;
  return { state, label: `${countLabel} · ${state}`, countLabel, sort };
}

export function ApplicationsLive({ rows }: { rows: Application[] }) {
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const viewRows = rows.map((application) => {
    const completeness = applicationCompleteness(application);
    return {
      ...application,
      completenessState: completeness.state,
      completenessLabel: completeness.label,
      completenessCountLabel: completeness.countLabel,
      completenessSort: completeness.sort,
      _filter: application.status,
      _filter2: completeness.state,
    };
  });
  const awaiting = rows.filter((a) => a.status === "Awaiting Payment").length;
  const missing = viewRows.filter((a) => a.completenessState === "Missing").length;
  // Drafts stay on the register — they're upcoming work Eman needs to see — but they are not
  // applications in progress: nothing has been submitted, and the contact is still a Lead
  // (../docs/lead-stage-status-example.md Step 6). Counted on their own so neither number lies.
  const drafts = rows.filter((a) => a.status === "Lead").length;
  const inProgress = rows.length - drafts;

  return (
    <ListScreen
      title="Applications"
      sub={`${inProgress} application${inProgress === 1 ? "" : "s"} in progress${drafts ? ` · ${drafts} draft${drafts === 1 ? "" : "s"}` : ""} · ${awaiting} awaiting payment`}
      icon={I.fileText}
      draft={false}
      primaryAction="New application"
      onPrimary={() => overlays.openWizard()}
      stats={[
        { val: inProgress, label: "In progress" },
        { val: awaiting, label: "Awaiting payment", color: "var(--amber)" },
        { val: missing, label: "Missing requirements", color: "var(--red)" },
        { val: rows.filter((a) => a.status === "Under Review").length, label: "Under review", color: "var(--blue)" },
      ]}
      filters={["Awaiting Payment", "Missing Requirements", "Under Review", "Approved"]}
      filters2={["Complete", "In review", "Missing", "Not initialized", "Draft"]}
      filters2Label="Completeness"
      rows={viewRows}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      emptyText="No applications yet — start one with the wizard."
      columns={[
        { k: "referenceNo", label: "Application" },
        { k: "clientName", label: "Client" },
        { k: "productName", label: "Product" },
        { k: "status", label: "Status" },
        { k: "completenessLabel", sortKey: "completenessSort", label: "Completeness" },
        { k: "applicationType", label: "Type" },
        { k: "dateStarted", label: "Started" },
        { k: "id", label: "" },
      ]}
      renderRow={(a) => (
        <Row key={a.id} onClick={() => openContact(a.clientId)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{a.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={a.clientName ?? "—"} sub={a.productName ?? undefined} /></Td>
          <Td className="text-muted-foreground">{a.productName ?? "—"}</Td>
          <Td><StatusBadge status={a.status} /></Td>
          <Td>
            <div className="flex items-center gap-2">
              {a.completenessCountLabel && (
                <span className="whitespace-nowrap font-mono text-[12px] font-semibold tabular-nums">
                  {a.completenessCountLabel}
                </span>
              )}
              <StatusBadge status={a.completenessState} />
            </div>
          </Td>
          <Td className="text-muted-foreground">{a.applicationType}</Td>
          <Td className="text-muted-foreground">{fmtDate(a.dateStarted)}</Td>
          <Td>
            {a.status !== "Lead" ? (
              <Btn
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  overlays.openApplicationRequirements(a.id);
                }}
              >
                Requirements
              </Btn>
            ) : !!a.wizardState && typeof a.wizardState === "object" && !Array.isArray(a.wizardState) && (
              <Btn
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  overlays.openWizard({
                    draftApplicationId: a.id,
                  });
                }}
              >
                Continue application
              </Btn>
            )}
          </Td>
        </Row>
      )}
    />
  );
}

/* --------------------------------- Policies -------------------------------- */
export function PoliciesLive({ rows }: { rows: Policy[] }) {
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const groupNames = [...new Set(rows.map((p) => p.groupName).filter(Boolean))] as string[];
  const lapsing = rows.filter((p) => {
    const d = daysUntil(p.expiryDate);
    return p.status === "Active" && d != null && d <= 30;
  }).length;

  return (
    <ListScreen
      title="Policies"
      sub={`${rows.length} policies under management`}
      icon={I.shield}
      draft={false}
      primaryAction="Issue policy"
      onPrimary={() => overlays.openPageModal("issue-policy")}
      stats={[
        { val: rows.filter((p) => p.status === "Active").length, label: "Active policies" },
        { val: rows.filter((p) => p.paymentMode === "Annual").length, label: "Annual mode" },
        { val: lapsing, label: "Lapsing soon", color: "var(--red)" },
        { val: pesoShort(rows.reduce((a, p) => a + (p.premiumAmount ?? 0), 0)), label: "Premium under management", color: "var(--brand)" },
      ]}
      filters={["Active", "Pending", "Expired", "Lapsed"]}
      filters2={[...groupNames, "Individual"]}
      filters2Label="Group"
      rows={rows.map((p) => ({ ...p, _filter: p.status, _filter2: p.groupName ?? "Individual" }))}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      emptyText="No policies yet."
      columns={[
        { k: "referenceNo", label: "Policy no." },
        { k: "clientName", label: "Client" },
        { k: "productName", label: "Product" },
        { k: "premiumAmount", label: "Premium", num: true },
        { k: "policyNumber", label: "PC number" },
        { k: "effectiveDate", label: "Effective" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(p) => {
        const d = daysUntil(p.expiryDate);
        const isLapsing = p.status === "Active" && d != null && d <= 30;
        return (
          <Row key={p.id} onClick={() => openContact(p.clientId)}>
            <Td><span className="font-mono text-[12px] text-muted-foreground">{p.referenceNo ?? "—"}</span></Td>
            <Td>
              <div className="flex items-center gap-2">
                <ClientCell name={p.clientName ?? "—"} sub={p.planName ?? undefined} />
                {p.groupName && <GroupChip id={p.groupId} name={p.groupName} />}
              </div>
            </Td>
            <Td className="text-muted-foreground">{p.productName ?? "—"}</Td>
            <Td className="text-right font-mono font-semibold tabular-nums">
              {p.premiumAmount != null ? peso(p.premiumAmount) : "—"}
            </Td>
            <Td className="text-muted-foreground">{p.policyNumber ?? "—"}</Td>
            <Td className="text-muted-foreground">{fmtDate(p.effectiveDate)}</Td>
            <Td><StatusBadge status={isLapsing ? "Lapsed" : p.status} /></Td>
          </Row>
        );
      }}
    />
  );
}

/* --------------------------------- Renewals -------------------------------- */
export function RenewalsLive({ rows }: { rows: Renewal[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const [, startTransition] = useTransition();

  const due30 = rows.filter((r) => {
    const d = daysUntil(r.renewalDueDate);
    return d != null && d >= 0 && d <= 30;
  }).length;
  const overdue = rows.filter((r) => {
    const d = daysUntil(r.renewalDueDate);
    return d != null && d < 0 && r.status !== "Renewed" && r.status !== "Paid";
  }).length;

  const sendNotice = (r: Renewal) =>
    overlays.openEngage(
      "Send Renewal Notice",
      {
        clientId: r.clientId,
        name: r.clientName ?? "Client",
        premium: r.premiumAmount,
        product: r.policyRef,
      },
      () =>
        startTransition(async () => {
          await markRenewalNoticeSentAction(r.id);
          router.refresh();
        }),
    );

  return (
    <ListScreen
      title="Renewals"
      sub={`${rows.length} renewals tracked · ${due30} due within 30 days`}
      icon={I.refresh}
      draft={false}
      primaryAction="Send notices"
      onPrimary={() => overlays.openEngage("Send Renewal Notice")}
      stats={[
        { val: rows.length, label: "Tracked renewals" },
        { val: due30, label: "Due in 30 days", color: "var(--amber)" },
        { val: overdue, label: "Overdue", color: "var(--red)" },
        { val: pesoShort(rows.filter((r) => r.status === "Awaiting Payment").reduce((a, r) => a + (r.premiumAmount ?? 0), 0)), label: "Awaiting payment", color: "var(--brand)" },
      ]}
      filters={["Upcoming", "Notice Received", "Reminder Sent", "Awaiting Payment", "Renewed", "Lapsed"]}
      rows={rows.map((r) => ({ ...r, _filter: r.status }))}
      defaultSort={{ key: "renewalDueDate", dir: "asc" }}
      emptyText="No renewals tracked yet."
      columns={[
        { k: "clientName", label: "Client" },
        { k: "policyRef", label: "Policy" },
        { k: "renewalDueDate", label: "Renewal date" },
        { k: "status", label: "Status" },
        { k: "premiumAmount", label: "Premium", num: true },
        { k: "id", label: "" },
      ]}
      renderRow={(r) => (
        <Row key={r.id} onClick={() => openContact(r.clientId)}>
          <Td><ClientCell name={r.clientName ?? "—"} sub={r.policyNumber ?? undefined} /></Td>
          <Td className="text-muted-foreground">{r.policyRef ?? "—"}</Td>
          <Td>
            {r.renewalDueDate ? (
              <DueCell days={daysUntil(r.renewalDueDate) ?? 0} label={fmtDate(r.renewalDueDate)} />
            ) : (
              "—"
            )}
          </Td>
          <Td><StatusBadge status={r.status} /></Td>
          <Td className="text-right font-mono font-semibold tabular-nums">
            {r.premiumAmount != null ? peso(r.premiumAmount) : "—"}
          </Td>
          <Td>
            <span onClick={(e) => e.stopPropagation()}>
              <Btn size="sm" onClick={() => sendNotice(r)}>
                <I.send size={13} /> Send notice
              </Btn>
            </span>
          </Td>
        </Row>
      )}
    />
  );
}

/* ---------------------------------- Claims --------------------------------- */
export function ClaimsLive({ rows }: { rows: Claim[] }) {
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const groupNames = [...new Set(rows.map((c) => c.groupName).filter(Boolean))] as string[];
  const awaitingDocs = rows.filter((c) => c.status === "Documents Pending").length;
  const open = rows.filter((c) => !["Closed", "Rejected", "Credited"].includes(c.status)).length;

  return (
    <ListScreen
      title="Claims"
      sub={`${open} open claims · ${awaitingDocs} awaiting documents`}
      icon={I.clipboard}
      draft={false}
      primaryAction="File claim"
      onPrimary={() => overlays.openPageModal("file-claim")}
      stats={[
        { val: open, label: "Open claims" },
        { val: awaitingDocs, label: "Awaiting documents", color: "var(--red)" },
        { val: rows.filter((c) => c.status === "Pending Review").length, label: "Under review", color: "var(--blue)" },
        { val: pesoShort(rows.reduce((a, c) => a + (c.amountClaimed ?? 0), 0)), label: "Total claimed", color: "var(--brand)" },
      ]}
      filters={["Documents Pending", "Submitted", "Pending Review", "Approved", "Closed"]}
      filters2={[...groupNames, "Individual"]}
      filters2Label="Group"
      rows={rows.map((c) => ({ ...c, _filter: c.status, _filter2: c.groupName ?? "Individual" }))}
      defaultSort={{ key: "updatedAt", dir: "desc" }}
      emptyText="No claims yet."
      columns={[
        { k: "referenceNo", label: "Claim" },
        { k: "clientName", label: "Claimant" },
        { k: "policyRef", label: "Policy" },
        { k: "status", label: "Status" },
        { k: "amountClaimed", label: "Amount", num: true },
        { k: "incidentDate", label: "Incident" },
        { k: "id", label: "" },
      ]}
      renderRow={(c) => (
        <Row key={c.id} onClick={() => openContact(c.clientId)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{c.referenceNo ?? "—"}</span></Td>
          <Td>
            <div className="flex items-center gap-2">
              <ClientCell name={c.clientName ?? "—"} sub={c.claimType ?? undefined} />
              {c.groupName && <GroupChip id={c.groupId} name={c.groupName} />}
            </div>
          </Td>
          <Td className="text-muted-foreground">{c.policyRef ?? "—"}</Td>
          <Td><StatusBadge status={c.status} /></Td>
          <Td className="text-right font-mono font-semibold tabular-nums">
            {c.amountClaimed != null ? peso(c.amountClaimed) : "—"}
          </Td>
          <Td className="text-muted-foreground">{fmtDate(c.incidentDate)}</Td>
          <Td>
            <Btn
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                overlays.openClaimRequirements(c.id);
              }}
            >
              Requirements
            </Btn>
          </Td>
        </Row>
      )}
    />
  );
}

/* ---------------------------------- Travel --------------------------------- */
export function TravelLive({ rows }: { rows: TravelRequest[] }) {
  const overlays = useOverlays();
  const awaiting = rows.filter((t) => t.status === "Awaiting Payment").length;

  return (
    <ListScreen
      title="Travel Insurance"
      sub={`${rows.length} open travel requests · ${awaiting} awaiting payment`}
      icon={I.plane}
      draft={false}
      primaryAction="New travel quote"
      onPrimary={() => overlays.openPageModal("new-travel-quote")}
      stats={[
        { val: rows.length, label: "Open requests" },
        { val: awaiting, label: "Awaiting payment", color: "var(--amber)" },
        { val: rows.filter((t) => t.status === "Policy Issued").length, label: "Policies issued", color: "var(--brand)" },
        { val: pesoShort(rows.filter((t) => t.status === "Awaiting Payment").reduce((a, t) => a + (t.quotedPremium ?? 0), 0)), label: "Awaiting payment ₱", color: "var(--brand)" },
      ]}
      filters={["Awaiting Payment", "Under Review", "Policy Issued"]}
      rows={rows.map((t) => ({ ...t, _filter: t.status }))}
      defaultSort={{ key: "departureDate", dir: "asc" }}
      emptyText="No travel requests yet."
      columns={[
        { k: "referenceNo", label: "Travel no." },
        { k: "clientName", label: "Client" },
        { k: "destination", label: "Destination" },
        { k: "departureDate", label: "Travel dates" },
        { k: "status", label: "Status" },
        { k: "quotedPremium", label: "Premium", num: true },
      ]}
      renderRow={(t) => (
        <Row key={t.id} onClick={() => overlays.openTravelWorkflow(t.id)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{t.referenceNo ?? "—"}</span></Td>
          <Td>
            <div className="flex items-center gap-2.5">
              <Avatar name={t.clientName ?? "—"} size={28} />
              <span className="text-[13px] font-semibold">{t.clientName ?? "—"}</span>
            </div>
          </Td>
          <Td className="font-[550]">{t.destination ?? "—"}</Td>
          <Td className="text-muted-foreground">
            {fmtDate(t.departureDate)} – {fmtDate(t.returnDate)}
          </Td>
          <Td><StatusBadge status={t.status} /></Td>
          <Td className="text-right font-mono font-semibold tabular-nums">
            {t.quotedPremium != null ? peso(t.quotedPremium) : "—"}
          </Td>
        </Row>
      )}
    />
  );
}
