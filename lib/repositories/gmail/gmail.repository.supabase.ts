import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { RepositoryError } from "../types";
import type {
  GmailAttempt,
  GmailConnection,
  GmailConnectionSummary,
  NewGmailConnection,
} from "./gmail-connection.entity";
import type { GmailRepository } from "./gmail.repository";

type ConnectionRow = Database["public"]["Tables"]["gmail_connections"]["Row"];
type SummaryRow = Omit<ConnectionRow, "refresh_token_ciphertext">;
type AttemptRow = Database["public"]["Tables"]["gmail_oauth_attempts"]["Row"];

// This select is deliberately explicit: Settings reads never fetch ciphertext.
const SUMMARY_SELECT = "id,mailbox_email,google_subject,oauth_client_id,granted_scopes,refresh_token_expires_at,status,connected_by,connected_at,last_checked_at,last_auth_error_code,revision,updated_at";
const CREDENTIALS_SELECT = `${SUMMARY_SELECT},refresh_token_ciphertext` as const;

function toSummary(row: SummaryRow): GmailConnectionSummary {
  return {
    id: "agency",
    mailboxEmail: row.mailbox_email,
    googleSubject: row.google_subject,
    oauthClientId: row.oauth_client_id,
    grantedScopes: row.granted_scopes,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    status: row.status as GmailConnection["status"],
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
    lastCheckedAt: row.last_checked_at,
    lastAuthErrorCode: row.last_auth_error_code,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

function toAttempt(row: AttemptRow): GmailAttempt {
  return {
    stateHash: row.state_hash,
    actorId: row.initiating_actor_id,
    browserBindingHash: row.browser_binding_hash,
    verifierCiphertext: row.verifier_ciphertext,
    nonceHash: row.nonce_hash,
    redirectUri: row.redirect_uri,
    oauthClientId: row.oauth_client_id,
    baselineRevision: row.baseline_revision,
    expiresAt: row.expires_at,
  };
}

function persistenceError(operation: string, code: string): RepositoryError {
  // Postgres errors can include failing-row details. Do not retain their payload
  // as a cause or include it in messages on this credential-bearing boundary.
  return new RepositoryError(`GmailRepository.${operation}: Gmail persistence failed.`, { code });
}

/** Service-role adapter; authorization and OAuth protocol live outside this port. */
export class SupabaseGmailRepository implements GmailRepository {
  async getSummary(): Promise<GmailConnectionSummary | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("gmail_connections")
      .select(SUMMARY_SELECT)
      .eq("id", "agency")
      .maybeSingle();
    if (error) throw persistenceError("getSummary", error.code);
    return data ? toSummary(data) : null;
  }

  async getCredentials(): Promise<GmailConnection | null> {
    const { data, error } = await getSupabaseAdmin()
      .from("gmail_connections")
      .select(CREDENTIALS_SELECT)
      .eq("id", "agency")
      .maybeSingle();
    if (error) throw persistenceError("getCredentials", error.code);
    return data ? { ...toSummary(data), refreshTokenCiphertext: data.refresh_token_ciphertext } : null;
  }

  async createAttempt(input: GmailAttempt): Promise<void> {
    const { error } = await getSupabaseAdmin().from("gmail_oauth_attempts").insert({
      state_hash: input.stateHash,
      initiating_actor_id: input.actorId,
      browser_binding_hash: input.browserBindingHash,
      verifier_ciphertext: input.verifierCiphertext,
      nonce_hash: input.nonceHash,
      redirect_uri: input.redirectUri,
      oauth_client_id: input.oauthClientId,
      baseline_revision: input.baselineRevision,
      expires_at: input.expiresAt,
    });
    if (error) throw persistenceError("createAttempt", error.code);
  }

  async consumeAttempt(
    stateHash: string,
    actorId: string,
    browserBindingHash: string,
  ): Promise<GmailAttempt | null> {
    const { data, error } = await getSupabaseAdmin().rpc("consume_gmail_oauth_attempt", {
      p_state_hash: stateHash,
      p_actor_id: actorId,
      p_browser_binding_hash: browserBindingHash,
    }).maybeSingle();
    if (error) throw persistenceError("consumeAttempt", error.code);
    return data ? toAttempt(data) : null;
  }

  async saveConnection(
    input: NewGmailConnection,
    expectedRevision: number,
    actorId: string,
  ): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin().rpc("save_gmail_connection", {
      p_connection: {
        mailbox_email: input.mailboxEmail,
        google_subject: input.googleSubject,
        oauth_client_id: input.oauthClientId,
        granted_scopes: input.grantedScopes,
        refresh_token_ciphertext: input.refreshTokenCiphertext,
        refresh_token_expires_at: input.refreshTokenExpiresAt,
        status: input.status,
        connected_by: input.connectedBy,
        connected_at: input.connectedAt,
        last_checked_at: input.lastCheckedAt,
        last_auth_error_code: input.lastAuthErrorCode,
      },
      p_expected_revision: expectedRevision,
      p_actor_id: actorId,
    });
    if (error) throw persistenceError("saveConnection", error.code);
    return data;
  }

  async recordCheck(
    expectedRevision: number,
    actorId: string,
    status: GmailConnection["status"],
    errorCode: string | null,
  ): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin().rpc("record_gmail_connection_check", {
      p_expected_revision: expectedRevision,
      p_actor_id: actorId,
      p_status: status,
      ...(errorCode !== null ? { p_error_code: errorCode } : {}),
    });
    if (error) throw persistenceError("recordCheck", error.code);
    return data;
  }
}
