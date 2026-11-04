import "server-only";

import { randomUUID } from "node:crypto";
import { getInboxRepository } from "@/lib/repositories/inbox";
import type { InboxSyncState, IncomingMessage } from "@/lib/repositories/inbox/inbox.entity";
import { getGmailReadAccess, type GmailAccess } from "./access";
import { GmailApiError, gmailRequest, GMAIL_REQUEST_TIMEOUT_MS } from "./api";
import { getGmailInboxConfig } from "./inbox-config";
import { decodeGmailBase64, gmailObject, gmailParts, parseGmailMessage } from "./mime";
import { GmailAuthorizationError } from "./policy";

const SYNC_BUDGET_MS = 45_000;
const AUTHORIZATION_ERROR_CODES: Readonly<Record<string, true>> = {
  invalid_client: true, not_connected: true, stale_connection: true, provider_unavailable: true,
  token_encryption_error: true, missing_scope: true, read_permission_required: true, unexpected_scope: true,
  refresh_token_missing: true, unverified_email: true, workspace_mismatch: true, identity_mismatch: true,
  invalid_identity: true, invalid_grant: true, invalid_token: true, provider_error: true,
};
// Provider tokens alone cannot resume within one history record containing many additions.
// Persist the exact candidate page before reading bodies; replay never depends on a moving list.
type PageCheckpoint = {
  version: 1;
  fetchToken: string | null;
  ids?: string[];
  nextToken?: string | null;
  historyId?: string;
};

function decimal(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,40}$/.test(value)) throw new Error("gmail_invalid_history_id");
  return value;
}

function providerToken(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value || value.length > 4_096) throw new Error("gmail_invalid_page_token");
  return value;
}

function encodeCheckpoint(page: PageCheckpoint): string {
  return `gmail-page-v1:${Buffer.from(JSON.stringify(page)).toString("base64url")}`;
}

function decodeCheckpoint(value: string | null): PageCheckpoint {
  if (!value) return { version: 1, fetchToken: null };
  if (!value.startsWith("gmail-page-v1:") || value.length > 512 * 1024) throw new Error("gmail_invalid_checkpoint");
  let data: Record<string, unknown>;
  try { data = gmailObject(JSON.parse(Buffer.from(value.slice(14), "base64url").toString("utf8"))); }
  catch { throw new Error("gmail_invalid_checkpoint"); }
  if (data.version !== 1 || (data.ids !== undefined && (!Array.isArray(data.ids) || data.ids.length > 1_000 || !data.ids.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(id))))) throw new Error("gmail_invalid_checkpoint");
  return {
    version: 1, fetchToken: providerToken(data.fetchToken),
    ...(data.ids !== undefined ? { ids: data.ids as string[], nextToken: providerToken(data.nextToken), historyId: decimal(data.historyId) } : {}),
  };
}

function identityMatches(state: InboxSyncState, access: GmailAccess): void {
  if (state.googleSubject !== access.googleSubject || state.oauthClientId !== access.oauthClientId) throw new GmailAuthorizationError("identity_mismatch", true);
}

async function registerWatch(access: GmailAccess): Promise<string> {
  const watch = gmailObject(await gmailRequest<unknown>("watch", { method: "POST", body: { topicName: getGmailInboxConfig().topicName }, access }));
  decimal(watch.historyId);
  if (typeof watch.expiration !== "string" || !/^\d{1,16}$/.test(watch.expiration)) throw new Error("gmail_invalid_watch_expiry");
  const expiry = Number(watch.expiration);
  if (!Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > 8.64e15) throw new Error("gmail_invalid_watch_expiry");
  return new Date(expiry).toISOString();
}

/** Only an explicit, repository-authorized Admin action creates this forward-only boundary. */
export async function enableGmailInbox(actorId: string): Promise<void> {
  const repository = getInboxRepository();
  const access = await getGmailReadAccess();
  const existing = await repository.getSyncState();
  if (existing) identityMatches(existing, access);
  const profile = gmailObject(await gmailRequest<unknown>("profile", { access }));
  // Capture receipt boundary after profile: arrivals in between are excluded, not silently lost.
  // All later arrivals are represented by history following this profile cursor.
  const enabledAt = new Date().toISOString();
  const state = await repository.enableSync({ googleSubject: access.googleSubject, oauthClientId: access.oauthClientId, historyId: decimal(profile.historyId), enabledAt, watchExpiresAt: null }, actorId);
  identityMatches(state, access);
  const expiresAt = await registerWatch(access);
  await repository.updateWatch(access.googleSubject, expiresAt);
}

export async function renewGmailInboxWatch(): Promise<void> {
  const repository = getInboxRepository();
  const state = await repository.getSyncState();
  if (!state) return;
  const access = await getGmailReadAccess();
  identityMatches(state, access);
  // Watch's returned historyId must NEVER replace the ingestion cursor.
  await repository.updateWatch(access.googleSubject, await registerWatch(access));
}

function pageIds(page: Record<string, unknown>, recovery: boolean): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const message = gmailObject(value);
    if (typeof message.id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(message.id)) throw new Error("gmail_invalid_message_id");
    ids.add(message.id);
    if (ids.size > 1_000) throw new Error("gmail_page_limits_exceeded");
  };
  if (recovery) {
    if (page.messages !== undefined && !Array.isArray(page.messages)) throw new Error("gmail_invalid_page");
    for (const message of (page.messages || []) as unknown[]) add(message);
  } else {
    if (page.history !== undefined && !Array.isArray(page.history)) throw new Error("gmail_invalid_page");
    for (const entry of (page.history || []) as unknown[]) {
      const history = gmailObject(entry);
      if (history.messagesAdded !== undefined && !Array.isArray(history.messagesAdded)) throw new Error("gmail_invalid_page");
      // Generic history.messages includes deletions/label events, not necessarily new mail.
      for (const added of (history.messagesAdded || []) as unknown[]) add(gmailObject(added).message);
    }
  }
  return [...ids];
}

class SyncBudgetReached extends Error {}

export async function syncGmailInbox(options: { renewWatch?: boolean } = {}): Promise<{ processed: number; complete: boolean; busy: boolean; watchRenewalError?: string }> {
  const deadline = Date.now() + SYNC_BUDGET_MS;
  const watchResult: { watchRenewalError?: string } = options.renewWatch ? { watchRenewalError: "gmail_watch_not_renewed" } : {};
  const repository = getInboxRepository();
  const initial = await repository.getSyncState();
  if (!initial) return { processed: 0, complete: true, busy: false, ...watchResult };
  const leaseToken = randomUUID();
  const state = await repository.claimSync(leaseToken);
  if (!state) return { processed: 0, complete: false, busy: true, ...watchResult };
  let processed = 0;
  let recoveryHistoryId = state.recoveryHistoryId;
  let page: PageCheckpoint;
  const commit = async (messages: IncomingMessage[], checkpoint: PageCheckpoint | null, complete: boolean, historyId = state.historyId) => {
    await repository.commitSync({ leaseToken, messages, historyId, pageToken: checkpoint ? encodeCheckpoint(checkpoint) : null, recoveryHistoryId: complete ? null : recoveryHistoryId, complete });
  };
  try {
    // claimSync verifies the cached DB identity/read grant before any token refresh.
    // Refresh failures must still release this lease and leave durable health evidence.
    const access = await getGmailReadAccess();
    identityMatches(state, access);
    const request = async (path: string): Promise<Record<string, unknown>> => {
      if (Date.now() + GMAIL_REQUEST_TIMEOUT_MS + 2_000 > deadline) throw new SyncBudgetReached();
      return gmailObject(await gmailRequest<unknown>(path, { access }));
    };
    if (options.renewWatch) {
      if (Date.now() + GMAIL_REQUEST_TIMEOUT_MS + 2_000 > deadline) throw new SyncBudgetReached();
      try {
        await repository.updateWatch(access.googleSubject, await registerWatch(access));
        delete watchResult.watchRenewalError;
      } catch (error) {
        // A failed watch must not prevent recovery of messages through the existing cursor.
        watchResult.watchRenewalError = error instanceof GmailApiError ? `gmail_api_${error.status}` : "gmail_watch_failed";
      }
    }
    const boundary = Date.parse(state.enabledAt);
    if (!Number.isFinite(boundary)) throw new Error("gmail_invalid_boundary");
    page = decodeCheckpoint(state.pageToken);
    while (Date.now() < deadline) {
      if (page.ids === undefined) {
        const query = new URLSearchParams({ maxResults: "20" });
        if (page.fetchToken) query.set("pageToken", page.fetchToken);
        if (recoveryHistoryId) {
          // Gmail's after query is second-granular; strict internalDate filtering follows.
          query.set("q", `after:${Math.max(0, Math.floor(boundary / 1000) - 1)}`);
          query.set("includeSpamTrash", "true");
        } else {
          query.set("startHistoryId", decimal(state.historyId));
          query.set("historyTypes", "messageAdded");
        }
        let response: Record<string, unknown>;
        try { response = await request(`${recoveryHistoryId ? "messages" : "history"}?${query}`); }
        catch (error) {
          if (!(error instanceof GmailApiError) || error.status !== 404 || recoveryHistoryId) throw error;
          // Snapshot BEFORE listing. Concurrent arrivals are picked up from this cursor later.
          const profile = await request("profile");
          recoveryHistoryId = decimal(profile.historyId);
          page = { version: 1, fetchToken: null };
          await commit([], page, false);
          continue;
        }
        page = { version: 1, fetchToken: page.fetchToken, ids: pageIds(response, recoveryHistoryId !== null), nextToken: providerToken(response.nextPageToken), historyId: recoveryHistoryId || decimal(response.historyId) };
        await commit([], page, false);
      }
      const id = page.ids?.[0];
      if (id) {
        let parsed: IncomingMessage | null = null;
        let full: Record<string, unknown> | null;
        try { full = await request(`messages/${id}?format=full`); }
        catch (error) {
          // Mail can be deleted between history/list and get; keep prior CRM evidence intact.
          if (error instanceof GmailApiError && error.status === 404) full = null;
          else throw error;
        }
        if (full && full.id !== id) throw new Error("gmail_message_identity_mismatch");
        if (full && Array.isArray(full.labelIds) && (full.labelIds.includes("SENT") || full.labelIds.includes("DRAFT"))) full = null;
        if (full && typeof full.internalDate === "string" && /^\d{1,16}$/.test(full.internalDate) && Number.isSafeInteger(Number(full.internalDate)) && Number(full.internalDate) < boundary) full = null;
        if (full) {
          // Gmail may externalize a large textual MIME body as an attachment resource.
          for (const part of gmailParts(full.payload, true)) {
            const body = part.body === undefined ? {} : gmailObject(part.body);
            const disposition = Array.isArray(part.headers) ? part.headers.map(gmailObject).find((header) => typeof header.name === "string" && header.name.toLowerCase() === "content-disposition")?.value : "";
            if ((part.mimeType === "text/plain" || part.mimeType === "text/html") && !part.filename && !/^attachment\b/i.test(String(disposition || "")) && body.data === undefined && typeof body.attachmentId === "string") {
              if (!/^[A-Za-z0-9_-]{1,512}$/.test(body.attachmentId)) throw new Error("gmail_invalid_attachment");
              const external = await request(`messages/${id}/attachments/${body.attachmentId}`);
              const bytes = decodeGmailBase64(external.data, 8 * 1024 * 1024);
              if (external.size !== bytes.length || body.size !== bytes.length) throw new Error("gmail_invalid_part_size");
              body.data = external.data;
            }
          }
          parsed = parseGmailMessage(full);
          if (parsed && Date.parse(parsed.receivedAt) < boundary) parsed = null;
        }
        const next = { ...page, ids: page.ids!.slice(1) };
        await commit(parsed ? [parsed] : [], next, false);
        page = next;
        if (parsed) processed++;
        continue;
      }
      if (page.nextToken) {
        page = { version: 1, fetchToken: page.nextToken };
        await commit([], page, false);
        continue;
      }
      await commit([], null, true, decimal(page.historyId));
      return { processed, complete: true, busy: false, ...watchResult };
    }
    await repository.releaseSync(leaseToken, null);
    return { processed, complete: false, busy: false, ...watchResult };
  } catch (error) {
    if (error instanceof SyncBudgetReached) {
      await repository.releaseSync(leaseToken, null);
      return { processed, complete: false, busy: false, ...watchResult };
    }
    // Never persist arbitrary exception text (provider responses, tokens, or message bodies).
    const code = error instanceof GmailApiError ? `gmail_api_${error.status}`
      : error instanceof GmailAuthorizationError && Object.hasOwn(AUTHORIZATION_ERROR_CODES, error.code) ? error.code : "gmail_sync_failed";
    await repository.releaseSync(leaseToken, code);
    throw new Error(code);
  }
}
