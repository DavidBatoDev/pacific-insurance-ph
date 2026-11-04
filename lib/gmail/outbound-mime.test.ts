import { simpleParser } from "mailparser";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildOutboundMime, MAX_RAW_MIME_BYTES, MAX_SELECTED_ATTACHMENT_BYTES, OutboundMimeError, parseSingleMailbox } from "./outbound-mime";

const id = "11111111-2222-4333-8444-555555555555";
const base = { id, createdAt: "2026-11-04T01:02:03.000Z", recipient: "client@example.test", subject: "Policy ✓ ñ", body: "Hello ✓\nLine two", references: [], attachments: [] };

describe("parseSingleMailbox", () => {
  it.each([
    ["client@example.test", "client@example.test"],
    ["Client Name <Client@Example.test>", "client@example.test"],
  ])("accepts %s", (input, expected) => expect(parseSingleMailbox(input)).toBe(expected));

  it.each([
    "a@example.test, b@example.test",
    "a@example.test; b@example.test",
    "a@example.test\r\nBcc: x@example.test",
    "group: a@example.test, b@example.test;",
    "not-an-address",
    "a@example.test\u0000",
  ])("rejects %j", (input) => expect(parseSingleMailbox(input)).toBeNull());
});

describe("buildOutboundMime", () => {
  it("produces a message whose independent parse matches the reviewed content and bytes", async () => {
    const pdf = Buffer.from("%PDF-1.4\n%synthetic\n", "latin1");
    const xlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0x10]);
    const raw = await buildOutboundMime({
      ...base,
      subject: `Renewal — ${"long subject words ".repeat(12)}✓`,
      inReplyTo: "<orig@example.test>",
      references: ["<root@example.test>", "<orig@example.test>"],
      attachments: [
        { fileName: "Brochure — Pacífico ✓.pdf", mimeType: "application/pdf", bytes: pdf },
        { fileName: "Rates.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: xlsx },
      ],
    });
    const parsed = await simpleParser(raw);
    expect(parsed.from?.value).toEqual([{ address: "admin@pacificinsuranceph.com", name: "Pacific Insurance PH" }]);
    const to = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
    expect(to.flatMap((item) => item?.value ?? []).map((item) => item.address)).toEqual(["client@example.test"]);
    expect(parsed.cc).toBeUndefined();
    expect(parsed.bcc).toBeUndefined();
    expect(parsed.subject).toBe(`Renewal — ${"long subject words ".repeat(12)}✓`);
    expect(parsed.text?.trim()).toBe("Hello ✓\nLine two");
    expect(parsed.messageId).toBe(`<crm.${id}@pacificinsuranceph.com>`);
    // Gmail replaces Message-ID on send; this header is the reconciliation locator.
    expect(parsed.headers.get("x-piph-outbound-id")).toBe(id);
    expect(parsed.date?.toISOString()).toBe(base.createdAt);
    expect(parsed.inReplyTo).toBe("<orig@example.test>");
    expect(parsed.references).toEqual(["<root@example.test>", "<orig@example.test>"]);
    expect(parsed.attachments.map((file) => [file.filename, file.contentType, file.contentDisposition])).toEqual([
      ["Brochure — Pacífico ✓.pdf", "application/pdf", "attachment"],
      ["Rates.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "attachment"],
    ]);
    expect(parsed.attachments[0].content.equals(pdf)).toBe(true);
    expect(parsed.attachments[1].content.equals(xlsx)).toBe(true);
    expect(raw.toString("latin1")).not.toMatch(/^X-Mailer:/im);
  });

  it.each([
    ["recipient list", { recipient: "a@example.test, b@example.test" }],
    ["header injection in recipient", { recipient: "a@example.test\r\nBcc: evil@example.test" }],
    ["header injection in subject", { subject: "Hi\r\nBcc: evil@example.test" }],
    ["invalid reply header", { inReplyTo: "<a@b>\r\nX: y" }],
  ])("rejects %s", async (_label, change) => {
    await expect(buildOutboundMime({ ...base, ...change })).rejects.toBeInstanceOf(OutboundMimeError);
  });

  it("never embeds a CR/LF smuggled through an attachment filename as a header", async () => {
    const raw = await buildOutboundMime({ ...base, attachments: [{ fileName: "a\r\nBcc: evil@example.test.pdf", mimeType: "application/pdf", bytes: Buffer.from("x") }] });
    const parsed = await simpleParser(raw);
    expect(parsed.bcc).toBeUndefined();
    expect(raw.toString("latin1")).not.toMatch(/^Bcc:/im);
  });

  it("enforces the aggregate attachment boundary exactly", async () => {
    const half = Buffer.alloc(MAX_SELECTED_ATTACHMENT_BYTES / 2);
    await expect(buildOutboundMime({ ...base, attachments: [
      { fileName: "a.bin", mimeType: "application/octet-stream", bytes: half },
      { fileName: "b.bin", mimeType: "application/octet-stream", bytes: Buffer.alloc(MAX_SELECTED_ATTACHMENT_BYTES / 2 + 1) },
    ] })).rejects.toThrow("exceed 25 MB");
    const raw = await buildOutboundMime({ ...base, attachments: [{ fileName: "a.bin", mimeType: "application/octet-stream", bytes: Buffer.alloc(MAX_SELECTED_ATTACHMENT_BYTES) }] });
    // Base64 expansion of 25 MB stays inside the 35 MB raw ceiling.
    expect(raw.length).toBeLessThanOrEqual(MAX_RAW_MIME_BYTES);
  }, 30_000);

  it("rejects a body over 128 KiB", async () => {
    await expect(buildOutboundMime({ ...base, body: "x".repeat(128 * 1024 + 1) })).rejects.toThrow("too long");
  });
});
