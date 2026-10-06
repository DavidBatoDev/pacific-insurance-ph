import { describe, expect, it } from "vitest";

import { buildDraftClientPatch, clientPreExistedDraft, type DraftClientFields } from "./draft-client-patch";

const existing = {
  firstName: "H7d",
  lastName: "Test",
  email: "h7d-test@test.local",
  mobileNumber: "0917 000 0000",
  dateOfBirth: "1990-01-01",
  address: "Makati",
  preferredChannel: "Gmail",
  leadSource: "Referral",
  assignedUserId: "user-1",
  notes: "Original notes",
  productInterest: "Select",
  estPremium: 50000,
  familySize: 2,
  coverageTier: null,
};

const form = (over: Partial<DraftClientFields> = {}): DraftClientFields => ({
  firstName: "",
  lastName: "",
  email: "",
  mobileNumber: "",
  dateOfBirth: "",
  address: "",
  preferredChannel: null,
  leadSource: "",
  assignedUserId: "",
  notes: "",
  productInterest: "",
  estPremium: null,
  familySize: null,
  coverageTier: "",
  ...over,
});

describe("buildDraftClientPatch — a client that existed before the draft", () => {
  it("never writes autofilled or typed identity (the Oct 6 'Matthew Nassr' overwrite)", () => {
    const patch = buildDraftClientPatch(
      existing,
      form({ firstName: "Matthew", lastName: "Nassr", email: "admin@pacificinsuranceph.com", mobileNumber: "0999", notes: "x", assignedUserId: "user-2", leadSource: "Website" }),
      { clientPreExisted: true },
    );
    expect(patch).toEqual({});
  });

  it("only fills blank discovery fields, never replaces set ones", () => {
    const patch = buildDraftClientPatch(
      existing,
      form({ productInterest: "TravelSafe", coverageTier: "Ward", familySize: 4 }),
      { clientPreExisted: true },
    );
    expect(patch).toEqual({ coverageTier: "Ward" });
  });
});

describe("buildDraftClientPatch — a client the wizard created for this draft", () => {
  it("carries identity edits to the lead being typed", () => {
    const patch = buildDraftClientPatch(existing, form({ firstName: "Hazel", email: "hazel@example.com" }), { clientPreExisted: false });
    expect(patch).toEqual({ firstName: "Hazel", email: "hazel@example.com" });
  });

  it("never clears a stored value from an empty form field", () => {
    expect(buildDraftClientPatch(existing, form(), { clientPreExisted: false })).toEqual({});
  });

  it("omits unchanged values and trims input", () => {
    const patch = buildDraftClientPatch(existing, form({ firstName: " H7d ", lastName: "Tester", productInterest: "Blue Royale" }), { clientPreExisted: false });
    expect(patch).toEqual({ lastName: "Tester", productInterest: "Blue Royale" });
  });
});

describe("clientPreExistedDraft", () => {
  it("is true when the client predates the draft by more than a minute", () => {
    expect(clientPreExistedDraft("2026-10-06T06:47:25Z", "2026-10-06T10:11:52Z")).toBe(true);
  });
  it("is false when the wizard created the client with the draft", () => {
    expect(clientPreExistedDraft("2026-10-06T10:11:52.100Z", "2026-10-06T10:11:52.500Z")).toBe(false);
  });
});
