export type GmailConnectionState = "disconnected" | "connected" | "reconnect_required";

/** The only mailbox connection data allowed in Settings client props. */
export interface GmailConnectionStatus {
  status: GmailConnectionState | null;
  mailboxEmail: string | null;
  lastCheckedAt: string | null;
  canManage: boolean;
  setupProblem: string | null;
  loadProblem: string | null;
  readAuthorized: boolean;
  inbox: { enabled: boolean; lastSyncedAt: string | null; watchExpiresAt: string | null; lastError: string | null; pending: boolean } | null;
  inboxSetupProblem: string | null;
  inboxLoadProblem: string | null;
}

/** Callback results are allowlisted messages, never provider error descriptions. */
export const GMAIL_CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Gmail connected. Authorization verified. Enable incoming email separately; outgoing delivery remains disabled.",
  cancelled: "Google authorization was cancelled. Any existing connection was kept.",
  invalid_attempt: "This authorization attempt expired or was already used. Start Connect Gmail again.",
  forbidden: "Only an active CRM Admin can connect this mailbox.",
  identity_mismatch: "Authorize admin@pacificinsuranceph.com. Any existing connection was kept.",
  unverified_email: "Google did not verify the mailbox address. The connection was not changed.",
  workspace_mismatch: "Authorize the Pacific Insurance PH Google Workspace mailbox.",
  missing_scope: "Gmail send permission was not granted. Reconnect and approve sending permission.",
  refresh_token_missing: "Google did not provide offline authorization. Start Connect Gmail again and approve consent.",
  stale_connection: "Another connection update completed first. Check the current status before reconnecting.",
  setup_error: "Gmail setup needs administrator attention. Check the server-only configuration.",
  failed: "Gmail authorization could not be completed. Any existing connection was kept. Try again.",
};
