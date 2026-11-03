import { describe, expect, it } from "vitest";
import {
  canReuseRefreshToken,
  classifyGoogleError,
  GmailAuthorizationError,
  requireSendScope,
  requireReadScope,
  sha256,
  validateGrantedScopes,
  verifyAccessTokenInfo,
  verifyGoogleIdClaims,
  verifyMailboxClaims,
} from "./policy";

const sender = "admin@pacificinsuranceph.com";
const clientId = "test-client.apps.googleusercontent.com";
const scopes = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/gmail.send"];
const mailbox = { sub: "google-subject", email: sender, email_verified: true, hd: "pacificinsuranceph.com", nonce: "test-nonce" };
const now = 1_800_000_000_000;
const idClaims = { ...mailbox, iss: "https://accounts.google.com", aud: clientId, exp: now / 1000 + 300 };
const tokenInfo = { aud: clientId, scopes, sub: mailbox.sub, expiry_date: now + 300_000 };

function expectFailure(action: () => unknown, code: string, permanent = true): void {
  expect(action).toThrow(GmailAuthorizationError);
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code, permanent });
  }
}

describe("verified Google mailbox policy", () => {
  it("accepts only the exact normalized agency mailbox", () => {
    expect(verifyMailboxClaims({ ...mailbox, email: " Admin@PacificInsurancePH.com " }, sender, sha256(mailbox.nonce))).toEqual({
      googleSubject: mailbox.sub, mailboxEmail: sender,
    });
  });

  it.each([
    { patch: { email: "someone@pacificinsuranceph.com" }, code: "identity_mismatch" },
    { patch: { email: "admin+alias@pacificinsuranceph.com" }, code: "identity_mismatch" },
    { patch: { email: "admin@pacificinsuranceph.com.attacker.test" }, code: "identity_mismatch" },
    { patch: { email_verified: false }, code: "unverified_email" },
    { patch: { email_verified: "true" }, code: "unverified_email" },
    { patch: { email_verified: undefined }, code: "unverified_email" },
    { patch: { hd: "other.test" }, code: "workspace_mismatch" },
    { patch: { hd: undefined }, code: "workspace_mismatch" },
    { patch: { sub: " " }, code: "invalid_identity" },
    { patch: { sub: undefined }, code: "invalid_identity" },
  ])("rejects invalid identity claims $code", ({ patch, code }) => {
    expectFailure(() => verifyMailboxClaims({ ...mailbox, ...patch } as typeof mailbox, sender), code);
  });

  it("does not let configuration replace the approved mailbox", () => {
    expectFailure(() => verifyMailboxClaims({ ...mailbox, email: "other@example.test" }, "other@example.test"), "identity_mismatch");
  });

  it.each(["", "wrong-nonce", undefined])("rejects a missing or mismatched nonce %j", (nonce) => {
    expectFailure(() => verifyMailboxClaims({ ...mailbox, nonce }, sender, sha256(mailbox.nonce)), "nonce_mismatch");
  });

  it("rejects malformed nonce hashes but allows nonce-free OIDC userinfo checks", () => {
    expectFailure(() => verifyMailboxClaims(mailbox, sender, "malformed"), "nonce_mismatch");
    expect(verifyMailboxClaims({ ...mailbox, nonce: undefined }, sender).googleSubject).toBe(mailbox.sub);
  });

  it.each([
    { iss: "https://attacker.test" },
    { aud: "another-client" },
    { aud: [clientId, "another-client"] },
    { azp: "another-client" },
    { exp: now / 1000 },
    { exp: undefined },
    { exp: Number.NaN },
  ])("rejects invalid signed ID-token metadata %j", (patch) => {
    expectFailure(() => verifyGoogleIdClaims({ ...idClaims, ...patch }, clientId, sender, sha256(mailbox.nonce), now), "invalid_identity");
  });

  it.each(["https://accounts.google.com", "accounts.google.com"])("accepts Google's issuer %s after signature verification", (iss) => {
    expect(verifyGoogleIdClaims({ ...idClaims, iss, azp: clientId }, clientId, sender, sha256(mailbox.nonce), now).mailboxEmail).toBe(sender);
  });
});

describe("actual token grants", () => {
  it("requires gmail.send, never treating requested scopes as granted", () => {
    expectFailure(() => requireSendScope(scopes.slice(0, 2)), "missing_scope");
  });

  it("canonicalizes the email alias and duplicate grants without mutating inputs", () => {
    const aliases = ["openid", "email", scopes[2], "email"];
    expect(validateGrantedScopes(aliases)).toEqual(scopes);
    expect(aliases).toEqual(["openid", "email", scopes[2], "email"]);
  });

  it.each([
    { partial: [scopes[2]] },
    { partial: ["openid", scopes[2]] },
    { partial: scopes.slice(0, 2) },
  ])("rejects partial authorization $partial", ({ partial }) => {
    expectFailure(() => validateGrantedScopes(partial), "missing_scope");
  });

  it.each(["https://www.googleapis.com/auth/gmail.modify", "https://mail.google.com/", "profile"])("rejects an unrequested broader grant %s", (extra) => {
    expectFailure(() => validateGrantedScopes([...scopes, extra]), "unexpected_scope");
  });

  it("accepts read capability without invalidating existing send-only authorization", () => {
    const readScope = "https://www.googleapis.com/auth/gmail.readonly";
    expect(validateGrantedScopes(scopes)).toEqual(scopes);
    expect(validateGrantedScopes([...scopes, readScope])).toEqual([...scopes, readScope]);
  });

  it("denies reads on send-only grants without classifying the connection as revoked", () => {
    expectFailure(() => requireReadScope(scopes), "read_permission_required", false);
    expect(requireReadScope([...scopes, "https://www.googleapis.com/auth/gmail.readonly"])).toBeUndefined();
  });

  it("requires the access token audience and subject to match the proved identity", () => {
    expect(verifyAccessTokenInfo(tokenInfo, clientId, mailbox.sub, now)).toEqual(scopes);
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, aud: "wrong" }, clientId, mailbox.sub, now), "identity_mismatch");
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, azp: "wrong" }, clientId, mailbox.sub, now), "identity_mismatch");
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, sub: "wrong" }, clientId, mailbox.sub, now), "identity_mismatch");
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, user_id: "wrong" }, clientId, mailbox.sub, now), "identity_mismatch");
  });

  it("never classifies normal access-token expiry as revoked offline authorization", () => {
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, expiry_date: now }, clientId, mailbox.sub, now), "provider_unavailable", false);
    expectFailure(() => verifyAccessTokenInfo({ ...tokenInfo, expiry_date: Number.NaN }, clientId, mailbox.sub, now), "provider_unavailable", false);
  });
});

describe("refresh-token reuse eligibility", () => {
  const identity = { googleSubject: mailbox.sub, mailboxEmail: sender };
  const existing = { ...identity, oauthClientId: clientId };
  const config = { clientId, senderEmail: sender };

  it("requires the same subject, OAuth client and exact normalized mailbox", () => {
    expect(canReuseRefreshToken(existing, identity, config)).toBe(true);
    expect(canReuseRefreshToken({ ...existing, mailboxEmail: sender.toUpperCase() }, identity, config)).toBe(true);
    expect(canReuseRefreshToken({ ...existing, googleSubject: "other" }, identity, config)).toBe(false);
    expect(canReuseRefreshToken({ ...existing, oauthClientId: "other" }, identity, config)).toBe(false);
    expect(canReuseRefreshToken({ ...existing, mailboxEmail: "other@pacificinsuranceph.com" }, identity, config)).toBe(false);
    expect(canReuseRefreshToken(existing, identity, { ...config, senderEmail: "other@pacificinsuranceph.com" })).toBe(false);
  });
});

describe("sanitized provider error classification", () => {
  it.each(["invalid_grant", "invalid_token"])("marks %s as permanent without exposing provider payloads", (code) => {
    const error = classifyGoogleError({ response: { status: 400, data: { error: code, error_description: "SECRET_TOKEN" } }, config: { client_secret: "SECRET_CLIENT" } });
    expect(error).toMatchObject({ code, permanent: true });
    expect(error.message).not.toContain("SECRET");
    expect(JSON.stringify(error)).not.toContain("SECRET");
    expect(error.cause).toBeUndefined();
  });

  it("recognizes exact OAuth error identifiers without copying error text", () => {
    expect(classifyGoogleError({ code: "invalid_grant" })).toMatchObject({ code: "invalid_grant", permanent: true });
    expect(classifyGoogleError(new Error("invalid_token"))).toMatchObject({ code: "invalid_token", permanent: true });
    expect(classifyGoogleError(new Error("invalid_grant SECRET"))).toMatchObject({ code: "provider_error", permanent: false });
  });

  it.each([429, 500, 502, 503])("keeps HTTP %i transient", (status) => {
    expect(classifyGoogleError({ response: { status } })).toMatchObject({ code: "provider_unavailable", permanent: false });
  });

  it.each(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT"])("keeps network failure %s transient", (code) => {
    expect(classifyGoogleError({ code })).toMatchObject({ code: "provider_unavailable", permanent: false });
  });

  it("distinguishes OAuth configuration from revocation", () => {
    expect(classifyGoogleError({ response: { status: 401, data: { error: "invalid_client" } } })).toMatchObject({ code: "invalid_client", permanent: false });
    expect(classifyGoogleError({ response: { status: 401 } })).toMatchObject({ code: "invalid_token", permanent: true });
  });

  it("does not call unknown failures revocation or leak arbitrary error messages", () => {
    const error = classifyGoogleError(new Error("client_secret=SECRET"));
    expect(error).toMatchObject({ code: "provider_error", permanent: false });
    expect(error.message).not.toContain("SECRET");
    const known = new GmailAuthorizationError("identity_mismatch", true);
    expect(classifyGoogleError(known)).toBe(known);
  });
});
