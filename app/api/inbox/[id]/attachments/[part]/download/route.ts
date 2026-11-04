import { recordAudit } from "@/lib/audit/log";
import { getGmailAttachment } from "@/lib/gmail/api";
import { getScopedInboxMessage, InboxReviewError, requireInboxActor } from "@/lib/gmail/review";
import { getRequirementAttachmentsRepository } from "@/lib/repositories/requirement-attachments";
import { downloadObject, getObjectInfo } from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; part: string }> }) {
  try {
    const actor = await requireInboxActor();
    const { id, part } = await params;
    const message = await getScopedInboxMessage(id, actor.id);
    const partId = part === "__root__" ? "" : part;
    const attachment = message.attachments.find((item) => item.partId === partId);
    if (!attachment) throw new InboxReviewError("Attachment not found.", 404);
    if (attachment.size > 25 * 1024 * 1024)
      throw new InboxReviewError("This original exceeds the 25 MB download limit. Ask an Admin with mailbox access to retrieve it in Gmail.", 413);
    const path = message.targetId ? await getRequirementAttachmentsRepository().getOriginalPath(actor.id, message.id, partId) : null;
    let original: { bytes: Buffer; fileName: string };
    if (path) {
      const info = await getObjectInfo(path);
      if (Number(info.size) > 25 * 1024 * 1024) throw new InboxReviewError("This original exceeds the 25 MB download limit.", 413);
      const stored = await downloadObject(path);
      if (stored.size > 25 * 1024 * 1024) throw new InboxReviewError("This original exceeds the 25 MB download limit.", 413);
      original = { bytes: Buffer.from(await stored.arrayBuffer()), fileName: attachment.fileName };
    } else {
      original = await getGmailAttachment(message, partId);
    }
    const fileName = original.fileName.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 180) || "attachment";
    const asciiName = fileName.replace(/[^\x20-\x7e]|[";]/g, "_");
    const encodedName = encodeURIComponent(fileName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    // Provider content-type is external input. Known signatures only; everything else stays inert.
    const bytes = original.bytes;
    let mimeType = "application/octet-stream";
    if (bytes.length >= 5 && bytes.compare(PDF_SIGNATURE, 0, 5, 0, 5) === 0) mimeType = "application/pdf";
    else if (bytes.length >= 8 && bytes.compare(PNG_SIGNATURE, 0, 8, 0, 8) === 0) mimeType = "image/png";
    else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mimeType = "image/jpeg";
    await recordAudit({ actorId: actor.id, action: "download", tableName: "gmail_inbox_messages", recordId: message.id });
    return new Response(original.bytes as Uint8Array<ArrayBuffer>, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": mimeType,
        "Content-Length": String(original.bytes.length),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return new Response(error instanceof InboxReviewError ? error.message : "The original attachment is temporarily unavailable. Check the Gmail connection and try again.", {
      status: error instanceof InboxReviewError ? error.status : 503,
      headers: PRIVATE_HEADERS,
    });
  }
}
