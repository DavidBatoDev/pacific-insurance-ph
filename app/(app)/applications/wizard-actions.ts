"use server";

import { revalidatePath } from "next/cache";

import {
  APPLICATION_STARTED_STAGE,
  CONVERT_READY_STAGE,
  canConvertLead,
  stagesSkippedByConvert,
} from "@/components/hub/lead-config";
import { getActor, type ActionResult } from "@/lib/actions/context";
import { recordActivity } from "@/lib/activity/log";
import { recordAudit } from "@/lib/audit/log";
import { can, toAppRole } from "@/lib/auth/permissions";
import { getApplicationsRepository } from "@/lib/repositories/applications";
import { getApplicationRequirementsRepository, type NewApplicationRequirement, type RequirementPhase } from "@/lib/repositories/application-requirements";
import { getClientsRepository, type Client, type ClientUpdate } from "@/lib/repositories/clients";
import { getCarrierWorkflowsRepository } from "@/lib/repositories/carrier-workflows";
import { getDocumentLibraryRepository, type LibraryDocument } from "@/lib/repositories/document-library";
import { getExternalCoverageRepository, type ExternalCoverageType } from "@/lib/repositories/external-coverage";
import { getGroupsRepository } from "@/lib/repositories/groups";
import { getTasksRepository } from "@/lib/repositories/tasks";
import { getTravelRepository } from "@/lib/repositories/travel";
import { getPaymentsRepository } from "@/lib/repositories/payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { logOutboundEmail } from "@/lib/communications/log-outbound-email";
import type { WizardForm } from "@/components/hub/overlays/wizard/wizard-data";
import { ageFromDob, beneficiaryIdDocumentFor, categoryForProduct, emptyWizardForm, initialiseFamilySizeSuggestion, isFlexiShieldProduct, medicalDocumentsFor, parseAmount, uniquePlanPreferenceMatch } from "@/components/hub/overlays/wizard/wizard-data";

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
  | "productVersionId"
  | "familySize"
  | "coverageTier";

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
const clientChannels = new Set(["Gmail", "Phone", "Viber", "WhatsApp", "iMessage", "In-Person", "Other"]);
const clientChannel = (value: string | null | undefined) => {
  const normalized = value === "Email" ? "Gmail" : value;
  return normalized && clientChannels.has(normalized) ? normalized : null;
};
const isWizardState = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const clientFamilySize = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

/**
 * The product-agnostic application checklist seeded by `0024_application_requirements.sql`.
 *
 * Named explicitly wherever it is looked up, because `required_document_templates` has no column
 * separating application templates from claim templates: G8's two Medical NOC checklists live in
 * the same table, also Active and also with a null `product_version_id`. "The first Active template
 * with no product" is therefore no longer a unique description.
 */
const BASELINE_TEMPLATE_NAME = "Standard new-business baseline";

/** Copy the current configurable template into an immutable application checklist. */
async function snapshotApplicationRequirements(applicationId: string, productVersionId: string | null, form?: WizardForm) {
  const requirements = getApplicationRequirementsRepository();
  if ((await requirements.listByApplication(applicationId)).length > 0) return;

  if (form?.category === "health") {
    const principal = form.displayName || [form.firstName, form.lastName].filter(Boolean).join(" ") || "Principal applicant";
    const people = [
      { name: principal, dob: form.dob, preExisting: form.preExisting, smokerStatus: form.smokerStatus, heightInches: form.heightInches, weightLbs: form.weightLbs, beneficiaryName: form.beneficiaryName },
      ...form.healthDependents.map((item) => ({ name: item.name, dob: item.dob, preExisting: item.preExisting ?? "Unknown", smokerStatus: item.smokerStatus, heightInches: item.heightInches, weightLbs: item.weightLbs, beneficiaryName: item.beneficiaryName })),
    ].filter((item) => item.name.trim());
    const items: Omit<NewApplicationRequirement, "applicationId">[] = people.flatMap((person, index) => {
      const age = ageFromDob(person.dob);
      const senior = typeof age === "number" && age >= 71;
      const base: Omit<NewApplicationRequirement, "applicationId">[] = [
        { documentName: senior ? "Completed age 71–100 application form" : "Completed regular application form", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 10 },
        { documentName: "Valid government-issued ID", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 20 },
      ];
      // Pacific Cross wants an ID for the beneficiary as well as the insured. Per person: the
      // carrier form gives the principal and each dependent their own beneficiary block (G4).
      const beneficiaryId = beneficiaryIdDocumentFor(person.beneficiaryName);
      if (beneficiaryId) base.push({ documentName: beneficiaryId, appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 25 });
      // Pacific Cross wants the attestation *or* the advisor's declaration, never both:
      // attestation if the sale was face-to-face, declaration if it was remote. The
      // attestation is per insured person; the declaration is one per submission and is
      // pushed once, below.
      if (!form.remoteSale) base.push({ documentName: "Attestation letter with specimen signatures", appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 30 });
      // Conditional medical panels — smoker, BMI and Obese Class 1 as well as the age/pre-existing
      // triggers. Shared with the wizard's client-side preview so the two cannot drift (G3).
      medicalDocumentsFor(person).forEach((documentName, offset) => {
        base.push({ documentName, appliesTo: person.name, isRequired: true, sortOrder: index * 100 + 40 + offset });
      });
      return base;
    });
    if (form.remoteSale) {
      items.push({ documentName: "Advisor's Declaration", appliesTo: "Remote or online sale", isRequired: true, sortOrder: 900 });
    }
    // FlexiShield is a second-layer product: Pacific Cross evidences the first layer instead of
    // requesting the TAL/CAC conforme, which apply only to Select/Blue Royale (G6). Both documents
    // are issued by the *other* HMO, so the client supplies them and there is correctly no
    // library template to attach.
    if (isFlexiShieldProduct(form.productName)) {
      items.push(
        { documentName: "Schedule of Benefits of the first-layer HMO", appliesTo: "Supplied by the client — issued by the first-layer HMO", isRequired: true, sortOrder: 920 },
        { documentName: "Certificate of Coverage of the first-layer HMO (full maximum benefit limit and expiry date)", appliesTo: "Supplied by the client — issued by the first-layer HMO", isRequired: true, sortOrder: 930 },
      );
    } else {
      items.push(
        { documentName: "Treatment Area Limitation (TAL) conforme", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 920 },
        { documentName: "Client Application for Coverage (CAC)", appliesTo: "Only when requested after underwriting", isRequired: false, sortOrder: 930 },
      );
    }
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
  // Anchored by name rather than "the first Active template with no product". This query has no
  // ordering, and since G8 there are three rows matching that looser description, two of which are
  // claim checklists — an unanchored lookup could hand an application the Medical NOC list. Not
  // reachable through the wizard today (the Create gate requires a product), but it would fail
  // silently if it ever were, so close it rather than depend on that.
  else templateQuery = templateQuery.is("product_version_id", null).eq("template_name", BASELINE_TEMPLATE_NAME);
  let { data: template, error } = await templateQuery.maybeSingle();
  if (error) throw new Error(error.message);

  if (!template && productVersionId) {
    const fallback = await db
      .from("required_document_templates")
      .select("id")
      .eq("status", "Active")
      .is("product_version_id", null)
      .eq("template_name", BASELINE_TEMPLATE_NAME)
      .maybeSingle();
    template = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  if (!template) return;

  const { data: items, error: itemsError } = await db
    .from("required_document_items")
    .select("id, document_name, is_required, applies_to, notes, sort_order, sale_channel, phase")
    .eq("requirement_template_id", template.id)
    .order("sort_order");
  if (itemsError) throw new Error(itemsError.message);

  // Same attestation-or-declaration rule as the health branch above. `form` is
  // optional here, so fall back to the persisted flag; if neither is available,
  // copy every item rather than guessing a channel and dropping a real requirement.
  let remoteSale = form?.remoteSale;
  if (remoteSale === undefined) {
    const { data: application } = await db.from("applications").select("remote_sale").eq("id", applicationId).maybeSingle();
    remoteSale = application?.remote_sale ?? undefined;
  }
  const channel = remoteSale === undefined ? null : remoteSale ? "Remote" : "Face-to-face";
  const applicable = (items ?? []).filter((item) => !channel || !item.sale_channel || item.sale_channel === channel);

  await requirements.createMany(applicable.map((item) => ({
    applicationId,
    requiredDocumentItemId: item.id,
    documentName: item.document_name,
    isRequired: item.is_required,
    appliesTo: item.applies_to,
    notes: item.notes,
    sortOrder: item.sort_order,
    // Carried through so the second gate stays visible-but-not-outstanding until it is
    // activated. Post-agreement items arrive is_required=false from the template (G9).
    phase: item.phase as RequirementPhase | null,
  })));
}

const ageBandFor = (dob: string): "0-70" | "71-100" => {
  const age = ageFromDob(dob);
  return typeof age === "number" && age >= 71 ? "71-100" : "0-70";
};

async function matchCarrierForm(form: WizardForm, ageBand: "0-70" | "71-100" | "All Ages") {
  const variant = isFlexiShieldProduct(form.productName) ? "FlexiShield" : null;
  const docs = await getDocumentLibraryRepository().listEligible({
    productName: form.productName,
    productVersionId: form.productVersionId || undefined,
    documentType: "Application Form",
    ageBand,
    variant,
  });
  return { variant, document: docs[0] ?? null };
}

/* ------------- Step 5 initial email — carrier-attachment gate ------------- */
/**
 * Step 5 composes an email that isn't logged until Create, so it can't go through
 * `sendEmailAction` (`clients/engage-actions.ts`) the way every send-now composer does — and until
 * now it therefore skipped that action's attachment requirement entirely, which is what let
 * `Send brochure` be logged from the wizard with nothing attached.
 *
 * The gate is re-implemented here against *form* values rather than a client record, because the
 * contact may not exist until `createFromWizardAction` creates it. Eligibility resolution below is
 * kept deliberately identical to `resolveEligibleLibraryDocuments` in `engage-actions.ts` so the
 * wizard and the Contact Profile composer never disagree about what may be attached.
 */

type RequiredLibraryType = "Brochure" | "Application Form";

/** Canonical twin: `attachmentRequirement` in `app/(app)/clients/engage-actions.ts` (not exported). */
function wizardAttachmentRequirement(templateName: string): RequiredLibraryType | null {
  if (templateName === "Send brochure") return "Brochure";
  if (templateName === "Send application form") return "Application Form";
  return null;
}

async function resolveWizardAttachments(
  documentType: RequiredLibraryType,
  productName: string,
  dob: string,
): Promise<{ documents: LibraryDocument[]; reason: string | null }> {
  if (!productName.trim())
    return { documents: [], reason: "Select a product in Step 1 before choosing a carrier asset." };
  let ageBand: "All Ages" | "0-70" | "71-100" = "All Ages";
  if (documentType === "Application Form") {
    if (!dob) return { documents: [], reason: "Add the applicant’s date of birth in Step 2 before selecting an application form." };
    const age = ageFromDob(dob);
    // Bounds-checked rather than reusing `ageBandFor`, which folds any age over 100 into `71-100`;
    // `engage-actions.ts` refuses it, and the two surfaces must agree on what is eligible.
    if (age === "" || age > 100) return { documents: [], reason: "No supported application-form age band matches this applicant." };
    ageBand = age <= 70 ? "0-70" : "71-100";
  }
  // Only product + type + age band — no `productVersionId` / `variant` narrowing, unlike
  // `matchCarrierForm` above, which picks the application's own carrier forms. This list must match
  // what the Contact Profile composer offers for the same person and product.
  const documents = await getDocumentLibraryRepository().listEligible({ productName, documentType, ageBand });
  return {
    documents,
    reason: documents.length ? null : `No active, approved ${documentType.toLowerCase()} matches ${productName}${documentType === "Application Form" ? ` · ${ageBand}` : ""}.`,
  };
}

/** Feeds Step 5's carrier-attachment picker. Mirrors `listEligibleLibraryDocumentsAction`. */
export async function listWizardEmailAttachmentsAction(input: {
  templateName: string;
  productName: string;
  dob: string;
}): Promise<ActionResult<{ documents: LibraryDocument[]; reason: string | null }>> {
  try {
    const actor = await getActor();
    if (!can(toAppRole(actor.role), "documentLibrary", "view"))
      return { ok: false, error: "Carrier attachments are available to Admin and Staff only." };
    const requirement = wizardAttachmentRequirement(input.templateName);
    if (!requirement) return { ok: true, data: { documents: [], reason: null } };
    return { ok: true, data: await resolveWizardAttachments(requirement, input.productName, input.dob) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn’t load library assets." };
  }
}

async function persistHealthWorkflow(applicationId: string, clientId: string, form: WizardForm) {
  const workflows = getCarrierWorkflowsRepository();
  const dependents = await workflows.saveApplicationDependents(applicationId, clientId, form.healthDependents.map((person) => ({
    id: person.id, name: person.name, dateOfBirth: person.dob || null, relationship: person.rel || null,
    email: person.email || null, preExistingStatus: person.preExisting || "Unknown", medicalNotes: person.medicalNotes || null,
    smokerStatus: person.smokerStatus || null, heightInches: parseAmount(person.heightInches ?? ""), weightLbs: parseAmount(person.weightLbs ?? ""),
    beneficiaryName: person.beneficiaryName || null, beneficiaryBirthdate: person.beneficiaryBirthDate || null,
    beneficiaryRelation: person.beneficiaryRelationship || null, beneficiaryContact: person.beneficiaryContact || null,
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
  await persistFirstLayerCoverage(clientId, form);
  return assignments.filter((item) => item.matchStatus === "Unavailable").length;
}

/**
 * Record the first-layer plan a second-layer product sits on top of (G5).
 *
 * Written against the client rather than the application: the cover belongs to the client and
 * outlives any one application, which is also why `external_coverage` keys on `client_id` with a
 * nullable `policy_id` — the policy does not exist yet at application time.
 * `policies.first_layer_coverage_id` closes that link once one is issued.
 *
 * Only for FlexiShield, and only when something was actually entered: the fields are optional in the
 * wizard because staff often take the MBL off the Certificate of Coverage after the client sends it,
 * and an empty shell row would be worse than no row.
 *
 * Updates the existing Active row rather than stacking a second one — a client re-applying should
 * correct their declared cover, not accumulate copies of it.
 */
async function persistFirstLayerCoverage(clientId: string, form: WizardForm) {
  if (!isFlexiShieldProduct(form.productName)) return;
  const mbl = parseAmount(form.firstLayerMbl);
  const declared =
    form.firstLayerProvider.trim() ||
    form.firstLayerPlan.trim() ||
    form.firstLayerEffective ||
    form.firstLayerExpiry ||
    mbl != null;
  if (!declared) return;

  const coverages = getExternalCoverageRepository();
  const patch = {
    coverageType: (form.firstLayerType || "HMO") as ExternalCoverageType,
    providerName: form.firstLayerProvider.trim() || null,
    planName: form.firstLayerPlan.trim() || null,
    maximumBenefitLimit: mbl,
    effectiveDate: form.firstLayerEffective || null,
    expiryDate: form.firstLayerExpiry || null,
  };
  const existing = (await coverages.listByClient(clientId)).find((item) => item.status === "Active");
  if (existing) await coverages.update(existing.id, patch);
  else await coverages.create({ clientId, ...patch });
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
      .select("id, product:products (name, category), plan_options (id, plan_name, coverage_tier)")
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

    const form = initialiseFamilySizeSuggestion({
      ...emptyWizardForm(),
      ...saved,
      schemaVersion: 3,
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
      familySize: resolveDefault("familySize", client.familySize != null ? String(client.familySize) : ""),
      coverageTier: resolveDefault("coverageTier", client.coverageTier ?? ""),
      productVersionId: resolveDefault("productVersionId", uniqueProduct?.id ?? ""),
      productName: hasSavedValue(saved.productName) ? saved.productName! : uniqueProduct?.name ?? "",
      category: hasSavedValue(saved.category)
        ? (saved.productName && /flexishield/i.test(saved.productName) ? "health" : saved.category!)
        : uniqueProduct ? categoryForProduct(uniqueProduct.name, (matches[0]?.product as { category?: string | null } | null)?.category) : "",
    } satisfies WizardForm);
    if (!form.planOptionId && form.coverageTier && uniqueProduct) {
      const row = matches[0] as typeof matches[number] & {
        plan_options: { id: string; plan_name: string; coverage_tier: string | null }[];
      };
      const preferredPlan = uniquePlanPreferenceMatch(
        form.coverageTier,
        (row.plan_options ?? []).map((plan) => ({
          id: plan.id,
          name: plan.plan_name,
          coverageTier: plan.coverage_tier,
        })),
      );
      if (preferredPlan) form.planOptionId = preferredPlan.id;
    }
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
 * Create everything Step 6's "This will automatically create" list
 * promises: the client (new record,
 * existing link, or lead conversion — same record, never a duplicate), the
 * application / travel request / group account, the follow-up task, the
 * optional initial email, and the timeline entries.
 */
export async function createFromWizardAction(
  form: WizardForm,
  mode: WizardMode,
  options?: { confirmedSkip?: boolean },
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

  /**
   * Whether this save actually starts an application. A draft has started nothing — it is a parked
   * wizard, resumable later — and an inquiry-only application is not one either (the
   * wizard derives `status = "Lead"` for it). Everything that takes a contact off the lead board
   * hangs off this.
   */
  const startsApplication = mode !== "draft" && form.status !== "Lead";

  /**
   * Whether Step 5's composed email actually gets logged by this save. `mode === "email"` sends
   * regardless of the toggle; a draft never sends, which is why a draft is never gated below.
   */
  const sendingEmail = mode === "email" || (form.sendEmail && mode !== "draft");
  const loggingEmail = sendingEmail && !!(form.emailRecipient || form.email);

  /* ---------- 0. carrier-attachment pre-flight ---------- */
  // Runs before the `try` and before any write: the wizard creates a client, an application, a
  // checklist and a task in one pass, so refusing here is the only way a rejected email doesn't
  // leave a half-built application behind. Step 5's picker is where the user satisfies it.
  if (loggingEmail) {
    const requirement = wizardAttachmentRequirement(form.emailTemplate);
    const attachmentId = form.emailLibraryDocumentId?.trim() ?? "";
    if (requirement) {
      if (!can(toAppRole(actor.role), "documentLibrary", "view"))
        return { ok: false, error: "Carrier attachments are available to Admin and Staff only." };
      const eligible = await resolveWizardAttachments(requirement, form.productName, form.dob);
      if (eligible.reason) return { ok: false, error: eligible.reason };
      if (!attachmentId || !eligible.documents.some((doc) => doc.id === attachmentId))
        return { ok: false, error: `Choose the approved ${requirement.toLowerCase()} matched to this application in Step 5.` };
    } else if (attachmentId) {
      return { ok: false, error: "This email template does not accept carrier-library attachments yet." };
    }
  }

  try {
    /* ---------- 1. resolve the contact record ---------- */
    let clientId: string | null = null;
    let clientName = "";
    let resumingDraft = false;
    /**
     * The contact this save is about, when it is still sitting on the lead board. A draft leaves it
     * alone; a completing save hands it off to Applicant in step 1b.
     */
    let leadAwaitingHandOff: Client | null = null;
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
        preferredChannel: clientChannel(form.channels[0]),
        leadSource: form.source || null,
        assignedUserId: form.assignedUserId || actor.id,
        notes: form.notes || null,
        productInterest: form.productName || null,
        estPremium: parseAmount(form.premium),
        familySize: clientFamilySize(form.familySize),
        coverageTier: form.coverageTier.trim() || null,
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
      // The draft that opened this wizard never converted the contact, so finishing it is what
      // does. Re-saving it as a draft still leaves the record on the lead board.
      if (existingClient.lifecycleStage === "Lead") leadAwaitingHandOff = existingClient;
    }

    if (!resumingDraft && form.convertClientId) {
      // Convert-from-lead: the SAME record is used, but nothing about it changes yet — the flip to
      // Applicant happens in step 1b, and only for a completing save.
      const lead = await clientsRepo.findById(form.convertClientId);
      if (!lead) return { ok: false, error: "The lead being converted no longer exists." };
      // Converting is the Product-Selected payoff (docs/lead-stage-status-example.md Step 5). The
      // check runs for every mode, draft included: a draft saved here is resumable later without
      // re-confirming, so an unauthorised entry must be refused at the door rather than parked.
      if (!canConvertLead(lead.leadStage) && !options?.confirmedSkip)
        return {
          ok: false,
          error: `Advance ${lead.fullName} to ${CONVERT_READY_STAGE} before converting to an application.`,
        };
      clientId = lead.id;
      clientName = lead.fullName;
      await clientsRepo.update(lead.id, {
        familySize: clientFamilySize(form.familySize),
        coverageTier: form.coverageTier.trim() || null,
      });
      if (lead.lifecycleStage === "Lead") leadAwaitingHandOff = lead;
    } else if (!resumingDraft && form.clientMode === "existing" && form.existingClientId) {
      const existing = await clientsRepo.findById(form.existingClientId);
      if (!existing) return { ok: false, error: "The selected client record no longer exists." };
      clientId = existing.id;
      clientName = existing.fullName;
      const discoveryPatch: ClientUpdate = {};
      if (form.familySize.trim()) discoveryPatch.familySize = clientFamilySize(form.familySize);
      if (form.coverageTier.trim()) discoveryPatch.coverageTier = form.coverageTier.trim();
      if (Object.keys(discoveryPatch).length) await clientsRepo.update(existing.id, discoveryPatch);
      // Picking a lead out of the client search is the same hand-off as the Convert button, so it
      // has to leave the board too — otherwise a lead ends up with a live application on it.
      if (existing.lifecycleStage === "Lead") leadAwaitingHandOff = existing;
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
        lifecycleStage: startsApplication ? "Applicant" : "Lead",
        ...(startsApplication
          ? {}
          : { leadStage: mode === "draft" ? APPLICATION_STARTED_STAGE : "New Lead", leadStatus: "New" }),
        leadSource: form.source || null,
        assignedUserId: form.assignedUserId || actor.id,
        address: form.address || null,
        preferredChannel: clientChannel(form.channels[0]),
        notes: form.notes || null,
        familySize: clientFamilySize(form.familySize),
        coverageTier: form.coverageTier.trim() || null,
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
        preferredChannel: clientChannel(form.channels[0]),
        clientType: "Prospect",
        // A draft stays a Lead even when step 6 already names an Applicant status: that status
        // describes the application being drafted, not a submission that has happened. The record
        // is handed off in step 1b when the wizard is actually completed.
        lifecycleStage: startsApplication ? "Applicant" : "Lead",
        // A draft saved for a brand-new walk-in lands in `Application Started` too — the column
        // means "a draft is waiting to be finished", and leaving them at `New Lead` would hide
        // real work behind a label that says nobody has touched it.
        leadStage: startsApplication
          ? "Converted"
          : mode === "draft"
            ? APPLICATION_STARTED_STAGE
            : "New Lead",
        leadStatus: startsApplication ? null : "New",
        productInterest: form.productName || null,
        estPremium: parseAmount(form.premium),
        familySize: clientFamilySize(form.familySize),
        coverageTier: form.coverageTier.trim() || null,
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

    /* ---------- 1b. lead stage / applicant hand-off ---------- */
    // Two different moments, two different consequences (docs/lead-stage-status-example.md Steps
    // 6-7): `Save as Draft` moves the STAGE to `Application Started` and the contact stays a Lead
    // on the board; only a completing save moves the LIFECYCLE and hands the record to the
    // Applicant track. Opening the wizard on its own writes neither.
    if (leadAwaitingHandOff && startsApplication) {
      const skippedStages = stagesSkippedByConvert(leadAwaitingHandOff.leadStage);
      await clientsRepo.update(leadAwaitingHandOff.id, {
        lifecycleStage: "Applicant",
        leadStage: "Converted",
        clientType: form.category === "hmo" ? "Corporate Contact" : leadAwaitingHandOff.clientType,
      });
      await recordActivity({
        scopeType: "client",
        scopeId: leadAwaitingHandOff.id,
        activityType: "lead.converted",
        summary:
          `Converted to Applicant — application started (${form.productName || "product"})` +
          // A shortcut past the pipeline should be reviewable later, not invisible.
          (skippedStages.length ? ` — skipped ${skippedStages.join(", ")}` : ""),
        actorId: actor.id,
      });
    } else if (
      leadAwaitingHandOff &&
      leadAwaitingHandOff.leadStage !== APPLICATION_STARTED_STAGE
    ) {
      // Any save that produced an application without converting — a draft, or a completed
      // an inquiry-only type — IS the `Application Started` milestone. The card stays on the board;
      // it just moves to the column that says the paperwork is underway. Re-saving is a no-op.
      //
      // This deliberately covers the completing-but-non-converting case as well as drafts. Without
      // it that save attaches a live application to a lead and changes nothing visible about it —
      // no stage move, no timeline entry — which is exactly the silent state the board is meant to
      // rule out (`docs/lead-stage-status-example.md` Steps 6-7: nothing moves silently).
      const previousStage = leadAwaitingHandOff.leadStage;
      await clientsRepo.update(leadAwaitingHandOff.id, { leadStage: APPLICATION_STARTED_STAGE });
      await recordActivity({
        scopeType: "client",
        scopeId: leadAwaitingHandOff.id,
        activityType: "lead.stage_changed",
        summary:
          `Stage changed — ${previousStage ?? "—"} → ${APPLICATION_STARTED_STAGE} ` +
          (mode === "draft" ? "(application draft saved)" : `(${form.appType || "application"} created — still a Lead)`),
        actorId: actor.id,
      });
    }

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

    /**
     * Persist the shared Application record for every non-Travel wizard branch.
     *
     * Group HMO used to skip this entirely on a fresh completed save because its operational
     * Group Account branch was mutually exclusive with the generic Application branch below.
     * Draft-resume happened to work because it updated the draft before entering that branch.
     * Keeping creation in one helper makes fresh and draft-backed BC Flexi submissions converge on
     * the same Application + immutable requirement-snapshot contract (G9).
     */
    const createApplicationRecord = async () => {
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
        smokerStatus: form.smokerStatus || null,
        heightInches: parseAmount(form.heightInches),
        weightLbs: parseAmount(form.weightLbs),
        beneficiaryName: form.beneficiaryName || null,
        beneficiaryBirthdate: form.beneficiaryBirthDate || null,
        beneficiaryRelation: form.beneficiaryRelationship || null,
        beneficiaryContact: form.beneficiaryContact || null,
        preExistingStatus: form.preExisting || null,
        medicalNotes: form.medicalNotes || null,
      });
      const unavailable = mode !== "draft" && form.category === "health"
        ? await persistHealthWorkflow(application.id, resolvedClientId, form)
        : 0;
      if (mode !== "draft" && form.category !== "health") {
        await snapshotApplicationRequirements(application.id, application.productVersionId ?? null, form);
      }
      await recordActivity({
        scopeType: "client",
        scopeId: resolvedClientId,
        activityType: mode === "draft" ? "application.draft_saved" : "application.created",
        summary:
          mode === "draft"
            ? `Application draft saved — ${application.referenceNo ?? ""} (${form.productName || "product"}) · contact stays a Lead`
            : `Application created — ${application.referenceNo ?? ""} (${form.productName || "product"}) · status ${application.status}`,
        actorId: actor.id,
      });
      await recordAudit({
        actorId: actor.id,
        action: mode === "draft" ? "create_draft" : "create",
        tableName: "applications",
        recordId: application.id,
        newValue: application as unknown as Json,
      });
      result.applicationId = application.id;
      result.summary =
        mode === "draft"
          ? `${clientName} saved as a draft — no messages sent.`
          : `${clientName} — ${form.productName || "application"} · status ${application.status}.${unavailable ? ` ${unavailable} approved carrier form${unavailable === 1 ? " is" : "s are"} unavailable.` : ""}`;
      return application;
    };

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
        smokerStatus: form.smokerStatus || null,
        heightInches: parseAmount(form.heightInches),
        weightLbs: parseAmount(form.weightLbs),
        beneficiaryName: form.beneficiaryName || null,
        beneficiaryBirthdate: form.beneficiaryBirthDate || null,
        beneficiaryRelation: form.beneficiaryRelationship || null,
        beneficiaryContact: form.beneficiaryContact || null,
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
      // A Group Account is the operational company/roster view, while the Application is the
      // workflow record shown in /applications and the parent of the phased requirements. A fresh
      // Group HMO submission needs both; a resumed draft already updated its Application above.
      if (!resumingDraft) await createApplicationRecord();
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
          lastName: m.lastName || null,
          firstName: m.firstName || null,
          middleInitial: m.middleInitial || null,
          gender: m.gender || null,
          civilStatus: m.civilStatus || null,
          nationality: m.nationality || null,
          birthDate: m.dob || null,
          placeOfBirth: m.placeOfBirth || null,
          effectiveDate: m.effectiveDate || null,
          occupationGrade: m.occupationGrade || null,
          roomAndBoardPlan: m.roomAndBoardPlan || null,
          maximumBenefitLimit: parseAmount(m.maximumBenefitLimit || ""),
          philhealthMember: m.philhealthMember === "Yes" ? true : m.philhealthMember === "No" ? false : null,
          address: m.address || null,
          email: m.email || null,
          mobileNumber: m.mobileNumber || null,
          landlineNumber: m.landlineNumber || null,
          beneficiaryName: m.beneficiaryName || null,
          beneficiaryBirthDate: m.beneficiaryBirthDate || null,
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
    } else if (!resumingDraft) await createApplicationRecord();

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
    // Validated in step 0 above; `logOutboundEmail` links the chosen carrier asset to the
    // communication and rolls its own row back if that link fails.
    if (loggingEmail) {
      const attachmentIds = form.emailLibraryDocumentId?.trim() ? [form.emailLibraryDocumentId.trim()] : [];
      await logOutboundEmail({ clientId: resolvedClientId, subject: form.emailSubject || `Your ${form.productName || "insurance"} application`, summary: form.emailBody.split("\n").find(Boolean) ?? "", notes: form.emailBody || null, actorId: actor.id, libraryDocumentIds: attachmentIds });
      result.summary += ` “${form.emailTemplate || "Initial email"}” logged (not delivered)${attachmentIds.length ? " with its carrier attachment" : ""}.`;
    }
    // Travel lives in its own lane: it already persists travel requirements
    // (replaceTravelRequirements) and logs a `travel.quoted` activity, so the generic
    // application document-checklist entry would be redundant and misleading here.
    if (mode === "docs" && form.category !== "travel") {
      // Conditional and post-agreement BC Flexi rows are visible in the wizard, but are not
      // outstanding yet. Keep this summary aligned with the persisted requirement gate.
      const items = form.checklist.filter((c) => c.isRequired !== false && !c.checked).length;
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
