"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { assignCommissionContactAction, updateCommissionAction } from "@/app/(app)/payments/actions";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import type { Commission } from "@/lib/repositories/payments";
import { peso, pesoShort } from "@/lib/format";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Avatar, Btn, StatusBadge } from "../primitives";
import { Row, Td } from "../table";
import { ListScreen } from "./list-screen";

/** DB voucher_status → design display label. */
const COMM_LABEL: Record<string, string> = {
  "Voucher Pending": "Requested",
  "Issue / Follow-Up Required": "Follow-up",
  Received: "Received",
  Paid: "Paid",
  "Not Started": "Not started",
  "Waiting for OR": "Waiting for OR",
};

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

/** Reusable commission tracker rendered at /commissions and under Payments. */
export function CommissionsLive({ commissions, commissionContacts }: { commissions: Commission[]; commissionContacts: ExternalContact[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const { openContact } = useRecordNav();
  const [, startTransition] = useTransition();

  const label = (commission: Commission) => COMM_LABEL[commission.status] ?? commission.status;
  const count = (displayLabel: string) =>
    commissions.filter((commission) => label(commission) === displayLabel).length;
  const paidSum = commissions
    .filter((commission) => label(commission) === "Paid")
    .reduce(
      (total, commission) =>
        total + (commission.amount ?? commission.estimatedAmount ?? 0),
      0,
    );
  const canSeeAmounts = persona.role !== "agent";

  const updateStep = (commission: Commission, step: "follow-up" | "received" | "paid") =>
    startTransition(async () => {
      const result = await updateCommissionAction(commission.id, step);
      if (result.ok) {
        overlays.toast(
          step === "paid"
            ? "Commission paid"
            : step === "received"
              ? "Commission received"
              : "Follow-up logged",
          `${commission.clientName ?? "Client"} · OR ${commission.orNumber ?? "—"}.`,
        );
      } else {
        overlays.toast("Couldn’t update commission", result.error);
      }
      router.refresh();
    });

  const requestVoucher = (commission: Commission) => {
    if (!commission.clientId || !commission.pacificCrossContactId || commission.pacificCrossContactStatus !== "Active" || !commission.pacificCrossContactEmail) return;
    overlays.openEngage(
      "Request Commission Voucher",
      {
        clientId: commission.clientId,
        name: commission.clientName ?? "Client",
        email: commission.pacificCrossContactEmail,
        externalContactId: commission.pacificCrossContactId,
        product: `OR ${commission.orNumber ?? "—"} — ${commission.clientName ?? ""} (${commission.policyRef ?? "policy"})`,
        premium: commission.estimatedAmount,
      },
      () =>
        startTransition(async () => {
          await updateCommissionAction(commission.id, "requested");
          router.refresh();
        }),
    );
  };

  const assignContact = (commission: Commission, contactId: string) => startTransition(async () => {
    const result = await assignCommissionContactAction(commission.id, contactId || null);
    if (!result.ok) overlays.toast("Couldn’t assign contact", result.error);
    router.refresh();
  });

  return (
    <ListScreen
      title="Commissions"
      sub="Commission tracking · OR number → voucher requested → follow-up → received → paid"
      icon={I.peso}
      stats={[
        { val: count("Requested"), label: "Requested", color: "var(--violet)" },
        { val: count("Follow-up"), label: "Follow-up pending", color: "var(--amber)" },
        { val: count("Received"), label: "Received", color: "var(--blue)" },
        {
          val: `${pesoShort(paidSum)} · ${count("Paid")}`,
          label: "Paid · Commission YTD",
          color: "var(--brand)",
        },
      ]}
      filters={["Requested", "Follow-up", "Received", "Paid"]}
      rows={commissions.map((commission) => ({
        ...commission,
        _filter: label(commission),
      }))}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      emptyText="No commissions yet — verify a payment with an OR number to start one."
      columns={[
        { k: "orNumber", label: "OR number" },
        { k: "clientName", label: "Client" },
        { k: "policyRef", label: "Policy" },
        { k: "estimatedAmount", label: "Commission", num: true },
        { k: "status", label: "Status" },
        { k: "clientId", label: "Commission contact" },
        { k: "followUpDate", label: "Last follow-up" },
        { k: "paidDate", label: "Voucher" },
        { k: "id", label: "" },
      ]}
      renderRow={(commission) => {
        const displayLabel = label(commission);
        return (
          <Row
            key={commission.id}
            onClick={() => commission.clientId && openContact(commission.clientId)}
          >
            <Td>
              <span className="font-mono text-[12px]">{commission.orNumber ?? "—"}</span>
            </Td>
            <Td>
              <div className="flex items-center gap-2.5">
                <Avatar name={commission.clientName ?? "—"} size={28} />
                <span className="text-[13px] font-semibold">
                  {commission.clientName ?? "—"}
                </span>
              </div>
            </Td>
            <Td className="text-muted-foreground">{commission.policyRef ?? "—"}</Td>
            <Td className="text-right font-mono font-semibold tabular-nums">
              {canSeeAmounts ? (
                commission.amount != null ? (
                  peso(commission.amount)
                ) : commission.estimatedAmount != null ? (
                  <span className="text-muted-foreground">
                    ~{peso(commission.estimatedAmount)}
                  </span>
                ) : (
                  "—"
                )
              ) : (
                <span
                  title="Hidden — commission amounts are restricted for your role"
                  className="text-subtle"
                >
                  •••••
                </span>
              )}
            </Td>
            <Td>
              <StatusBadge
                status={
                  displayLabel === "Requested"
                    ? "Requested"
                    : displayLabel === "Follow-up"
                      ? "Follow-up"
                      : displayLabel
                }
              />
            </Td>
            <Td>
              <span onClick={(event) => event.stopPropagation()}>
                <select className="h-8 max-w-[190px] rounded-md border border-border-strong bg-card px-2 text-[11.5px]" value={commission.pacificCrossContactId ?? ""} onChange={(event) => assignContact(commission, event.target.value)}>
                  <option value="">Assign contact…</option>
                  {commission.pacificCrossContactId && !commissionContacts.some((contact) => contact.id === commission.pacificCrossContactId) && <option value={commission.pacificCrossContactId}>{commission.pacificCrossContactName ?? "Inactive contact"} (inactive)</option>}
                  {commissionContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                </select>
              </span>
            </Td>
            <Td className="text-muted-foreground">{fmtDate(commission.followUpDate)}</Td>
            <Td>
              {(displayLabel === "Received" || displayLabel === "Paid") &&
              commission.orNumber ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
                  <I.doc2 size={12} /> CV-
                  {commission.orNumber.replace(/[^0-9]/g, "") || commission.orNumber}
                </span>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </Td>
            <Td>
              <span
                className="flex flex-wrap justify-end gap-1.5"
                onClick={(event) => event.stopPropagation()}
              >
                {(displayLabel === "Requested" ||
                  displayLabel === "Follow-up" ||
                  displayLabel === "Not started" ||
                  displayLabel === "Waiting for OR") && (
                  <>
                    {displayLabel !== "Follow-up" && (
                      <Btn size="sm" disabled={!commission.pacificCrossContactId || commission.pacificCrossContactStatus !== "Active" || !commission.pacificCrossContactEmail} onClick={() => requestVoucher(commission)}>
                        Request Voucher
                      </Btn>
                    )}
                    <Btn size="sm" onClick={() => updateStep(commission, "follow-up")}>
                      Log Follow-up
                    </Btn>
                    <Btn size="sm" onClick={() => updateStep(commission, "received")}>
                      Mark Received
                    </Btn>
                  </>
                )}
                {displayLabel === "Received" && (
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => updateStep(commission, "paid")}
                  >
                    Mark Paid
                  </Btn>
                )}
                {displayLabel === "Paid" && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                    <I.check size={13} /> Paid
                  </span>
                )}
              </span>
            </Td>
          </Row>
        );
      }}
    />
  );
}
