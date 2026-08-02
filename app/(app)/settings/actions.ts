"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordAudit } from "@/lib/audit/log";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getExternalContactsRepository, type ExternalContact, type NewExternalContact } from "@/lib/repositories/external-contacts";
import {
  getIntegrationSettingsRepository,
  type PacificCrossIntegrationSettings,
} from "@/lib/repositories/integration-settings";
import {
  getPaymentChannelsRepository,
  type NewPaymentChannel,
  type PaymentChannel,
} from "@/lib/repositories/payment-channels";
import { getUsersRepository, type User } from "@/lib/repositories/users";
import {
  getDocumentLibraryRepository,
  LIBRARY_AGE_BANDS,
  LIBRARY_DOCUMENT_TYPES,
  type LibraryDocument,
  type LibraryDocumentUpdate,
  type NewLibraryDocument,
} from "@/lib/repositories/document-library";
import { createSignedUpload, getObjectInfo, removeObject } from "@/lib/supabase/storage";
import type { Json } from "@/lib/supabase/types";

async function requireAdmin() {
  const actor = await getActor();
  if (toAppRole(actor.role) !== "admin") throw new Error("Settings changes are Admin-only.");
  return actor;
}

const LIBRARY_MAX_BYTES = 25 * 1024 * 1024;
const LIBRARY_MIME_TYPES = new Set([
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function libraryMimeType(fileName: string, supplied: string) {
  if (LIBRARY_MIME_TYPES.has(supplied)) return supplied;
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return null;
}

export type LibraryUploadMetadata = Omit<NewLibraryDocument, "filePath" | "uploadedBy">;

export async function beginLibraryUploadAction(input: { fileName: string; mimeType: string; size: number })
  : Promise<ActionResult<{ path: string; token: string; mimeType: string }>> {
  try {
    await requireAdmin();
    if (!input.fileName.trim() || input.size <= 0) return { ok: false, error: "Choose a file to upload." };
    if (input.size > LIBRARY_MAX_BYTES) return { ok: false, error: "Library files must be 25 MB or smaller." };
    const mimeType = libraryMimeType(input.fileName, input.mimeType);
    if (!mimeType) return { ok: false, error: "Only PDF, DOC, and DOCX files are allowed." };
    const ext = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    return { ok: true, data: { ...await createSignedUpload(`library/${randomUUID()}.${ext}`), mimeType } };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t start upload." }; }
}

export async function finalizeLibraryUploadAction(path: string, input: LibraryUploadMetadata): Promise<ActionResult<LibraryDocument>> {
  try {
    const actor = await requireAdmin();
    if (!path.startsWith("library/")) return { ok: false, error: "Invalid library path." };
    if (!input.productVersionId || !input.documentName.trim() || !input.versionLabel.trim())
      return { ok: false, error: "Product version, document name, and version are required." };
    if (!LIBRARY_DOCUMENT_TYPES.includes(input.documentType as (typeof LIBRARY_DOCUMENT_TYPES)[number]))
      return { ok: false, error: "Choose a supported document type." };
    if (!LIBRARY_AGE_BANDS.includes((input.ageBand ?? "All Ages") as (typeof LIBRARY_AGE_BANDS)[number]))
      return { ok: false, error: "Choose a supported age band." };
    if (!libraryMimeType(input.originalFileName, input.mimeType))
      return { ok: false, error: "Only PDF, DOC, and DOCX files are allowed." };
    if (input.expiryDate && input.effectiveDate && input.expiryDate < input.effectiveDate)
      return { ok: false, error: "Expiry date cannot be before the effective date." };
    const info = await getObjectInfo(path);
    const size = Number(info.size ?? input.fileSizeBytes);
    if (size > LIBRARY_MAX_BYTES) return { ok: false, error: "Uploaded file exceeds 25 MB." };
    const saved = await getDocumentLibraryRepository().create({ ...input, filePath: path, fileSizeBytes: size, uploadedBy: actor.id, approvalStatus: "Pending Approval", status: "Active" });
    await recordAudit({ actorId: actor.id, action: "create", tableName: "document_library", recordId: saved.id, newValue: saved as unknown as Json });
    revalidatePath("/settings");
    return { ok: true, data: saved };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t finalize upload." }; }
}

export async function discardLibraryUploadAction(path: string): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    if (!/^library\/[0-9a-f-]+\.(pdf|doc|docx)$/.test(path))
      return { ok: false, error: "Invalid library path." };
    await removeObject(path);
    return { ok: true, data: null };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t discard upload." }; }
}

export async function updateLibraryDocumentAction(id: string, input: LibraryDocumentUpdate): Promise<ActionResult<LibraryDocument>> {
  try {
    const actor = await requireAdmin();
    const current = await getDocumentLibraryRepository().findById(id);
    if (!current) return { ok: false, error: "Library asset not found." };
    if (input.expiryDate && input.effectiveDate && input.expiryDate < input.effectiveDate)
      return { ok: false, error: "Expiry date cannot be before the effective date." };
    if (current.approvalStatus === "Approved") {
      const changesIdentity =
        (input.documentName !== undefined && input.documentName !== current.documentName) ||
        (input.documentType !== undefined && input.documentType !== current.documentType) ||
        (input.versionLabel !== undefined && input.versionLabel !== current.versionLabel) ||
        (input.variant !== undefined && input.variant !== current.variant) ||
        (input.ageBand !== undefined && input.ageBand !== current.ageBand);
      if (changesIdentity)
        return { ok: false, error: "Approved asset identity is locked. Upload a new version instead." };
    }
    const saved = await getDocumentLibraryRepository().update(id, input);
    await recordAudit({ actorId: actor.id, action: "update", tableName: "document_library", recordId: id, previousValue: current as unknown as Json, newValue: saved as unknown as Json });
    revalidatePath("/settings"); return { ok: true, data: saved };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Couldn’t update asset." }; }
}

export async function setLibraryDocumentStateAction(id: string, operation: "approve" | "archive"): Promise<ActionResult<LibraryDocument>> {
  try {
    const actor = await requireAdmin();
    const repo = getDocumentLibraryRepository();
    const saved = operation === "approve" ? await repo.approve(id) : await repo.archive(id);
    await recordAudit({ actorId: actor.id, action: "update", tableName: "document_library", recordId: id, newValue: saved as unknown as Json });
    revalidatePath("/settings"); return { ok: true, data: saved };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : `Couldn’t ${operation} asset.` }; }
}

async function requireContactEditor() {
  const actor = await getActor();
  if (!can(toAppRole(actor.role), "externalContacts", "edit"))
    throw new Error("Pacific Cross contacts are view-only for your role.");
  return actor;
}

export async function saveExternalContactAction(
  id: string | null,
  input: NewExternalContact,
): Promise<ActionResult<ExternalContact>> {
  try {
    const actor = await requireContactEditor();
    const normalized = { ...input, name: input.name.trim(), email: input.email?.trim().toLowerCase() || null };
    if (!normalized.name) return { ok: false, error: "Contact name is required." };
    if (normalized.email && !/^\S+@\S+\.\S+$/.test(normalized.email))
      return { ok: false, error: "Enter a valid email address." };
    const repo = getExternalContactsRepository();
    const duplicate = (await repo.list()).find((contact) =>
      contact.id !== id && normalized.email && contact.email?.toLowerCase() === normalized.email,
    );
    if (duplicate) return { ok: false, error: `That email is already assigned to ${duplicate.name}.` };
    const saved = id ? await repo.update(id, normalized) : await repo.create(normalized);
    await recordAudit({ actorId: actor.id, action: id ? "update" : "create", tableName: "external_contacts", recordId: saved.id, newValue: saved as unknown as Json });
    revalidatePath("/settings");
    revalidatePath("/commissions");
    revalidatePath("/payments");
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save contact." };
  }
}

/* -------------------------- Pacific Cross portal -------------------------- */

/** Save the agency's Pacific Cross portal link (Settings → Integrations; Admin-only). */
export async function savePacificCrossPortalAction(
  portalUrl: string,
): Promise<ActionResult<PacificCrossIntegrationSettings>> {
  try {
    const actor = await requireAdmin();
    const value = portalUrl.trim();
    if (!value) return { ok: false, error: "Pacific Cross portal URL is required." };

    let normalizedUrl: string;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      normalizedUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Enter a valid HTTPS URL." };
    }

    const saved = await getIntegrationSettingsRepository().savePacificCross({
      portalUrl: normalizedUrl,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "integration_settings",
      recordId: saved.id,
      newValue: saved as unknown as Json,
    });
    revalidatePath("/settings");
    revalidatePath("/clients", "layout");
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save Pacific Cross portal." };
  }
}

/** Change a team member's role (Settings → Team; Admin-only). */
export async function updateUserRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult<User>> {
  try {
    const actor = await requireAdmin();
    if (!["Owner", "Admin", "Assistant", "Viewer"].includes(role))
      return { ok: false, error: "Unknown role." };
    if (userId === actor.id) return { ok: false, error: "You can’t change your own role." };

    const updated = await getUsersRepository().update(userId, { role });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "users",
      recordId: userId,
      newValue: updated as unknown as Json,
    });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update role." };
  }
}

/** Soft activate/deactivate a team member (history preserved). */
export async function toggleUserStatusAction(userId: string): Promise<ActionResult<User>> {
  try {
    const actor = await requireAdmin();
    if (userId === actor.id) return { ok: false, error: "You can’t deactivate yourself." };
    const repo = getUsersRepository();
    const user = await repo.findById(userId);
    if (!user) return { ok: false, error: "User not found." };
    const updated = await repo.update(userId, {
      status: user.status === "Active" ? "Inactive" : "Active",
    });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update user." };
  }
}

/* ------------------------- Official Payment Channels ------------------------ */

/** Create or update a payment channel (Settings → Payment Channels; Admin-only). */
export async function savePaymentChannelAction(
  id: string | null,
  input: NewPaymentChannel,
): Promise<ActionResult<PaymentChannel>> {
  try {
    const actor = await requireAdmin();
    if (!input.label.trim() || !input.accountNumber.trim())
      return { ok: false, error: "Label and account number are required." };

    const repo = getPaymentChannelsRepository();
    // A single default: setting one clears the others.
    if (input.isDefault) {
      for (const c of await repo.list()) {
        if (c.isDefault && c.id !== id) await repo.update(c.id, { isDefault: false });
      }
    }
    const saved = id ? await repo.update(id, input) : await repo.create(input);
    await recordAudit({
      actorId: actor.id,
      action: id ? "update" : "create",
      tableName: "payment_channels",
      recordId: saved.id,
      newValue: saved as unknown as Json,
    });
    revalidatePath("/settings");
    return { ok: true, data: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save channel." };
  }
}

/** Soft activate/deactivate a payment channel. */
export async function togglePaymentChannelAction(id: string): Promise<ActionResult<PaymentChannel>> {
  try {
    await requireAdmin();
    const repo = getPaymentChannelsRepository();
    const channel = (await repo.list()).find((c) => c.id === id);
    if (!channel) return { ok: false, error: "Channel not found." };
    if (channel.isDefault && channel.active)
      return { ok: false, error: "Make another channel the default first." };
    const updated = await repo.update(id, { active: !channel.active });
    revalidatePath("/settings");
    return { ok: true, data: updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update channel." };
  }
}
