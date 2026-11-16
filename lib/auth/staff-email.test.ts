import { describe, expect, it } from "vitest";

import { normalizeStaffEmail } from "./staff-email";

describe("normalizeStaffEmail", () => {
  it("accepts the Workspace domain and normalizes case and whitespace", () => {
    expect(normalizeStaffEmail("  Faye.Kang@PacificInsurancePH.com ")).toBe("faye.kang@pacificinsuranceph.com");
  });

  it("rejects every other domain, including look-alikes and subdomains", () => {
    for (const email of [
      "someone@gmail.com",
      "matt@pacificinsurance.ph",
      "matt@pacificinsuranceph.com.evil.com",
      "matt@mail.pacificinsuranceph.com",
      "matt@pacificinsuranceph.co",
      "pacificinsuranceph.com",
      "",
    ]) expect(normalizeStaffEmail(email)).toBeNull();
  });

  it("rejects display names, lists and header-injection characters", () => {
    for (const email of [
      "Matt <matt@pacificinsuranceph.com>",
      "a@pacificinsuranceph.com, b@pacificinsuranceph.com",
      "matt@pacificinsuranceph.com\nBcc: x@evil.com",
      "a@b@pacificinsuranceph.com",
      ".matt@pacificinsuranceph.com",
    ]) expect(normalizeStaffEmail(email)).toBeNull();
  });
});
