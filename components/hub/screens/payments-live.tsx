"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { verifyPaymentAction } from "@/app/(app)/payments/actions";
import { uploadDocumentAction } from "@/app/(app)/documents/actions";
import type { Commission, Payment } from "@/lib/repositories/payments";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "@/lib/format";
import type { Tone } from "../tone";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { Drawer } from "../overlays/drawer";
import { useOverlays } from "../overlays/overlay-provider";
import { Btn, Field, INPUT, Pill, StatusBadge } from "../primitives";
import { ClientCell, Row, Td } from "../table";
import { CommissionsLive } from "./commissions-live";
import { ListScreen } from "./list-screen";

/**
 * Payments — Collections + Commissions tabs (see payments-page.md), wired to the payments and commissions tables.
 */

const SOURCE_TONE: Record<string, Tone> = {
  Application: "blue",
  Renewal: "violet",
  Travel: "amber",
  Policy: "green",
  Other: "slate",
};

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
  const { openContact } = useRecordNav();
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
        <Row key={p.id} onClick={() => p.clientId && openContact(p.clientId)}>
          <Td><span className="font-mono text-[12px] text-muted-foreground">{p.referenceNo ?? "—"}</span></Td>
          <Td><ClientCell name={p.clientName ?? "—"} sub={p.sourceRef ?? undefined} /></Td>
          <Td>
            <Pill size="sm" tone={SOURCE_TONE[p.source]}>{p.source}</Pill>
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

  return (
    <div>
      <div className="mb-2 flex justify-end">{tabControl}</div>
      {tab === "collections" ? collections : <CommissionsLive commissions={commissions} commissionContacts={commissionContacts} />}
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

      <Field
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
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Payment method" required>
          <select className={INPUT} value={method} onChange={(e) => setMethod(e.target.value)}>
            {["Portal", "Bank transfer", "Cashier", "Credit card", "Business link", "Other"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment status" required hint="Awaiting → Received → Verified">
          <select
            className={INPUT}
            value={status}
            onChange={(e) => setStatus(e.target.value as "Received" | "Verified")}
          >
            <option>Received</option>
            <option>Verified</option>
          </select>
        </Field>
      </div>

      <Field
        label="OR number"
        required={status === "Verified"}
        hint="Official Receipt from Pacific Cross (via Glynn) — also stamped on the policy"
        className="mt-4"
      >
        <input className={INPUT} value={or} onChange={(e) => setOr(e.target.value)} placeholder="OR-2026-XXXXX" />
      </Field>

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

      <Field label="Internal notes" className="mt-4">
        <textarea
          className="min-h-[70px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything worth noting…"
        />
      </Field>

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
