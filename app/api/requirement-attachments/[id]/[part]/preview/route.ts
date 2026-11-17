import { agentOwnsRecord, getAgentScope, RecordAccessError } from "@/lib/auth/agent-scope";
import { requirementAttachmentResponse } from "@/lib/documents/requirement-attachment-response";
import { getScopedInboxMessage } from "@/lib/gmail/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; part: string }> }) {
  const { id, part } = await params;
  // Agent scope (Phase J9): `id` is an inbox message, owned through its client. Signed-out callers
  // fall through so the shared response keeps its own 401.
  const agentId = await getAgentScope().catch((error: unknown) => {
    if (error instanceof RecordAccessError) return null;
    throw error;
  });
  if (agentId) {
    const message = await getScopedInboxMessage(id).catch(() => null);
    if (!message?.clientId || !(await agentOwnsRecord(agentId, "client", message.clientId)))
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return requirementAttachmentResponse(id, part, true);
}
