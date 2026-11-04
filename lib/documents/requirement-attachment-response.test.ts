import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ original: vi.fn(), audit: vi.fn(), mime: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ recordAudit: mocks.audit }));
vi.mock("@/lib/gmail/review", () => ({ InboxReviewError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock("./requirement-attachments", () => ({ getRequirementAttachmentOriginal: mocks.original, requirementAttachmentPreviewMime: mocks.mime }));

import { requirementAttachmentResponse } from "./requirement-attachment-response";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.original.mockResolvedValue({ actorId: "staff", messageId: "mail", fileName: 'CET; "employee".xlsx', bytes: Buffer.from("data") });
  mocks.mime.mockReturnValue(null);
});

describe("private requirement attachment responses", () => {
  it("rejects active/unknown inline content without creating a preview audit", async () => {
    const response = await requirementAttachmentResponse("mail", "part", true);
    expect(response.status).toBe(415);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("serves unknown/Excel content as an inert download with safe filenames", async () => {
    const response = await requirementAttachmentResponse("mail", "__root__", false);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="CET_ _employee_.xlsx"');
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  });

  it("permits signature-approved inline preview only on our authenticated origin", async () => {
    mocks.mime.mockReturnValue("application/pdf");
    const response = await requirementAttachmentResponse("mail", "1", true);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toMatch(/^inline;/);
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'self'");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("does not echo raw storage/provider failures or cache error responses", async () => {
    mocks.original.mockRejectedValue(new Error("private-storage-path secret-token provider body"));
    const response = await requirementAttachmentResponse("mail", "1", false);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/secret-token|private-storage-path|provider body/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
