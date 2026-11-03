import { OAuth2Client } from "google-auth-library";
import { revalidatePath } from "next/cache";
import { getGmailConfig } from "@/lib/gmail/config";
import { getInboxRepository } from "@/lib/repositories/inbox";
import { getGmailInboxConfig } from "@/lib/gmail/inbox-config";
import { isGmailPushIdentity, parseGmailNotification } from "@/lib/gmail/notifications";
import { syncGmailInbox } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const verifier = new OAuth2Client({ transporterOptions: { timeout: 8_000, retry: false } });
const responseHeaders = { "Cache-Control": "private, no-store" };
const reply = (status: number) => new Response(null, { status, headers: responseHeaders });

export async function POST(request: Request) {
  let config;
  let mailbox: string;
  try { config = getGmailInboxConfig(); mailbox = getGmailConfig().senderEmail; } catch { return reply(503); }
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 16384 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)) return reply(401);
  try {
    const ticket = await verifier.verifyIdToken({ idToken: authorization.slice(7), audience: config.pushAudience });
    if (!isGmailPushIdentity(ticket.getPayload(), config.pushServiceAccount)) return reply(403);
  } catch { return reply(401); }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415);
  let notification;
  try {
    // Read only the small Pub/Sub envelope, never an unbounded request body.
    const reader = request.body?.getReader();
    if (!reader) return reply(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16384) { await reader.cancel(); return reply(413); }
      chunks.push(chunk.value);
    }
    notification = parseGmailNotification(JSON.parse(Buffer.concat(chunks).toString("utf8")), config.subscriptionName, mailbox);
  } catch { return reply(400); }
  try {
    const repo = getInboxRepository();
    await repo.enqueueNotification(notification);
    const state = await repo.getSyncState();
    // An authenticated notification cannot enable inbox access or establish a cursor.
    if (!state) return reply(204);
    const result = await syncGmailInbox();
    revalidatePath("/inbox");
    // Acknowledge only after all work is checkpointed. Pub/Sub retries busy/partial work.
    return reply(result.complete && !result.busy ? 204 : 503);
  } catch { return reply(503); }
}
