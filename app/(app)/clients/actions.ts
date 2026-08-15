"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActor } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import {
  getClientsRepository,
  type ClientUpdate,
  type NewClient,
} from "@/lib/repositories/clients";
import {
  getApplicationsRepository,
  type Application,
} from "@/lib/repositories/applications";
import { getDependentsRepository } from "@/lib/repositories/dependents";
import { RepositoryError } from "@/lib/repositories/types";
import type { Json } from "@/lib/supabase/types";

export interface ClientFormState {
  error?: string;
  /** True when the action was blocked because a likely duplicate exists. */
  duplicate?: boolean;
}

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function parseClient(fd: FormData) {
  return {
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: str(fd, "email") ?? null,
    mobileNumber: str(fd, "mobileNumber") ?? null,
    dateOfBirth: str(fd, "dateOfBirth") ?? null,
    address: str(fd, "address") ?? null,
    clientType: str(fd, "clientType") ?? "Prospect",
    leadSource: str(fd, "leadSource") ?? null,
    preferredChannel: str(fd, "preferredChannel") ?? null,
    vipStatus: fd.get("vipStatus") === "on" || fd.get("vipStatus") === "true",
    status: str(fd, "status") ?? "Active",
    notes: str(fd, "notes") ?? null,
    productInterest: str(fd, "productInterest") ?? null,
    estPremium: fd.get("estPremium") ? Number(fd.get("estPremium")) : null,
    familySize: fd.get("familySize") ? Number(fd.get("familySize")) : null,
    coverageTier: str(fd, "coverageTier") ?? null,
  };
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await getActor();
  const input = parseClient(formData);
  if (!input.firstName || !input.lastName) {
    return { error: "First name and last name are required." };
  }

  const repo = getClientsRepository();
  let createdId: string;

  try {
    const confirmed = formData.get("confirmDuplicate") === "true";
    if (!confirmed) {
      const dupes = await repo.findPotentialDuplicates({
        email: input.email,
        mobileNumber: input.mobileNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
      });
      if (dupes.length) {
        const names = dupes.map((d) => `${d.fullName} (${d.referenceNo ?? "—"})`).join(", ");
        return {
          error: `Possible duplicate of ${names}. Use “Create anyway” to proceed.`,
          duplicate: true,
        };
      }
    }

    const payload: NewClient = {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      clientType: input.clientType,
      leadSource: input.leadSource,
      preferredChannel: input.preferredChannel,
      vipStatus: input.vipStatus,
      status: input.status,
      notes: input.notes,
      productInterest: input.productInterest,
      estPremium: input.estPremium,
      familySize: input.familySize,
      coverageTier: input.coverageTier,
    };
    const created = await repo.create(payload);
    createdId = created.id;

    await recordActivity({
      scopeType: "client",
      scopeId: created.id,
      activityType: "client.created",
      summary: `Client ${created.fullName} created`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "create",
      tableName: "clients",
      recordId: created.id,
      newValue: created as unknown as Json,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create client." };
  }

  revalidatePath("/clients");
  redirect(`/clients/${createdId}`);
}

export async function updateClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await getActor();
  const id = String(formData.get("id") ?? "");
  const input = parseClient(formData);
  if (!id) return { error: "Missing client id." };
  if (!input.firstName || !input.lastName) {
    return { error: "First name and last name are required." };
  }

  const repo = getClientsRepository();
  try {
    const before = await repo.findById(id);
    const patch: ClientUpdate = {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      mobileNumber: input.mobileNumber,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      clientType: input.clientType,
      leadSource: input.leadSource,
      preferredChannel: input.preferredChannel,
      vipStatus: input.vipStatus,
      status: input.status,
      notes: input.notes,
      productInterest: input.productInterest,
      estPremium: input.estPremium,
      familySize: input.familySize,
      coverageTier: input.coverageTier,
    };
    const updated = await repo.update(id, patch);

    await recordActivity({
      scopeType: "client",
      scopeId: id,
      activityType: "client.updated",
      summary: `Client details updated`,
      actorId: actor.id,
    });
    await recordAudit({
      actorId: actor.id,
      action: "update",
      tableName: "clients",
      recordId: id,
      previousValue: before as unknown as Json,
      newValue: updated as unknown as Json,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update client." };
  }

  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}${formData.get("from") === "prospects" ? "?from=prospects" : ""}`);
}

/**
 * An application counts as "unsubmitted" — a lead's draft that never went to
 * Pacific Cross — only while it still carries the default `Lead` status and has
 * no submission date. Once it advances (Under Review, Missing Requirements,
 * Awaiting Payment, Approved) it's a real commitment and must not be swept away
 * with the lead. See docs/lead-stage-status.md.
 */
const UNSUBMITTED_APPLICATION_STATUSES = new Set(["Lead"]);

function isUnsubmittedApplication(app: Application): boolean {
  return app.dateSubmitted == null && UNSUBMITTED_APPLICATION_STATUSES.has(app.status);
}

/** Turn a client-delete FK violation (23503) into a specific, actionable message. */
function blockedDeleteMessage(error: RepositoryError): string {
  const blockers: Array<[constraint: string, label: string]> = [
    ["applications_client_id_fkey", "a submitted application"],
    ["claims_client_id_fkey", "a claim"],
    ["policies_client_id_fkey", "a policy"],
    ["renewals_client_id_fkey", "a renewal"],
    ["travel_requests_client_id_fkey", "a travel request"],
  ];
  const hit = blockers.find(([constraint]) => error.message.includes(constraint));
  const label = hit ? hit[1] : "related records";
  return `Can't delete this client — they still have ${label} on record. Resolve or reassign it first.`;
}

export async function deleteClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await getActor();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing client id." };

  const repo = getClientsRepository();
  const appsRepo = getApplicationsRepository();
  const before = await repo.findById(id);

  // A lead's in-flight application draft shouldn't block deleting the lead —
  // remove the unsubmitted ones first. Submitted applications and other
  // commitments stay protected by their RESTRICT foreign keys, and surface as a
  // clear message below rather than an unhandled 500.
  const apps = await appsRepo.listByClient(id);
  for (const app of apps.filter(isUnsubmittedApplication)) {
    await appsRepo.delete(app.id);
  }

  try {
    await repo.delete(id);
  } catch (e) {
    if (e instanceof RepositoryError && e.code === "23503") {
      return { error: blockedDeleteMessage(e) };
    }
    throw e;
  }

  await recordAudit({
    actorId: actor.id,
    action: "delete",
    tableName: "clients",
    recordId: id,
    previousValue: before as unknown as Json,
  });

  revalidatePath("/clients");
  redirect("/clients");
}

export async function addDependentAction(formData: FormData) {
  const actor = await getActor();
  const clientId = String(formData.get("clientId") ?? "");
  const fullName = str(formData, "fullName");
  if (!clientId || !fullName) return;

  await getDependentsRepository().create({
    primaryClientId: clientId,
    fullName,
    relationship: str(formData, "relationship") ?? null,
    dateOfBirth: str(formData, "dateOfBirth") ?? null,
    gender: str(formData, "gender") ?? null,
  });
  await recordActivity({
    scopeType: "client",
    scopeId: clientId,
    activityType: "dependent.added",
    summary: `Dependent ${fullName} added`,
    actorId: actor.id,
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function removeDependentAction(formData: FormData) {
  const actor = await getActor();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!id || !clientId) return;

  await getDependentsRepository().delete(id);
  await recordActivity({
    scopeType: "client",
    scopeId: clientId,
    activityType: "dependent.removed",
    summary: `Dependent removed`,
    actorId: actor.id,
  });

  revalidatePath(`/clients/${clientId}`);
}
