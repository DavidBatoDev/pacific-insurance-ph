import { requirementAttachmentResponse } from "@/lib/documents/requirement-attachment-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; part: string }> }) {
  const { id, part } = await params;
  return requirementAttachmentResponse(id, part, false);
}
