"use client";

/**
 * DRAFT — mock UI only.
 * Ported from drafts/src/screens.jsx + screens-extra.jsx for prototype review.
 * Each screen configures the generic <ListScreen/> with placeholder data; no real
 * data layer, persistence, or actions are wired up yet.
 */
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { APPLICATIONS, CLAIMS, CLIENTS, RENEWALS, STAFF, TRAVEL, peso, pesoShort, type Tone } from "../data";
import { I } from "../icons";
import { Avatar, DueCell, StatusBadge, TierBadge, TONE_BADGE } from "../primitives";
import { ClientCell, Row, Td } from "../table";
import { ListScreen } from "./list-screen";

/* Small inline badge for statuses/types not covered by StatusBadge. */
function Pill({ tone, dot, children }: { tone: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-[650]",
        TONE_BADGE[tone],
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const numTd = "text-right font-mono font-semibold tabular-nums";

/* ---------- Clients ---------- */
export function ClientsScreen() {
  return (
    <ListScreen
      title="Clients"
      icon={I.users}
      sub="1,248 active clients · 86 added this quarter"
      primaryAction="Add client"
      stats={[
        { val: "1,248", label: "Active clients" },
        { val: "312", label: "Gold tier", color: "var(--amber)" },
        { val: "86", label: "New this quarter", color: "var(--brand)" },
        { val: "9", label: "At risk", color: "var(--red)" },
      ]}
      filters={["Active", "At Risk", "New"]}
      rows={CLIENTS.map((c) => ({ ...c, _filter: c.status }))}
      defaultSort={{ key: "value", dir: "desc" }}
      columns={[
        { k: "name", label: "Client" },
        { k: "city", label: "Location" },
        { k: "policies", label: "Policies", num: true },
        { k: "tier", label: "Tier" },
        { k: "since", label: "Client since" },
        { k: "value", label: "Lifetime value", num: true },
        { k: "status", label: "Status" },
      ]}
      renderRow={(c) => (
        <Row key={c.email}>
          <Td><ClientCell name={c.name} sub={c.email} /></Td>
          <Td className="text-muted-foreground">{c.city}</Td>
          <Td className="text-right font-semibold tabular-nums">{c.policies}</Td>
          <Td><TierBadge tier={c.tier} /></Td>
          <Td className="text-muted-foreground">{c.since}</Td>
          <Td className={numTd}>{peso(c.value)}</Td>
          <Td><StatusBadge status={c.status} /></Td>
        </Row>
      )}
    />
  );
}

/* ---------- Applications ---------- */
export function ApplicationsScreen() {
  return (
    <ListScreen
      title="Applications"
      icon={I.fileText}
      sub="41 applications in progress · 14 awaiting payment"
      primaryAction="New application"
      stats={[
        { val: "41", label: "In progress" },
        { val: "14", label: "Awaiting payment", color: "var(--amber)" },
        { val: "2", label: "Missing requirements", color: "var(--red)" },
        { val: pesoShort(1250000), label: "Pipeline value", color: "var(--brand)" },
      ]}
      filters={["Awaiting Payment", "Missing Documents", "Under Review", "Approved"]}
      rows={APPLICATIONS.map((a) => ({ ...a, _filter: a.status }))}
      defaultSort={{ key: "due", dir: "asc" }}
      columns={[
        { k: "id", label: "Application" },
        { k: "client", label: "Client" },
        { k: "product", label: "Product" },
        { k: "status", label: "Status" },
        { k: "staff", label: "Assigned" },
        { k: "amount", label: "Premium", num: true },
        { k: "due", label: "Due" },
      ]}
      renderRow={(a) => (
        <Row key={a.id}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{a.id}</span></Td>
          <Td><ClientCell name={a.client} sub={a.city} /></Td>
          <Td className="text-muted-foreground">{a.product}</Td>
          <Td><StatusBadge status={a.status} /></Td>
          <Td>
            <div className="flex items-center gap-2.5">
              <Avatar name={STAFF[a.staff].name} size={24} />
              <span className="text-[12.5px] text-muted-foreground">{STAFF[a.staff].name.split(" ")[0]}</span>
            </div>
          </Td>
          <Td className={numTd}>{peso(a.amount)}</Td>
          <Td><DueCell days={a.due} /></Td>
        </Row>
      )}
    />
  );
}

/* ---------- Policies (screen-local mock data) ---------- */
interface Policy {
  id: string;
  client: string;
  product: string;
  type: string;
  premium: number;
  start: string;
  status: string;
}
const POLICIES: Policy[] = [
  { id: "POL-2024-11820", client: "John Santos", product: "Blue Royale", type: "Individual", premium: 185000, start: "Mar 2024", status: "Active" },
  { id: "POL-2023-09241", client: "Ramon Velasco", product: "Premier Health", type: "Individual", premium: 95000, start: "Aug 2023", status: "Active" },
  { id: "POL-2022-04417", client: "Sofia Reyes", product: "Family Shield", type: "Family", premium: 148000, start: "Jan 2022", status: "Active" },
  { id: "POL-2024-07712", client: "Cristina Flores", product: "AsianLife Care", type: "Individual", premium: 110000, start: "Jun 2024", status: "Active" },
  { id: "POL-2021-03390", client: "Grace Castillo", product: "Maxicare Plus", type: "Individual", premium: 73000, start: "Nov 2021", status: "Lapsing" },
  { id: "POL-2023-08856", client: "Edgar Domingo", product: "Family Shield", type: "Family", premium: 132000, start: "Feb 2023", status: "Active" },
  { id: "POL-2024-12003", client: "Patricia Lim", product: "Select", type: "Individual", premium: 88000, start: "May 2026", status: "Active" },
];

export function PoliciesScreen() {
  return (
    <ListScreen
      title="Policies"
      icon={I.shield}
      sub="2,394 active policies under management"
      primaryAction="Issue policy"
      stats={[
        { val: "2,394", label: "Active policies" },
        { val: "1,902", label: "Individual" },
        { val: "492", label: "Family / group" },
        { val: "14", label: "Lapsing soon", color: "var(--red)" },
      ]}
      filters={["Active", "Lapsing"]}
      rows={POLICIES.map((p) => ({ ...p, _filter: p.status }))}
      defaultSort={{ key: "start", dir: "desc" }}
      columns={[
        { k: "id", label: "Policy no." },
        { k: "client", label: "Client" },
        { k: "product", label: "Product" },
        { k: "type", label: "Type" },
        { k: "premium", label: "Premium", num: true },
        { k: "start", label: "Effective" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(p) => (
        <Row key={p.id}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{p.id}</span></Td>
          <Td><ClientCell name={p.client} /></Td>
          <Td className="text-muted-foreground">{p.product}</Td>
          <Td><Pill tone="slate">{p.type}</Pill></Td>
          <Td className={numTd}>{peso(p.premium)}</Td>
          <Td className="text-muted-foreground">{p.start}</Td>
          <Td><Pill tone={p.status === "Active" ? "green" : "amber"} dot>{p.status}</Pill></Td>
        </Row>
      )}
    />
  );
}

/* ---------- Renewals ---------- */
export function RenewalsScreen() {
  return (
    <ListScreen
      title="Renewals"
      icon={I.refresh}
      sub="72 upcoming renewals · 8 due within 30 days"
      primaryAction="Send notices"
      stats={[
        { val: "72", label: "Upcoming (90 days)" },
        { val: "8", label: "Due in 30 days", color: "var(--amber)" },
        { val: "1", label: "Overdue", color: "var(--red)" },
        { val: pesoShort(860000), label: "Awaiting payment", color: "var(--brand)" },
      ]}
      filters={["Awaiting Payment", "Notice Sent", "In Progress", "Overdue"]}
      rows={RENEWALS.map((r) => ({ ...r, _filter: r.status }))}
      defaultSort={{ key: "due", dir: "asc" }}
      columns={[
        { k: "client", label: "Client" },
        { k: "policy", label: "Policy" },
        { k: "date", label: "Renewal date" },
        { k: "due", label: "Due in" },
        { k: "status", label: "Status" },
        { k: "amount", label: "Premium", num: true },
      ]}
      renderRow={(r) => (
        <Row key={r.id}>
          <Td><ClientCell name={r.client} sub={r.city} /></Td>
          <Td className="text-muted-foreground">{r.policy}</Td>
          <Td className="text-muted-foreground">{r.date}</Td>
          <Td><DueCell days={r.due} /></Td>
          <Td><StatusBadge status={r.status} /></Td>
          <Td className={numTd}>{peso(r.amount)}</Td>
        </Row>
      )}
    />
  );
}

/* ---------- Claims ---------- */
export function ClaimsScreen() {
  return (
    <ListScreen
      title="Claims"
      icon={I.clipboard}
      sub="18 open claims · 3 awaiting documents"
      primaryAction="File claim"
      stats={[
        { val: "18", label: "Open claims" },
        { val: "3", label: "Awaiting documents", color: "var(--red)" },
        { val: "7", label: "Under review", color: "var(--blue)" },
        { val: pesoShort(416000), label: "Total claimed", color: "var(--brand)" },
      ]}
      filters={["Additional Documents Required", "Under Review", "Awaiting Response", "Approved"]}
      rows={CLAIMS.map((c) => ({ ...c, _filter: c.status }))}
      defaultSort={{ key: "updated", dir: "asc" }}
      columns={[
        { k: "id", label: "Claim" },
        { k: "client", label: "Client" },
        { k: "policy", label: "Policy" },
        { k: "status", label: "Status" },
        { k: "amount", label: "Amount", num: true },
        { k: "updated", label: "Last updated" },
      ]}
      renderRow={(c) => (
        <Row key={c.id}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{c.id}</span></Td>
          <Td><ClientCell name={c.client} sub={c.city} /></Td>
          <Td className="text-muted-foreground">{c.policy}</Td>
          <Td><StatusBadge status={c.status} /></Td>
          <Td className={numTd}>{peso(c.amount)}</Td>
          <Td className="text-muted-foreground">{c.updated}</Td>
        </Row>
      )}
    />
  );
}

/* ---------- Travel ---------- */
export function TravelScreen() {
  return (
    <ListScreen
      title="Travel Insurance"
      icon={I.plane}
      sub="15 open travel requests · 5 awaiting payment"
      primaryAction="New travel quote"
      stats={[
        { val: "15", label: "Open requests" },
        { val: "5", label: "Awaiting payment", color: "var(--amber)" },
        { val: "3", label: "Issued today", color: "var(--brand)" },
        { val: pesoShort(78000), label: "Awaiting payment", color: "var(--brand)" },
      ]}
      filters={["Awaiting Payment", "Under Review", "Policy Issued"]}
      rows={TRAVEL.map((t) => ({ ...t, _filter: t.status }))}
      defaultSort={{ key: "status", dir: "asc" }}
      columns={[
        { k: "id", label: "Travel no." },
        { k: "client", label: "Client" },
        { k: "dest", label: "Destination" },
        { k: "date", label: "Travel dates" },
        { k: "status", label: "Status" },
        { k: "amount", label: "Premium", num: true },
        { k: "next", label: "Next step" },
      ]}
      renderRow={(t) => (
        <Row key={t.id}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{t.id}</span></Td>
          <Td><ClientCell name={t.client} /></Td>
          <Td className="font-[550]">{t.flag} {t.dest}</Td>
          <Td className="text-muted-foreground">{t.date}</Td>
          <Td><StatusBadge status={t.status} /></Td>
          <Td className={numTd}>{peso(t.amount)}</Td>
          <Td className="text-muted-foreground">{t.next}</Td>
        </Row>
      )}
    />
  );
}

/* ---------- Documents (screen-local mock data) ---------- */
interface Doc {
  name: string;
  type: string;
  client: string;
  size: string;
  date: string;
  status: "Verified" | "Pending" | "Missing";
}
const DOCS: Doc[] = [
  { name: "Maria Cruz — Valid ID.pdf", type: "Identification", client: "Maria Cruz", size: "1.2 MB", date: "Jun 9, 2026", status: "Verified" },
  { name: "APP-000125 Medical Questionnaire.pdf", type: "Medical", client: "Renato Dizon", size: "840 KB", date: "Jun 10, 2026", status: "Pending" },
  { name: "Blue Royale Policy Contract.pdf", type: "Contract", client: "John Santos", size: "3.4 MB", date: "Jun 8, 2026", status: "Verified" },
  { name: "Andres Bonifacio — TIN ID.jpg", type: "Identification", client: "Andres Bonifacio", size: "—", date: "Requested", status: "Missing" },
  { name: "CLM-00781 Hospital Bill.pdf", type: "Claim", client: "Teresa Mendoza", size: "2.1 MB", date: "Jun 10, 2026", status: "Pending" },
  { name: "Travel Itinerary — Japan.pdf", type: "Travel", client: "Katrina Bautista", size: "560 KB", date: "Jun 9, 2026", status: "Verified" },
];
const DOC_TONE: Record<Doc["status"], Tone> = { Verified: "green", Pending: "amber", Missing: "red" };

export function DocumentsScreen() {
  return (
    <ListScreen
      title="Documents"
      icon={I.folder}
      sub="Central repository for client and policy documents"
      primaryAction="Upload"
      stats={[
        { val: "4,821", label: "Total documents" },
        { val: "12", label: "Pending review", color: "var(--amber)" },
        { val: "5", label: "Missing / requested", color: "var(--red)" },
        { val: "98%", label: "Verified", color: "var(--brand)" },
      ]}
      filters={["Verified", "Pending", "Missing"]}
      rows={DOCS.map((d) => ({ ...d, _filter: d.status }))}
      defaultSort={{ key: "date", dir: "desc" }}
      columns={[
        { k: "name", label: "Document" },
        { k: "type", label: "Type" },
        { k: "client", label: "Client" },
        { k: "size", label: "Size" },
        { k: "date", label: "Uploaded" },
        { k: "status", label: "Status" },
      ]}
      renderRow={(d) => (
        <Row key={d.name}>
          <Td>
            <div className="flex items-center gap-2.5">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-surface-3 text-muted-foreground">
                <I.doc2 size={15} />
              </span>
              <span className="text-[12.5px] font-semibold">{d.name}</span>
            </div>
          </Td>
          <Td><Pill tone="slate">{d.type}</Pill></Td>
          <Td className="text-muted-foreground">{d.client}</Td>
          <Td className="font-mono text-[12px] text-muted-foreground">{d.size}</Td>
          <Td className="text-muted-foreground">{d.date}</Td>
          <Td><Pill tone={DOC_TONE[d.status]} dot>{d.status}</Pill></Td>
        </Row>
      )}
    />
  );
}
