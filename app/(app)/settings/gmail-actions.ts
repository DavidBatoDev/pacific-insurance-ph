"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { getGmailRepository } from "@/lib/repositories/gmail";
import { GMAIL_BROWSER_COOKIE, GMAIL_CALLBACK_PATH, getGmailConfig } from "@/lib/gmail/config";
import { checkGmailConnection, getGmailConnectionStatus, requireGmailAdmin } from "@/lib/gmail/connection";
import { createGmailAuthorization } from "@/lib/gmail/oauth";
import { encryptToken } from "@/lib/gmail/token-crypto";
import { classifyGoogleError } from "@/lib/gmail/policy";
import type { GmailConnectionStatus } from "@/lib/gmail/types";
import { enableGmailInbox, syncGmailInbox } from "@/lib/gmail/sync";
import { getInboxRepository } from "@/lib/repositories/inbox";

export async function beginGmailConnectionAction(): Promise<ActionResult<void>> {
  let authorizationUrl: string;
  try {
    const actor = await requireGmailAdmin();
    const config = getGmailConfig();
    const origin = (await headers()).get("origin");
    if (!origin || origin !== new URL(config.redirectUri).origin) {
      return { ok: false, error: "Open the CRM at the origin configured for the Gmail callback before connecting." };
    }
    const repo = getGmailRepository();
    const connection = await repo.getSummary();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const browserBinding = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const authorization = await createGmailAuthorization(config, state, nonce);
    await repo.createAttempt({
      stateHash,
      actorId: actor.id,
      browserBindingHash: createHash("sha256").update(browserBinding).digest("hex"),
      verifierCiphertext: encryptToken(authorization.verifier, config.encryptionKey, `gmail:pkce:${stateHash}`),
      nonceHash: createHash("sha256").update(nonce).digest("hex"),
      redirectUri: config.redirectUri,
      oauthClientId: config.clientId,
      baselineRevision: connection?.revision ?? 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    (await cookies()).set(GMAIL_BROWSER_COOKIE, browserBinding, {
      httpOnly: true, sameSite: "lax", secure: new URL(config.redirectUri).protocol === "https:",
      path: GMAIL_CALLBACK_PATH, maxAge: 10 * 60,
    });
    await recordAudit({ actorId: actor.id, action: "gmail.connection_started", tableName: "gmail_connections", newValue: { mailbox: config.senderEmail } });
    authorizationUrl = authorization.url;
  } catch (error) {
    return { ok: false, error: classifyGoogleError(error).message };
  }
  // Next redirect throws a framework signal, not an OAuth failure.
  redirect(authorizationUrl);
}

export async function checkGmailConnectionAction(): Promise<ActionResult<GmailConnectionStatus>> {
  try {
    const actor = await requireGmailAdmin();
    await checkGmailConnection(actor.id);
    revalidatePath("/settings");
    const status = await getGmailConnectionStatus();
    if (!status) return { ok: false, error: "Mailbox status is not available for this user." };
    return { ok: true, data: status };
  } catch (error) {
    revalidatePath("/settings");
    return { ok: false, error: classifyGoogleError(error).message };
  }
}

export async function enableIncomingGmailAction(): Promise<ActionResult<string>> {
  try {
    const actor = await requireGmailAdmin();
    await enableGmailInbox(actor.id);
    revalidatePath("/settings");
    revalidatePath("/inbox");
    return { ok: true, data: "Incoming email enabled from now. Older mailbox messages are not imported." };
  } catch (error) {
    return { ok: false, error: classifyGoogleError(error).message };
  }
}

export async function syncIncomingGmailAction(): Promise<ActionResult<string>> {
  try {
    await requireGmailAdmin();
    if (!await getInboxRepository().getSyncState()) return { ok: false, error: "Enable incoming email first." };
    // The same explicit action restores an expired watch without resetting the saved cursor.
    const result = await syncGmailInbox({ renewWatch: true });
    revalidatePath("/settings");
    revalidatePath("/inbox");
    return { ok: true, data: result.busy ? "Another synchronization is already running. Try again shortly." : result.watchRenewalError ? "Message progress saved, but Gmail push could not be renewed. Check the topic permissions and select Sync now again." : result.complete ? `Synchronization complete: ${result.processed} incoming message(s) processed.` : "Progress saved. Synchronization has more pages; select Sync now again to continue." };
  } catch (error) {
    return { ok: false, error: classifyGoogleError(error).message };
  }
}
