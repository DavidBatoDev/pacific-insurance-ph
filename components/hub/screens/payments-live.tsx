"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Commission, Payment } from "@/lib/repositories/payments";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "@/lib/format";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { useOverlays } from "../overlays/overlay-provider";
import { VerifyPaymentDrawer } from "../overlays/verify-payment";
import { Btn, StatusBadge } from "../primitives";
import { ClientCell, Row, Td } from "../table";
import { CommissionsLive } from "./commissions-live";
import { ListScreen } from "./list-screen";

/**
 * Payments — Collections + Commissions tabs (see payments-page.md), wired to the payments and commissions tables.
 */

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function PaymentsLive({
  payments,
  commissions,
  commissionContacts,
}: {
  payments: Payment[];
  commissions: Commission[];
  commissionContacts: ExternalContact[];
}) {
  const { openContact, prefetchContact } = useRecordNav();
  const [tab, setTab] = useState<"collections" | "commissions">("collections");
  const [verify, setVerify] = useState<Payment | null>(null);

  const tabControl = (
    <div className="flex items-center rounded-md border border-border bg-surface-3 p-0.5">
      {(
        [
          ["collections", "Collections"],
          ["commissions", "Commissions"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className={cn(
            "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
            tab === id ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  /* ------------------------------ collections ------------------------------ */
  const sum = (st: string) => payments.filter((p) => p.status === st).reduce((a, p) => a + (p.amount ?? 0), 0);
  const cnt = (st: string) => payments.filter((p) => p.status === st).length;

  const collections = (
    <ListScreen
      title="Payments"
      sub="Premium collection across Applications, Renewals & Travel · verify payments and capture the OR number"
      icon={I.peso}
      stats={[
        { val: pesoShort(sum("Awaiting")), label: `Awaiting payment · ${cnt("Awaiting")}`, color: "var(--amber)" },
        { val: cnt("Received"), label: "Received · unverified", color: "var(--blue)" },
        { val: cnt("Verified"), label: "Verified · OR in", color: "var(--brand)" },
        { val: pesoShort(sum("Overdue")), label: `Overdue · ${cnt("Overdue")}`, color: "var(--red)" },
      ]}
      filters={["Awaiting", "Received", "Verified", "Overdue"]}
      filters2={["Application", "Renewal", "Travel"]}
      filters2Label="Source"
      rows={payments.map((p) => ({ ...p, _filter: p.status, _filter2: p.source }))}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      emptyText="No payments tracked yet."
      columns={[
        { k: "referenceNo", label: "Payment ref" },
        { k: "clientName", label: "Client" },
        { k: "source", label: "Source" },
        { k: "amount", label: "Amount", num: true },
        { k: "paymentMethod", label: "Method" },
        { k: "status", label: "Status" },
        { k: "orNumber", label: "OR number" },
        { k: "paymentDate", label: "Date" },
        { k: "id", label: "" },
      ]}
      renderRow={(p) => (
        <Row key={p.id} onClick={() => p.clientId && openContact(p.clientId)} onMouseEnter={() => p.clientId && prefetchContact(p.clientId)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{p.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={p.clientName ?? "—"} sub={p.sourceRef ?? undefined} /></Td>
          <Td><SourceCell payment={p} /></Td>
          <Td className="text-right font-mono font-semibold tabular-nums">{p.amount != null ? peso(p.amount) : "—"}</Td>
          <Td className="text-muted-foreground">{p.paymentMethod ?? "—"}</Td>
          <Td><StatusBadge status={p.status} /></Td>
          <Td>{p.orNumber ? <span className="font-mono text-[12px]">{p.orNumber}</span> : <span className="text-subtle">—</span>}</Td>
          <Td className="text-muted-foreground">{fmtDate(p.paymentDate ?? p.createdAt)}</Td>
          <Td>
            <span onClick={(e) => e.stopPropagation()}>
              {p.status === "Verified" ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                  <I.check size={13} /> Verified
                </span>
              ) : (
                <Btn size="sm" onClick={() => setVerify(p)}>
                  <I.peso size={13} /> Verify Payment
                </Btn>
              )}
            </span>
          </Td>
        </Row>
      )}
    />
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">{tabControl}</div>
      {tab === "collections" ? collections : <CommissionsLive commissions={commissions} commissionContacts={commissionContacts} />}
      {verify && <VerifyPaymentDrawer payment={verify} onClose={() => setVerify(null)} />}
    </div>
  );
}

/** Source type + reference, linking to the record the payment belongs to. */
function SourceCell({ payment: p }: { payment: Payment }) {
  const router = useRouter();
  const overlays = useOverlays();
  const { openContact } = useRecordNav();

  let go: (() => void) | null = null;
  if (p.source === "Application" && p.applicationId) {
    const id = p.applicationId;
    go = () => overlays.openApplicationRequirements(id);
  } else if (p.source === "Travel" && p.travelRequestId) {
    const id = p.travelRequestId;
    go = () => overlays.openTravelWorkflow(id);
  } else if (p.source === "Renewal") {
    go = () => router.push("/renewals");
  } else if (p.source === "Policy" && p.clientId) {
    const id = p.clientId;
    go = () => openContact(id);
  }

  if (!go) return <span className="text-[12.5px] text-muted-foreground">{p.source}</span>;
  const run = go;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        run();
      }}
      className="rounded-sm text-left text-[12.5px] font-semibold text-brand-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {p.source}
      {p.sourceRef ? ` · ${p.sourceRef}` : ""}
    </button>
  );
}
