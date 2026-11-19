import { describe, expect, it } from "vitest";

import {
  RENEWED_EXPIRY_ERROR,
  RENEWED_STATUS_ERROR,
  canMarkLapsed,
  currentRenewalPerPolicy,
  isRetainedRenewal,
  manilaTodayIso,
  oneYearAfter,
  renewedExpiryProblem,
  suggestedRenewedExpiry,
} from "./lifecycle";

const TODAY = "2026-11-20";
const paid = { status: "Paid", renewalDueDate: "2026-11-01", policyExpiryDate: "2026-11-01" };

describe("isRetainedRenewal", () => {
  it.each(["Paid", "Renewed"])("counts %s as retained", (status) => {
    expect(isRetainedRenewal(status)).toBe(true);
  });

  it.each(["Upcoming", "Notice Received", "Reminder Sent", "Awaiting Payment", "Grace Period", "Reinstatement Required", "Lapsed", ""])(
    "does not count %j as retained",
    (status) => {
      expect(isRetainedRenewal(status)).toBe(false);
    },
  );
});

describe("manilaTodayIso", () => {
  it("uses the Manila calendar day, not UTC", () => {
    expect(manilaTodayIso(new Date("2026-11-19T16:30:00.000Z"))).toBe("2026-11-20");
    expect(manilaTodayIso(new Date("2026-11-19T15:59:59.000Z"))).toBe("2026-11-19");
  });
});

describe("currentRenewalPerPolicy", () => {
  const cycle = (id: string, policyId: string, status: string, renewalDueDate: string | null, extra: { renewalCompletedDate?: string | null; createdAt?: string } = {}) => ({
    id, policyId, status, renewalDueDate, renewalCompletedDate: extra.renewalCompletedDate ?? null, createdAt: extra.createdAt ?? "2026-01-01T00:00:00Z",
  });

  it("shows a renewed policy once, as its open next cycle carrying the completion date", () => {
    const rows = currentRenewalPerPolicy([
      cycle("old", "p1", "Renewed", "2029-10-10", { renewalCompletedDate: "2026-11-20" }),
      cycle("next", "p1", "Upcoming", "2030-10-10"),
    ]);
    expect(rows).toEqual([expect.objectContaining({ id: "next", lastRenewedDate: "2026-11-20" })]);
  });

  it("prefers the open cycle even when a closed cycle has a later due date", () => {
    const rows = currentRenewalPerPolicy([cycle("open", "p1", "Awaiting Payment", "2026-01-01"), cycle("closed", "p1", "Lapsed", "2027-01-01")]);
    expect(rows.map((r) => r.id)).toEqual(["open"]);
  });

  it("shows a Paid cycle awaiting completion when no cycle is open", () => {
    const rows = currentRenewalPerPolicy([
      cycle("prior", "p1", "Renewed", "2026-01-01", { renewalCompletedDate: "2025-12-15" }),
      cycle("paid", "p1", "Paid", "2027-01-01"),
    ]);
    expect(rows).toEqual([expect.objectContaining({ id: "paid", lastRenewedDate: "2025-12-15" })]);
  });

  it("falls back to the latest closed cycle and keeps the most recent earlier renewal date", () => {
    const rows = currentRenewalPerPolicy([
      cycle("first", "p1", "Renewed", "2027-01-01", { renewalCompletedDate: "2026-12-01" }),
      cycle("second", "p1", "Renewed", "2028-01-01", { renewalCompletedDate: "2027-12-01" }),
      cycle("third", "p1", "Lapsed", "2029-01-01"),
    ]);
    expect(rows).toEqual([expect.objectContaining({ id: "third", lastRenewedDate: "2027-12-01" })]);
  });

  it("breaks equal due dates by creation time and keeps policies separate", () => {
    const rows = currentRenewalPerPolicy([
      cycle("older", "p1", "Lapsed", null, { createdAt: "2026-01-01T00:00:00Z" }),
      cycle("newer", "p1", "Lapsed", null, { createdAt: "2026-02-01T00:00:00Z" }),
      cycle("solo", "p2", "Upcoming", "2026-12-01"),
    ]);
    expect(rows).toEqual([
      expect.objectContaining({ id: "newer", lastRenewedDate: null }),
      expect.objectContaining({ id: "solo", lastRenewedDate: null }),
    ]);
  });
});

describe("canMarkLapsed", () => {
  it("allows an unpaid renewal due yesterday", () => {
    expect(canMarkLapsed({ status: "Awaiting Payment", renewalDueDate: "2026-11-19" }, TODAY)).toBe(true);
    expect(canMarkLapsed({ status: "Upcoming", renewalDueDate: "2026-01-01" }, TODAY)).toBe(true);
  });

  it("does not allow due today, future or missing due dates", () => {
    expect(canMarkLapsed({ status: "Upcoming", renewalDueDate: TODAY }, TODAY)).toBe(false);
    expect(canMarkLapsed({ status: "Upcoming", renewalDueDate: "2026-11-21" }, TODAY)).toBe(false);
    expect(canMarkLapsed({ status: "Upcoming", renewalDueDate: null }, TODAY)).toBe(false);
  });

  it.each(["Paid", "Renewed", "Lapsed"])("does not allow an overdue %s renewal", (status) => {
    expect(canMarkLapsed({ status, renewalDueDate: "2026-01-01" }, TODAY)).toBe(false);
  });
});

describe("oneYearAfter", () => {
  it.each([
    ["2029-10-10", "2030-10-10"],
    ["2026-12-31", "2027-12-31"],
    ["2028-02-29", "2029-02-28"],
    ["2027-02-28", "2028-02-28"],
  ])("moves %s to %s", (from, to) => {
    expect(oneYearAfter(from)).toBe(to);
  });
});

describe("suggestedRenewedExpiry", () => {
  it("prefills one year after the cycle expiry", () => {
    expect(suggestedRenewedExpiry({ status: "Paid", policyExpiryDate: "2029-10-10", renewalDueDate: "2029-10-10" }, TODAY)).toBe("2030-10-10");
  });

  it("uses the due date when no expiry is recorded", () => {
    expect(suggestedRenewedExpiry({ status: "Paid", policyExpiryDate: null, renewalDueDate: "2026-12-01" }, TODAY)).toBe("2027-12-01");
  });

  it("leaves the field empty when the suggestion would be rejected or there is no base date", () => {
    expect(suggestedRenewedExpiry({ status: "Paid", policyExpiryDate: "2025-01-01", renewalDueDate: "2025-01-01" }, TODAY)).toBe("");
    expect(suggestedRenewedExpiry({ status: "Paid", policyExpiryDate: "2026-01-01", renewalDueDate: "2027-06-01" }, TODAY)).toBe("");
    expect(suggestedRenewedExpiry({ status: "Paid", policyExpiryDate: null, renewalDueDate: null }, TODAY)).toBe("");
    expect(suggestedRenewedExpiry({ status: "Awaiting Payment", policyExpiryDate: "2029-10-10", renewalDueDate: "2029-10-10" }, TODAY)).toBe("");
  });
});

describe("renewedExpiryProblem", () => {
  it("accepts a future date after the cycle dates", () => {
    expect(renewedExpiryProblem(paid, "2027-11-01", TODAY)).toBeNull();
  });

  it("accepts a valid leap day", () => {
    expect(renewedExpiryProblem(paid, "2028-02-29", TODAY)).toBeNull();
  });

  it("accepts the day after today when cycle dates are older", () => {
    expect(renewedExpiryProblem(paid, "2026-11-21", TODAY)).toBeNull();
  });

  it("accepts a cycle with no recorded dates", () => {
    expect(renewedExpiryProblem({ status: "Paid", renewalDueDate: null, policyExpiryDate: null }, "2027-01-01", TODAY)).toBeNull();
  });

  it.each(["Upcoming", "Notice Received", "Awaiting Payment", "Renewed", "Lapsed"])("rejects a %s renewal", (status) => {
    expect(renewedExpiryProblem({ ...paid, status }, "2027-11-01", TODAY)).toBe(RENEWED_STATUS_ERROR);
  });

  it.each([
    "",
    " ",
    "2027-2-01",
    "01/02/2027",
    "2027-11-01T00:00:00Z",
    "2027-11-01 ",
    "2027-02-29",
    "2100-02-29",
    "2027-04-31",
    "2027-00-10",
    "2027-13-01",
    "2027-11-00",
    "2027-11-32",
    "0000-01-01",
    "12027-01-01",
    "+012027-01-01",
  ])("rejects malformed or impossible date %j", (date) => {
    expect(renewedExpiryProblem(paid, date, TODAY)).toBe(RENEWED_EXPIRY_ERROR);
  });

  it("rejects an earlier year-one date", () => {
    expect(renewedExpiryProblem(paid, "0001-01-01", TODAY)).toBe(RENEWED_EXPIRY_ERROR);
  });

  it("rejects dates equal to or before today", () => {
    expect(renewedExpiryProblem({ ...paid, renewalDueDate: "2020-01-01", policyExpiryDate: "2020-01-01" }, TODAY, TODAY)).toBe(RENEWED_EXPIRY_ERROR);
    expect(renewedExpiryProblem({ ...paid, renewalDueDate: "2020-01-01", policyExpiryDate: "2020-01-01" }, "2026-11-19", TODAY)).toBe(RENEWED_EXPIRY_ERROR);
  });

  it("rejects dates equal to or before the cycle due date and policy expiry", () => {
    const future = { status: "Paid", renewalDueDate: "2027-03-01", policyExpiryDate: "2027-06-01" };
    expect(renewedExpiryProblem(future, "2027-03-01", TODAY)).toBe(RENEWED_EXPIRY_ERROR);
    expect(renewedExpiryProblem(future, "2027-06-01", TODAY)).toBe(RENEWED_EXPIRY_ERROR);
    expect(renewedExpiryProblem(future, "2027-06-02", TODAY)).toBeNull();
  });

  it("accepts the last valid calendar day", () => {
    expect(renewedExpiryProblem(paid, "9999-12-31", TODAY)).toBeNull();
  });
});
