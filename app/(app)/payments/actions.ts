"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import {
  getCommissionsRepository,
  getPaymentsRepository,
  type Commission,
  type Payment,
} from "@/lib/repositories/payments";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";

/** First-year vs renewal vs travel commission estimate. */
const COMM_RATE: Record<string, number> = { Application: 0.18, Renewal: 0.1, Travel: 0.15 };

const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

export interface VerifyPaymentInput {
  paymentId: string;
  paymentMethod: string;
  /** Received (proof on file) or Verified (OR captured). */
  status: "Received" | "Verified";
  orNumber?: string | null;
  submittedToPacificCross?: boolean;
  /** documents.id of the uploaded proof (screenshot / bank slip). */
  proofDocumentId?: string | null;
  notes?: string | null;
}

/**
 * Verify Payment (payments-page.md Tab 1). On Verified-with-OR: logs Payment
 * verified + OR recorded, advances the source record, stamps the policy's
 * or_number, and auto-creates a commission row + a follow-up task.
 */
export async function verifyPaymentAction(input: VerifyPaymentInput): Promise<ActionResult<Payment>> {
  const actor = await getActor();
  if (input.status === "Verified" && !input.orNumber?.trim())
    return { ok: false, error: "An OR number is required to verify." };

  try {
    const repo = getPaymentsRepository();
    const payment = await repo.findById(input.paymentId);
    if (!payment) return { ok: false, error: "Payment not found." };
    // Proof of payment is required before a payment can be Received/Verified
    // (payments-page.md) — either just attached or already on file.
    if (!input.proofDocumentId && !payment.proofDocumentId)
      return { ok: false, error: "Attach the proof of payment (screenshot or bank slip) first." };

    const today = new Date().toISOString().slice(0, 10);
    const updated = await repo.update(input.paymentId, {
      status: input.status,
      paymentMethod: input.paymentMethod,
      paymentDate: payment.paymentDate ?? today,
      orNumber: input.orNumber?.trim() || undefined,
      orReceivedDate: input.status === "Verified" ? today : undefined,
      sentToPacificCross: input.submittedToPacificCross,
      proofDocumentId: input.proofDocumentId ?? undefined,
      notes: input.notes ?? undefined,
    });

    const log = (activityType: string, summary: string) =>
      payment.clientId
        ? recordActivity({ scopeType: "client", scopeId: payment.clientId, activityType, summary, actorId: actor.id })
        : Promise.resolve();

    if (input.status === "Received") {
      await log("payment.received", `Proof of payment received — ${payment.referenceNo ?? ""} ${payment.amount != null ? peso(payment.amount) : ""}`.trim());
    }

    if (input.status === "Verified" && input.orNumber) {
      const or = input.orNumber.trim();
      await log("payment.verified", `Payment verified — ${payment.sourceRef ?? payment.referenceNo ?? ""} · ${payment.amount != null ? peso(payment.amount) : ""} · ${input.paymentMethod}`.trim());
      await log("payment.or_recorded", `OR recorded — ${or} · commission tracking started`);

      // Advance the source record (design result table).
      if (payment.applicationId) {
        await getApplicationsRepository().update(payment.applicationId, { status: "Approved" });
      } else if (payment.renewalId) {
        await getRenewalsRepository().update(payment.renewalId, { status: "Paid", renewalPaymentDate: today });
      } else if (payment.travelRequestId) {
        await getTravelRepository().update(payment.travelRequestId, { status: "Policy Issued" });
      }

      // Stamp the OR onto the linked policy (directly via renewal, if any).
      let policyId = payment.policyId;
      if (!policyId && payment.renewalId) {
        policyId = (await getRenewalsRepository().findById(payment.renewalId))?.policyId ?? null;
      }
      if (policyId) {
        // or_number is payments-domain metadata on the policy row; the policies
        // port stays focused on lifecycle fields, so stamp it directly.
        await getSupabaseAdmin().from("policies").update({ or_number: or }).eq("id", policyId);
      }

      // Auto-create the commission row + a voucher follow-up task.
      const est = payment.amount != null ? Math.round(payment.amount * (COMM_RATE[payment.source] ?? 0.12)) : null;
      await getCommissionsRepository().create({
        clientId: payment.clientId,
        policyId,
        paymentId: payment.id,
        orNumber: or,
        status: "Voucher Pending",
        estimatedAmount: est,
        followUpDate: today,
      });
      await getTasksRepository().create({
        title: `Request commission voucher — ${payment.clientName ?? "client"} (OR ${or})`,
        tag: "Commission",
        clientId: payment.clientId,
        assignedUserId: actor.id,
        dueDate: today,
        priority: "Normal",
      });
    }

    revalidatePath("/payments");
    revalidatePath("/commissions");
    if (payment.clientId) revalidatePath(`/clients/${payment.clientId}`);
    revalidatePath("/tasks");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to verify payment." };
  }
}

/** Awaiting/Overdue payments for the Send Payment Links batch drawer. */
export async function listAwaitingPaymentsAction(): Promise<Payment[]> {
  const all = await getPaymentsRepository().list();
  return all.filter((p) => p.status === "Awaiting" || p.status === "Overdue");
}

/**
 * Payment Links batch (new-modals.md §12): logs a payment-instruction
 * entry to each contact's timeline. No delivery or source-status advancement occurs.
 */
export async function sendPaymentLinksAction(input: {
  paymentIds: string[];
  payChannel: string;
  via: string[];
  subjectBySource: Record<string, string>;
  bodyBySource: Record<string, string>;
}): Promise<ActionResult<number>> {
  const actor = await getActor();
  try {
    const repo = getPaymentsRepository();
    let logged = 0;
    for (const id of input.paymentIds) {
      const p = await repo.findById(id);
      if (!p?.clientId) continue;
      await logOutboundEmail({ clientId: p.clientId, subject: input.subjectBySource[p.source] ?? `Payment instruction — ${p.sourceRef ?? ""}`.trim(), summary: `${peso(p.amount ?? 0)} · ${input.payChannel} · via ${input.via.join(", ")}`, notes: input.bodyBySource[p.source] ?? null, actorId: actor.id });
      await recordActivity({
        scopeType: "client",
        scopeId: p.clientId,
        activityType: "payment.instruction_logged",
        summary: `Payment instruction logged — ${p.sourceRef ?? p.referenceNo ?? ""} · ${peso(p.amount ?? 0)}`,
        actorId: actor.id,
      });
      logged++;
    }
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    revalidatePath("/renewals");
    return { ok: true, data: logged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to log payment links." };
  }
}

export type CommissionStep = "requested" | "follow-up" | "received" | "paid";

export async function assignCommissionContactAction(id: string, contactId: string | null): Promise<ActionResult<Commission>> {
  try {
    const actor = await getActor();
    if (contactId) {
      const contact = await getExternalContactsRepository().findById(contactId);
      if (!contact || contact.status !== "Active" || contact.contactType !== "Commission Contact" || !contact.email)
        return { ok: false, error: "Choose an active, verified commission contact with an email address." };
    }
    const updated = await getCommissionsRepository().update(id, { pacificCrossContactId: contactId });
    if (updated.clientId) await recordActivity({ scopeType: "client", scopeId: updated.clientId, activityType: "commission.contact_assigned", summary: `Commission contact ${updated.pacificCrossContactName ? `assigned to ${updated.pacificCrossContactName}` : "cleared"}`, actorId: actor.id });
    revalidatePath("/payments"); revalidatePath("/commissions");
    return { ok: true, data: updated };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Failed to assign contact." }; }
}

/** Commission row actions (Request Voucher / Log Follow-up / Mark Received / Mark Paid). */
export async function updateCommissionAction(
  id: string,
  step: CommissionStep,
): Promise<ActionResult<Commission>> {
  const actor = await getActor();
  try {
    const repo = getCommissionsRepository();
    const commission = await repo.findById(id);
    if (!commission) return { ok: false, error: "Commission not found." };

    const today = new Date().toISOString().slice(0, 10);
    const patch =
      step === "requested"
        ? { status: "Voucher Pending", followUpDate: today }
        : step === "follow-up"
          ? { status: "Issue / Follow-Up Required", followUpDate: today }
          : step === "received"
            ? {
                status: "Received",
                receivedDate: today,
                amount: commission.amount ?? commission.estimatedAmount,
              }
            : { status: "Paid", paidDate: today };
    const updated = await repo.update(id, patch);

    if (commission.clientId) {
      const summaries: Record<CommissionStep, string> = {
        requested: `Commission voucher requested — OR ${commission.orNumber ?? "—"}`,
        "follow-up": `Commission follow-up logged — OR ${commission.orNumber ?? "—"}`,
        received: `Commission received — OR ${commission.orNumber ?? "—"} · voucher on file`,
        paid: `Commission paid — OR ${commission.orNumber ?? "—"} · ${updated.amount != null ? peso(updated.amount) : ""}`.trim(),
      };
      await recordActivity({
        scopeType: "client",
        scopeId: commission.clientId,
        activityType: `commission.${step}`,
        summary: summaries[step],
        actorId: actor.id,
      });
    }

    revalidatePath("/payments");
    revalidatePath("/commissions");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update commission." };
  }
}

/** Active Official Payment Channels for the Send Payment Links payee picker. */
export async function listPaymentChannelOptionsAction(): Promise<
  { id: string; label: string }[]
> {
  const { getPaymentChannelsRepository } = await import("@/lib/repositories/payment-channels");
  const channels = await getPaymentChannelsRepository().list();
  return channels
    .filter((c) => c.active)
    .map((c) => ({ id: c.id, label: `${c.label} — ${c.accountNumber}` }));
}
