"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type SetStateAction } from "react";

import {
  createFromWizardAction,
  getDraftResumeAction,
  getClientOpenWorkAction,
  getTravelClientFillAction,
  type ClientOpenWork,
  type AutoFilledWizardField,
  type DraftResumePayload,
  type WizardMode,
  listProductRequirementPreviewAction,
} from "@/app/(app)/applications/wizard-actions";
import { attachRequirementSelection } from "@/components/documents/requirement-attachment-client";
import type { RequirementAttachmentSelection, RequirementTarget } from "@/lib/documents/requirement-attachment.types";
import { listProductOptionsAction, type ProductOption } from "@/app/(app)/policies/actions";
import { listPaymentChannelOptionsAction } from "@/app/(app)/payments/actions";
import { listAssignableUsersAction, type AssignableUser } from "@/app/(app)/tasks/actions";
import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { usePersona } from "../../persona";
import { BrandGlyph } from "../../shell";
import { Btn } from "../../primitives";
import { useOverlays } from "../overlay-provider";
import { openPortalWindow } from "../portal-window";
import { Step1, Step2 } from "./steps-1";
import { Step3, Step4, Step5, Step6 } from "./steps-2";
import { OpenWorkDialog } from "./open-work-dialog";
import { TravelRequirementUploads } from "./travel-details-step";
import { healthWizardRequirements, travelWizardRequirements, requirementSelectionScope, withRequirementPersonKeys, wizardRequirementPreview } from "./wizard-requirements";
import {
  emptyWizardForm,
  initialiseFamilySizeSuggestion,
  categoryForProduct,
  INQUIRY_APP_TYPE,
  isInquiryAppType,
  normaliseAppType,
  parseAmount,
  uniquePlanPreferenceMatch,
  WIZ_STEPS,
  WIZ_TRAVEL_STEPS,
  type ChecklistItem,
  type WizardForm,
} from "./wizard-data";

/**
 * New Client Application — the 6-step wizard overlay (see
 * web/new-application-wizard.md). Adapts to the product
 * category (Health / Group HMO / Travel); the split Create button fans into
 * create / create & request documents / save draft. Step 5's email is never sent on create: it
 * opens afterwards in the shared composer for explicit review and Send.
 */

export interface WizardPrefill {
  convertClientId?: string;
  convertClientName?: string;
  productInterest?: string | null;
  email?: string | null;
  dob?: string | null;
  familySize?: number | null;
  coverageTier?: string | null;
  /** H2a: the lead's payment frequency from Generate Proposal (Annual / Semi-annual). */
  paymentFrequency?: string | null;
  /* Display-only, for Step 2's read-only "Lead details" panel. These deliberately do NOT enter
     `WizardForm`: identity is locked to the lead record on a convert and the convert branch never
     writes them back, so keeping them out of the form means they can't drift or be re-saved. */
  mobileNumber?: string | null;
  referenceNo?: string | null;
  draftApplicationId?: string;
  /**
   * Set only by the skip-ahead confirm dialog, never by the sanctioned convert button. Kept off
   * `WizardForm` so it can't be persisted into a draft's `wizardState` and replayed later.
   */
  confirmedSkip?: boolean;
}

const AUTO_FILLED_LABEL: Record<AutoFilledWizardField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  mobile: "Mobile number",
  dob: "Date of birth",
  address: "Address",
  channels: "Preferred communication channel",
  notes: "Notes",
  assignedUserId: "Assigned agent",
  appType: "Application type",
  source: "Source",
  productVersionId: "Product",
  familySize: "Family size",
  coverageTier: "Coverage tier / room preference",
  payFreq: "Payment frequency",
};

export function NewApplicationWizard({
  prefill,
  onClose,
}: {
  prefill?: WizardPrefill;
  onClose: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [splitOpen, setSplitOpen] = useState(false);
  const dirtyRef = useRef(false);
  const [wizard, setWizard] = useState<{ form: WizardForm; selections: Record<string, RequirementAttachmentSelection> }>(() => ({
    form: withRequirementPersonKeys(initialiseFamilySizeSuggestion({
      ...emptyWizardForm(),
      convertClientId: prefill?.convertClientId ?? null,
      convertClientName: prefill?.convertClientName ?? null,
      clientMode: prefill?.convertClientId ? "existing" : "new",
      displayName: prefill?.convertClientName ?? "",
      email: prefill?.email ?? "",
      emailRecipient: prefill?.email ?? "",
      dob: prefill?.dob ?? "",
      familySize: prefill?.familySize != null ? String(prefill.familySize) : "",
      coverageTier: prefill?.coverageTier ?? "",
      payFreq: prefill?.paymentFrequency ?? "",
    })),
    selections: {},
  }));
  const setF = useCallback((update: SetStateAction<WizardForm>) => {
    setWizard((current) => {
      const form = withRequirementPersonKeys(typeof update === "function" ? update(current.form) : update);
      const sameScope = requirementSelectionScope(current.form) === requirementSelectionScope(form);
      return { form, selections: sameScope ? current.selections : {} };
    });
  }, []);
  const [persistedRequirementPreview, setPersistedRequirementPreview] = useState<DraftResumePayload["requirementPreview"]>(null);
  const [templatePreview, setTemplatePreview] = useState<{ key: string; items: ChecklistItem[] } | null>(null);
  const canonicalPreview = persistedRequirementPreview?.applicationId === wizard.form.draftApplicationId && wizard.form.category !== "travel"
    ? persistedRequirementPreview
    : null;
  // One effective form supplies rendering, draft snapshots and creation. The checklist is
  // derived from immutable canonical rows or the same builders that create authoritative rows.
  const f = useMemo<WizardForm>(() => {
    const form = wizard.form;
    const checklist = canonicalPreview
      ? canonicalPreview.items
      : form.category === "health"
        ? wizardRequirementPreview(healthWizardRequirements(form))
        : form.category === "travel"
          ? wizardRequirementPreview(travelWizardRequirements(form))
          : templatePreview?.key === `${form.productVersionId}:${form.remoteSale}`
            ? templatePreview.items
            : [];
    return { ...form, checklist };
  }, [wizard.form, canonicalPreview, templatePreview]);
  const selections = wizard.selections;
  const [resumeLoading, setResumeLoading] = useState(Boolean(prefill?.draftApplicationId));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Partial<Record<AutoFilledWizardField, string>>>(() => {
    if (!prefill?.convertClientId) return {};
    return {
      ...(prefill.dob ? { dob: prefill.dob } : {}),
      ...(prefill.familySize != null ? { familySize: String(prefill.familySize) } : {}),
      ...(prefill.coverageTier ? { coverageTier: prefill.coverageTier } : {}),
      ...(prefill.paymentFrequency ? { payFreq: prefill.paymentFrequency } : {}),
    };
  });
  const [linkedClientName, setLinkedClientName] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  /** The lead's product interest when it doesn't match any catalog product. */
  const [unmatchedProduct, setUnmatchedProduct] = useState<string | null>(null);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    listProductOptionsAction().then((items) => {
      setProducts(items);
      if (!prefill?.productInterest) return;
      const product = items.find((item) => item.productName.toLowerCase() === prefill.productInterest?.toLowerCase());
      const preferredPlan = product && prefill.coverageTier
        ? uniquePlanPreferenceMatch(prefill.coverageTier, product.planOptions)
        : null;
      // Starting from a lead is an inquiry until someone says otherwise, so that is what the type
      // defaults to. It is consequential, not cosmetic: the inquiry type derives
      // `status = "Lead"` below, which keeps `startsApplication` false server-side — the record
      // gains an application but stays a Lead on the board until the type or status is changed.
      //
      // The default is deliberately OUTSIDE the product check. It used to be nested inside it, so a
      // lead whose product interest isn't in the catalog (several carry values that exist in
      // PRODUCT_COLORS but not in `products`) opened the wizard with no app type *and* no product,
      // and no indication why. `current.appType ||` still yields to a user's own choice.
      setF((current) => ({
        ...current,
        // A travel quote is a sale, not an inquiry (H6g): it starts as a New Insurance Application.
        appType:
          current.appType ||
          (product && categoryForProduct(product.productName, product.productCategory) === "travel"
            ? "New Insurance Application"
            : INQUIRY_APP_TYPE),
        ...(product
          ? {
              productVersionId: product.productVersionId,
              productName: product.productName,
              category: categoryForProduct(product.productName, product.productCategory),
              planOptionId: current.planOptionId || preferredPlan?.id || "",
            }
          : {}),
      }));
      // Surfaced in Step 1 rather than silently dropped — the lead does have an interest on file,
      // it just isn't a product that can be sold yet.
      setUnmatchedProduct(product ? null : prefill.productInterest);
    }).catch(() => setProducts([]));
    listAssignableUsersAction().then(setUsers).catch(() => setUsers([]));
    listActiveTemplatesAction().then(setTemplates).catch(() => setTemplates([]));
    listPaymentChannelOptionsAction().then(setPaymentChannels).catch(() => setPaymentChannels([]));
  }, [prefill?.coverageTier, prefill?.productInterest, setF]);

  useEffect(() => {
    if (!prefill?.draftApplicationId) return;
    getDraftResumeAction(prefill.draftApplicationId)
      .then((res) => {
        if (!res.ok || !res.data?.form) {
          const message = res.ok
            ? "The application draft returned incomplete data. Close and reopen it to try again."
            : res.error;
          setResumeError(message);
          overlays.toast("Couldn’t load application draft", message);
          return;
        }
        // A draft saved before the app-type rename carries the old spelling; map it forward
        // so its select renders a matching option instead of going blank on resume.
        setF(withRequirementPersonKeys({ ...res.data.form, appType: normaliseAppType(res.data.form.appType) }));
        setStep(res.data.form.draftStep);
        setAutoFilled(res.data.autoFilled);
        setLinkedClientName(res.data.linkedClientName);
        setPersistedRequirementPreview(res.data.requirementPreview);
      })
      .catch(() => {
        const message = "The application draft could not be loaded.";
        setResumeError(message);
        overlays.toast("Couldn’t load application draft", message);
      })
      .finally(() => setResumeLoading(false));
  }, [overlays, prefill?.draftApplicationId, setF]);

  const set = (patch: Partial<WizardForm>) => {
    const keys = Object.keys(patch);
    if (!keys.every((k) => k === "checklist")) dirtyRef.current = true;
    setF((s) => ({ ...s, ...patch }));
  };

  // Form changes clear incompatible choices atomically in setF, not after a render.
  const selectionScope = requirementSelectionScope(f);
  const attachmentClientId = canonicalPreview?.clientId || f.convertClientId || (f.clientMode === "existing" ? f.existingClientId : null) || undefined;
  const selectRequirement = (key: string, selection: RequirementAttachmentSelection | null) => {
    dirtyRef.current = true;
    setWizard((current) => {
      // Ignore a result from a picker opened before its client/person scope changed.
      if (requirementSelectionScope(current.form) !== selectionScope) return current;
      const selections = { ...current.selections };
      if (selection) selections[key] = selection;
      else delete selections[key];
      return { ...current, selections };
    });
  };
  const [travelFilledFrom, setTravelFilledFrom] = useState<{ clientId: string; name: string; fromPastTrip: boolean } | null>(null);
  const isTravel = f.category === "travel";
  useEffect(() => {
    const clientId = f.existingClientId;
    if (!isTravel || !clientId || travelFilledFrom?.clientId === clientId) return;
    let cancelled = false;
    getTravelClientFillAction(clientId).then((res) => {
      if (cancelled || !res.ok) return;
      const fill = res.data;
      setTravelFilledFrom({ clientId, name: fill.clientName, fromPastTrip: fill.fromPastTrip });
      setF((s) => {
        // Visible, editable fill of the first traveler row (DH12: no silent autofill). A row the
        // user already typed someone else into is left alone.
        const first = s.travelers[0];
        if (first && first.name.trim() && first.name.trim().toLowerCase() !== fill.clientName.trim().toLowerCase()) return s;
        const filled = {
          ...(first ?? { planOptionId: s.planOptionId, beneficiaryName: "", beneficiaryDob: "", beneficiaryRelationship: "", beneficiaryContact: "" }),
          ...fill.traveler,
        };
        return { ...s, applicantIsTraveler: true, passport: s.passport || fill.traveler.idNumber, travelers: [filled, ...s.travelers.slice(1)] };
      });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isTravel, f.existingClientId, travelFilledFrom?.clientId, setF]);

  // Open work on a picked client (2026-10-06): offer to continue a draft / travel request /
  // application rather than start a duplicate. Checked once per client per wizard session, and not
  // when this wizard is itself a resumed draft.
  const [openWork, setOpenWork] = useState<{ clientId: string; clientName: string; work: ClientOpenWork } | null>(null);
  const openWorkChecked = useRef<Set<string>>(new Set());
  useEffect(() => {
    const clientId = f.existingClientId;
    if (!clientId || prefill?.draftApplicationId || f.draftApplicationId || openWorkChecked.current.has(clientId)) return;
    openWorkChecked.current.add(clientId);
    let cancelled = false;
    getClientOpenWorkAction(clientId).then((res) => {
      if (cancelled || !res.ok) return;
      const { drafts, travelRequests, applications } = res.data;
      if (drafts.length + travelRequests.length + applications.length > 0) {
        setOpenWork({ clientId, clientName: f.existingClientName || "This client", work: res.data });
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [f.existingClientId, f.existingClientName, f.draftApplicationId, prefill?.draftApplicationId]);

  // H3a: the authoritative requirement list for template-driven (non-health, non-travel) products.
  useEffect(() => {
    if (!f.productVersionId || f.category === "health" || f.category === "travel" || !f.category) return;
    let cancelled = false;
    const key = `${f.productVersionId}:${f.remoteSale}`;
    listProductRequirementPreviewAction(f.productVersionId, f.remoteSale)
      .then((items) => {
        if (!cancelled) setTemplatePreview({ key, items });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [f.productVersionId, f.category, f.remoteSale]);

  // Escape / backdrop close with dirty confirm (design requestClose).
  const requestClose = () => {
    if (dirtyRef.current && !window.confirm("Discard this application draft? Nothing has been saved.")) return;
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestClose reads refs only
  }, []);

  // Derived initial status (design): an inquiry stays a Lead; entering identity
  // or picking a product makes the record an Applicant.
  useEffect(() => {
    const st =
      isInquiryAppType(f.appType)
        ? "Lead"
        : f.firstName || f.companyName || f.productVersionId
          ? "Applicant"
          : "Lead";
    // Derived state mirrors the existing wizard behavior and does not mark the form dirty.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (st !== f.status) setF((s) => ({ ...s, status: st }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute on the inputs it derives from
  }, [f.appType, f.firstName, f.companyName, f.productVersionId]);

  const hasName = !!(f.firstName || f.displayName || f.companyName || f.existingClientId || f.convertClientId);
  const hasContact = !!(f.email || f.mobile || f.existingClientId || f.convertClientId);
  // Design also requires an assigned agent; here the empty select value means
  // "Me" (resolved to the actor server-side), so that condition always holds.
  // A draft captures an early inquiry, before a product/workflow is necessarily known.
  const canDraft = hasName && hasContact && !pending;
  const groupTooFew = f.category === "hmo" && f.members.filter((m) => m.name.trim()).length < 3;
  // Why Create is disabled, as jump-to links (2026-10-06: a draft with no trip dates silently
  // greyed out "Create & open portal" and nothing said why). `canCreate` is derived from this
  // list so the two can't disagree. Steps are the travel screen numbers on the travel path.
  const blockerStep = (standard: number) => (f.category === "travel" ? (standard === 5 || standard === 6 ? 2 : 1) : standard);
  const createBlockers: { label: string; step: number }[] = [
    ...(!hasName ? [{ label: "Client name", step: blockerStep(2) }] : []),
    ...(!hasContact ? [{ label: "Email or mobile", step: blockerStep(2) }] : []),
    ...(!f.productVersionId ? [{ label: "Product", step: 1 }] : []),
    ...(!f.appType ? [{ label: "Application type", step: 1 }] : []),
    ...(!f.source ? [{ label: "Source", step: 1 }] : []),
    ...(groupTooFew ? [{ label: "At least 3 group members", step: 3 }] : []),
    ...(f.category === "travel" && !f.destination ? [{ label: "Destination", step: blockerStep(3) }] : []),
    ...(f.category === "travel" && !f.departure ? [{ label: "Departure date", step: blockerStep(3) }] : []),
    ...(f.category === "travel" && !f.returnDate ? [{ label: "Return date", step: blockerStep(3) }] : []),
    ...(f.category === "travel" && f.departure && f.returnDate && f.returnDate < f.departure
      ? [{ label: "Return date after departure", step: blockerStep(3) }]
      : []),
    ...(f.category === "travel" && !f.travelers.some((traveler) => traveler.name.trim()) ? [{ label: "A named traveler", step: blockerStep(3) }] : []),
    ...(f.category === "health" && !f.planOptionId ? [{ label: "Plan option", step: 3 }] : []),
    ...(f.category === "health" && !f.coverage ? [{ label: "Coverage type", step: 3 }] : []),
  ];
  const canCreate = !pending && createBlockers.length === 0;

  // H3a: the product decides every later step (details, requirements), so it is chosen first.
  // Drafts are exempt — an early inquiry may not know its product yet.
  const productChosen = !!f.productVersionId;
  const steps = isTravel ? WIZ_TRAVEL_STEPS : WIZ_STEPS;
  const lastStep = steps.length;
  // A category switch (or a travel draft saved under the six-step flow) can leave `step` past the
  // end of the shorter travel list; clamp rather than render nothing.
  const currentStep = Math.min(step, lastStep);
  const go = (n: number) => {
    const next = Math.max(1, Math.min(lastStep, productChosen ? n : 1));
    setStep(next);
    setF((s) => ({ ...s, draftStep: next }));
  };

  const changedAutoFilledFields = () =>
    (Object.keys(autoFilled) as AutoFilledWizardField[]).filter((field) => {
      const value = f[field];
      const current = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return current !== autoFilled[field];
    });

  const attachSelections = async (targets: Record<string, RequirementTarget> = {}): Promise<string[]> => {
    const failures: string[] = [];
    for (const [key, selection] of Object.entries(selections)) {
      const label = f.checklist.find((item) => item.requirementKey === key)?.name || key;
      const target = targets[key];
      if (!target) {
        failures.push(label);
        continue;
      }
      try {
        const receipt = await attachRequirementSelection(target, selection);
        if (!receipt.ok) failures.push(label);
      } catch {
        failures.push(label);
      }
    }
    return failures;
  };

  const finish = async (mode: WizardMode) => {
    // Travel (H6b): reserve the portal pop-up inside the click, before any await — pop-up
    // blockers only allow opens tied to the gesture. It is pointed at the portal on success.
    const portal = isTravel && mode !== "draft" ? openPortalWindow() : null;
    const changedFields = changedAutoFilledFields();
    if (changedFields.length > 0) {
      const confirmed = await overlays.confirm({
        title: "Save changes to linked lead?",
        message: (
          <>
            You changed {changedFields.map((field) => AUTO_FILLED_LABEL[field]).join(", ")}. Saving will update the linked lead/client record.
          </>
        ),
        confirmLabel: "Save changes",
        cancelLabel: "Review changes",
      });
      if (!confirmed) {
        portal?.close();
        return;
      }
    }
    startTransition(async () => {
      const res = await createFromWizardAction(f, mode, { confirmedSkip: prefill?.confirmedSkip });
      if (res.ok) {
        const titles: Record<WizardMode, string> = {
          draft: "Draft saved",
          create: res.data.groupId ? "Group account created" : "Application created",
          docs: "Application created & documents requested",
        };
        // Travel submissions live in the Travel Insurance lane (travel_requests / /travel),
        // not Applications — surface that instead of the generic "Application created" titles.
        const title = res.data.travelRequestId ? "Client moved to Travel Insurance" : titles[mode];
        const failures = mode === "draft" ? [] : await attachSelections(res.data.requirementTargets);
        const attachmentSummary = failures.length
          ? ` ${failures.length} attachment${failures.length === 1 ? "" : "s"} failed: ${failures.join("; ")}. The record was created; attach these in its requirements workflow. Do not create it again.`
          : mode === "draft" && Object.keys(selections).length
            ? " Selected attachments were not saved in the draft. Choose them again when completing it."
            : "";
        // Step 5's email, bound to the created record. Creating sent nothing: it opens in the
        // shared composer for explicit review and Send, after the receipt attachments above.
        const emailDraft = mode !== "draft" && res.data.clientId ? res.data.emailDraft : undefined;
        const emailSummary = emailDraft ? " Review the email before sending — nothing has been sent yet." : "";
        const reviewEmail = (next: { label: string; open: () => void }) => {
          if (!emailDraft || !res.data.clientId) return false;
          overlays.toast(title, res.data.summary + attachmentSummary + emailSummary, { label: next.label, onClick: next.open });
          overlays.openEngage(
            "Send Email",
            {
              clientId: res.data.clientId,
              name: (f.category === "hmo" ? f.companyName : "") || f.displayName || [f.firstName, f.lastName].filter(Boolean).join(" ") || "Client",
              email: emailDraft.recipient || f.email || null,
              product: f.productName || null,
              premium: parseAmount(f.premium),
              record: emailDraft.origin.type === "contact" ? emailDraft.origin.record ?? null : null,
            },
            next.open,
            emailDraft,
          );
          return true;
        };
        if (res.data.travelRequestId && mode !== "draft") {
          const travelRequestId = res.data.travelRequestId;
          if (portal && res.data.travelPortalUrl) portal.location.href = res.data.travelPortalUrl;
          else portal?.close();
          router.refresh();
          onClose();
          const openTravel = () => overlays.openTravelWorkflow(travelRequestId);
          if (reviewEmail({ label: "Open travel workflow", open: openTravel })) return;
          overlays.toast(title, res.data.summary + attachmentSummary);
          openTravel();
          return;
        }
        portal?.close();
        router.refresh();
        if (res.data.groupId) router.push(`/group/${res.data.groupId}`);
        onClose();
        // H3a: land on the application's full requirement set instead of making the user find
        // "Continue Application" on the client — after the email review when one was composed.
        const applicationId = mode !== "draft" && !res.data.travelRequestId ? res.data.applicationId : undefined;
        const openChecklist = () => { if (applicationId) overlays.openApplicationRequirements(applicationId); };
        if (applicationId && reviewEmail({ label: "Continue to checklist", open: openChecklist })) return;
        overlays.toast(title, res.data.summary + attachmentSummary);
        openChecklist();
      } else {
        portal?.close();
        overlays.toast("Couldn’t create the application", res.error);
      }
    });
  };

  const stepProps = { f, set, products, users, paymentChannels };
  const heads: Record<number, string> = isTravel
    ? { 1: "Client, trip & requirements", 2: "Review & create travel request" }
    : {
    1: "Client type & application setup",
    2: f.category === "hmo" ? "Company information" : "Client information",
    3: "Product-specific details",
    4: "Requirements & documents",
    5: "Communication & follow-up",
    6: "Review & create application",
  };

  return createPortal(
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" onMouseDown={requestClose}>
      <div
        className="relative grid h-[min(720px,94vh)] w-full max-w-[980px] grid-cols-[260px_1fr] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-xl border border-border bg-card shadow-pop max-[800px]:grid-cols-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={requestClose}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <I.plus size={20} className="rotate-45" />
        </button>

        {openWork && openWork.clientId === f.existingClientId && (
          <OpenWorkDialog
            clientName={openWork.clientName}
            work={openWork.work}
            productName={f.productName}
            onContinueDraft={(draftApplicationId) => {
              onClose();
              overlays.openWizard({ draftApplicationId });
            }}
            onOpenTravel={(travelRequestId) => {
              onClose();
              overlays.openTravelWorkflow(travelRequestId);
            }}
            onOpenApplication={(applicationId) => {
              onClose();
              overlays.openApplicationRequirements(applicationId);
            }}
            onStartNew={() => setOpenWork(null)}
          />
        )}

        {/* Left rail */}
        <div className="row-span-2 flex flex-col border-r border-border-soft bg-surface-2 p-5 max-[800px]:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-br from-[#10b981] to-[#047857]">
              <BrandGlyph size={16} />
            </span>
            <span className="text-[12.5px] font-bold">Pacific Insurance PH</span>
          </div>
          <div className="text-[17px] font-bold tracking-[-0.01em]">New Client Application</div>
          <div className="mt-5 flex flex-col gap-1">
            {steps.map((s) => (
              <button
                key={s.n}
                onClick={() => go(s.n)}
                disabled={s.n > 1 && !productChosen}
                title={s.n > 1 && !productChosen ? "Choose a product in Step 1 first" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  currentStep === s.n ? "bg-brand-soft" : "hover:bg-hover",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold",
                    currentStep > s.n
                      ? "bg-brand text-white"
                      : currentStep === s.n
                        ? "border-2 border-brand text-brand"
                        : "border border-border-strong text-subtle",
                  )}
                >
                  {currentStep > s.n ? <I.check size={13} /> : s.n}
                </span>
                <span className={cn("text-[12.5px] font-[650]", currentStep === s.n ? "text-brand-hover" : "")}>{s.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-md border border-border-soft bg-card px-3 py-2.5 text-[11.5px]">
            <span className="text-subtle">Initial status</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-blue-border bg-blue-soft px-2 py-px font-[650] text-blue">
              {f.status}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 overflow-y-auto p-6">
          {f.convertClientId && (
            <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
              <I.user size={15} className="mt-0.5 shrink-0 text-brand" />
              {/* The app type decides whether this save converts, so the banner has to follow it:
                  the inquiry type derives status Lead, which the server reads as "don't convert".
                  Saying "Converting" there would contradict Step 1's own "Stays a Lead" pill. */}
              {f.status === "Lead" ? (
                <div>
                  <b>{f.convertClientName}</b> stays a Lead — change the application type to convert.
                </div>
              ) : (
                <div>
                  Converting <b>{f.convertClientName}</b> from Lead → Applicant on create; Save draft
                  keeps them a lead.
                </div>
              )}
            </div>
          )}
          <h2 className="mb-5 text-[18px] font-bold tracking-[-0.01em]">{heads[currentStep]}</h2>
          {resumeLoading ? (
            <div className="rounded-md border border-border-soft bg-surface-2 px-4 py-5 text-[13px] text-muted-foreground">
              Loading the linked lead and saved application details…
            </div>
          ) : resumeError ? (
            <div className="rounded-md border border-red-border bg-red-soft px-4 py-3 text-[13px] text-red">
              {resumeError}
            </div>
          ) : (
            <>
              {isTravel ? (
                currentStep === 1 ? (
                  <div className="space-y-4">
                    <Step1 {...stepProps} unmatchedProduct={unmatchedProduct} />
                    {travelFilledFrom && travelFilledFrom.clientId === f.existingClientId && (
                      <div className="flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3 text-[12.5px]">
                        <I.user size={15} className="mt-0.5 shrink-0 text-brand" />
                        <div>
                          Traveler details filled from <b>{travelFilledFrom.name}</b>
                          {travelFilledFrom.fromPastTrip ? " and their last trip" : ""} — check and edit them below before creating.
                        </div>
                      </div>
                    )}
                    {f.clientMode !== "existing" && (
                      <Step2 {...stepProps} linkedClientName={linkedClientName} />
                    )}
                    <Step3 {...stepProps} />
                    <TravelRequirementUploads
                      key={selectionScope}
                      f={f}
                      clientId={attachmentClientId}
                      selections={selections}
                      onSelect={selectRequirement}
                      disabled={pending}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Step5 {...stepProps} templates={templates} agentName={persona.userName} />
                    <Step6 {...stepProps} />
                  </div>
                )
              ) : (
              <>
              {step === 1 && <Step1 {...stepProps} unmatchedProduct={unmatchedProduct} />}
              {step === 2 && (
                <Step2
                  {...stepProps}
                  linkedClientName={linkedClientName}
                  leadDetails={
                    prefill?.convertClientId
                      ? {
                          referenceNo: prefill.referenceNo ?? null,
                          email: prefill.email ?? null,
                          mobileNumber: prefill.mobileNumber ?? null,
                          dob: prefill.dob ?? null,
                        }
                      : undefined
                  }
                />
              )}
              {step === 3 && <Step3 {...stepProps} />}
              {step === 4 && <Step4 key={selectionScope} {...stepProps} clientId={attachmentClientId} selections={selections} onSelect={selectRequirement} disabled={pending} />}
              {step === 5 && <Step5 {...stepProps} templates={templates} agentName={persona.userName} />}
              {step === 6 && <Step6 {...stepProps} />}
              </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="col-start-2 flex items-center gap-3 border-t border-border-soft bg-surface-2 px-5 py-3.5 max-[800px]:col-start-1">
          {currentStep > 1 ? (
            <Btn onClick={() => go(currentStep - 1)}>
              <I.chevRight size={15} className="rotate-180" /> Back
            </Btn>
          ) : (
            <Btn onClick={requestClose}>Cancel</Btn>
          )}
          <span className="flex-1 text-[11.5px] text-faint">
            {currentStep === 1 && !productChosen ? (
              "Choose a product to continue — it decides the requirements"
            ) : currentStep === lastStep && createBlockers.length > 0 ? (
              <span className="text-amber">
                Still needed:{" "}
                {createBlockers.map((blocker, index) => (
                  <span key={blocker.label}>
                    {index > 0 && ", "}
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => go(blocker.step)}>
                      {blocker.label}
                    </button>
                  </span>
                ))}
              </span>
            ) : (
              !canDraft && "Add a name and contact method to save a draft"
            )}
          </span>
          <Btn disabled={!canDraft || resumeLoading || !!resumeError} onClick={() => finish("draft")}>
            Save draft
          </Btn>
          {currentStep < lastStep ? (
            <Btn variant="primary" disabled={resumeLoading || !!resumeError || (currentStep === 1 && !productChosen)} onClick={() => go(currentStep + 1)}>
              Continue <I.chevRight size={15} />
            </Btn>
          ) : (
            <div className="relative flex">
              <Btn
                variant="primary"
                disabled={!canCreate || resumeLoading || !!resumeError}
                title={createBlockers.length ? `Still needed: ${createBlockers.map((blocker) => blocker.label).join(", ")}` : undefined}
                onClick={() => finish(isTravel ? "create" : "docs")}
                className="rounded-r-none"
              >
                <I.send size={15} /> {pending ? "Creating…" : isTravel ? "Create & open portal" : "Create & request documents"}
              </Btn>
              <button
                onClick={() => setSplitOpen((o) => !o)}
                disabled={!canCreate || resumeLoading || !!resumeError}
                className="grid h-9 w-8 place-items-center rounded-r-md border border-l border-transparent border-l-white/25 bg-primary text-primary-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25 disabled:cursor-not-allowed disabled:border-border disabled:border-l-border-strong disabled:bg-surface-3 disabled:text-subtle disabled:hover:bg-surface-3"
              >
                <I.chevDown size={15} className="rotate-180" />
              </button>
              {splitOpen && (
                <div className="absolute bottom-11 right-0 w-[240px] overflow-hidden rounded-md border border-border bg-card py-1 shadow-pop">
                  {(
                    [
                      ["create", "Create application", "check"],
                      ["draft", "Save as draft", "doc2"],
                    ] as const
                  ).map(([mode, label, icon]) => {
                    const Ico = I[icon];
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          setSplitOpen(false);
                          finish(mode);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <Ico size={15} className="text-subtle" /> {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
