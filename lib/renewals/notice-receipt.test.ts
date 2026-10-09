import { describe, expect, it } from "vitest";

import { noticeReceiptPatch } from "./notice-receipt";

const upcoming = { noticeReceivedDate: null, status: "Upcoming" };

describe("noticeReceiptPatch", () => {
  it("records a valid calendar date and advances Upcoming to Notice Received", () => {
    expect(noticeReceiptPatch(upcoming, "2026-10-02")).toEqual({
      noticeReceivedDate: "2026-10-02", status: "Notice Received",
    });
  });

  it("accepts leap day in a leap year", () => {
    expect(noticeReceiptPatch(upcoming, "2028-02-29")).toEqual({
      noticeReceivedDate: "2028-02-29", status: "Notice Received",
    });
  });

  it.each(["", " ", "2026-2-01", "02/10/2026", "2026-10-02T00:00:00Z", "2026-10-02 ", "2026-02-29", "2026-02-30", "2026-04-31", "2026-00-10", "2026-13-01", "2026-10-00", "2026-10-32", "0000-01-01", "1900-02-29"])(
    "rejects malformed or impossible date %j", (date) => {
      expect(() => noticeReceiptPatch(upcoming, date)).toThrow("Notice received must be a valid date.");
    },
  );

  it.each(["Notice Received", "Reminder Sent", "Awaiting Payment", "Paid", "Renewed", "Grace Period", "Reinstatement Required", "Lapsed"])(
    "allows receipt correction without changing %s", (status) => {
      expect(noticeReceiptPatch({ status, noticeReceivedDate: "2026-10-01" }, "2026-10-02")).toEqual({
        noticeReceivedDate: "2026-10-02",
      });
    },
  );

  it("returns a no-op when receipt and status need no change", () => {
    expect(noticeReceiptPatch({ status: "Paid", noticeReceivedDate: "2026-10-02" }, "2026-10-02")).toBeNull();
  });

  it("still advances Upcoming when a matching date was already recorded", () => {
    expect(noticeReceiptPatch({ status: "Upcoming", noticeReceivedDate: "2026-10-02" }, "2026-10-02")).toEqual({
      noticeReceivedDate: "2026-10-02", status: "Notice Received",
    });
  });
});
