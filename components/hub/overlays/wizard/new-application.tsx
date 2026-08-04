"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  createFromWizardAction,
  getDraftResumeAction,
  type AutoFilledWizardField,
  type WizardMode,
} from "@/app/(app)/applications/wizard-actions";
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
import { Step1, Step2 } from "./steps-1";
import { Step3, Step4, Step5, Step6 } from "./steps-2";
import {
  emptyWizardForm,
  ageFromDob,
  categoryForProduct,
  WIZ_CHECKLISTS,
  WIZ_STEPS,
  type WizardForm,
} from "./wizard-data";

/**
 * New Client Application — the 6-step wizard overlay (design
 * new-application.jsx / web/new-application-wizard.md). Adapts to the product
 * category (Health / Group HMO / Travel); the split Create button fans into
 * create / create & email / create & request documents / save draft.
 */

export interface WizardPrefill {
  convertClientId?: string;
  convertClientName?: string;
  productInterest?: string | null;
  email?: string | null;
  draftApplicationId?: string;
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
  const [f, setF] = useState<WizardForm>(() => ({
    ...emptyWizardForm(),
    convertClientId: prefill?.convertClientId ?? null,
    convertClientName: prefill?.convertClientName ?? null,
    clientMode: prefill?.convertClientId ? "existing" : "new",
    displayName: prefill?.convertClientName ?? "",
    email: prefill?.email ?? "",
    emailRecipient: prefill?.email ?? "",
  }));
  const skipInitialChecklist = useRef(Boolean(prefill?.draftApplicationId));
  const [resumeLoading, setResumeLoading] = useState(Boolean(prefill?.draftApplicationId));
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Partial<Record<AutoFilledWizardField, string>>>({});
  const [linkedClientName, setLinkedClientName] = useState<string | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    listProductOptionsAction().then((items) => {
      setProducts(items);
      if (prefill?.productInterest) {
        const product = items.find((item) => item.productName.toLowerCase() === prefill.productInterest?.toLowerCase());
        if (product) setF((current) => ({ ...current, appType: current.appType || "New Insurance Application", productVersionId: product.productVersionId, productName: product.productName, category: categoryForProduct(product.productName, product.productCategory) }));
      }
    }).catch(() => setProducts([]));
    listAssignableUsersAction().then(setUsers).catch(() => setUsers([]));
    listActiveTemplatesAction().then(setTemplates).catch(() => setTemplates([]));
    listPaymentChannelOptionsAction().then(setPaymentChannels).catch(() => setPaymentChannels([]));
  }, [prefill?.productInterest]);

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
        setF(res.data.form);
        setStep(res.data.form.draftStep);
        setAutoFilled(res.data.autoFilled);
        setLinkedClientName(res.data.linkedClientName);
      })
      .catch(() => {
        const message = "The application draft could not be loaded.";
        setResumeError(message);
        overlays.toast("Couldn’t load application draft", message);
      })
      .finally(() => setResumeLoading(false));
  }, [overlays, prefill?.draftApplicationId]);

  const set = (patch: Partial<WizardForm>) => {
    const keys = Object.keys(patch);
    if (!keys.every((k) => k === "checklist")) dirtyRef.current = true;
    setF((s) => ({ ...s, ...patch }));
  };

  // Auto-generate the checklist when the category (or pre-existing flag) changes.
  useEffect(() => {
    if (!f.category) return;
    if (skipInitialChecklist.current) {
      skipInitialChecklist.current = false;
      return;
    }
    const base = WIZ_CHECKLISTS[f.category] ?? [];
    let items = base.map((b) => ({ ...b, checked: false, status: "Pending" }));
    if (f.category === "health") {
      const principal = f.displayName || [f.firstName, f.lastName].filter(Boolean).join(" ") || "Principal applicant";
      const people = [{ name: principal, dob: f.dob, preExisting: f.preExisting }, ...f.healthDependents.map((person) => ({ name: person.name, dob: person.dob, preExisting: person.preExisting ?? "Unknown" }))].filter((person) => person.name.trim());
      items = people.flatMap((person) => {
        const age = ageFromDob(person.dob);
        const senior = typeof age === "number" && age >= 71;
        const result = [
          { name: senior ? `Age 71–100 application form — ${person.name}` : `Regular application form — ${person.name}`, cond: senior ? "individual senior form" : null, checked: false, status: "Pending" },
          { name: `Valid ID — ${person.name}`, cond: null, checked: false, status: "Pending" },
          { name: `Attestation — ${person.name}`, cond: null, checked: false, status: "Pending" },
        ];
        if (senior || person.preExisting === "Yes") result.push({ name: `Medical documents — ${person.name}`, cond: "required", checked: false, status: "Pending" });
        return result;
      });
      if (f.remoteSale) items.push({ name: "Advisor declaration and remote-selling confirmation", cond: "required", checked: false, status: "Pending" });
      items.push({ name: "TAL conforme / CAC", cond: "only if requested after underwriting", checked: false, status: "Pending" });
    } else if (f.category === "travel") {
      items = [{ name: "Completed Travel application form", cond: null, checked: false, status: "Pending" }, ...f.travelers.filter((traveler) => traveler.name.trim()).map((traveler) => ({ name: `${traveler.idType || "Passport"} copy — ${traveler.name}`, cond: null, checked: false, status: "Pending" })), { name: "Payment proof", cond: "before portal processing", checked: false, status: "Pending" }, { name: "Issued Travel policy", cond: "after issuance", checked: false, status: "Pending" }];
    }
    setF((s) => ({ ...s, checklist: items }));
  }, [f.category, f.preExisting, f.remoteSale, f.healthDependents, f.travelers, f.displayName, f.firstName, f.lastName, f.dob]);

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

  // Derived initial status (design): Inquiry/Lead Only stays a Lead; entering
  // identity or picking a product makes the record an Applicant.
  useEffect(() => {
    const st =
      f.appType === "Inquiry / Lead Only"
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
  const travelMissing = f.category === "travel" && (!f.destination || !f.departure || !f.returnDate || !f.travelers.some((traveler) => traveler.name.trim()));
  const healthMissing = f.category === "health" && (!f.planOptionId || !f.coverage);
  const canCreate = canDraft && !!f.productVersionId && !!f.appType && !!f.source && !groupTooFew && !travelMissing && !healthMissing;

  const go = (n: number) => {
    const next = Math.max(1, Math.min(6, n));
    setStep(next);
    setF((s) => ({ ...s, draftStep: next }));
  };

  const changedAutoFilledFields = () =>
    (Object.keys(autoFilled) as AutoFilledWizardField[]).filter((field) => {
      const value = f[field];
      const current = Array.isArray(value) ? value.join(", ") : String(value ?? "");
      return current !== autoFilled[field];
    });

  const finish = async (mode: WizardMode) => {
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
      if (!confirmed) return;
    }
    startTransition(async () => {
      const res = await createFromWizardAction(f, mode);
      if (res.ok) {
        const titles: Record<WizardMode, string> = {
          draft: "Draft saved",
          create: res.data.groupId ? "Group account created" : "Application created",
          email: "Application created & email logged",
          docs: "Application created & documents requested",
        };
        // Travel submissions live in the Travel Insurance lane (travel_requests / /travel),
        // not Applications — surface that instead of the generic "Application created" titles.
        const title = res.data.travelRequestId ? "Client moved to Travel Insurance" : titles[mode];
        overlays.toast(title, res.data.summary);
        router.refresh();
        if (res.data.groupId) router.push(`/group/${res.data.groupId}`);
        onClose();
      } else {
        overlays.toast("Couldn’t create the application", res.error);
      }
    });
  };

  const stepProps = { f, set, products, users, paymentChannels };
  const heads: Record<number, [string, string]> = {
    1: ["Client type & application setup", "Tell the system what workflow to prepare."],
    2: [f.category === "hmo" ? "Company information" : "Client information", "Create or update the main profile."],
    3: ["Product-specific details", "Configure details for the selected product."],
    4: ["Requirements & documents", "Auto-generated checklist based on the product."],
    5: ["Communication & follow-up", "Prepare the next action for the client."],
    6: ["Review & create application", "Final confirmation before saving."],
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

        {/* Left rail */}
        <div className="row-span-2 flex flex-col border-r border-border-soft bg-surface-2 p-5 max-[800px]:hidden">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-[8px] bg-gradient-to-br from-[#10b981] to-[#047857]">
              <BrandGlyph size={16} />
            </span>
            <span className="text-[12.5px] font-bold">Pacific Insurance PH</span>
          </div>
          <div className="text-[17px] font-bold tracking-[-0.01em]">New Client Application</div>
          <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Create a client record and start an insurance application workflow.
          </div>
          <div className="mt-5 flex flex-col gap-1">
            {WIZ_STEPS.map((s) => (
              <button
                key={s.n}
                onClick={() => go(s.n)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                  step === s.n ? "bg-brand-soft" : "hover:bg-hover",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11.5px] font-bold",
                    step > s.n
                      ? "bg-brand text-white"
                      : step === s.n
                        ? "border-2 border-brand text-brand"
                        : "border border-border-strong text-subtle",
                  )}
                >
                  {step > s.n ? <I.check size={13} /> : s.n}
                </span>
                <span>
                  <span className={cn("block text-[12.5px] font-[650]", step === s.n ? "text-brand-hover" : "")}>{s.label}</span>
                  <span className="block text-[10.5px] text-subtle">{s.desc}</span>
                </span>
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
              <div>
                Converting <b>{f.convertClientName}</b> from Lead → Applicant. The same record is
                used — <b>no duplicate is created.</b> Nothing changes until you save.
              </div>
            </div>
          )}
          <h2 className="text-[18px] font-bold tracking-[-0.01em]">{heads[step][0]}</h2>
          <p className="mb-5 mt-0.5 text-[13px] text-muted-foreground">{heads[step][1]}</p>
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
              {step === 1 && <Step1 {...stepProps} />}
              {step === 2 && <Step2 {...stepProps} linkedClientName={linkedClientName} />}
              {step === 3 && <Step3 {...stepProps} />}
              {step === 4 && <Step4 {...stepProps} />}
              {step === 5 && <Step5 {...stepProps} templates={templates} agentName={persona.userName} />}
              {step === 6 && <Step6 {...stepProps} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="col-start-2 flex items-center gap-3 border-t border-border-soft bg-surface-2 px-5 py-3.5 max-[800px]:col-start-1">
          {step > 1 ? (
            <Btn onClick={() => go(step - 1)}>
              <I.chevRight size={15} className="rotate-180" /> Back
            </Btn>
          ) : (
            <Btn onClick={requestClose}>Cancel</Btn>
          )}
          <span className="flex-1 text-[11.5px] text-faint">
            {canDraft ? "Draft can be saved" : "Add a name and contact method to save a draft"}
          </span>
          <Btn disabled={!canDraft || resumeLoading || !!resumeError} onClick={() => finish("draft")}>
            Save draft
          </Btn>
          {step < 6 ? (
            <Btn variant="primary" disabled={resumeLoading || !!resumeError} onClick={() => go(step + 1)}>
              Continue <I.chevRight size={15} />
            </Btn>
          ) : (
            <div className="relative flex">
              <Btn
                variant="primary"
                disabled={!canCreate || resumeLoading || !!resumeError}
                onClick={() => finish("docs")}
                className="rounded-r-none"
              >
                <I.send size={15} /> {pending ? "Creating…" : "Create & request documents"}
              </Btn>
              <button
                onClick={() => setSplitOpen((o) => !o)}
                disabled={!canCreate || resumeLoading || !!resumeError}
                className="grid h-9 w-8 place-items-center rounded-r-md border border-l border-transparent border-l-white/25 bg-primary text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
              >
                <I.chevDown size={15} className="rotate-180" />
              </button>
              {splitOpen && (
                <div className="absolute bottom-11 right-0 w-[240px] overflow-hidden rounded-md border border-border bg-card py-1 shadow-pop">
                  {(
                    [
                      ["create", "Create application", "check"],
                      ["email", "Create & log email", "mail"],
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
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover"
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
