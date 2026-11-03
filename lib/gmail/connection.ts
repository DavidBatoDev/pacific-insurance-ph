import "server-only";

import { createHash } from "node:crypto";

import { getCurrentUser } from "@/lib/auth/current-user";
import { toAppRole } from "@/lib/auth/permissions";
import { getGmailRepository } from "@/lib/repositories/gmail";
import { getInboxRepository } from "@/lib/repositories/inbox";
import { gmailInboxConfigurationProblem } from "./inbox-config";
import type { GmailConnectionStatus } from "./types";
import { getGmailConfig, gmailConfigurationProblem } from "./config";
import { decryptToken, encryptToken } from "./token-crypto";
import { checkGmailRefresh, exchangeGmailCode, selectRefreshToken } from "./oauth";
import { GMAIL_READ_SCOPE, GmailAuthorizationError, classifyGoogleError } from "./policy";

/** Always authorizes the actual CRM user, independent of the persona preview. */
export async function requireGmailAdmin() {
  const actor = await getCurrentUser();
  if (!actor || actor.status !== "Active" || toAppRole(actor.role) !== "admin") {
    throw new GmailAuthorizationError("forbidden", false);
  }
  return actor;
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus | null> {
  const actor = await getCurrentUser();
  if (!actor || actor.status !== "Active" || toAppRole(actor.role) === "agent") return null;
  const canManage = toAppRole(actor.role) === "admin";
  const setupProblem = canManage ? gmailConfigurationProblem() : null;
  const inboxSetupProblem = canManage ? gmailInboxConfigurationProblem() : null;
  try {
    const connection = await getGmailRepository().getSummary();
    let inbox: GmailConnectionStatus["inbox"] = null;
    let inboxLoadProblem: string | null = null;
    try {
      const state = await getInboxRepository().getSyncState();
      const watchProblem = state && (!state.watchExpiresAt || Date.parse(state.watchExpiresAt) <= Date.now()) ? "gmail_watch_expired" : null;
      inbox = { enabled: Boolean(state), lastSyncedAt: state?.lastSyncedAt ?? null, watchExpiresAt: state?.watchExpiresAt ?? null, lastError: state?.lastError ?? watchProblem, pending: state?.pending ?? false };
    } catch {
      inboxLoadProblem = "Incoming email status could not be loaded. Check database availability and the inbox migration.";
    }
    return {
      status: connection?.status ?? "disconnected",
      mailboxEmail: connection?.mailboxEmail ?? null,
      lastCheckedAt: connection?.lastCheckedAt ?? null,
      canManage, setupProblem, loadProblem: null,
      readAuthorized: connection?.grantedScopes.includes(GMAIL_READ_SCOPE) ?? false,
      inbox, inboxSetupProblem, inboxLoadProblem,
    };
  } catch {
    return {
      status: null, mailboxEmail: null, lastCheckedAt: null, canManage, setupProblem,
      loadProblem: "Mailbox status could not be loaded. Check database availability and the Gmail migration.",
      readAuthorized: false, inbox: null, inboxSetupProblem, inboxLoadProblem: null,
    };
  }
}

/** Claims the callback exactly once before any external token exchange. */
export async function completeGmailConnection(input: {
  actorId: string;
  state: string;
  browserBinding: string;
  code: string | null;
  denied: boolean;
}): Promise<string> {
  const config = getGmailConfig();
  const repo = getGmailRepository();
  const stateHash = createHash("sha256").update(input.state).digest("hex");
  const browserHash = createHash("sha256").update(input.browserBinding).digest("hex");
  const attempt = await repo.consumeAttempt(stateHash, input.actorId, browserHash);
  if (!attempt || attempt.oauthClientId !== config.clientId || attempt.redirectUri !== config.redirectUri) {
    return "invalid_attempt";
  }
  if (input.denied) return "cancelled";
  if (!input.code) return "invalid_attempt";

  const verifier = decryptToken(attempt.verifierCiphertext, config.encryptionKey, `gmail:pkce:${stateHash}`);
  const exchanged = await exchangeGmailCode(config, input.code, verifier, attempt.nonceHash);
  const existing = await repo.getCredentials();
  if ((existing?.revision ?? 0) !== attempt.baselineRevision) return "stale_connection";
  const refreshToken = selectRefreshToken(exchanged.refreshToken, existing, exchanged, config);
  const refreshed = await checkGmailRefresh(config, refreshToken);
  if (refreshed.googleSubject !== exchanged.googleSubject || refreshed.mailboxEmail !== exchanged.mailboxEmail) {
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  const now = new Date().toISOString();
  const saved = await repo.saveConnection({
    mailboxEmail: refreshed.mailboxEmail,
    googleSubject: refreshed.googleSubject,
    oauthClientId: config.clientId,
    grantedScopes: refreshed.grantedScopes,
    refreshTokenCiphertext: encryptToken(refreshed.refreshToken, config.encryptionKey, `gmail:refresh:${config.clientId}:${refreshed.googleSubject}`),
    refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt ?? exchanged.refreshTokenExpiresAt ?? (!exchanged.refreshToken ? existing?.refreshTokenExpiresAt ?? null : null),
    status: "connected",
    connectedBy: input.actorId,
    connectedAt: now,
    lastCheckedAt: now,
    lastAuthErrorCode: null,
  }, attempt.baselineRevision, input.actorId);
  return saved ? "connected" : "stale_connection";
}

/** Explicit health check; Settings rendering never refreshes or changes tokens. */
export async function checkGmailConnection(actorId: string): Promise<void> {
  const config = getGmailConfig();
  const repo = getGmailRepository();
  const connection = await repo.getCredentials();
  if (!connection) throw new GmailAuthorizationError("not_connected", false);
  if (connection.oauthClientId !== config.clientId || connection.mailboxEmail !== config.senderEmail) {
    await repo.recordCheck(connection.revision, actorId, "reconnect_required", "identity_mismatch");
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  // A key/configuration error is not evidence that Google revoked the grant.
  const token = decryptToken(connection.refreshTokenCiphertext, config.encryptionKey, `gmail:refresh:${config.clientId}:${connection.googleSubject}`);
  try {
    if (connection.refreshTokenExpiresAt && Date.parse(connection.refreshTokenExpiresAt) <= Date.now()) {
      throw new GmailAuthorizationError("invalid_grant", true);
    }
    const checked = await checkGmailRefresh(config, token);
    if (checked.googleSubject !== connection.googleSubject) {
      throw new GmailAuthorizationError("identity_mismatch", true);
    }
    if (checked.refreshToken !== token || checked.grantedScopes.length !== connection.grantedScopes.length || checked.grantedScopes.some((scope) => !connection.grantedScopes.includes(scope))) {
      const now = new Date().toISOString();
      const { id: _id, revision: _revision, updatedAt: _updatedAt, ...saved } = connection;
      const updated = await repo.saveConnection({
        ...saved,
        connectedBy: actorId,
        grantedScopes: checked.grantedScopes,
        refreshTokenCiphertext: encryptToken(checked.refreshToken, config.encryptionKey, `gmail:refresh:${config.clientId}:${connection.googleSubject}`),
        refreshTokenExpiresAt: checked.refreshTokenExpiresAt ?? connection.refreshTokenExpiresAt,
        status: "connected", lastCheckedAt: now, lastAuthErrorCode: null,
      }, connection.revision, actorId);
      if (!updated) throw new GmailAuthorizationError("stale_connection", false);
    } else {
      const updated = await repo.recordCheck(connection.revision, actorId, "connected", null);
      if (!updated) throw new GmailAuthorizationError("stale_connection", false);
    }
  } catch (error) {
    const safe = classifyGoogleError(error);
    if (safe.permanent) await repo.recordCheck(connection.revision, actorId, "reconnect_required", safe.code);
    throw safe;
  }
}
