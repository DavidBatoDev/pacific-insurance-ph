import "server-only";

import { getGmailRepository } from "@/lib/repositories/gmail";
import { getGmailConfig } from "./config";
import { checkGmailRefresh } from "./oauth";
import { classifyGoogleError, GmailAuthorizationError, requireReadScope } from "./policy";
import { decryptToken, encryptToken } from "./token-crypto";

export interface GmailReadAccess {
  accessToken: string;
  googleSubject: string;
  oauthClientId: string;
}

/** Access tokens stay in server memory for one operation; never serialized or persisted. */
export async function getGmailReadAccess(): Promise<GmailReadAccess> {
  const config = getGmailConfig();
  const repo = getGmailRepository();
  const connection = await repo.getCredentials();
  if (!connection) throw new GmailAuthorizationError("not_connected", false);
  if (connection.status !== "connected") throw new GmailAuthorizationError("invalid_grant", true);
  if (connection.oauthClientId !== config.clientId || connection.mailboxEmail !== config.senderEmail) {
    throw new GmailAuthorizationError("identity_mismatch", true);
  }
  requireReadScope(connection.grantedScopes);
  const token = decryptToken(connection.refreshTokenCiphertext, config.encryptionKey, `gmail:refresh:${config.clientId}:${connection.googleSubject}`);
  try {
    if (connection.refreshTokenExpiresAt && Date.parse(connection.refreshTokenExpiresAt) <= Date.now()) {
      throw new GmailAuthorizationError("invalid_grant", true);
    }
    const checked = await checkGmailRefresh(config, token);
    if (checked.googleSubject !== connection.googleSubject || checked.mailboxEmail !== connection.mailboxEmail) {
      throw new GmailAuthorizationError("identity_mismatch", true);
    }
    if (checked.refreshToken !== token || checked.grantedScopes.length !== connection.grantedScopes.length || checked.grantedScopes.some((scope) => !connection.grantedScopes.includes(scope))) {
      const { id: _id, revision: _revision, updatedAt: _updatedAt, ...saved } = connection;
      const updated = await repo.saveConnection({
        ...saved,
        grantedScopes: checked.grantedScopes,
        refreshTokenCiphertext: encryptToken(checked.refreshToken, config.encryptionKey, `gmail:refresh:${config.clientId}:${connection.googleSubject}`),
        refreshTokenExpiresAt: checked.refreshTokenExpiresAt ?? connection.refreshTokenExpiresAt,
        lastCheckedAt: new Date().toISOString(), lastAuthErrorCode: null,
      }, connection.revision, connection.connectedBy);
      if (!updated) throw new GmailAuthorizationError("stale_connection", false);
    }
    requireReadScope(checked.grantedScopes);
    return { accessToken: checked.accessToken, googleSubject: checked.googleSubject, oauthClientId: config.clientId };
  } catch (error) {
    const safe = classifyGoogleError(error);
    if (safe.permanent) {
      // Revocation affects sending as well. A missing read grant alone never reaches this branch.
      await repo.recordCheck(connection.revision, connection.connectedBy, "reconnect_required", safe.code);
    }
    throw safe;
  }
}
