import { describe, expect, it } from "vitest";

import { normalizeStaffEmail } from "./staff-email";

describe("normalizeStaffEmail", () => {
  it("accepts both agency domains and normalizes case and whitespace", () => {
    expect(normalizeStaffEmail("  Faye.Kang@PacificInsurance.ph ")).toBe("faye.kang@pacificinsurance.ph");
    expect(normalizeStaffEmail("eman@pacificinsuranceph.com")).toBe("eman@pacificinsuranceph.com");
  });

  it("rejects every other domain, including look-alikes and subdomains", () => {
    for (const email of [
      "someone@gmail.com",
      "matt@pacificinsurance.ph.evil.com",
      "matt@mail.pacificinsurance.ph",
      "matt@pacificinsuranceph.co",
      "pacificinsurance.ph",
      "",
    ]) expect(normalizeStaffEmail(email)).toBeNull();
  });

  it("rejects display names, lists and header-injection characters", () => {
    for (const email of [
      "Matt <matt@pacificinsurance.ph>",
      "a@pacificinsurance.ph, b@pacificinsurance.ph",
      "matt@pacificinsurance.ph\nBcc: x@evil.com",
      "a@b@pacificinsurance.ph",
      ".matt@pacificinsurance.ph",
    ]) expect(normalizeStaffEmail(email)).toBeNull();
  });
});
