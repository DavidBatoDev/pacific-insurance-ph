import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { decodeGmailBase64, MAX_ATTACHMENT_BYTES, parseGmailMessage, safeGmailFileName } from "./mime";

function textPart(text: string, mimeType = "text/plain", partId = "0") {
  const bytes = Buffer.from(text);
  return { partId, mimeType, filename: "", body: { size: bytes.length, data: bytes.toString("base64url") } };
}

function message(parts: unknown[] = [textPart("A real synthetic reply")]) {
  return {
    id: "abc123", threadId: "thread123", labelIds: ["INBOX", "UNREAD"], internalDate: "1793491200000",
    payload: { mimeType: "multipart/mixed", body: { size: 0 }, headers: [
      { name: "From", value: '"Doe, Jane" <Jane@Example.test>' },
      { name: "To", value: 'Operations <ADMIN@example.test>, "Smith, Joe" <joe@example.test>' },
      { name: "Subject", value: "=?UTF-8?B?UsOpcG9uc2U=?=" },
      { name: "Message-ID", value: "<reply@example.test>" },
      { name: "References", value: "<first@example.test> <second@example.test>" },
      { name: "Date", value: "Wed, 01 Jan 1992 00:00:00 +0000" },
    ], parts },
  };
}

describe("Gmail MIME evidence parsing", () => {
  it("uses internal receipt time, decodes headers, and parses quoted recipient lists", () => {
    expect(parseGmailMessage(message())).toMatchObject({
      gmailMessageId: "abc123", fromAddress: "jane@example.test", fromName: "Doe, Jane", subject: "Réponse",
      toAddresses: ["admin@example.test", "joe@example.test"], references: ["<first@example.test>", "<second@example.test>"],
      receivedAt: new Date(1793491200000).toISOString(), bodyText: "A real synthetic reply", bodyTruncated: false,
    });
  });

  it("retains unlabeled archived mail and missing sender metadata without inventing a sender", () => {
    const input = message();
    const { labelIds: _labels, ...unlabeled } = input;
    unlabeled.payload.headers = input.payload.headers.filter((header) => header.name !== "From");
    expect(parseGmailMessage(unlabeled)).toMatchObject({ fromAddress: "", fromName: "", bodyText: "A real synthetic reply", subject: "Réponse" });
  });

  it("prefers text/plain alternatives without including HTML or attachment content", () => {
    const file = { ...textPart("Not the correspondence", "text/plain", "2"), filename: "notes.txt" };
    const parsed = parseGmailMessage(message([textPart("<p>HTML version</p>", "text/html"), textPart("Plain version", "text/plain", "1"), file]));
    expect(parsed?.bodyText).toBe("Plain version");
    expect(parsed?.attachments).toEqual([{ partId: "2", attachmentId: null, fileName: "notes.txt", mimeType: "text/plain", size: 22 }]);
  });

  it("converts HTML to inert text without active content, image URLs or anchor destinations", () => {
    const parsed = parseGmailMessage(message([textPart('<p>Hello &amp; welcome</p><script>stealSecrets()</script><style>hidden{}</style><img src="https://tracking.invalid/pixel"><a href="javascript:alert(1)">Evidence</a><iframe src="https://remote.invalid">evil frame</iframe>', "text/html")]));
    expect(parsed?.bodyText).toContain("Hello & welcome");
    expect(parsed?.bodyText).toContain("Evidence");
    expect(parsed?.bodyText).not.toMatch(/stealSecrets|tracking|javascript|remote|evil frame|<[^>]+>/);
  });

  it("explicitly marks truncation and never splits a UTF-8 character", () => {
    const parsed = parseGmailMessage(message([textPart("€".repeat(50_000))]));
    expect(parsed?.bodyTruncated).toBe(true);
    expect(Buffer.byteLength(parsed!.bodyText)).toBeLessThanOrEqual(128 * 1024);
    expect(parsed?.bodyText).not.toContain("�");
  });

  it.each(["SENT", "DRAFT"])("ignores %s before attempting to parse MIME bodies", (label) => {
    expect(parseGmailMessage({ ...message(), labelIds: ["INBOX", label], payload: null })).toBeNull();
  });

  it("flags automated responses without treating the sender as verified carrier evidence", () => {
    const input = message();
    input.payload.headers.push({ name: "Auto-Submitted", value: "auto-replied" }, { name: "Authentication-Results", value: "mx.example; spf=pass" });
    expect(parseGmailMessage(input)).toMatchObject({ isAutoReply: true, authenticationResults: "mx.example; spf=pass" });
    input.payload.headers.find((header) => header.name === "Auto-Submitted")!.value = "no";
    expect(parseGmailMessage(input)?.isAutoReply).toBe(false);
  });

  it("retains oversize attachment metadata instead of silently dropping correspondence", () => {
    const input = message();
    input.payload.parts.push({ partId: "1", mimeType: "application/pdf", filename: "../proof\r\n.pdf", body: { attachmentId: "file1", size: MAX_ATTACHMENT_BYTES + 1 } });
    const parsed = parseGmailMessage(input);
    expect(parsed?.attachments[0]).toMatchObject({ fileName: "_proof  .pdf", size: MAX_ATTACHMENT_BYTES + 1 });
    expect(parsed?.bodyText).toBe("A real synthetic reply");
  });

  it("rejects malformed MIME and unavailable externalized text rather than committing incomplete evidence", () => {
    expect(() => parseGmailMessage(message([{ ...textPart("x"), body: { size: 99, data: "eA" } }]))).toThrow("gmail_invalid_part_size");
    expect(() => parseGmailMessage(message([{ ...textPart("x"), body: { size: 1, attachmentId: "file" } }]))).toThrow("gmail_text_body_unavailable");
    expect(() => parseGmailMessage({ ...message(), internalDate: "NaN" })).toThrow("gmail_invalid_message");
  });

  it("fails safely on excessive MIME depth and duplicate attachment part identifiers", () => {
    let nested: unknown = textPart("deep");
    for (let depth = 0; depth < 32; depth++) nested = { mimeType: "multipart/mixed", parts: [nested] };
    expect(() => parseGmailMessage({ ...message(), payload: nested })).toThrow("gmail_mime_limits_exceeded");
    const file = { ...textPart("x"), filename: "file.txt" };
    expect(() => parseGmailMessage(message([file, file]))).toThrow("gmail_invalid_attachment");
  });

  it("keeps an attached message's nested text out of the correspondence body", () => {
    const parsed = parseGmailMessage(message([
      textPart("The actual reply"),
      { partId: "1", mimeType: "message/rfc822", filename: "forwarded.eml", body: { size: 200, attachmentId: "forwarded1" }, parts: [textPart("Attached private thread", "text/plain", "1.0")] },
    ]));
    expect(parsed?.bodyText).toBe("The actual reply");
    expect(parsed?.attachments).toHaveLength(1);
    expect(parsed?.attachments[0].fileName).toBe("forwarded.eml");
  });

  it("strictly validates base64url and byte limits rather than accepting Buffer's permissive decoding", () => {
    expect(decodeGmailBase64("aGVsbG8", 5).toString()).toBe("hello");
    expect(() => decodeGmailBase64("aGVsbG8$", 20)).toThrow("gmail_invalid_base64");
    expect(() => decodeGmailBase64("Zh", 20)).toThrow("gmail_invalid_base64");
    expect(() => decodeGmailBase64("aGVsbG8", 4)).toThrow("gmail_content_too_large");
    expect(safeGmailFileName("..\\proof\u202e.pdf\u0000")).toBe("_proof_.pdf_");
  });
});
