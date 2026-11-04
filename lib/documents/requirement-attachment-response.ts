import "server-only";

import { recordAudit } from "@/lib/audit/log";
import { InboxReviewError } from "@/lib/gmail/review";
import { getRequirementAttachmentOriginal, requirementAttachmentPreviewMime } from "./requirement-attachments";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; sandbox",
  "Referrer-Policy": "no-referrer",
};

export async function requirementAttachmentResponse(messageId: string, routePart: string, inline: boolean): Promise<Response> {
  try {
    const original = await getRequirementAttachmentOriginal(messageId, routePart === "__root__" ? "" : routePart);
    const mimeType = requirementAttachmentPreviewMime(original.bytes);
    if (inline && !mimeType) return new Response("This format cannot be previewed safely. Download the original instead.", { status: 415, headers: PRIVATE_HEADERS });
    const asciiName = original.fileName.replace(/[^\x20-\x7e]|[";]/g, "_");
    const encodedName = encodeURIComponent(original.fileName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    await recordAudit({ actorId: original.actorId, action: inline ? "preview" : "download", tableName: "gmail_inbox_messages", recordId: original.messageId });
    return new Response(original.bytes as Uint8Array<ArrayBuffer>, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": mimeType || "application/octet-stream",
        "Content-Length": String(original.bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch (error) {
    return new Response(error instanceof InboxReviewError ? error.message : "The original attachment is temporarily unavailable. Please try again.", {
      status: error instanceof InboxReviewError ? error.status : 503,
      headers: PRIVATE_HEADERS,
    });
  }
}
