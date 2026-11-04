import { getInboxRevision, InboxReviewError } from "@/lib/gmail/review";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(): Promise<Response> {
  try {
    return Response.json({ revision: await getInboxRevision() }, { headers });
  } catch (error) {
    if (error instanceof InboxReviewError && error.status === 401)
      return Response.json({ error: "An active account is required." }, { status: 401, headers });
    if (error instanceof InboxReviewError && error.status === 403)
      return Response.json({ error: "This action is not permitted." }, { status: 403, headers });
    return Response.json({ error: "Inbox update check unavailable." }, { status: 503, headers });
  }
}
