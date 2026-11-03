export interface GmailConnection {
  id: "agency";
  mailboxEmail: string;
  googleSubject: string;
  oauthClientId: string;
  grantedScopes: string[];
  refreshTokenCiphertext: string;
  refreshTokenExpiresAt: string | null;
  status: "connected" | "reconnect_required";
  connectedBy: string;
  connectedAt: string;
  lastCheckedAt: string;
  lastAuthErrorCode: string | null;
  revision: number;
  updatedAt: string;
}

/** Never load the encrypted refresh token when reading connection status. */
export type GmailConnectionSummary = Omit<GmailConnection, "refreshTokenCiphertext">;

export type NewGmailConnection = Omit<GmailConnection, "id" | "revision" | "updatedAt">;

/** Server-only, short-lived OAuth correlation and encrypted PKCE material. */
export interface GmailAttempt {
  stateHash: string;
  actorId: string;
  browserBindingHash: string;
  verifierCiphertext: string;
  nonceHash: string;
  redirectUri: string;
  oauthClientId: string;
  baselineRevision: number;
  expiresAt: string;
}
