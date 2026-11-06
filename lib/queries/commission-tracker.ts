import "server-only";

import { toAppRole } from "@/lib/auth/permissions";
import { commissionOwners, requireCommissionActor } from "@/lib/commissions/access";
import { commissionCapabilities } from "@/lib/commissions/voucher";
import { getExternalContactsRepository } from "@/lib/repositories/external-contacts";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import { getCommissionsRepository, type Commission } from "@/lib/repositories/payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface CommissionTrackerRow extends Commission {
  canReadVoucher: boolean;
  canFileVoucher: boolean;
  canUpdateCommission: boolean;
  productName: string | null;
  planName: string | null;
}

type Selection = {
  product_versions: { product: { name: string } | null } | null;
  plan_options: { plan_name: string } | null;
};
type PolicySelection = Selection & { id: string };
type PaymentSelection = {
  id: string;
  policy: Selection | null;
  application: Selection | null;
  renewal: { policy: Selection | null } | null;
  travel: Selection | null;
};

const SELECTION = "product_versions(product:products(name)),plan_options(plan_name)";

/** Resolve only linked source selections, never the rate snapshot or OR text. */
async function trackerSelections(commissions: Commission[]) {
  const db = getSupabaseAdmin();
  const policyIds = [...new Set(commissions.map((commission) => commission.policyId).filter((id): id is string => !!id))];
  const paymentIds = [...new Set(commissions.filter((commission) => !commission.policyId).map((commission) => commission.paymentId).filter((id): id is string => !!id))];
  const [policies, payments] = await Promise.all([
    policyIds.length
      ? db.from("policies").select(`id,${SELECTION}`).in("id", policyIds).returns<PolicySelection[]>()
      : { data: [], error: null },
    paymentIds.length
      ? db.from("payments").select(`id,policy:policies(${SELECTION}),application:applications(${SELECTION}),renewal:renewals(policy:policies(${SELECTION})),travel:travel_requests(${SELECTION})`)
        .in("id", paymentIds).returns<PaymentSelection[]>()
      : { data: [], error: null },
  ]);
  if (policies.error) throw policies.error;
  if (payments.error) throw payments.error;
  return {
    policies: new Map((policies.data ?? []).map((policy) => [policy.id, policy])),
    payments: new Map((payments.data ?? []).map((payment) => [payment.id, payment])),
  };
}

/** Shared, real-user-authorized payload for both commission tracker entry points. */
export async function loadCommissionTracker(): Promise<{
  commissions: CommissionTrackerRow[];
  commissionContacts: ExternalContact[];
}> {
  const actor = await requireCommissionActor();
  const [commissions, commissionContacts] = await Promise.all([
    getCommissionsRepository().list(),
    getExternalContactsRepository().list({ status: "Active", contactTypes: ["Commission Contact"] }),
  ]);
  const owners = await commissionOwners(commissions.map((commission) => commission.clientId));
  const role = toAppRole(actor.role);
  const scoped = commissions.flatMap((commission) => {
    const assignedUserId = commission.clientId ? owners.get(commission.clientId) ?? null : null;
    const capabilities = commissionCapabilities(actor, { clientId: commission.clientId, assignedUserId });
    if (role === "agent" && !capabilities.canReadVoucher) return [];
    return [{ ...commission, assignedUserId, ...capabilities }];
  });
  const selections = await trackerSelections(scoped.filter((commission) => commission.canReadVoucher));

  return {
    commissionContacts,
    commissions: scoped.map((commission): CommissionTrackerRow => {
      if (!commission.canReadVoucher) {
        return {
          ...commission,
          voucherDocumentId: null,
          voucherReference: null,
          voucherReceivedAt: null,
          voucherFileName: null,
          receivedDate: null,
          amount: null,
          estimatedAmount: null,
          ratePct: null,
          commissionRateId: null,
          premiumAmount: null,
          premiumCurrency: null,
          rateProductName: null,
          rateBusinessType: null,
          rateEffectiveDate: null,
          currency: null,
          notes: null,
          productName: null,
          planName: null,
        };
      }
      const payment = commission.paymentId ? selections.payments.get(commission.paymentId) : null;
      // A linked policy is authoritative even when its historical selection is missing.
      const selection = commission.policyId
        ? selections.policies.get(commission.policyId)
        : payment?.policy ?? payment?.application ?? payment?.renewal?.policy ?? payment?.travel;
      return {
        ...commission,
        productName: selection?.product_versions?.product?.name ?? null,
        planName: selection?.plan_options?.plan_name ?? null,
      };
    }),
  };
}
