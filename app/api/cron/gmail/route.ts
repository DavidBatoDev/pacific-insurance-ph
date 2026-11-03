import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getInboxRepository } from "@/lib/repositories/inbox";
import { syncGmailInbox } from "@/lib/gmail/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** Daily fallback supports Vercel Hobby; Pub/Sub performs normal near-real-time delivery. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Gmail cron is not configured." }, { status: 503, headers });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  try {
    if (!await getInboxRepository().getSyncState()) return Response.json({ enabled: false }, { headers });
    // One credential refresh, lease and deadline cover both renewal and reconciliation.
    const result = await syncGmailInbox({ renewWatch: true });
    const watchRenewed = !result.busy && !result.watchRenewalError;
    revalidatePath("/inbox");
    revalidatePath("/settings");
    return Response.json({ enabled: true, watchRenewed, ...result }, { status: watchRenewed && result.complete && !result.busy ? 200 : 503, headers });
  } catch {
    return Response.json({ error: "Gmail reconciliation needs attention. Check integration status." }, { status: 503, headers });
  }
}
