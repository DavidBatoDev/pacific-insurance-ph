import { describe, expect, it } from "vitest";
import { extractCrmReferences, suggestInboxTargets } from "./matching";
import type { InboxTarget } from "@/lib/repositories/inbox/inbox.entity";

const target = (id: string, clientId = "client-a", kind: InboxTarget["kind"] = "application"): InboxTarget => ({
  id, clientId, kind, label: `Application APP-2026-${id} · Ada Santos`, participants: ["ada@example.com"],
});
const message = {
  subject: "Re: APP-2026-00001", bodyText: "Attached for review.", fromAddress: "ada@example.com",
  toAddresses: ["admin@pacificinsuranceph.com"], ccAddresses: [], isAutoReply: false,
};

describe("incoming correspondence matching", () => {
  it("extracts bounded CRM references case-insensitively without matching names or partial identifiers", () => {
    expect(extractCrmReferences("Ada app-2026-00001 APP-2026-00001 xAPP-2026-00002 12345")).toEqual(["APP-2026-00001", "XAPP-2026-00002"]);
    expect(extractCrmReferences("APP-2026-000010000 and APP-26-00001")).toEqual([]);
  });
  it("keeps even a consistent exact reference and participant match as review-only", () => {
    const result = suggestInboxTargets(message, [target("00001")]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ consistent: true, requiresReview: true, warnings: [] });
  });
  it("does not promote a forged reference with an unexpected sender", () => {
    const [result] = suggestInboxTargets({ ...message, fromAddress: "stranger@example.com" }, [target("00001")]);
    expect(result.consistent).toBe(false);
    expect(result.warnings.join(" ")).toContain("not a recorded participant");
  });
  it("does not use a matching recipient as an expected sender", () => {
    const [result] = suggestInboxTargets({ ...message, fromAddress: "stranger@example.com", toAddresses: ["ada@example.com"] }, [target("00001")]);
    expect(result.consistent).toBe(false);
  });
  it("retains established thread evidence but warns on conflicting client references", () => {
    const a = target("00001"), b = target("00002", "client-b");
    const results = suggestInboxTargets({ ...message, subject: "Re: APP-2026-00002" }, [a, b], a);
    expect(results[0].target.id).toBe(a.id);
    expect(results[0].consistent).toBe(false);
    expect(results[0].warnings.join(" ")).toContain("another client");
  });
  it("warns about multiple references for different records of the same client", () => {
    const results = suggestInboxTargets({ ...message, bodyText: "APP-2026-00002" }, [target("00001"), target("00002")]);
    expect(results.every((result) => !result.consistent)).toBe(true);
    expect(results[0].warnings.join(" ")).toContain("another record");
  });
  it("does not trust address-only matches or auto replies as receipt", () => {
    const [result] = suggestInboxTargets({ ...message, subject: "Out of office", isAutoReply: true }, [target("00001")]);
    expect(result.consistent).toBe(false);
    expect(result.warnings).toHaveLength(2);
  });
  it("warns when a reference cannot be resolved to an authorized source record", () => {
    const [result] = suggestInboxTargets({ ...message, bodyText: "CLI-2026-99999" }, [target("00001")]);
    expect(result.warnings.join(" ")).toContain("outside the available target list");
  });
  it("matches the exact recorded policy number without interpreting punctuation as a pattern", () => {
    const policy: InboxTarget = { ...target("policy", "client-a", "policy"), label: "POL-2026-00001 · PC.123/45 · Ada Santos" };
    const [exact] = suggestInboxTargets({ ...message, subject: "Policy PC.123/45 renewal", fromAddress: "other@example.com" }, [policy]);
    expect(exact.reasons).toContain("Exact record reference in message");
    expect(exact.consistent).toBe(false);
    expect(suggestInboxTargets({ ...message, subject: "Policy XPC.123/45 or PCx123/45 or PC.123/456", fromAddress: "other@example.com" }, [policy])).toEqual([]);
  });
  it("does not treat a client name in a two-part label as a policy reference", () => {
    const policy: InboxTarget = { ...target("policy", "client-a", "policy"), label: "POL-2026-00001 · Ada Santos" };
    expect(suggestInboxTargets({ ...message, subject: "Ada Santos", fromAddress: "other@example.com" }, [policy])).toEqual([]);
  });
  it("never invents a match for an unrelated sender or duplicates a thread target", () => {
    expect(suggestInboxTargets({ ...message, subject: "Hello", fromAddress: "other@example.com" }, [target("00001")])).toEqual([]);
    expect(suggestInboxTargets(message, [target("00001")], target("00001"))).toHaveLength(1);
  });
});
