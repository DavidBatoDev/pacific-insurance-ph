"use server";

import { revalidatePath } from "next/cache";

import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getApplicationRequirementsRepository, type NewApplicationRequirement } from "@/lib/repositories/application-requirements";
import { getClientsRepository, type ClientUpdate } from "@/lib/repositories/clients";
import { getCarrierWorkflowsRepository } from "@/lib/repositories/carrier-workflows";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getGroupsRepository } from "@/lib/repositories/groups";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";
import type { WizardForm } from "@/components/hub/overlays/wizard/wizard-data";
import { ageFromDob, categoryForProduct, emptyWizardForm, parseAmount } from "@/components/hub/overlays/wizard/wizard-data";

export type WizardMode = "draft" | "create" | "email" | "docs";

export interface WizardResult {
  clientId: string | null;
  applicationId?: string;
  travelRequestId?: string;
  groupId?: string;
  /** Human summary for the toast. */
  summary: string;
}

export type AutoFilledWizardField =
  | "firstName"
  | "lastName"
  | "email"
  | "mobile"
  | "dob"
  | "address"
  | "channels"
  | "notes"
  | "assignedUserId"
  | "appType"
  | "source"
  | "productVersionId";

export interface DraftResumePayload {
  form: WizardForm;
  linkedClientName: string;
  /** Fields that received a lead/default value instead of an existing draft value. */
  autoFilled: Partial<Record<AutoFilledWizardField, string>>;
}

const normaliseProductName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const hasSavedValue = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value != null;
const wizardChannel = (value: string | null) => (value === "Gmail" ? "Email" : value);
const isWizardState = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** Copy the current configurable template into an immutable application checklist. */
async function snapshotApplicationRequirements(applicationId: string, productVersionId: string | null, form?: WizardForm) {
  const requirements = getApplicationRequirementsRepository();
  if ((await requirements.listByApplication(applicationId)).length > 0) return;

  if (form?.category === "health") {
    const principal = form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || "Principal applicant";
    const people = [{ name: principal, dob: form.dob, preExisting: form.preExisting }, ...form.healthDependents.map((item) => ({ name: item.name, dob: item.dob, preExisting: item.preExisting ?? "Unknown" }))].filter((item) => item.name.trim());
    const items: Omit<NewApplicationRequirement, "applicationId">[] = people.flatMap((person, index) => {
      const age = ageFromDob(person.dob);
      const senior = typeof age === "number" && age >= 71;
      const medical = senior || person.preExisting === "Yes";
      const base: Omit<NewApplicationRequirement, "applicationId">[] = [
        { documentName: senior ? "Completed age 71–100 application form" : "Completed regular application form", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 10 },
        { documentName: "Valid government-issued ID", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 20 },
        { documentName: "Attestation letter with specimen signatures", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 30 },
      ];
      if (medical) base.push({ documentName: senior ? "Senior medical examination / physician statement" : "Medical questionnaire or supporting records", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 40 });
      return base;
    });
    if (form.remoteSale) {
      items.push(
        { documentName: "Advisor declaration", appliesTo: "Remote / online submission", isRequired: true, sortOrder: 900 },
        { documentName: "Remote-selling confirmation", appliesTo: "Remote / online submission", isRequired: true, sortOrder: 910 },
      );
    }
    items.push(
      { documentName: "Treatment Area Limitation (TAL) conforme", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 920 },
      { documentName: "Client Application for Coverage (CAC)", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 930 },
    );
    await requirements.createMany(items.map((item) => ({ applicationId, ...item })));
    return;
  }

  const db = getSupabaseAdmin();
  let templateQuery = db
    .from("required_document_templates")
    .select("id")
    .eq("status", "Active")
    .limit(1);
  if (productVersionId) templateQuery = templateQuery.eq("product_version_id", productVersionId);
  else templateQuery = templateQuery.is("product_version_id", null);
  let { data: template, error } = await templateQuery.maybeSingle();
  if (error) throw new Error(error.message);

  if (!template && productVersionId) {
    const fallback = await db
      .from("required_document_templates")
      .select("id")
      .eq("status", "Active")
      .is("product_version_id", null)
      .eq("template_name", "Standard new-business baseline")
      .maybeSingle();
    template = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  if (!template) return;

  const { data: items, error: itemsError } = await db
    .from("required_document_items")
    .select("id, document_name, is_required, applies_to, notes, sort_order")
    .eq("requirement_template_id", template.id)
    .order("sort_order");
  if (itemsError) throw new Error(itemsError.message);
  await requirements.createMany((items ?? []).map((item) => ({
    applicationId,
    requiredDocumentItemId: item.id,
    documentName: item.document_name,
    isRequired: item.is_required,
    appliesTo: item.applies_to,
    notes: item.notes,
    sortOrder: item.sort_order,
  })));
}

const ageBandFor = (dob: string): "0-70" | "71-100" => {
  const age = ageFromDob(dob);
  return typeof age === "number" && age >= 71 ? "71-100" : "0-70";
};

async function matchCarrierForm(form: WizardForm, ageBand: "0-70" | "71-100" | "All Ages") {
  const variant = /flexishield/i.test(form.productName) ? "FlexiShield" : null;
  const docs = await getDocumentLibraryRepository().listEligible({
    productName: form.productName,
    productVersionId: form.productVersionId || undefined,
    documentType: "Application Form",
    ageBand,
    variant,
  });
  return { variant, document: docs[0] ?? null };
}

async function persistHealthWorkflow(applicationId: string, clientId: string, form: WizardForm) {
  const workflows = getCarrierWorkflowsRepository();
  const dependents = await workflows.saveApplicationDependents(applicationId, clientId, form.healthDependents.map((person) => ({
    id: person.id, name: person.name, dateOfBirth: person.dob || null, relationship: person.rel || null,
    email: person.email || null, preExistingStatus: person.preExisting || "Unknown", medicalNotes: person.medicalNotes || null,
  })));
  const principalName = form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || "Principal applicant";
  const people = [{ dependentId: null, personName: principalName, dob: form.dob }, ...dependents.map((person) => ({ dependentId: person.id, personName: person.name, dob: person.dateOfBirth ?? "" }))];
  const assignments = [];
  for (const person of people) {
    const ageBand = ageBandFor(person.dob);
    const match = await matchCarrierForm(form, ageBand);
    assignments.push({ dependentId: person.dependentId, personName: person.personName, variant: match.variant, ageBand, documentLibraryId: match.document?.id ?? null, matchStatus: match.document ? "Matched" as const : "Unavailable" as const });
  }
  await workflows.replaceApplicationCarrierForms(applicationId, assignments);
  await snapshotApplicationRequirements(applicationId, form.productVersionId || null, form);
  return assignments.filter((item) => item.matchStatus === "Unavailable").length;
}

/**
 * Resolve a resumable draft against its current linked lead. Saved values win;
 * a blank field inherits the lead only when the field has usable lead context.
 */
export async function getDraftResumeAction(
  applicationId: string,
): Promise<ActionResult<DraftResumePayload>> {
  await getActor();
  try {
    const draft = await getApplicationsRepository().findById(applicationId);
    if (!draft || draft.status !== "Lead" || !isWizardState(draft.wizardState)) {
      return { ok: false, error: "This application draft is no longer available to continue." };
    }
    const client = await getClientsRepository().findById(draft.clientId);
    if (!client) return { ok: false, error: "The contact for this application draft no longer exists." };

    const saved = draft.wizardState as Partial<WizardForm>;
    const { data: productRows, error: productError } = await getSupabaseAdmin()
      .from("product_versions")
      .select("id, product:products (name, category)")
      .eq("status", "Active");
    if (productError) return { ok: false, error: productError.message };

    const matches = (productRows ?? []).filter((row) => {
      const name = (row.product as { name: string } | null)?.name;
      return !!client.productInterest && !!name && normaliseProductName(name) === normaliseProductName(client.productInterest);
    });
    const uniqueProduct = matches.length === 1
      ? { id: matches[0].id, name: (matches[0].product as { name: string }).name }
      : null;

    const autoFilled: Partial<Record<AutoFilledWizardField, string>> = {};
    const resolveDefault = <K extends AutoFilledWizardField>(key: K, fallback: WizardForm[K]) => {
      const value = saved[key];
      if (hasSavedValue(value)) return value as WizardForm[K];
      if (hasSavedValue(fallback)) autoFilled[key] = Array.isArray(fallback) ? fallback.join(", ") : String(fallback);
      return fallback;
    };

    const form = {
      ...emptyWizardForm(),
      ...saved,
      draftApplicationId: draft.id,
      draftStep: typeof saved.draftStep === "number" ? saved.draftStep : 1,
      clientMode: "existing" as const,
      existingClientId: client.id,
      existingClientName: client.fullName,
      convertClientId: null,
      convertClientName: null,
      firstName: resolveDefault("firstName", client.firstName),
      lastName: resolveDefault("lastName", client.lastName),
      displayName: hasSavedValue(saved.displayName) ? saved.displayName! : client.fullName,
      email: resolveDefault("email", client.email ?? ""),
      mobile: resolveDefault("mobile", client.mobileNumber ?? ""),
      dob: resolveDefault("dob", client.dateOfBirth ?? ""),
      address: resolveDefault("address", client.address ?? ""),
      channels: resolveDefault("channels", wizardChannel(client.preferredChannel) ? [wizardChannel(client.preferredChannel)!] : []),
      notes: resolveDefault("notes", client.notes ?? ""),
      assignedUserId: resolveDefault("assignedUserId", client.assignedUserId ?? ""),
      appType: resolveDefault("appType", "New Insurance Application"),
      source: resolveDefault("source", client.leadSource ?? ""),
      productVersionId: resolveDefault("productVersionId", uniqueProduct?.id ?? ""),
      productName: hasSavedValue(saved.productName) ? saved.productName! : uniqueProduct?.name ?? "",
      category: hasSavedValue(saved.category)
        ? (saved.productName && /flexishield/i.test(saved.productName) ? "health" : saved.category!)
        : uniqueProduct ? categoryForProduct(uniqueProduct.name, (matches[0]?.product as { category?: string | null } | null)?.category) : "",
    } satisfies WizardForm;
    if (form.category === "travel" && form.travelers.length === 0 && Number(saved.dependents) > 0) {
      form.travelers = [{
        name: form.displayName || client.fullName, dob: form.dob, nationality: form.nationality,
        gender: form.gender, contact: form.mobile, idType: "Passport", idNumber: form.passport,
        planOptionId: form.planOptionId, beneficiaryName: "", beneficiaryDob: "",
        beneficiaryRelationship: "", beneficiaryContact: "",
      }];
    }
    if (!hasSavedValue(saved.emailRecipient) && form.email) form.emailRecipient = form.email;

    return { ok: true, data: { form, linkedClientName: client.fullName, autoFilled } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load the application draft." };
  }
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
  if (!hasName || !hasContact || (mode !== "draft" && !form.category))
    return {
      ok: false,
      error:
        mode === "draft"
          ? "A name and contact method are required to save a draft."
          : "Name, a contact method, and a product category are required.",
    };

  try {
    /* ---------- 1. resolve the contact record ---------- */
    let clientId: string | null = null;
    let clientName = "";
    let resumingDraft = false;
    const applicationsRepo = getApplicationsRepository();

    if (form.draftApplicationId) {
      const draft = await applicationsRepo.findById(form.draftApplicationId);
      if (!draft || draft.status !== "Lead" || !isWizardState(draft.wizardState)) {
        return { ok: false, error: "This application draft is no longer available to continue." };
      }
      const existingClient = await clientsRepo.findById(draft.clientId);
      if (!existingClient) return { ok: false, error: "The contact for this application draft no longer exists." };

      const clientPatch: ClientUpdate = {
        email: form.email || null,
        mobileNumber: form.mobile || null,
        dateOfBirth: form.dob || null,
        address: form.address || null,
        preferredChannel: form.channels[0] ?? null,
        leadSource: form.source || null,
        assignedUserId: form.assignedUserId || actor.id,
        notes: form.notes || null,
        productInterest: form.productName || null,
        estPremium: parseAmount(form.premium),
      };
      if (form.category === "hmo") {
        const [firstName, ...lastName] = (form.companyContact || form.companyName).trim().split(" ");
        clientPatch.firstName = firstName || existingClient.firstName;
        clientPatch.lastName = lastName.join(" ") || existingClient.lastName;
      } else {
        clientPatch.firstName = form.firstName || form.displayName.split(" ")[0] || existingClient.firstName;
        clientPatch.lastName = form.lastName || form.displayName.split(" ").slice(1).join(" ") || existingClient.lastName;
      }
      await clientsRepo.update(draft.clientId, clientPatch);
      clientId = draft.clientId;
      clientName = [clientPatch.firstName, clientPatch.lastName].filter(Boolean).join(" ") || existingClient.fullName;
      resumingDraft = true;
    }

    if (!resumingDraft && form.convertClientId) {
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
    } else if (!resumingDraft && form.clientMode === "existing" && form.existingClientId) {
      clientId = form.existingClientId;
      clientName = form.existingClientName;
    } else if (!resumingDraft && form.category === "hmo") {
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
    } else if (!resumingDraft) {
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

    if (!clientId) return { ok: false, error: "Could not resolve the application contact." };
    const resolvedClientId = clientId;
    const result: WizardResult = { clientId: resolvedClientId, summary: "" };

    const hasSeniorApplicant = [form.dob, ...form.healthDependents.map((person) => person.dob)]
      .some((dob) => { const age = ageFromDob(dob); return typeof age === "number" && age >= 71; });
    const applicationType =
      form.category === "hmo"
        ? "Group Application"
        : form.category === "travel"
          ? "Travel Insurance"
          : hasSeniorApplicant
            ? "Senior Application"
            : form.preExisting === "Yes" || form.healthDependents.some((person) => person.preExisting === "Yes")
            ? "Medical Evaluation"
            : "Standard";

    if (resumingDraft && form.draftApplicationId && (mode === "draft" || form.category !== "travel")) {
      const application = await applicationsRepo.update(form.draftApplicationId, {
        productVersionId: form.productVersionId || null,
        planOptionId: form.planOptionId || null,
        applicationType,
        status: mode === "draft" ? "Lead" : form.status || "Applicant",
        assignedUserId: form.assignedUserId || actor.id,
        dateStarted: new Date().toISOString().slice(0, 10),
        notes: form.internalNote || form.notes || null,
        wizardState: mode === "draft" ? (form as unknown as Json) : null,
        coverageType: form.coverage || null,
        desiredStartDate: form.startDate || null,
        preferredPaymentMode: form.payFreq || null,
        estimatedPremium: parseAmount(form.premium),
        remoteSale: form.remoteSale,
        preExistingStatus: form.preExisting || null,
        medicalNotes: form.medicalNotes || null,
      });
      const unavailable = mode !== "draft" && form.category === "health"
        ? await persistHealthWorkflow(application.id, resolvedClientId, form)
        : 0;
      if (mode !== "draft" && form.category !== "health") await snapshotApplicationRequirements(application.id, application.productVersionId ?? null, form);
      await recordActivity({
        scopeType: "client",
        scopeId: resolvedClientId,
        activityType: mode === "draft" ? "application.draft_saved" : "application.updated",
        summary: mode === "draft" ? "Application draft updated" : `Application completed — status ${application.status}`,
        actorId: actor.id,
      });
      await recordAudit({
        actorId: actor.id,
        action: mode === "draft" ? "update_draft" : "update",
        tableName: "applications",
        recordId: application.id,
        newValue: application as unknown as Json,
      });
      result.applicationId = application.id;
      result.summary =
        mode === "draft"
          ? `${clientName} draft updated — no messages sent.`
          : `${clientName} — ${form.productName || "application"} · status ${application.status}.${unavailable ? ` ${unavailable} approved carrier form${unavailable === 1 ? " is" : "s are"} unavailable.` : ""}`;
    }

    /* ---------- 2. create the operational record ---------- */
    if (form.category === "hmo" && mode !== "draft") {
      const group = await getGroupsRepository().create({
        name: form.companyName || clientName,
        productVersionId: form.productVersionId || null,
        premiumAmount: parseAmount(form.premium),
        billingCycle: form.payFreq === "Semi-annual" ? "Semi-Annual" : "Annual",
        status: "Onboarding",
        primaryContactId: resolvedClientId,
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
        clientId: resolvedClientId,
        productVersionId: form.productVersionId || null,
        planOptionId: form.planOptionId || null,
        destination: form.destination || null,
        departureDate: form.departure || null,
        returnDate: form.returnDate || null,
        travelerCount: form.travelers.filter((traveler) => traveler.name.trim()).length,
        travelPurpose: form.travelPurpose || null,
        itinerary: form.itinerary || null,
        applicantIsTraveler: form.applicantIsTraveler,
        quotedPremium: parseAmount(form.premium),
        status: "Awaiting Payment",
        notes: form.internalNote || null,
        paymentChannelId: form.paymentChannelId || null,
        portalPaymentStatus: form.portalPaymentStatus,
        portalPaymentReference: form.portalPaymentReference || null,
        portalPaymentAmount: parseAmount(form.portalPaymentAmount),
        portalProcessingStatus: form.portalProcessingStatus,
        ...(await (async () => {
          const match = await matchCarrierForm(form, "All Ages");
          return { carrierFormLibraryId: match.document?.id ?? null, carrierFormAgeBand: "All Ages", carrierFormMatchStatus: match.document ? "Matched" : "Unavailable" };
        })()),
      });
      const validTravelers = form.travelers.filter((traveler) => traveler.name.trim());
      await getCarrierWorkflowsRepository().replaceTravelers(travel.id, validTravelers.map((traveler) => ({
        fullName: traveler.name, dateOfBirth: traveler.dob || null, nationality: traveler.nationality || null,
        gender: traveler.gender || null, contactNumber: traveler.contact || null,
        idType: traveler.idType || null, idNumber: traveler.idNumber || null,
        planOptionId: traveler.planOptionId || form.planOptionId || null,
        beneficiaryName: traveler.beneficiaryName || null, beneficiaryBirthdate: traveler.beneficiaryDob || null,
        beneficiaryRelation: traveler.beneficiaryRelationship || null, beneficiaryContact: traveler.beneficiaryContact || null,
      })));
      await getCarrierWorkflowsRepository().replaceTravelRequirements(travel.id, [
        { documentName: "Completed Travel application form", appliesTo: validTravelers.map((traveler) => traveler.name).join(", "), isRequired: true, sortOrder: 10 },
        ...validTravelers.map((traveler, index) => ({ documentName: traveler.idType === "Government-issued ID" ? "Valid government-issued ID" : "Passport copy", appliesTo: traveler.name, isRequired: true, sortOrder: 20 + index * 10 })),
        { documentName: "Payment proof", appliesTo: "Client collection", isRequired: true, sortOrder: 500 },
        { documentName: "Issued Travel policy", appliesTo: "After portal issuance", isRequired: false, sortOrder: 510 },
      ]);
      const premium = parseAmount(form.premium);
      if (premium && !(await getPaymentsRepository().listByTravelRequest(travel.id)).length) {
        await getPaymentsRepository().create({ clientId: resolvedClientId, travelRequestId: travel.id, amount: premium, status: "Awaiting", notes: "Travel collection created by application workflow" });
      }
      if (resumingDraft && form.draftApplicationId) await applicationsRepo.delete(form.draftApplicationId);
      await recordActivity({
        scopeType: "client",
        scopeId: resolvedClientId,
        activityType: "travel.quoted",
        summary: `Travel request created — ${travel.referenceNo ?? ""} ${form.destination ?? ""}`.trim(),
        actorId: actor.id,
      });
      result.travelRequestId = travel.id;
      result.summary = `${clientName} — travel request ${travel.referenceNo ?? ""} · Awaiting Payment.${travel.carrierFormMatchStatus === "Unavailable" ? " Approved Travel application form unavailable; record creation continued." : ""}`;
    } else if (!resumingDraft) {
      const application = await applicationsRepo.create({
        clientId: resolvedClientId,
        productVersionId: form.productVersionId || null,
        planOptionId: form.planOptionId || null,
        applicationType,
        status: mode === "draft" ? "Lead" : form.status || "Applicant",
        assignedUserId: form.assignedUserId || actor.id,
        dateStarted: new Date().toISOString().slice(0, 10),
        notes: form.internalNote || form.notes || null,
        wizardState: mode === "draft" ? (form as unknown as Json) : null,
        coverageType: form.coverage || null,
        desiredStartDate: form.startDate || null,
        preferredPaymentMode: form.payFreq || null,
        estimatedPremium: parseAmount(form.premium),
        remoteSale: form.remoteSale,
        preExistingStatus: form.preExisting || null,
        medicalNotes: form.medicalNotes || null,
      });
      const unavailable = mode !== "draft" && form.category === "health"
        ? await persistHealthWorkflow(application.id, resolvedClientId, form)
        : 0;
      if (mode !== "draft" && form.category !== "health") await snapshotApplicationRequirements(application.id, application.productVersionId ?? null, form);
      await recordActivity({
        scopeType: "client",
        scopeId: resolvedClientId,
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
          : `${clientName} — ${form.productName || "application"} · status ${application.status}.${unavailable ? ` ${unavailable} approved carrier form${unavailable === 1 ? " is" : "s are"} unavailable.` : ""}`;
    }

    /* ---------- 3. follow-up task ---------- */
    if (form.createTask && mode !== "draft") {
      await getTasksRepository().create({
        title: `Follow up ${form.category === "hmo" ? form.companyName || clientName : clientName} — ${form.productName || "application"}`,
        tag: form.category === "travel" ? "Travel" : "Application",
        clientId: resolvedClientId,
        assignedUserId: form.assignedUserId || actor.id,
        dueDate: form.followDate ? form.followDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        priority: form.priority === "Urgent" ? "High" : "Normal",
      });
    }

    /* ---------- 4. initial email ---------- */
    const sendingEmail = mode === "email" || (form.sendEmail && mode !== "draft");
    if (sendingEmail && (form.emailRecipient || form.email)) {
      await logOutboundEmail({ clientId: resolvedClientId, subject: form.emailSubject || `Your ${form.productName || "insurance"} application`, summary: form.emailBody.split("\n").find(Boolean) ?? "", notes: form.emailBody || null, actorId: actor.id });
      result.summary += ` “${form.emailTemplate || "Initial email"}” logged (not delivered).`;
    }
    if (mode === "docs") {
      const items = form.checklist.filter((c) => !c.checked).length;
      await recordActivity({
        scopeType: "client",
        scopeId: resolvedClientId,
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
    revalidatePath(`/clients/${resolvedClientId}`);
    if (result.groupId) revalidatePath(`/group/${result.groupId}`);
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create the application." };
  }
}
