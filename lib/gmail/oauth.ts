import "server-only";

import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { GMAIL_SCOPES, type GmailConfig } from "./config";
import {
  canReuseRefreshToken,
  classifyGoogleError,
  GmailAuthorizationError,
  verifyAccessTokenInfo,
  verifyGoogleIdClaims,
  verifyMailboxClaims,
  type MailboxClaims,
} from "./policy";
import { decryptToken } from "./token-crypto";

interface GmailAuthorization {
  googleSubject: string;
  mailboxEmail: string;
  grantedScopes: string[];
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
}

function newClient(config: GmailConfig): OAuth2Client {
  return new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    transporterOptions: { timeout: 8_000, retry: false },
  });
}

function refreshExpiry(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("refresh_token_expires_in" in data)) return null;
  const seconds = data.refresh_token_expires_in;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    throw new GmailAuthorizationError("invalid_grant", true);
  }
  const expiry = Date.now() + seconds * 1000;
  if (!Number.isSafeInteger(expiry) || expiry > 8.64e15) throw new GmailAuthorizationError("invalid_grant", true);
  return new Date(expiry).toISOString();
}

export async function createGmailAuthorization(
  config: GmailConfig,
  state: string,
  nonce: string,
): Promise<{ url: string; verifier: string }> {
  try {
    if (!state || !nonce) throw new GmailAuthorizationError("invalid_identity", true);
    const client = newClient(config);
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    if (!codeChallenge) throw new GmailAuthorizationError("provider_error", false);
    const url = client.generateAuthUrl({
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: false,
      login_hint: config.senderEmail,
      scope: [...GMAIL_SCOPES],
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });
    return { url, verifier: codeVerifier };
  } catch (error) {
    throw classifyGoogleError(error);
  }
}

export async function exchangeGmailCode(
  config: GmailConfig,
  code: string,
  verifier: string,
  nonceHash: string,
): Promise<GmailAuthorization> {
  try {
    if (!code || !verifier) throw new GmailAuthorizationError("invalid_grant", true);
    const client = newClient(config);
    const { tokens, res } = await client.getToken({ code, codeVerifier: verifier, redirect_uri: config.redirectUri });
    if (!tokens.id_token || !tokens.access_token) throw new GmailAuthorizationError("invalid_identity", true);
    let identity: { googleSubject: string; mailboxEmail: string };
    try {
      // Verifies Google signatures, issuer, audience and lifetime; never decode an unverified JWT.
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
      const payload = ticket.getPayload();
      if (!payload) throw new GmailAuthorizationError("invalid_identity", true);
      identity = verifyGoogleIdClaims(payload, config.clientId, config.senderEmail, nonceHash);
    } catch (error) {
      const classified = classifyGoogleError(error);
      throw classified.code === "provider_error" ? new GmailAuthorizationError("invalid_identity", true) : classified;
    }
    const info = await client.getTokenInfo(tokens.access_token);
    const grantedScopes = verifyAccessTokenInfo(info, config.clientId, identity.googleSubject);
    return {
      ...identity,
      grantedScopes,
      refreshToken: tokens.refresh_token || null,
      refreshTokenExpiresAt: refreshExpiry(res?.data),
    };
  } catch (error) {
    throw classifyGoogleError(error);
  }
}

export async function checkGmailRefresh(
  config: GmailConfig,
  refreshToken: string,
): Promise<Omit<GmailAuthorization, "refreshToken"> & { refreshToken: string; accessToken: string }> {
  try {
    if (!refreshToken) throw new GmailAuthorizationError("refresh_token_missing", true);
    // A fresh client with only the refresh credential forces a real token endpoint exchange.
    const client = newClient(config);
    let rotatedRefreshToken: string | null = null;
    // The SDK's refreshAccessToken method replaces credentials.refresh_token with the input.
    // Capture any provider rotation before that replacement, without retaining the raw payload.
    client.on("tokens", (tokens) => {
      if (tokens.refresh_token) rotatedRefreshToken = tokens.refresh_token;
    });
    client.setCredentials({ refresh_token: refreshToken });
    const { credentials, res } = await client.refreshAccessToken();
    if (!credentials.access_token) throw new GmailAuthorizationError("invalid_token", true);
    const info = await client.getTokenInfo(credentials.access_token);
    const grantedScopes = verifyAccessTokenInfo(info, config.clientId);
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${credentials.access_token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw classifyGoogleError({ response: { status: response.status } });
    const userinfo: unknown = await response.json();
    if (typeof userinfo !== "object" || userinfo === null || Array.isArray(userinfo)) {
      throw new GmailAuthorizationError("invalid_identity", true);
    }
    const identity = verifyMailboxClaims(userinfo as MailboxClaims, config.senderEmail);
    verifyAccessTokenInfo(info, config.clientId, identity.googleSubject);
    return {
      ...identity,
      grantedScopes,
      accessToken: credentials.access_token,
      refreshToken: rotatedRefreshToken || refreshToken,
      refreshTokenExpiresAt: refreshExpiry(res?.data),
    };
  } catch (error) {
    throw classifyGoogleError(error);
  }
}

/** Selection is not an authorization check: callers must prove offline refresh before saving. */
export function selectRefreshToken(
  newToken: string | null | undefined,
  existing: { googleSubject: string; oauthClientId: string; mailboxEmail: string; refreshTokenCiphertext: string } | null,
  identity: { googleSubject: string; mailboxEmail: string },
  config: GmailConfig,
): string {
  if (newToken) return newToken;
  if (!existing || !canReuseRefreshToken(existing, identity, config)) {
    throw new GmailAuthorizationError("refresh_token_missing", true);
  }
  return decryptToken(
    existing.refreshTokenCiphertext,
    config.encryptionKey,
    `gmail:refresh:${config.clientId}:${identity.googleSubject}`,
  );
}
