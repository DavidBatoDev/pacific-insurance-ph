"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { assignCommissionContactAction, fileCommissionVoucherAction, updateCommissionAction } from "@/app/(app)/payments/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import type { CommissionTrackerRow } from "@/lib/queries/commission-tracker";
import { computeCommission, VAT_BASE_FACTOR, WITHHOLDING_TAX_RATE } from "@/lib/commissions/compute";
import { money, moneyTotals } from "@/lib/format";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { useOverlays } from "../overlays/overlay-provider";
import { Modal } from "../overlays/modal";
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
export function CommissionsLive({ commissions, commissionContacts }: { commissions: CommissionTrackerRow[]; commissionContacts: ExternalContact[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const { openContact } = useRecordNav();
  const [, startTransition] = useTransition();

  const label = (commission: CommissionTrackerRow) => COMM_LABEL[commission.status] ?? commission.status;
  const count = (displayLabel: string) =>
    commissions.filter((commission) => label(commission) === displayLabel).length;
  const paidTotals = new Map<string, number>();
  const paidEstimates = new Map<string, number>();
  let paidMissingActual = 0;
  for (const commission of commissions.filter((entry) => label(entry) === "Paid")) {
    if (commission.amount != null) {
      const currency = commission.currency ?? commission.premiumCurrency ?? "PHP";
      paidTotals.set(currency, (paidTotals.get(currency) ?? 0) + commission.amount);
    } else {
      paidMissingActual += 1;
      if (commission.estimatedAmount != null) {
        const currency = commission.currency ?? commission.premiumCurrency ?? "PHP";
        paidEstimates.set(currency, (paidEstimates.get(currency) ?? 0) + commission.estimatedAmount);
      }
    }
  }
  const canSeeAmounts = persona.role !== "agent";

  const updateStep = async (commission: CommissionTrackerRow, step: "follow-up" | "paid") => {
    if (!commission.canUpdateCommission) return;
    if (step === "paid" && !await overlays.confirm({
      title: "Record commission payment",
      message: "Record this commission as paid. This does not file a carrier voucher or turn an estimate into an actual amount.",
      confirmLabel: "Record payment",
    })) return;
    startTransition(async () => {
      const result = await updateCommissionAction(commission.id, step);
      if (result.ok) {
        overlays.toast(step === "paid" ? "Commission payment recorded" : "Follow-up logged",
          `${commission.clientName ?? "Client"} · OR ${commission.orNumber ?? "—"}.`);
        router.refresh();
      } else {
        overlays.toast("Couldn’t update commission", result.error);
      }
    });
  };

  const requestVoucher = (commission: CommissionTrackerRow) => {
    if (!commission.canUpdateCommission || !commission.clientId || !commission.pacificCrossContactId || commission.pacificCrossContactStatus !== "Active" || !commission.pacificCrossContactEmail) return;
    overlays.openEngage(
      "Request Commission Voucher",
      {
        clientId: commission.clientId,
        name: commission.clientName ?? "Client",
        email: commission.pacificCrossContactEmail,
        externalContactId: commission.pacificCrossContactId,
        product: `OR ${commission.orNumber ?? "—"} — ${commission.clientName ?? ""} (${commission.policyRef ?? "policy"})`,
        premium: commission.estimatedAmount,
        record: commission.policyId ? { kind: "policy", id: commission.policyId } : null,
      },
      // Runs only after Gmail accepted the request; a failed status update never invites a resend.
      () =>
        startTransition(async () => {
          const result = await updateCommissionAction(commission.id, "requested");
          if (!result.ok) overlays.toast("Email sent — update the commission manually", `The voucher request was sent, but the commission status couldn’t be updated: ${result.error}`);
          router.refresh();
        }),
    );
  };

  const assignContact = (commission: CommissionTrackerRow, contactId: string) => {
    if (!commission.canUpdateCommission) return;
    startTransition(async () => {
      const result = await assignCommissionContactAction(commission.id, contactId || null);
      if (!result.ok) overlays.toast("Couldn’t assign contact", result.error);
      router.refresh();
    });
  };

  return (
    <ListScreen
      title="Commissions"
      sub="Commission payments and carrier voucher filing"
      icon={I.peso}
      stats={[
        { val: count("Requested"), label: "Requested", color: "var(--violet)" },
        { val: count("Follow-up"), label: "Follow-up pending", color: "var(--amber)" },
        { val: commissions.filter((commission) => commission.voucherDocumentId && commission.canReadVoucher).length, label: "Originals filed · visible", color: "var(--blue)" },
        {
          val: canSeeAmounts ? moneyTotals(paidTotals) : "Restricted",
          label: `Paid actual amounts · ${count("Paid")} paid`,
          color: "var(--brand)",
        },
        {
          val: canSeeAmounts ? moneyTotals(paidEstimates) : "Restricted",
          label: `Estimates only · ${paidMissingActual} paid without actual`,
          color: "var(--amber)",
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
        { k: "voucherReference", label: "Carrier voucher" },
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
                  <span>
                    {money(commission.amount, commission.currency ?? commission.premiumCurrency)}
                    <span className="block text-[11px] font-normal text-subtle">Actual amount</span>
                  </span>
                ) : commission.estimatedAmount != null ? (
                  <span className="text-muted-foreground">
                    Estimate · {money(commission.estimatedAmount, commission.currency ?? commission.premiumCurrency)}
                    {commission.ratePct != null && (
                      <span className="block text-[11px] font-normal text-subtle">
                        {commission.ratePct}% · net of VAT and WHT
                      </span>
                    )}
                    <CommissionBreakdownToggle commission={commission} />
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
              {commission.canUpdateCommission ? (
                <span onClick={(event) => event.stopPropagation()}>
                  <select aria-label={`Commission contact for ${commission.clientName ?? commission.orNumber ?? "commission"}`} className="h-8 max-w-[190px] rounded-md border border-border-strong bg-card px-2 text-[11.5px]" value={commission.pacificCrossContactId ?? ""} onChange={(event) => assignContact(commission, event.target.value)}>
                    <option value="">Assign contact…</option>
                    {commission.pacificCrossContactId && !commissionContacts.some((contact) => contact.id === commission.pacificCrossContactId) && <option value={commission.pacificCrossContactId}>{commission.pacificCrossContactName ?? "Inactive contact"} (inactive)</option>}
                    {commissionContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                  </select>
                </span>
              ) : <span className="text-muted-foreground">{commission.pacificCrossContactName ?? "Not assigned"}</span>}
            </Td>
            <Td className="text-muted-foreground">{fmtDate(commission.followUpDate)}</Td>
            <Td>
              <VoucherOriginal commission={commission} />
            </Td>
            <Td>
              <span
                className="flex flex-wrap justify-end gap-1.5"
                onClick={(event) => event.stopPropagation()}
              >
                {commission.canFileVoucher && <VoucherFilingControl commission={commission} />}
                {commission.canUpdateCommission && !commission.clientId && (
                  <span className="max-w-[240px] whitespace-normal text-[12px] text-red">This commission has no client; voucher cannot be filed.</span>
                )}
                {commission.canUpdateCommission && !commission.voucherDocumentId && (
                  <>
                    <Btn size="sm" disabled={!commission.clientId || !commission.pacificCrossContactId || commission.pacificCrossContactStatus !== "Active" || !commission.pacificCrossContactEmail} onClick={() => requestVoucher(commission)}>
                      Request Voucher
                    </Btn>
                    <Btn size="sm" onClick={() => updateStep(commission, "follow-up")}>
                      Log Follow-up
                    </Btn>
                  </>
                )}
                {commission.canUpdateCommission && displayLabel !== "Paid" && (
                  <Btn size="sm" variant="primary" onClick={() => updateStep(commission, "paid")}>
                    Mark Paid
                  </Btn>
                )}
                {displayLabel === "Paid" && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
                    <I.check size={13} /> Paid · {fmtDate(commission.paidDate)}
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

function VoucherOriginal({ commission }: { commission: CommissionTrackerRow }) {
  if (!commission.canReadVoucher) return <span className="text-subtle">Restricted</span>;
  if (!commission.voucherDocumentId) return <span className="text-subtle">Original not filed</span>;
  return (
    <div className="max-w-[220px] text-[11.5px]">
      <a
        href={`/api/documents/${commission.voucherDocumentId}/download`}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-1 break-all font-semibold text-brand-hover hover:underline"
      >
        <I.doc2 size={12} className="shrink-0" />
        {commission.voucherReference || "Voucher PDF"}
      </a>
      <span className="mt-0.5 block text-muted-foreground">Original filed · {fmtDate(commission.voucherReceivedAt)}</span>
    </div>
  );
}

/** Each row keeps its reference draft and opening pointer until filing succeeds. */
function VoucherFilingControl({ commission }: { commission: CommissionTrackerRow }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState(commission.voucherReference ?? "");
  const [expectedDocumentId, setExpectedDocumentId] = useState(commission.voucherDocumentId);
  const [saving, setSaving] = useState(false);
  const replacing = Boolean(commission.voucherDocumentId);

  return (
    <>
      <Btn size="sm" onClick={() => {
        setExpectedDocumentId(commission.voucherDocumentId);
        setOpen(true);
      }}>
        {replacing ? "Replace voucher" : "File voucher"}
      </Btn>
      {open && (
        <Modal
          maxWidth={520}
          onClose={() => { if (!saving) setOpen(false); }}
          footer={<Btn disabled={saving} onClick={() => setOpen(false)}>Close</Btn>}
        >
          <h3 className="text-[16px] font-bold">{replacing ? "Replace voucher" : "File voucher"}</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            File the original carrier PDF. Remove its password before uploading. Filing does not record a commission payment or change financial amounts.
          </p>
          <dl className="my-4 grid grid-cols-1 gap-3 rounded-md border border-border-soft bg-surface-2 p-3 text-[12px] sm:grid-cols-2">
            {([
              ["Client", commission.clientName ?? "Not recorded"],
              ["Assigned agent", commission.assignedUserName ?? "Not recorded"],
              ["Product", commission.productName ?? "Not recorded"],
              ["Plan", commission.planName ?? "Not recorded"],
              ["Premium", commission.premiumAmount != null ? money(commission.premiumAmount, commission.premiumCurrency) : "Not recorded"],
              ["Currency", commission.premiumCurrency ?? "Not recorded"],
            ] as const).map(([name, value]) => (
              <div key={name} className="min-w-0">
                <dt className="text-subtle">{name}</dt>
                <dd className="mt-0.5 break-words font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mb-4 text-[12px]">
            <span className="font-semibold">Commission estimate</span>
            <span className="ml-2 font-mono">{commission.estimatedAmount != null ? money(commission.estimatedAmount, commission.currency ?? commission.premiumCurrency) : "Not recorded"}</span>
            <CommissionBreakdownToggle commission={commission} />
          </div>
          <div className="mb-4 rounded-md border border-border-soft p-3">
            <p className="mb-1 text-[12px] font-semibold">Current original</p>
            <VoucherOriginal commission={commission} />
            {commission.voucherDocumentId && (
              <p className="mt-1 break-all text-[11.5px] text-muted-foreground">{commission.voucherFileName ?? "Voucher PDF"}</p>
            )}
            {replacing && <p className="mt-2 text-[11.5px] text-muted-foreground">The previous original stays in the filing history when replaced.</p>}
          </div>
          <label className="mb-4 block text-[12px] font-semibold">
            Carrier voucher number <span className="font-normal text-subtle">(optional)</span>
            <input
              value={reference}
              disabled={saving}
              maxLength={200}
              onChange={(event) => setReference(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25"
            />
          </label>
          {!commission.clientId ? (
            <p role="alert" className="text-[12px] text-red">This commission has no client; voucher cannot be filed.</p>
          ) : (
            <PdfUpload
              clientId={commission.clientId}
              prompt={replacing ? "Upload replacement voucher PDF" : "Upload carrier voucher PDF"}
              disabled={saving || !commission.canFileVoucher}
              onUploaded={async (path, fileName) => {
                setSaving(true);
                try {
                  const result = await fileCommissionVoucherAction({
                    commissionId: commission.id,
                    path,
                    fileName,
                    voucherReference: reference,
                    expectedDocumentId,
                  });
                  if (result.ok) {
                    setReference(result.data.voucherReference ?? "");
                    setOpen(false);
                    overlays.toast("Voucher filed", fileName);
                    router.refresh();
                  }
                  return result;
                } catch (cause) {
                  const message = cause instanceof Error ? cause.message : "Couldn’t file voucher. Try again.";
                  return { ok: false, error: message };
                } finally {
                  setSaving(false);
                }
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}


/**
 * H9c — the commission computation, shown step by step. Recomputed with the same
 * `computeCommission` the payment action stored the estimate with, so the two always agree.
 */
function CommissionBreakdownToggle({ commission }: { commission: CommissionTrackerRow }) {
  const [open, setOpen] = useState(false);
  if (commission.premiumAmount == null || commission.ratePct == null) return null;
  const b = computeCommission(commission.premiumAmount, commission.ratePct);
  const cur = commission.premiumCurrency;
  const vatPct = Math.round((1 - VAT_BASE_FACTOR) * 100);
  const whtPct = Math.round(WITHHOLDING_TAX_RATE * 100);
  const lines: [string, string, boolean?][] = [
    ["Premium", money(b.premium, cur)],
    [`Less VAT (${vatPct}%)`, `− ${money(b.vat, cur)}`],
    ["Commission base", money(b.base, cur)],
    [`× rate (${b.ratePct}%)`, money(b.gross, cur)],
    [`Less WHT (${whtPct}%)`, `− ${money(b.withholdingTax, cur)}`],
    ["Net commission", money(b.net, cur), true],
  ];
  const source = [
    commission.rateProductName,
    commission.rateBusinessType,
    commission.rateEffectiveDate ? `rate effective ${fmtDate(commission.rateEffectiveDate)}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <span className="block" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-0.5 font-sans text-[11px] font-semibold text-brand-hover hover:underline"
      >
        {open ? "Hide breakdown" : "Show breakdown"}
      </button>
      {open && (
        <span className="mt-1.5 block min-w-[230px] rounded-md border border-border-soft bg-surface-2 px-2.5 py-2 text-left font-sans">
          {lines.map(([label, value, strong]) => (
            <span key={label} className={`flex justify-between gap-4 text-[11.5px] ${strong ? "mt-1 border-t border-border-soft pt-1 font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>
              <span>{label}</span>
              <span className="whitespace-nowrap font-mono tabular-nums">{value}</span>
            </span>
          ))}
          {source && <span className="mt-1.5 block text-[10.5px] font-normal text-subtle">{source}</span>}
          <span className="mt-0.5 block text-[10.5px] font-normal text-subtle">VAT basis is an assumption pending finance (DH16).</span>
        </span>
      )}
    </span>
  );
}
