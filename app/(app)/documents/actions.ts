"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getActor } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { removeObject, uploadObject } from "@/lib/supabase/storage";
import type { Json } from "@/lib/supabase/types";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s === "" ? undefined : s;
}

export async function uploadDocumentAction(formData: FormData) {
  const actor = await getActor();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const clientId = str(formData, "clientId") ?? null;
  const documentType = str(formData, "documentType") ?? null;
  const visibility = str(formData, "visibility") ?? "Internal Only";
  const name = str(formData, "name") ?? file.name;
  const applicationId = str(formData, "applicationId") ?? null;
  const travelRequestId = str(formData, "travelRequestId") ?? null;
  const claimId = str(formData, "claimId") ?? null;
  const sourceLibraryDocumentId = str(formData, "sourceLibraryDocumentId") ?? null;
  const applicationRequirementId = str(formData, "applicationRequirementId") ?? null;
  const travelRequirementId = str(formData, "travelRequirementId") ?? null;
  const claimRequirementId = str(formData, "claimRequirementId") ?? null;

  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "bin";
  const path = `${clientId ?? "unfiled"}/${randomUUID()}.${ext || "bin"}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadObject(path, bytes, file.type || undefined);

  const doc = await getDocumentsRepository().create({
    name,
    filePath: path,
    clientId,
    applicationId,
    travelRequestId,
    claimId,
    sourceLibraryDocumentId,
    applicationRequirementId,
    travelRequirementId,
    claimRequirementId,
    documentType,
    visibility,
    uploadedBy: actor.id,
  });

  if (applicationRequirementId) {
    await getSupabaseAdmin().from("application_requirements").update({ status: "Received" }).eq("id", applicationRequirementId);
  }
  if (travelRequirementId) {
    await getSupabaseAdmin().from("travel_request_requirements").update({ status: "Received" }).eq("id", travelRequirementId);
  }
  if (claimRequirementId) {
    await getSupabaseAdmin().from("claim_requirements").update({ status: "Received" }).eq("id", claimRequirementId);
  }

  await recordAudit({
    actorId: actor.id,
    action: "create",
    tableName: "documents",
    recordId: doc.id,
    newValue: { name, path, visibility } as unknown as Json,
  });

  if (clientId) {
    await recordActivity({
      scopeType: "client",
      scopeId: clientId,
      activityType: "document.uploaded",
      summary: `Document “${name}” uploaded`,
      actorId: actor.id,
    });
    revalidatePath(`/clients/${clientId}`);
  }
  revalidatePath("/documents");
  if (applicationId) revalidatePath("/applications");
  if (travelRequestId) revalidatePath("/travel");
  if (claimId) revalidatePath("/claims");
  return { id: doc.id };
}

export async function deleteDocumentAction(formData: FormData) {
  const actor = await getActor();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const repo = getDocumentsRepository();
  const doc = await repo.findById(id);
  if (doc?.filePath) {
    try {
      await removeObject(doc.filePath);
    } catch {
      // Object may already be gone; proceed to remove the record.
    }
  }
  await repo.delete(id);

  await recordAudit({
    actorId: actor.id,
    action: "delete",
    tableName: "documents",
    recordId: id,
    previousValue: (doc ?? null) as unknown as Json,
  });

  if (doc?.clientId) {
    await recordActivity({
      scopeType: "client",
      scopeId: doc.clientId,
      activityType: "document.deleted",
      summary: `Document “${doc.name}” removed`,
      actorId: actor.id,
    });
    revalidatePath(`/clients/${doc.clientId}`);
  }
  revalidatePath("/documents");
}
