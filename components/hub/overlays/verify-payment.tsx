"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { uploadDocumentAction } from "@/app/(app)/documents/actions";
import { verifyPaymentAction } from "@/app/(app)/payments/actions";
import { peso } from "@/lib/format";
import type { Payment } from "@/lib/repositories/payments";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { Drawer } from "./drawer";
import { Section } from "./wizard/steps-1";
import type { SectionState } from "./wizard/wizard-data";
import { useOverlays } from "./overlay-provider";

/**
 * Verify Payment form (payments-page.md Tab 1): proof, method, status, OR. One implementation,
 * rendered by the Payments page's drawer and inline in the application workflow's Payment step.
 */
export function useVerifyPaymentForm(payment: Payment, onSaved: () => void) {
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
          status === "Verified" ? "Payment verified · invoice recorded" : "Payment updated",
          status === "Verified"
            ? `${payment.clientName ?? "Client"} · OR ${or.trim()} on file · commission row + follow-up task created.`
            : `${payment.clientName ?? "Client"} marked Received.`,
        );
        router.refresh();
        onSaved();
      } else {
        overlays.toast("Couldn’t verify payment", res.error);
      }
    });

  const submitLabel = pending ? "Saving…" : status === "Verified" ? "Verify & record invoice" : "Save";

  const summary = (
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
  );

  // Same grouped cards + completeness dots as the New Application wizard, so it is clear what is
  // still missing before saving.
  const needsOr = status === "Verified" && !or.trim();
  const missing = [...(hasProof ? [] : ["proof of payment"]), ...(needsOr ? ["service invoice no."] : [])];
  const proofState: SectionState = hasProof
    ? { status: "done", label: proof ? "Attached" : "On file" }
    : { status: "todo", label: "1 needed" };
  const receiptState: SectionState = needsOr
    ? { status: "todo", label: "Invoice no. needed" }
    : { status: "done", label: status === "Verified" ? "Ready to verify" : "Marking Received" };

  const fields = (
    <>
      <Section title="Proof of payment" state={proofState}>
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
              ? "Proof already on file"
              : "Attach a screenshot, bank slip or provisional receipt…"}
          <input
            type="file"
            accept="image/*,.pdf"
            aria-label="Proof of payment"
            className="hidden"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
          />
        </label>
      </Section>

      <Section title="Payment & service invoice" state={receiptState}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payment method" required>
            <select className={INPUT} value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Portal", "Bank transfer", "Cashier", "Credit card", "Business link", "Other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment status" required hint={status === "Verified" ? "Needs the service invoice no." : "Proof on file, invoice to follow"}>
            <select
              aria-label="Payment status"
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
          label="Service invoice no. (OR)"
          required={status === "Verified"}
          hint="From Pacific Cross’s service invoice"
          className="mt-4"
        >
          <input className={INPUT} value={or} onChange={(e) => setOr(e.target.value)} placeholder="OR-2026-XXXXX" />
        </Field>
      </Section>

      <Section title="Pacific Cross & notes">
        <button
          type="button"
          onClick={() => setSubmitted(!submitted)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
            submitted ? "border-brand bg-brand-soft" : "border-border-strong text-muted-foreground hover:bg-hover",
          )}
        >
          <span className={cn("grid size-[18px] place-items-center rounded-md border-[1.6px]", submitted ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
            {submitted && <I.check size={13} />}
          </span>
          Proof sent to Pacific Cross
        </button>
        <Field label="Internal notes" className="mt-4">
          <textarea
            className="min-h-[70px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth noting…"
          />
        </Field>
      </Section>
    </>
  );

  return { summary, fields, missing, canSave: !!canSave, pending, save, submitLabel };
}

/** Verify Payment drawer on the Payments page. */
export function VerifyPaymentDrawer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const form = useVerifyPaymentForm(payment, onClose);
  return (
    <Drawer
      icon="peso"
      title="Verify payment"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!form.canSave} onClick={form.save}>
            <I.check size={15} /> {form.submitLabel}
          </Btn>
        </>
      }
    >
      {form.summary}
      {form.fields}
    </Drawer>
  );
}
