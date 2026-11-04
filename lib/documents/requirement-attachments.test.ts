import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequirementAttachmentReceipt, RequirementTarget } from "./requirement-attachment.types";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  actor: vi.fn(), message: vi.fn(), scope: vi.fn(), list: vi.fn(), begin: vi.fn(), receive: vi.fn(), originalPath: vi.fn(),
  gmail: vi.fn(), info: vi.fn(), download: vi.fn(), upload: vi.fn(), signed: vi.fn(),
}));
vi.mock("@/lib/gmail/review", () => ({
  InboxReviewError: class extends Error { constructor(message: string, public status = 400) { super(message); } },
  requireInboxActor: mocks.actor, getScopedInboxMessage: mocks.message, validateInboxId: vi.fn(),
}));
vi.mock("@/lib/gmail/api", () => ({ getGmailAttachment: mocks.gmail }));
vi.mock("@/lib/repositories/requirement-attachments", () => ({ getRequirementAttachmentsRepository: () => ({
  resolveScope: mocks.scope, listEmailAttachments: mocks.list, beginUpload: mocks.begin,
  receive: mocks.receive, getOriginalPath: mocks.originalPath,
}) }));
vi.mock("@/lib/supabase/storage", () => ({
  createSignedUpload: mocks.signed, downloadObject: mocks.download, getObjectInfo: mocks.info, uploadObject: mocks.upload,
}));
vi.mock("./uploaded-pdf", () => ({ PDF_UPLOAD_MAX_BYTES: 25 * 1024 * 1024 }));

import { attachRequirementDocument, getRequirementAttachmentOriginal, listRequirementEmailAttachments, requirementAttachmentError, requirementAttachmentPreviewMime } from "./requirement-attachments";

const clientId = "11111111-1111-4111-8111-111111111111";
const target: RequirementTarget = { kind: "application", recordId: "22222222-2222-4222-8222-222222222222", requirementId: "33333333-3333-4333-8333-333333333333" };
const messageId = "44444444-4444-4444-8444-444444444444";
const source = { type: "email" as const, messageId, partId: "1", confirmOtherRecord: false };
const receipt = { document: { id: "receipt", clientId }, requirementStatus: "Verified", alreadyAttached: true } as RequirementAttachmentReceipt;
function message() {
  return { id: messageId, clientId, targetKind: target.kind, targetId: target.recordId, attachments: [
    { partId: "1", fileName: "CET.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 4 },
  ] };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.actor.mockResolvedValue({ id: "staff", appRole: "staff", status: "Active" });
  mocks.scope.mockResolvedValue({ clientId, label: "Application checklist", status: "Verified" });
  mocks.message.mockResolvedValue(message());
  mocks.originalPath.mockResolvedValue(`${clientId}/gmail/original.pdf`);
  mocks.info.mockResolvedValue({ size: 4 });
  mocks.receive.mockResolvedValue(receipt);
  mocks.signed.mockImplementation(async (path: string) => ({ path, token: "signed-upload-token" }));
  mocks.gmail.mockResolvedValue({ bytes: Buffer.from("data"), fileName: "CET.xlsx", mimeType: "application/octet-stream" });
});

describe("requirement attachment source boundaries", () => {
  it("reuses filed originals without a Gmail connection or another upload", async () => {
    mocks.gmail.mockRejectedValue(new Error("disconnected"));
    await attachRequirementDocument(target, source);
    expect(mocks.gmail).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("does not fetch or file cross-client attachments", async () => {
    mocks.message.mockResolvedValue({ ...message(), clientId: "another-client" });
    await expect(attachRequirementDocument(target, source)).rejects.toMatchObject({ status: 404 });
    expect(mocks.originalPath).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("does not grant Agents Gmail filing rights", async () => {
    mocks.actor.mockResolvedValue({ id: "agent", appRole: "agent", status: "Active" });
    await expect(attachRequirementDocument(target, source)).rejects.toMatchObject({ status: 403 });
    expect(mocks.message).not.toHaveBeenCalled();
    expect(mocks.receive).not.toHaveBeenCalled();
  });


  it("requires acknowledgement before reading a different record's original", async () => {
    mocks.message.mockResolvedValue({ ...message(), targetKind: "claim", targetId: "other-record" });
    await expect(attachRequirementDocument(target, source)).rejects.toMatchObject({ status: 400 });
    expect(mocks.originalPath).not.toHaveBeenCalled();
    expect(mocks.gmail).not.toHaveBeenCalled();
    await attachRequirementDocument(target, { ...source, confirmOtherRecord: true });
  });


  it("accepts concurrent identical original writes but never substitutes different bytes", async () => {
    mocks.originalPath.mockResolvedValue(null);
    mocks.upload.mockRejectedValue(new Error("already exists"));
    mocks.download.mockResolvedValue(new Blob(["data"]));
    await attachRequirementDocument(target, source);
    expect(mocks.receive).toHaveBeenCalledTimes(1);
    mocks.receive.mockClear();
    mocks.download.mockResolvedValue(new Blob(["evil"]));
    await expect(attachRequirementDocument(target, source)).rejects.toMatchObject({ status: 503 });
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it("does not replace a missing stored original with a new Gmail download", async () => {
    mocks.info.mockRejectedValue(new Error("missing object"));
    await expect(getRequirementAttachmentOriginal(messageId, "1")).rejects.toThrow();
    expect(mocks.gmail).not.toHaveBeenCalled();
  });

});

describe("native checklist uploads and bounded search", () => {

  it("rejects forged paths or size mismatches before receiving native metadata", async () => {
    const metadata = { type: "upload" as const, fileName: "CET.xlsx", mimeType: "application/octet-stream", size: 4 };
    await expect(attachRequirementDocument(target, { ...metadata, path: "other-client/requirements/file.xlsx" })).rejects.toMatchObject({ status: 400 });
    expect(mocks.info).not.toHaveBeenCalled();
    const path = `${clientId}/requirements/55555555-5555-4555-8555-555555555555.xlsx`;
    mocks.info.mockResolvedValue({ size: 5 });
    await expect(attachRequirementDocument(target, { ...metadata, path })).rejects.toMatchObject({ status: 400 });
    expect(mocks.receive).not.toHaveBeenCalled();
  });

  it.each([
    { offset: -1 },
    { offset: 0.5 },
    { offset: 2_147_483_601 },
    { search: "x".repeat(201) },
  ])("rejects invalid candidate pagination/search before querying correspondence: %j", async (options) => {
    await expect(listRequirementEmailAttachments({ type: "client", clientId }, options)).rejects.toMatchObject({ status: 400 });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("never exposes raw provider/storage errors and only recognizes inline signatures", () => {
    expect(requirementAttachmentError(new Error("token=secret provider payload"))).not.toContain("secret");
    expect(requirementAttachmentPreviewMime(Buffer.from("<svg><script>active</script></svg>"))).toBeNull();
    expect(requirementAttachmentPreviewMime(Buffer.from("%PDF-safe"))).toBe("application/pdf");
    expect(requirementAttachmentPreviewMime(Buffer.from([0xff, 0xd8, 0xff, 1]))).toBe("image/jpeg");
    expect(requirementAttachmentPreviewMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  });
});
