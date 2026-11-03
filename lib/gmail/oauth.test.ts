import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { GmailConfig } from "./config";
import { selectRefreshToken } from "./oauth";
import { encryptToken } from "./token-crypto";
import { GmailAuthorizationError } from "./policy";

const config: GmailConfig = {
  clientId: "test-client.apps.googleusercontent.com",
  clientSecret: "synthetic-secret",
  redirectUri: "https://app.example.test/api/integrations/gmail/callback",
  senderEmail: "admin@pacificinsuranceph.com",
  encryptionKey: Buffer.alloc(32, 1),
};
const identity = { googleSubject: "google-subject", mailboxEmail: config.senderEmail };

function existingConnection() {
  return {
    ...identity,
    oauthClientId: config.clientId,
    refreshTokenCiphertext: encryptToken("synthetic-old-refresh", config.encryptionKey, `gmail:refresh:${config.clientId}:${identity.googleSubject}`),
  };
}

describe("offline Gmail refresh credential selection (no provider calls)", () => {
  it("selects a newly issued refresh credential instead of opening an old one", () => {
    expect(selectRefreshToken("synthetic-new-refresh", { ...existingConnection(), refreshTokenCiphertext: "unreadable" }, identity, config)).toBe("synthetic-new-refresh");
  });

  it.each([null, undefined, ""])("preserves a matching old credential when rotation is omitted: %j", (newToken) => {
    expect(selectRefreshToken(newToken, existingConnection(), identity, config)).toBe("synthetic-old-refresh");
  });

  it("requires offline authorization for the first connection", () => {
    expect(() => selectRefreshToken(null, null, identity, config)).toThrow(GmailAuthorizationError);
  });

  it.each([
    { googleSubject: "other-subject" },
    { oauthClientId: "other-client" },
    { mailboxEmail: "other@pacificinsuranceph.com" },
  ])("never reuses a credential for a different identity/client %j", (patch) => {
    expect(() => selectRefreshToken(null, { ...existingConnection(), ...patch }, identity, config)).toThrow(GmailAuthorizationError);
  });

  it("keeps encryption failures separate from revoked Google authorization", () => {
    const existing = existingConnection();
    try {
      selectRefreshToken(null, existing, identity, { ...config, encryptionKey: Buffer.alloc(32, 2) });
      throw new Error("Expected wrong-key decryption to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "token_encryption_error", permanent: false });
      expect(String(error)).not.toContain("synthetic-old-refresh");
    }
  });
});
