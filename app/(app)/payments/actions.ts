"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivities, recordActivity } from "@/lib/activity/log";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import {
  getCommissionsRepository,
  getPaymentsRepository,
  type Commission,
  type Payment,
} from "@/lib/repositories/payments";
import { computeCommission } from "@/lib/commissions/compute";
import { requireCommissionAccess, requireCommissionActor } from "@/lib/commissions/access";
import { registerUploadedCommissionVoucher } from "@/lib/documents/uploaded-pdf";
import { getCommissionRatesRepository } from "@/lib/repositories/commission-rates";
import { getRenewalsRepository } from "@/lib/repositories/renewals";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { logOutboundEmails } from "@/lib/communications/log-outbound-email";

/**
 * Resolve the product a payment is for, via the source record's product
 * version: application / policy / renewal (through its policy) / travel request.
 * Returns null when the payment has no linked product (e.g. "Other").
 */
async function resolvePaymentProduct(
  payment: Payment,
): Promise<{ productId: string; productName: string } | null> {
  const db = getSupabaseAdmin();
  let versionId: string | null = null;
  if (payment.applicationId) {
    const { data } = await db.from("applications").select("product_version_id").eq("id", payment.applicationId).maybeSingle();
    versionId = data?.product_version_id ?? null;
  } else if (payment.travelRequestId) {
    const { data } = await db.from("travel_requests").select("product_version_id").eq("id", payment.travelRequestId).maybeSingle();
    versionId = data?.product_version_id ?? null;
  } else {
    let policyId = payment.policyId;
    if (!policyId && payment.renewalId) {
      const { data } = await db.from("renewals").select("policy_id").eq("id", payment.renewalId).maybeSingle();
      policyId = data?.policy_id ?? null;
    }
    if (policyId) {
      const { data } = await db.from("policies").select("product_version_id").eq("id", policyId).maybeSingle();
      versionId = data?.product_version_id ?? null;
    }
  }
  if (!versionId) return null;
  const { data: pv } = await db
    .from("product_versions")
    .select("product_id, products (name)")
    .eq("id", versionId)
    .maybeSingle<{ product_id: string; products: { name: string } | null }>();
  return pv ? { productId: pv.product_id, productName: pv.products?.name ?? "this product" } : null;
}

const money = (n: number, currency: string | null) =>
  `${!currency || currency === "PHP" ? "₱" : currency === "USD" ? "US$" : `${currency} `}${n.toLocaleString("en-PH")}`;

export interface VerifyPaymentInput {
  paymentId: string;
  paymentMethod: string;
  amount?: number | null;
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
    const amount = input.amount ?? payment.amount;
    if (amount == null || !Number.isFinite(amount) || amount <= 0)
      return { ok: false, error: "Enter the premium amount before recording payment." };
    // Proof of payment is required before a payment can be Received/Verified
    // (payments-page.md) — either just attached or already on file.
    if (!input.proofDocumentId && !payment.proofDocumentId)
      return { ok: false, error: "Attach the proof of payment (screenshot or bank slip) first." };

    const today = new Date().toISOString().slice(0, 10);
    const updated = await repo.update(input.paymentId, {
      status: input.status,
      amount,
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
      await log("payment.received", `Proof of payment received — ${payment.referenceNo ?? ""} ${updated.amount != null ? money(updated.amount, updated.currency) : ""}`.trim());
    }

    if (input.status === "Verified" && input.orNumber) {
      const or = input.orNumber.trim();
      await log("payment.verified", `Payment verified — ${payment.sourceRef ?? payment.referenceNo ?? ""} · ${updated.amount != null ? money(updated.amount, updated.currency) : ""} · ${input.paymentMethod}`.trim());
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
      // Rate comes from the effective-dated commission_rates table (H9a); the estimate is the
      // NET commission from computeCommission (H9b: less 12% VAT, × rate, less 10% WHT). The
      // ×0.88 VAT basis is an unconfirmed assumption (DH16) — see lib/commissions/compute.ts.
      const product = await resolvePaymentProduct(payment);
      const rate = product
        ? await getCommissionRatesRepository().findEffective(
            product.productId,
            payment.source === "Renewal" ? "Renewal" : "New",
            payment.paymentDate ?? today,
          )
        : null;
      const est =
        rate?.ratePct != null && updated.amount != null
          ? computeCommission(updated.amount, rate.ratePct).net
          : null;
      const pendingNote =
        rate?.ratePct == null
          ? `Commission rate pending for ${product?.productName ?? "unknown product"} — set it in Settings → Commission Rates.`
          : null;
      await getCommissionsRepository().create({
        clientId: payment.clientId,
        policyId,
        paymentId: payment.id,
        orNumber: or,
        status: "Voucher Pending",
        estimatedAmount: est,
        ratePct: rate?.ratePct ?? null,
        commissionRateId: rate?.id ?? null,
        currency: updated.currency,
        followUpDate: today,
      });
      await getTasksRepository().create({
        title: `Request commission voucher — ${payment.clientName ?? "client"} (OR ${or})`,
        ...(pendingNote ? { notes: pendingNote } : {}),
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
  // Filter in SQL: the repository caps list() at 200 rows, so filtering the
  // capped page in JS would silently under-report once payments outgrow it.
  return getPaymentsRepository().list({ statusIn: ["Awaiting", "Overdue"] });
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
    // Batched: one read + one communications insert + one activity insert,
    // instead of 3 round-trips per payment. The communications insert is a
    // single statement, so a failure logs nothing rather than a partial batch.
    const payments = (await getPaymentsRepository().findByIds(input.paymentIds)).filter(
      (p): p is typeof p & { clientId: string } => !!p.clientId,
    );
    await logOutboundEmails(
      payments.map((p) => ({
        clientId: p.clientId,
        subject: input.subjectBySource[p.source] ?? `Payment instruction — ${p.sourceRef ?? ""}`.trim(),
        summary: `${money(p.amount ?? 0, p.currency)} · ${input.payChannel} · via ${input.via.join(", ")}`,
        notes: input.bodyBySource[p.source] ?? null,
        actorId: actor.id,
      })),
    );
    await recordActivities(
      payments.map((p) => ({
        scopeType: "client" as const,
        scopeId: p.clientId,
        activityType: "payment.instruction_logged",
        summary: `Payment instruction logged — ${p.sourceRef ?? p.referenceNo ?? ""} · ${money(p.amount ?? 0, p.currency)}`,
        actorId: actor.id,
      })),
    );
    const logged = payments.length;
    revalidatePath("/payments");
    revalidatePath("/dashboard");
    revalidatePath("/renewals");
    return { ok: true, data: logged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to log payment links." };
  }
}

export type CommissionStep = "requested" | "follow-up" | "paid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOUCHER_PDF_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export interface FileCommissionVoucherActionInput {
  commissionId: string;
  path: string;
  fileName: string;
  voucherReference: string | null;
  expectedDocumentId: string | null;
}

export async function fileCommissionVoucherAction(
  input: FileCommissionVoucherActionInput,
): Promise<ActionResult<Commission>> {
  try {
    await requireCommissionActor();
    if (!input || typeof input !== "object" || Array.isArray(input))
      return { ok: false, error: "Invalid voucher filing input." };
    if (typeof input.commissionId !== "string" || !UUID_PATTERN.test(input.commissionId))
      return { ok: false, error: "Commission not found." };
    const { actor, commission } = await requireCommissionAccess(input.commissionId, "canFileVoucher");
    if (!commission.clientId)
      return { ok: false, error: "This commission has no client; voucher cannot be filed." };
    if (input.expectedDocumentId !== null
      && (typeof input.expectedDocumentId !== "string" || !UUID_PATTERN.test(input.expectedDocumentId)))
      return { ok: false, error: "Invalid current voucher ID." };
    if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 1024
      || /[/\\\u0000-\u001f\u007f-\u009f]/.test(input.fileName))
      return { ok: false, error: "Invalid voucher filename." };
    if (input.voucherReference !== null && typeof input.voucherReference !== "string")
      return { ok: false, error: "Invalid carrier voucher number." };
    const voucherReference = input.voucherReference?.trim() || null;
    if (voucherReference && voucherReference.length > 200)
      return { ok: false, error: "Carrier voucher number must be 200 characters or fewer." };
    const prefix = `${commission.clientId}/`;
    if (typeof input.path !== "string" || !input.path.startsWith(prefix)
      || !VOUCHER_PDF_NAME_PATTERN.test(input.path.slice(prefix.length)))
      return { ok: false, error: "Invalid upload path." };

    const updated = await registerUploadedCommissionVoucher({
      actorId: actor.id,
      commissionId: commission.id,
      clientId: commission.clientId,
      storagePath: input.path,
      fileName: input.fileName,
      voucherReference,
      expectedDocumentId: input.expectedDocumentId,
    });
    revalidatePath("/payments");
    revalidatePath("/commissions");
    revalidatePath("/documents");
    revalidatePath(`/clients/${commission.clientId}`);
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to file commission voucher." };
  }
}

export async function assignCommissionContactAction(id: string, contactId: string | null): Promise<ActionResult<Commission>> {
  try {
    const { actor } = await requireCommissionAccess(id, "canUpdateCommission");
    if (contactId !== null && (typeof contactId !== "string" || !UUID_PATTERN.test(contactId)))
      return { ok: false, error: "Choose an active, verified commission contact with an email address." };
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

/** Commission money and follow-up actions; voucher receipt requires filing its PDF. */
export async function updateCommissionAction(
  id: string,
  step: CommissionStep,
): Promise<ActionResult<Commission>> {
  try {
    const { actor } = await requireCommissionAccess(id, "canUpdateCommission");
    if (step !== "requested" && step !== "follow-up" && step !== "paid")
      return { ok: false, error: "Invalid commission step." };
    const updated = await getCommissionsRepository().transition(actor.id, id, step);

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
