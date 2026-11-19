import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Renewal, RenewalUpdate } from "@/lib/repositories/renewals";

const mocks = vi.hoisted(() => {
  class RecordAccessError extends Error {
    constructor() {
      super("Record not found.");
    }
  }
  return {
    RecordAccessError,
    getActor: vi.fn(),
    assertRecordAccess: vi.fn(),
    recordActivity: vi.fn(),
    recordAudit: vi.fn(),
    revalidatePath: vi.fn(),
    repo: {
      findById: vi.fn(),
      update: vi.fn(),
      transition: vi.fn(),
      completeRenewal: vi.fn(),
      lapseRenewal: vi.fn(),
      synchronizeFromPolicies: vi.fn(),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/actions/context", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/activity/log", () => ({ recordActivity: mocks.recordActivity }));
vi.mock("@/lib/audit/log", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/auth/agent-scope", () => ({
  assertRecordAccess: mocks.assertRecordAccess,
  RecordAccessError: mocks.RecordAccessError,
}));
vi.mock("@/lib/repositories/renewals", () => ({ getRenewalsRepository: () => mocks.repo }));

import {
  markRenewalLapsedAction,
  markRenewalNoticeReceivedAction,
  markRenewalNoticeSentAction,
  markRenewalRenewedAction,
} from "./actions";

const RENEWAL_ID = "11111111-2222-4333-8444-555555555555";
const POLICY_ID = "66666666-7777-4888-9999-aaaaaaaaaaaa";
const CLIENT_ID = "client-1";
const ACTOR = { id: "actor-1", fullName: "Staff", role: "Assistant" };
const REVISION = "2026-11-19T02:00:00.000000+00:00";
const CHANGED = "This renewal changed. Reload and try again.";

function renewal(overrides: Partial<Renewal> = {}): Renewal {
  return {
    id: RENEWAL_ID, referenceNo: "REN-1", policyId: POLICY_ID, clientId: CLIENT_ID, clientName: "Ana Cruz",
    policyRef: "POL-1", policyNumber: "PN-1", premiumAmount: 1000, currency: "PHP", renewalNoticeDate: null,
    noticeReceivedDate: null, policyExpiryDate: "2026-11-01", renewalDueDate: "2026-11-01", renewalCompletedDate: null, status: "Upcoming",
    earlyPaymentFlag: false, notes: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: REVISION, ...overrides,
  };
}

/**
 * In-memory stand-in for the renewals table: `stored` is the database row; `staleReads` are snapshots
 * returned by the next findById calls, modelling a request that read the row before another tab moved it.
 */
let stored: Renewal | null;
let staleReads: Renewal[];

function apply(row: Renewal, patch: RenewalUpdate): Renewal {
  return {
    ...row,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.noticeReceivedDate !== undefined ? { noticeReceivedDate: patch.noticeReceivedDate } : {}),
    updatedAt: "2026-11-20T00:00:00.000000+00:00",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stored = renewal();
  staleReads = [];
  mocks.getActor.mockResolvedValue(ACTOR);
  mocks.assertRecordAccess.mockResolvedValue(undefined);
  mocks.repo.findById.mockImplementation(async (id: string) => {
    if (id !== RENEWAL_ID) return null;
    return staleReads.shift() ?? stored;
  });
  mocks.repo.update.mockImplementation(async (_id: string, patch: RenewalUpdate) => {
    stored = apply(stored!, patch);
    return stored;
  });
  mocks.repo.transition.mockImplementation(async (_id: string, from: readonly string[], patch: RenewalUpdate) => {
    if (!stored || !from.includes(stored.status)) return null;
    stored = apply(stored, patch);
    return stored;
  });
});

describe("markRenewalNoticeReceivedAction", () => {
  it("advances an Upcoming cycle to Notice Received", async () => {
    const result = await markRenewalNoticeReceivedAction(RENEWAL_ID, "2026-10-01");

    expect(result).toMatchObject({ ok: true, data: { status: "Notice Received", noticeReceivedDate: "2026-10-01" } });
    expect(mocks.repo.transition).toHaveBeenCalledWith(RENEWAL_ID, ["Upcoming"], {
      noticeReceivedDate: "2026-10-01", status: "Notice Received",
    });
    expect(mocks.repo.update).not.toHaveBeenCalled();
  });

  it("records only the receipt date when the cycle closed after it was read", async () => {
    staleReads = [renewal()];
    stored = renewal({ status: "Paid" });

    const result = await markRenewalNoticeReceivedAction(RENEWAL_ID, "2026-10-01");

    expect(result).toMatchObject({ ok: true, data: { status: "Paid", noticeReceivedDate: "2026-10-01" } });
    expect(stored).toMatchObject({ status: "Paid", noticeReceivedDate: "2026-10-01" });
    expect(mocks.repo.update).toHaveBeenCalledWith(RENEWAL_ID, { noticeReceivedDate: "2026-10-01" });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      previousValue: { notice_received_date: null, status: "Paid" },
      newValue: { notice_received_date: "2026-10-01", status: "Paid" },
    }));
  });

  it("writes nothing when a closed cycle already carries the same receipt date", async () => {
    staleReads = [renewal()];
    stored = renewal({ status: "Renewed", noticeReceivedDate: "2026-10-01" });

    const result = await markRenewalNoticeReceivedAction(RENEWAL_ID, "2026-10-01");

    expect(result).toMatchObject({ ok: true, data: { status: "Renewed" } });
    expect(mocks.repo.update).not.toHaveBeenCalled();
    expect(mocks.recordActivity).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("keeps correcting the receipt date on a closed cycle without a status write", async () => {
    stored = renewal({ status: "Lapsed", noticeReceivedDate: "2026-09-01" });

    const result = await markRenewalNoticeReceivedAction(RENEWAL_ID, "2026-09-15");

    expect(result).toMatchObject({ ok: true, data: { status: "Lapsed", noticeReceivedDate: "2026-09-15" } });
    expect(mocks.repo.transition).not.toHaveBeenCalled();
    expect(mocks.repo.update).toHaveBeenCalledWith(RENEWAL_ID, { noticeReceivedDate: "2026-09-15" });
  });
});

describe("markRenewalNoticeSentAction", () => {
  it("moves an Upcoming cycle to Reminder Sent and logs it", async () => {
    const result = await markRenewalNoticeSentAction(RENEWAL_ID);

    expect(result).toMatchObject({ ok: true, data: { status: "Reminder Sent" } });
    expect(mocks.repo.transition).toHaveBeenCalledWith(RENEWAL_ID, ["Upcoming", "Notice Received"], { status: "Reminder Sent" });
    expect(mocks.recordActivity).toHaveBeenCalledTimes(1);
  });

  it("refuses a stale tab without advancing or logging a closed cycle", async () => {
    staleReads = [renewal()];
    stored = renewal({ status: "Renewed" });

    const result = await markRenewalNoticeSentAction(RENEWAL_ID);

    expect(result).toEqual({ ok: false, error: CHANGED });
    expect(stored?.status).toBe("Renewed");
    expect(mocks.repo.update).not.toHaveBeenCalled();
    expect(mocks.recordActivity).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("markRenewalRenewedAction", () => {
  beforeEach(() => {
    stored = renewal({ status: "Paid" });
    mocks.repo.completeRenewal.mockImplementation(async () => renewal({ status: "Renewed" }));
  });

  it("completes through the repository with the authenticated actor and revalidates", async () => {
    const result = await markRenewalRenewedAction(RENEWAL_ID, REVISION, "2027-11-01");

    expect(result).toMatchObject({ ok: true, data: { status: "Renewed" } });
    expect(mocks.repo.completeRenewal).toHaveBeenCalledWith(RENEWAL_ID, ACTOR.id, REVISION, "2027-11-01");
    expect(mocks.assertRecordAccess).toHaveBeenCalledWith("renewal", RENEWAL_ID);
    expect(mocks.assertRecordAccess).toHaveBeenCalledWith("policy", POLICY_ID);
    // SQL writes the audit and timeline entries in its own transaction.
    expect(mocks.recordActivity).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
    for (const path of ["/renewals", "/policies", "/payments", "/dashboard", "/tasks", "/reports", `/clients/${CLIENT_ID}`]) {
      expect(mocks.revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("rejects an unauthenticated request before any lookup", async () => {
    mocks.getActor.mockRejectedValue(new Error("Not authenticated"));

    const result = await markRenewalRenewedAction(RENEWAL_ID, REVISION, "2027-11-01");

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
    expect(mocks.repo.findById).not.toHaveBeenCalled();
    expect(mocks.repo.completeRenewal).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing renewal", "99999999-2222-4333-8444-555555555555"],
    ["a malformed id", "not-a-uuid"],
  ])("returns Record not found for %s", async (_label, id) => {
    const result = await markRenewalRenewedAction(id, REVISION, "2027-11-01");

    expect(result).toEqual({ ok: false, error: "Record not found." });
    expect(mocks.repo.completeRenewal).not.toHaveBeenCalled();
  });

  it.each(["renewal", "policy"])("hides a renewal whose %s belongs to another agent", async (kind) => {
    mocks.assertRecordAccess.mockImplementation(async (k: string) => {
      if (k === kind) throw new mocks.RecordAccessError();
    });

    const result = await markRenewalRenewedAction(RENEWAL_ID, REVISION, "2027-11-01");

    expect(result).toEqual({ ok: false, error: "Record not found." });
    expect(mocks.repo.completeRenewal).not.toHaveBeenCalled();
  });

  it.each(["", "2027-02-29", "2027-13-01", "0000-01-01", "27-11-01", "20271-01-01"])(
    "rejects the malformed expiry %j before calling SQL",
    async (date) => {
      const result = await markRenewalRenewedAction(RENEWAL_ID, REVISION, date);

      expect(result).toEqual({ ok: false, error: "New expiry must be after the current renewal dates and today." });
      expect(mocks.repo.completeRenewal).not.toHaveBeenCalled();
    },
  );

  it("treats a missing revision as a changed renewal", async () => {
    const result = await markRenewalRenewedAction(RENEWAL_ID, "", "2027-11-01");

    expect(result).toEqual({ ok: false, error: CHANGED });
    expect(mocks.repo.completeRenewal).not.toHaveBeenCalled();
  });

  it.each([CHANGED, "Only a paid renewal can be marked renewed."])(
    "propagates the SQL error %j without logs or revalidation",
    async (message) => {
      mocks.repo.completeRenewal.mockRejectedValue(new Error(message));

      const result = await markRenewalRenewedAction(RENEWAL_ID, REVISION, "2027-11-01");

      expect(result).toEqual({ ok: false, error: message });
      expect(mocks.recordActivity).not.toHaveBeenCalled();
      expect(mocks.recordAudit).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("markRenewalLapsedAction", () => {
  beforeEach(() => {
    stored = renewal({ status: "Awaiting Payment" });
    mocks.repo.lapseRenewal.mockImplementation(async () => renewal({ status: "Lapsed" }));
  });

  it("lapses through the repository with the authenticated actor and revalidates", async () => {
    const result = await markRenewalLapsedAction(RENEWAL_ID, REVISION);

    expect(result).toMatchObject({ ok: true, data: { status: "Lapsed" } });
    expect(mocks.repo.lapseRenewal).toHaveBeenCalledWith(RENEWAL_ID, ACTOR.id, REVISION);
    expect(mocks.assertRecordAccess).toHaveBeenCalledWith("policy", POLICY_ID);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reports");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/clients/${CLIENT_ID}`);
  });

  it("rejects an unauthenticated request", async () => {
    mocks.getActor.mockRejectedValue(new Error("Not authenticated"));

    const result = await markRenewalLapsedAction(RENEWAL_ID, REVISION);

    expect(result).toEqual({ ok: false, error: "Not authenticated" });
    expect(mocks.repo.lapseRenewal).not.toHaveBeenCalled();
  });

  it("returns Record not found for a missing renewal", async () => {
    stored = null;

    const result = await markRenewalLapsedAction(RENEWAL_ID, REVISION);

    expect(result).toEqual({ ok: false, error: "Record not found." });
    expect(mocks.repo.lapseRenewal).not.toHaveBeenCalled();
  });

  it("hides another agent's renewal", async () => {
    mocks.assertRecordAccess.mockRejectedValue(new mocks.RecordAccessError());

    const result = await markRenewalLapsedAction(RENEWAL_ID, REVISION);

    expect(result).toEqual({ ok: false, error: "Record not found." });
    expect(mocks.repo.lapseRenewal).not.toHaveBeenCalled();
  });

  it.each([CHANGED, "Only an overdue renewal can be marked lapsed.", "A paid or renewed renewal cannot be lapsed."])(
    "propagates the SQL error %j without logs or revalidation",
    async (message) => {
      mocks.repo.lapseRenewal.mockRejectedValue(new Error(message));

      const result = await markRenewalLapsedAction(RENEWAL_ID, REVISION);

      expect(result).toEqual({ ok: false, error: message });
      expect(mocks.recordActivity).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );
});
