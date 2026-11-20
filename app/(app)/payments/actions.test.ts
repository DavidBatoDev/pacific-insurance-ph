import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Payment } from "@/lib/repositories/payments";
import type { RenewalUpdate } from "@/lib/repositories/renewals";

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  assertRecordAccess: vi.fn(),
  recordActivity: vi.fn(),
  revalidatePath: vi.fn(),
  payments: { findById: vi.fn(), update: vi.fn() },
  commissions: { create: vi.fn() },
  rates: { findEffective: vi.fn() },
  tasks: { create: vi.fn() },
  applications: { update: vi.fn() },
  travel: { update: vi.fn() },
  renewals: { findById: vi.fn(), update: vi.fn(), transition: vi.fn() },
  policyUpdates: [] as { values: Record<string, unknown>; id: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/actions/context", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/activity/log", () => ({ recordActivity: mocks.recordActivity, recordActivities: vi.fn() }));
vi.mock("@/lib/auth/agent-scope", () => ({ assertRecordAccess: mocks.assertRecordAccess, getAgentScope: vi.fn() }));
vi.mock("@/lib/repositories/payments", () => ({
  getPaymentsRepository: () => mocks.payments,
  getCommissionsRepository: () => mocks.commissions,
}));
vi.mock("@/lib/repositories/applications", () => ({ getApplicationsRepository: () => mocks.applications }));
vi.mock("@/lib/repositories/commission-rates", () => ({ getCommissionRatesRepository: () => mocks.rates }));
vi.mock("@/lib/repositories/renewals", () => ({ getRenewalsRepository: () => mocks.renewals }));
vi.mock("@/lib/repositories/tasks", () => ({ getTasksRepository: () => mocks.tasks }));
vi.mock("@/lib/repositories/travel", () => ({ getTravelRepository: () => mocks.travel }));
vi.mock("@/lib/repositories/external-contacts", () => ({ getExternalContactsRepository: vi.fn() }));
vi.mock("@/lib/commissions/access", () => ({ requireCommissionAccess: vi.fn(), requireCommissionActor: vi.fn() }));
vi.mock("@/lib/documents/uploaded-pdf", () => ({ registerUploadedCommissionVoucher: vi.fn() }));
vi.mock("@/lib/communications/log-outbound-email", () => ({ logOutboundEmails: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  // Minimal query builder: product lookups resolve through renewal → policy → product version,
  // and the policy OR stamp is captured.
  getSupabaseAdmin: () => ({
    from(table: string) {
      let update: Record<string, unknown> | null = null;
      const rows: Record<string, unknown> = {
        renewals: { policy_id: "policy-1" },
        policies: { product_version_id: "pv-1" },
        product_versions: { product_id: "product-1", products: { name: "Blue Royale" } },
      };
      const builder = {
        select: () => builder,
        update: (values: Record<string, unknown>) => {
          update = values;
          return builder;
        },
        eq: (_column: string, id: unknown) => {
          if (update) mocks.policyUpdates.push({ values: update, id });
          return builder;
        },
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        then: (resolve: (value: { data: null; error: null }) => unknown) => resolve({ data: null, error: null }),
      };
      return builder;
    },
  }),
}));

import { verifyPaymentAction } from "./actions";

const POLICY_ID = "policy-1";
const RENEWAL_ID = "renewal-1";
const ACTOR = { id: "actor-1", fullName: "Staff", role: "Assistant" };
const TODAY = "2026-11-20";
const OPEN_STATUSES = ["Upcoming", "Notice Received", "Reminder Sent", "Awaiting Payment", "Grace Period", "Reinstatement Required"];

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-2", referenceNo: "PAY-2", clientId: "client-1", clientName: "Ana Cruz", policyId: null,
    applicationId: null, renewalId: RENEWAL_ID, travelRequestId: null, source: "Renewal", sourceRef: "REN-1",
    amount: 5000, currency: "PHP", installmentNumber: 2, installmentCount: 2, paymentMethod: null, paymentDate: null,
    status: "Awaiting", orNumber: null, orReceivedDate: null, sentToPacificCross: false, proofDocumentId: "doc-1",
    notes: null, createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z", ...overrides,
  };
}

/** The renewal row as the database holds it; transition models the conditional UPDATE. */
let renewalRow: { status: string; renewalPaymentDate: string | null };

const verify = () =>
  verifyPaymentAction({ paymentId: "payment-2", paymentMethod: "Bank transfer", status: "Verified", orNumber: " OR-77 " });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T03:00:00.000Z`));
  mocks.policyUpdates.length = 0;
  mocks.getActor.mockResolvedValue(ACTOR);
  mocks.assertRecordAccess.mockResolvedValue(undefined);
  mocks.payments.findById.mockResolvedValue(payment());
  mocks.payments.update.mockImplementation(async (_id: string, patch: Partial<Payment>) => ({ ...payment(), ...patch }));
  mocks.rates.findEffective.mockResolvedValue({ id: "rate-1", ratePct: 20 });
  mocks.commissions.create.mockResolvedValue({});
  mocks.tasks.create.mockResolvedValue({});
  mocks.renewals.findById.mockImplementation(async () => ({ id: RENEWAL_ID, policyId: POLICY_ID, status: renewalRow.status }));
  mocks.renewals.transition.mockImplementation(async (_id: string, from: readonly string[], patch: RenewalUpdate) => {
    if (!from.includes(renewalRow.status)) return null;
    renewalRow = { status: patch.status ?? renewalRow.status, renewalPaymentDate: patch.renewalPaymentDate ?? renewalRow.renewalPaymentDate };
    return { id: RENEWAL_ID, policyId: POLICY_ID, status: renewalRow.status };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verifyPaymentAction renewal advancement", () => {
  it("marks an open renewal Paid on the first verified installment", async () => {
    renewalRow = { status: "Awaiting Payment", renewalPaymentDate: null };

    const result = await verify();

    expect(result.ok).toBe(true);
    expect(mocks.renewals.transition).toHaveBeenCalledWith(RENEWAL_ID, OPEN_STATUSES, { status: "Paid", renewalPaymentDate: TODAY });
    expect(renewalRow).toEqual({ status: "Paid", renewalPaymentDate: TODAY });
    expect(mocks.renewals.update).not.toHaveBeenCalled();
    for (const path of ["/renewals", "/dashboard", "/reports"]) expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
  });

  it.each(["Paid", "Renewed", "Lapsed"])(
    "verifies a later installment without regressing a %s cycle and keeps the other payment effects",
    async (status) => {
      renewalRow = { status, renewalPaymentDate: "2026-06-15" };

      const result = await verify();

      expect(result).toMatchObject({ ok: true, data: { status: "Verified", orNumber: "OR-77", orReceivedDate: TODAY } });
      // The cycle keeps its closed status and first payment date.
      expect(renewalRow).toEqual({ status, renewalPaymentDate: "2026-06-15" });
      expect(mocks.renewals.update).not.toHaveBeenCalled();
      // Payment, OR stamp, commission and voucher task still happen.
      expect(mocks.payments.update).toHaveBeenCalledWith("payment-2", expect.objectContaining({ status: "Verified", paymentDate: TODAY }));
      expect(mocks.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "payment.verified" }));
      expect(mocks.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "payment.or_recorded" }));
      expect(mocks.policyUpdates).toEqual([{ values: { or_number: "OR-77" }, id: POLICY_ID }]);
      expect(mocks.commissions.create).toHaveBeenCalledWith(expect.objectContaining({
        paymentId: "payment-2", policyId: POLICY_ID, orNumber: "OR-77", status: "Voucher Pending", ratePct: 20,
      }));
      expect(mocks.tasks.create).toHaveBeenCalledWith(expect.objectContaining({ tag: "Commission", assignedUserId: ACTOR.id }));
    },
  );

  it("leaves the renewal alone when only proof is received", async () => {
    renewalRow = { status: "Awaiting Payment", renewalPaymentDate: null };

    const result = await verifyPaymentAction({ paymentId: "payment-2", paymentMethod: "Bank transfer", status: "Received" });

    expect(result.ok).toBe(true);
    expect(mocks.renewals.transition).not.toHaveBeenCalled();
    expect(renewalRow.status).toBe("Awaiting Payment");
  });
});
