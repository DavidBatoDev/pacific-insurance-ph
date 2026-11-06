import { describe, expect, it } from "vitest";
import { commissionCapabilities, isCommissionVoucher } from "./voucher";

describe("commission original confidentiality", () => {
  const own = { clientId: "client", assignedUserId: "actor" };
  const foreign = { clientId: "client", assignedUserId: "other" };
  it.each([
    ["Owner", own, true, true], ["Admin", foreign, true, true],
    ["Assistant", own, true, true], ["Assistant", foreign, false, false],
    ["Viewer", own, true, false], ["Viewer", foreign, false, false],
  ])("uses persisted %s ownership for read and mutation", (role, commission, read, mutate) => {
    expect(commissionCapabilities({ id: "actor", role, status: "Active" }, commission)).toEqual({
      canReadVoucher: read, canFileVoucher: mutate, canUpdateCommission: mutate,
    });
  });
  it("denies inactive and missing actors even on owned clients", () => {
    for (const actor of [null, { id: "actor", role: "Owner", status: "Inactive" }]) {
      expect(commissionCapabilities(actor, own)).toEqual({ canReadVoucher: false, canFileVoucher: false, canUpdateCommission: false });
    }
  });
  it("fails closed for missing ownership and prevents clientless filing by admins", () => {
    expect(commissionCapabilities({ id: "actor", role: "Assistant", status: "Active" }, { clientId: "client", assignedUserId: null }).canReadVoucher).toBe(false);
    expect(commissionCapabilities({ id: "actor", role: "Owner", status: "Active" }, { clientId: null, assignedUserId: null })).toEqual({ canReadVoucher: true, canFileVoucher: false, canUpdateCommission: true });
  });
  it("treats either document marker as confidential, including orphaned type rows", () => {
    expect(isCommissionVoucher({ documentType: "Commission Voucher", commissionId: null })).toBe(true);
    expect(isCommissionVoucher({ documentType: "Other", commissionId: "commission" })).toBe(true);
    expect(isCommissionVoucher({ documentType: "Policy", commissionId: null })).toBe(false);
  });
});
