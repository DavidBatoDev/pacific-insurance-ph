"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getClientsRepository } from "@/lib/repositories/clients";
import { getGroupsRepository } from "@/lib/repositories/groups";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { WizardForm } from "@/components/hub/overlays/wizard/wizard-data";
import { parseAmount } from "@/components/hub/overlays/wizard/wizard-data";

export type WizardMode = "draft" | "create" | "email" | "docs";

export interface WizardResult {
  clientId: string | null;
  applicationId?: string;
  travelRequestId?: string;
  groupId?: string;
  /** Human summary for the toast. */
  summary: string;
}

/**
 * Create everything the 6-step wizard promises (design new-application.jsx +
 * Step 6's "This will automatically create" list): the client (new record,
 * existing link, or lead conversion — same record, never a duplicate), the
 * application / travel request / group account, the follow-up task, the
 * optional initial email, and the timeline entries.
 */
export async function createFromWizardAction(
  form: WizardForm,
  mode: WizardMode,
): Promise<ActionResult<WizardResult>> {
  const actor = await getActor();
  const clientsRepo = getClientsRepository();

  const hasName = !!(form.firstName || form.displayName || form.companyName || form.existingClientId || form.convertClientId);
  const hasContact = !!(form.email || form.mobile || form.existingClientId || form.convertClientId);
  if (!hasName || !hasContact || !form.category)
    return { ok: false, error: "Name, a contact method, and a product category are required." };

  try {
    /* ---------- 1. resolve the contact record ---------- */
    let clientId: string | null = null;
    let clientName = "";

    if (form.convertClientId) {
      // Convert-from-lead commit: flip the SAME record to Applicant.
      const lead = await clientsRepo.findById(form.convertClientId);
      if (!lead) return { ok: false, error: "The lead being converted no longer exists." };
      await clientsRepo.update(lead.id, {
        lifecycleStage: "Applicant",
        leadStage: "Converted",
        clientType: form.category === "hmo" ? "Corporate Contact" : lead.clientType,
      });
      await recordActivity({
        scopeType: "client",
        scopeId: lead.id,
        activityType: "lead.converted",
        summary: `Converted to Applicant — application started (${form.productName || "product"})`,
        actorId: actor.id,
      });
      clientId = lead.id;
      clientName = lead.fullName;
    } else if (form.clientMode === "existing" && form.existingClientId) {
      clientId = form.existingClientId;
      clientName = form.existingClientName;
    } else if (form.category === "hmo") {
      // Group HMO: the primary contact person becomes the contact record.
      const contactName = (form.companyContact || form.companyName).trim();
      const [firstName, ...rest] = contactName.split(" ");
      const created = await clientsRepo.create({
        firstName: firstName || form.companyName,
        lastName: rest.join(" ") || "(Company)",
        email: form.email || null,
        mobileNumber: form.mobile || null,
        clientType: "Corporate Contact",
        lifecycleStage: "Applicant",
        leadSource: form.source || null,
        assignedUserId: form.assignedUserId || actor.id,
        address: form.address || null,
        notes: form.notes || null,
      });
      clientId = created.id;
      clientName = created.fullName;
    } else {
      const created = await clientsRepo.create({
        firstName: form.firstName || form.displayName.split(" ")[0],
        lastName: form.lastName || form.displayName.split(" ").slice(1).join(" ") || "—",
        email: form.email || null,
        mobileNumber: form.mobile || null,
        dateOfBirth: form.dob || null,
        address: form.address || null,
        preferredChannel: form.channels[0] ?? null,
        clientType: "Prospect",
        lifecycleStage: mode === "draft" && form.status === "Lead" ? "Lead" : "Applicant",
        leadStage: mode === "draft" && form.status === "Lead" ? "New Lead" : "Converted",
        leadStatus: mode === "draft" && form.status === "Lead" ? "New" : null,
        productInterest: form.productName || null,
        estPremium: parseAmount(form.premium),
        leadSource: form.source || null,
        assignedUserId: form.assignedUserId || actor.id,
        notes: form.notes || null,
      });
      clientId = created.id;
      clientName = created.fullName;
    }

    const result: WizardResult = { clientId, summary: "" };

    /* ---------- 2. create the operational record ---------- */
    if (form.category === "hmo" && mode !== "draft") {
      const group = await getGroupsRepository().create({
        name: form.companyName || clientName,
        productVersionId: form.productVersionId || null,
        premiumAmount: parseAmount(form.premium),
        billingCycle: form.payFreq === "Semi-annual" ? "Semi-Annual" : "Annual",
        status: "Onboarding",
        primaryContactId: clientId,
        effectiveDate: form.startDate || null,
        address: form.address || null,
      });
      const validMembers = form.members.filter((m) => m.name.trim());
      for (const m of validMembers) {
        await getGroupsRepository().addMember({
          groupId: group.id,
          fullName: m.name.trim(),
          relationship: ["Principal", "Employee", "Dependent"].includes(m.rel) ? m.rel : "Employee",
          joinDate: form.startDate || null,
        });
      }
      await recordActivity({
        scopeType: "group_account",
        scopeId: group.id,
        activityType: "group.created",
        summary: `Group account created — ${group.name} (${validMembers.length} members)`,
        actorId: actor.id,
      });
      result.groupId = group.id;
      result.summary = `${group.name} — group account created · ${validMembers.length} members · status Onboarding.`;
    } else if (form.category === "travel" && mode !== "draft") {
      const travel = await getTravelRepository().create({
        clientId,
        productVersionId: form.productVersionId || null,
        destination: form.destination || null,
        departureDate: form.departure || null,
        returnDate: form.returnDate || null,
        travelerCount: Number(form.dependents) || 1,
        quotedPremium: parseAmount(form.premium),
        status: "Awaiting Payment",
        notes: form.internalNote || null,
      });
      await recordActivity({
        scopeType: "client",
        scopeId: clientId,
        activityType: "travel.quoted",
        summary: `Travel request created — ${travel.referenceNo ?? ""} ${form.destination ?? ""}`.trim(),
        actorId: actor.id,
      });
      result.travelRequestId = travel.id;
      result.summary = `${clientName} — travel request ${travel.referenceNo ?? ""} · Awaiting Payment.`;
    } else {
      const application = await getApplicationsRepository().create({
        clientId,
        productVersionId: form.productVersionId || null,
        applicationType:
          form.category === "hmo"
            ? "Group Application"
            : form.category === "travel"
              ? "Travel Insurance"
              : form.preExisting === "Yes"
                ? "Medical Evaluation"
                : "Standard",
        status: mode === "draft" ? "Lead" : form.status || "Applicant",
        assignedUserId: form.assignedUserId || actor.id,
        dateStarted: new Date().toISOString().slice(0, 10),
        notes: form.internalNote || form.notes || null,
      });
      await recordActivity({
        scopeType: "client",
        scopeId: clientId,
        activityType: "application.created",
        summary: `Application created — ${application.referenceNo ?? ""} (${form.productName || "product"}) · status ${application.status}`,
        actorId: actor.id,
      });
      await recordAudit({
        actorId: actor.id,
        action: "create",
        tableName: "applications",
        recordId: application.id,
        newValue: application as unknown as Json,
      });
      result.applicationId = application.id;
      result.summary =
        mode === "draft"
          ? `${clientName} saved as a draft — no messages sent.`
          : `${clientName} — ${form.productName || "application"} · status ${application.status}.`;
    }

    /* ---------- 3. follow-up task ---------- */
    if (form.createTask && mode !== "draft") {
      await getTasksRepository().create({
        title: `Follow up ${form.category === "hmo" ? form.companyName || clientName : clientName} — ${form.productName || "application"}`,
        tag: form.category === "travel" ? "Travel" : "Application",
        clientId,
        assignedUserId: form.assignedUserId || actor.id,
        dueDate: form.followDate ? form.followDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        priority: form.priority === "Urgent" ? "High" : "Normal",
      });
    }

    /* ---------- 4. initial email ---------- */
    const sendingEmail = mode === "email" || (form.sendEmail && mode !== "draft");
    if (sendingEmail && (form.emailRecipient || form.email)) {
      await getSupabaseAdmin().from("communications").insert({
        client_id: clientId,
        direction: "Outbound",
        channel: "Gmail",
        subject: form.emailSubject || `Your ${form.productName || "insurance"} application`,
        summary: form.emailBody.split("\n").find(Boolean) ?? "",
        notes: form.emailBody || null,
        related_user_id: actor.id,
        delivery_status: "sent",
      });
      result.summary += ` “${form.emailTemplate || "Initial email"}” sent.`;
    }
    if (mode === "docs") {
      const items = form.checklist.filter((c) => !c.checked).length;
      await recordActivity({
        scopeType: "client",
        scopeId: clientId,
        activityType: "application.docs_requested",
        summary: `Document checklist requested — ${items} outstanding item${items === 1 ? "" : "s"}`,
        actorId: actor.id,
      });
      result.summary += ` Checklist of ${items} items requested.`;
    }

    revalidatePath("/applications");
    revalidatePath("/prospects");
    revalidatePath("/travel");
    revalidatePath("/clients");
    revalidatePath("/tasks");
    if (clientId) revalidatePath(`/clients/${clientId}`);
    if (result.groupId) revalidatePath(`/group/${result.groupId}`);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create the application." };
  }
}
