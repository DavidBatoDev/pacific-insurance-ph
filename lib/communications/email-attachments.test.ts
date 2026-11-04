import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const store = vi.hoisted(() => ({ objects: new Map<string, Buffer>(), documents: new Map<string, Record<string, unknown>>() }));
vi.mock("@/lib/supabase/storage", () => ({
  getObjectInfo: async (path: string) => ({ size: store.objects.get(path)?.length }),
  downloadObject: async (path: string) => new Blob([new Uint8Array(store.objects.get(path)!)]),
}));
vi.mock("@/lib/repositories/documents", () => ({ getDocumentsRepository: () => ({ findById: async (id: string) => store.documents.get(id) ?? null }) }));
vi.mock("@/lib/repositories/document-library", () => ({ getDocumentLibraryRepository: vi.fn(), LIBRARY_DOCUMENT_TYPES: [], MAX_OPTIONAL_ATTACHMENTS: 5 }));
vi.mock("@/lib/documents/requirement-attachments", () => ({ getRequirementAttachmentOriginal: vi.fn() }));
vi.mock("@/lib/repositories/inbox", () => ({ getInboxRepository: vi.fn() }));

import type { Client } from "@/lib/repositories/clients";
import { loadReviewedAttachments, resolveEmailAttachments, type AttachmentManifestEntry } from "./email-attachments";

const client = { id: "c1" } as Client;
const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const draft = { origin: { type: "contact" as const, clientId: "c1" }, recipient: "a@example.test", subject: "S", body: "B", documentIds: [D1, D2] };

beforeEach(() => {
  store.objects.clear();
  store.documents.clear();
  store.objects.set("c1/a.pdf", Buffer.from("%PDF-one"));
  store.objects.set("c1/b.pdf", Buffer.from("%PDF-two!"));
  store.documents.set(D1, { id: D1, clientId: "c1", name: "Form.pdf", filePath: "c1/a.pdf", status: "Uploaded", documentType: null });
  store.documents.set(D2, { id: D2, clientId: "c1", name: "Form.pdf", filePath: "c1/b.pdf", status: "Uploaded", documentType: null });
});

/** Postgres jsonb returns object keys in its own order; a persisted manifest must still verify. */
function persisted(manifest: AttachmentManifestEntry[]): AttachmentManifestEntry[] {
  return manifest.map((entry) => ({ ...entry, source: entry.source.type === "email" ? entry.source : { id: entry.source.id, type: entry.source.type } }));
}

describe("email attachments", () => {
  it("keeps distinct files with the same name as separate attachments with disambiguated names", async () => {
    const loaded = await resolveEmailAttachments(draft, { client });
    expect(loaded.map(({ entry }) => entry.fileName)).toEqual(["Form.pdf", "Form (2).pdf"]);
    expect(loaded.map(({ bytes }) => bytes.toString())).toEqual(["%PDF-one", "%PDF-two!"]);
  });

  it("re-verifies a persisted manifest and returns the reviewed bytes", async () => {
    const manifest = persisted((await resolveEmailAttachments(draft, { client })).map(({ entry }) => entry));
    const reloaded = await loadReviewedAttachments(manifest, draft, { client });
    expect(reloaded.map(({ bytes }) => bytes.toString())).toEqual(["%PDF-one", "%PDF-two!"]);
  });

  it("fails before sending when a reviewed file's bytes changed", async () => {
    const manifest = persisted((await resolveEmailAttachments(draft, { client })).map(({ entry }) => entry));
    store.objects.set("c1/b.pdf", Buffer.from("%PDF-TWO!"));
    await expect(loadReviewedAttachments(manifest, draft, { client })).rejects.toThrow("changed after review");
  });

  it("rejects another client's document and replaced documents", async () => {
    store.documents.set(D2, { ...store.documents.get(D2), clientId: "other" });
    await expect(resolveEmailAttachments(draft, { client })).rejects.toThrow("stored for this client");
    store.documents.set(D2, { ...store.documents.get(D2), clientId: "c1", status: "Replaced" });
    await expect(resolveEmailAttachments(draft, { client })).rejects.toThrow("stored for this client");
  });
});
