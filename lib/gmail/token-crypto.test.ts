import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptToken, encryptToken } from "./token-crypto";
import { GmailAuthorizationError } from "./policy";

const key = Buffer.alloc(32, 1);
const plaintext = "synthetic-refresh-token";
const context = "gmail:refresh:test-client:google-subject";

describe("Gmail authenticated token envelope", () => {
  it("roundtrips plaintext with a fresh 12-byte IV and 16-byte tag", () => {
    const first = encryptToken(plaintext, key, context);
    const second = encryptToken(plaintext, key, context);
    const [version, iv, tag] = first.split(".");
    expect(version).toBe("v1");
    expect(Buffer.from(iv, "base64url").length).toBe(12);
    expect(Buffer.from(tag, "base64url").length).toBe(16);
    expect(first).not.toBe(second);
    expect(first).not.toContain(plaintext);
    expect(decryptToken(first, key, context)).toBe(plaintext);
    expect(decryptToken(second, key, context)).toBe(plaintext);
  });

  it.each([1, 2, 3])("authenticates envelope component %i against tampering", (index) => {
    const parts = encryptToken(plaintext, key, context).split(".");
    const bytes = Buffer.from(parts[index], "base64url");
    bytes[0] ^= 1;
    parts[index] = bytes.toString("base64url");
    expect(() => decryptToken(parts.join("."), key, context)).toThrow(GmailAuthorizationError);
  });

  it("rejects the wrong key without exposing crypto implementation details", () => {
    const envelope = encryptToken(plaintext, key, context);
    expect(() => decryptToken(envelope, Buffer.alloc(32, 2), context)).toThrow(GmailAuthorizationError);
    try {
      decryptToken(envelope, Buffer.alloc(32, 2), context);
    } catch (error) {
      expect(error).toMatchObject({ code: "token_encryption_error", permanent: false });
      expect(String(error)).not.toContain(plaintext);
      expect(String(error)).not.toContain(envelope);
    }
  });

  it.each([
    "gmail:refresh:other-client:google-subject",
    "gmail:refresh:test-client:other-subject",
    "gmail:pkce:state-hash",
    "",
  ])("binds the ciphertext to its exact purpose/client/subject: %s", (wrongContext) => {
    const envelope = encryptToken(plaintext, key, context);
    expect(() => decryptToken(envelope, key, wrongContext)).toThrow();
  });

  it.each(["", "v2.a.b.c", "v1.a.b.c", "v1.a.b.c.extra", "v1.!!!!.a.b", "v1..."])("rejects malformed or unsupported envelopes %s", (envelope) => {
    expect(() => decryptToken(envelope, key, context)).toThrow();
  });

  it("requires a real 256-bit key and a nonempty purpose on both paths", () => {
    expect(() => encryptToken(plaintext, Buffer.alloc(31), context)).toThrow();
    expect(() => decryptToken("v1.a.b.c", Buffer.alloc(33), context)).toThrow();
    expect(() => encryptToken(plaintext, key, "")).toThrow();
    expect(() => encryptToken("", key, context)).toThrow();
  });
});
