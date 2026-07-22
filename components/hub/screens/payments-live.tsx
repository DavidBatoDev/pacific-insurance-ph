"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  updateCommissionAction,
  verifyPaymentAction,
} from "@/app/(app)/payments/actions";
import { uploadDocumentAction } from "@/app/(app)/documents/actions";
import type { Commission, Payment } from "@/lib/repositories/payments";
import { cn } from "@/lib/utils";
import { peso, pesoShort, type Tone } from "../data";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { DRAWER_INPUT, DrawerField } from "../overlays/client-picker";
import { Drawer } from "../overlays/drawer";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Avatar, Btn, PageHead, StatusBadge, TONE_BADGE } from "../primitives";
import { ClientCell, Row, Td } from "../table";
import { ListScreen } from "./list-screen";

/**
 * Payments — Collections + Commissions tabs (design payments.jsx /
 * payments-page.md), wired to the payments and commissions tables.
 */

const SOURCE_TONE: Record<string, Tone> = {
  Application: "blue",
  Renewal: "violet",
  Travel: "amber",
  Policy: "green",
  Other: "slate",
};

/** Pacific Cross contact index — one edit if personnel change. */
const PC_VOUCHER_CONTACT = { name: "Roseanne Llaga", email: "roseanne.llaga@pacificcross.com" };

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
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function PaymentsLive({
  payments,
  commissions,
}: {
  payments: Payment[];
  commissions: Commission[];
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const { openContact } = useRecordNav();
  const [tab, setTab] = useState<"collections" | "commissions">("collections");
  const [verify, setVerify] = useState<Payment | null>(null);
  const [, startTransition] = useTransition();

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

  const commissionStep = (c: Commission, step: "follow-up" | "received" | "paid") =>
    startTransition(async () => {
      const res = await updateCommissionAction(c.id, step);
      if (res.ok)
        overlays.toast(
          step === "paid" ? "Commission paid" : step === "received" ? "Commission received" : "Follow-up logged",
          `${c.clientName ?? "Client"} · OR ${c.orNumber ?? "—"}.`,
        );
      else overlays.toast("Couldn’t update commission", res.error);
      router.refresh();
    });

  const requestVoucher = (c: Commission) => {
    if (!c.clientId) return;
    overlays.openEngage(
      "Request Commission Voucher",
      {
        clientId: c.clientId,
        name: c.clientName ?? "Client",
        email: PC_VOUCHER_CONTACT.email,
        product: `OR ${c.orNumber ?? "—"} — ${c.clientName ?? ""} (${c.policyRef ?? "policy"})`,
        premium: c.estimatedAmount,
      },
      () =>
        startTransition(async () => {
          await updateCommissionAction(c.id, "requested");
          router.refresh();
        }),
    );
  };

  /* ------------------------------ collections ------------------------------ */
  const sum = (st: string) => payments.filter((p) => p.status === st).reduce((a, p) => a + (p.amount ?? 0), 0);
  const cnt = (st: string) => payments.filter((p) => p.status === st).length;

  const collections = (
    <ListScreen
      title="Payments"
      sub="Premium collection across Applications, Renewals & Travel · verify payments and capture the OR number"
      icon={I.peso}
      draft={false}
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
        <Row key={p.id} onClick={() => p.clientId && openContact(p.clientId)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{p.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={p.clientName ?? "—"} sub={p.sourceRef ?? undefined} /></Td>
          <Td>
            <span className={cn("inline-flex h-[20px] items-center rounded-full border px-2 text-[10.5px] font-[650]", TONE_BADGE[SOURCE_TONE[p.source]])}>
              {p.source}
            </span>
          </Td>
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

  /* ------------------------------ commissions ------------------------------ */
  const canSeeAmounts = persona.role !== "agent";
  const label = (c: Commission) => COMM_LABEL[c.status] ?? c.status;
  const ccnt = (l: string) => commissions.filter((c) => label(c) === l).length;
  const paidSum = commissions.filter((c) => label(c) === "Paid").reduce((a, c) => a + (c.amount ?? c.estimatedAmount ?? 0), 0);

  const commissionsTab = (
    <ListScreen
      title="Payments"
      sub="Commission tracking · OR number → voucher requested → follow-up → received → paid"
      icon={I.peso}
      draft={false}
      stats={[
        { val: ccnt("Requested"), label: "Requested", color: "var(--violet)" },
        { val: ccnt("Follow-up"), label: "Follow-up pending", color: "var(--amber)" },
        { val: ccnt("Received"), label: "Received", color: "var(--blue)" },
        { val: pesoShort(paidSum) + ` · ${ccnt("Paid")}`, label: "Paid · Commission YTD", color: "var(--brand)" },
      ]}
      filters={["Requested", "Follow-up", "Received", "Paid"]}
      rows={commissions.map((c) => ({ ...c, _filter: label(c) }))}
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
      renderRow={(c) => {
        const l = label(c);
        return (
          <Row key={c.id} onClick={() => c.clientId && openContact(c.clientId)}>
            <Td><span className="font-mono text-[12px]">{c.orNumber ?? "—"}</span></Td>
            <Td>
              <div className="flex items-center gap-2.5">
                <Avatar name={c.clientName ?? "—"} size={28} />
                <span className="text-[13px] font-semibold">{c.clientName ?? "—"}</span>
              </div>
            </Td>
            <Td className="text-muted-foreground">{c.policyRef ?? "—"}</Td>
            <Td className="text-right font-mono font-semibold tabular-nums">
              {canSeeAmounts ? (
                c.amount != null ? (
                  peso(c.amount)
                ) : c.estimatedAmount != null ? (
                  <span className="text-muted-foreground">~{peso(c.estimatedAmount)}</span>
                ) : (
                  "—"
                )
              ) : (
                <span title="Hidden — commission amounts are restricted for your role" className="text-subtle">•••••</span>
              )}
            </Td>
            <Td><StatusBadge status={l === "Requested" ? "Requested" : l === "Follow-up" ? "Follow-up" : l} /></Td>
            <Td>
              <span className="text-[12.5px] font-[550]">{PC_VOUCHER_CONTACT.name}</span>
              <span className="block text-[11px] text-subtle">Pacific Cross</span>
            </Td>
            <Td className="text-muted-foreground">{fmtDate(c.followUpDate)}</Td>
            <Td>
              {(l === "Received" || l === "Paid") && c.orNumber ? (
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted-foreground">
                  <I.doc2 size={12} /> CV-{c.orNumber.replace(/[^0-9]/g, "") || c.orNumber}
                </span>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </Td>
            <Td>
              <span className="flex flex-wrap justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                {(l === "Requested" || l === "Follow-up" || l === "Not started" || l === "Waiting for OR") && (
                  <>
                    {l !== "Follow-up" && (
                      <Btn size="sm" onClick={() => requestVoucher(c)}>
                        Request Voucher
                      </Btn>
                    )}
                    <Btn size="sm" onClick={() => commissionStep(c, "follow-up")}>
                      Log Follow-up
                    </Btn>
                    <Btn size="sm" onClick={() => commissionStep(c, "received")}>
                      Mark Received
                    </Btn>
                  </>
                )}
                {l === "Received" && (
                  <Btn size="sm" variant="primary" onClick={() => commissionStep(c, "paid")}>
                    Mark Paid
                  </Btn>
                )}
                {l === "Paid" && (
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

  return (
    <div>
      <div className="mb-2 flex justify-end">{tabControl}</div>
      {tab === "collections" ? collections : commissionsTab}
      {verify && <VerifyPaymentDrawer payment={verify} onClose={() => setVerify(null)} />}
    </div>
  );
}

/** Verify Payment drawer (payments-page.md Tab 1). */
function VerifyPaymentDrawer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [method, setMethod] = useState(payment.paymentMethod ?? "Portal");
  const [status, setStatus] = useState<"Received" | "Verified">(
    payment.status === "Received" ? "Verified" : "Received",
  );
  const [or, setOr] = useState(payment.orNumber ?? "");
  const [submitted, setSubmitted] = useState(payment.sentToPacificCross);
  const [proof, setProof] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const hasProof = !!proof || !!payment.proofDocumentId;
  const canSave = !pending && hasProof && (status !== "Verified" || or.trim());

  const save = () =>
    startTransition(async () => {
      // Upload the proof first (documents storage path), then verify with its id.
      let proofDocumentId: string | null = null;
      if (proof) {
        const fd = new FormData();
        fd.set("file", proof);
        if (payment.clientId) fd.set("clientId", payment.clientId);
        fd.set("documentType", "Proof of Payment");
        fd.set("name", `Proof of payment — ${payment.referenceNo ?? payment.id.slice(0, 8)}`);
        try {
          const uploaded = await uploadDocumentAction(fd);
          proofDocumentId = uploaded?.id ?? null;
        } catch {
          overlays.toast("Couldn’t upload proof", "The file didn’t upload — try again.");
          return;
        }
      }
      const res = await verifyPaymentAction({
        paymentId: payment.id,
        paymentMethod: method,
        status,
        orNumber: or.trim() || null,
        submittedToPacificCross: submitted,
        proofDocumentId,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        overlays.toast(
          status === "Verified" ? "Payment verified · OR recorded" : "Payment updated",
          status === "Verified"
            ? `${payment.clientName ?? "Client"} · OR ${or.trim()} on file · commission row + follow-up task created.`
            : `${payment.clientName ?? "Client"} marked Received.`,
        );
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t verify payment", res.error);
      }
    });

  return (
    <Drawer
      icon="peso"
      title="Verify payment"
      sub="Confirm proof, then capture the OR number to start commission tracking"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.check size={15} /> {pending ? "Saving…" : status === "Verified" ? "Verify & record OR" : "Save"}
          </Btn>
        </>
      }
    >
      <div className="mb-4 rounded-md border border-border-soft bg-surface-2 px-3.5 py-3 text-[12.5px]">
        {(
          [
            ["Payment", payment.referenceNo ?? "—"],
            ["Client", payment.clientName ?? "—"],
            ["Source", `${payment.source} · ${payment.sourceRef ?? "—"}`],
            ["Amount", payment.amount != null ? peso(payment.amount) : "—"],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-border-soft py-1.5 last:border-0">
            <span className="font-semibold uppercase tracking-[0.03em] text-subtle">{k}</span>
            <span className="font-[600]">{v}</span>
          </div>
        ))}
      </div>

      <DrawerField
        label="Proof of payment"
        required={!payment.proofDocumentId}
        hint="Screenshot or bank slip — saved to the client’s documents"
        className="mb-4"
      >
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed px-3.5 py-3 text-[12.5px] transition-colors",
            proof
              ? "border-brand bg-brand-soft text-brand-hover"
              : "border-border-strong text-muted-foreground hover:bg-hover",
          )}
        >
          <I.upload size={16} className="shrink-0" />
          {proof
            ? proof.name
            : payment.proofDocumentId
              ? "Proof already on file — attach a new file to replace it"
              : "Attach screenshot / bank slip…"}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
          />
        </label>
      </DrawerField>

      <div className="grid grid-cols-2 gap-4">
        <DrawerField label="Payment method" required>
          <select className={DRAWER_INPUT} value={method} onChange={(e) => setMethod(e.target.value)}>
            {["Portal", "Bank transfer", "Cashier", "Credit card", "Business link", "Other"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </DrawerField>
        <DrawerField label="Payment status" required hint="Awaiting → Received → Verified">
          <select
            className={DRAWER_INPUT}
            value={status}
            onChange={(e) => setStatus(e.target.value as "Received" | "Verified")}
          >
            <option>Received</option>
            <option>Verified</option>
          </select>
        </DrawerField>
      </div>

      <DrawerField
        label="OR number"
        required={status === "Verified"}
        hint="Official Receipt from Pacific Cross (via Glynn) — also stamped on the policy"
        className="mt-4"
      >
        <input className={DRAWER_INPUT} value={or} onChange={(e) => setOr(e.target.value)} placeholder="OR-2026-XXXXX" />
      </DrawerField>

      <button
        onClick={() => setSubmitted(!submitted)}
        className={cn(
          "mt-4 flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
          submitted ? "border-brand bg-brand-soft" : "border-border-strong text-muted-foreground hover:bg-hover",
        )}
      >
        <span className={cn("grid size-[18px] place-items-center rounded-md border-[1.6px]", submitted ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
          {submitted && <I.check size={13} />}
        </span>
        Submitted to Pacific Cross (Glynn) — the step that triggers the OR number
      </button>

      <DrawerField label="Internal notes" className="mt-4">
        <textarea
          className="min-h-[70px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth noting…"
        />
      </DrawerField>

      <div className="mt-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          {status === "Verified" ? (
            <>
              <b>On verify:</b> logs Payment verified + OR recorded to the client&apos;s timeline,
              advances the {payment.source.toLowerCase()}, stamps the policy&apos;s OR number, and
              auto-creates a commission row + follow-up task.
            </>
          ) : (
            <>
              Marks the payment <b>Received</b>. Add the OR number and set status to{" "}
              <b>Verified</b> to start commission tracking.
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
