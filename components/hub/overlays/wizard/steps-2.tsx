"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { listWizardEmailAttachmentsAction } from "@/app/(app)/applications/wizard-actions";
import type { LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { DRAWER_INPUT, DrawerField } from "../client-picker";
import { templateNeedsLibraryAttachment } from "../library-attachment-picker";
import { Section, type StepProps } from "./steps-1";
import { EXTERNAL_COVERAGE_TYPES } from "@/lib/repositories/external-coverage/external-coverage.entity";
import {
  ageFromDob,
  bmiFrom,
  BMI_THRESHOLDS,
  daysBetween,
  INQUIRY_APP_TYPE,
  isFlexiShieldProduct,
  SMOKER_STATUSES,
  WIZ_OPTS,
  type WizardForm,
  type WizardMember,
} from "./wizard-data";

/** Wizard steps 3–6 (design new-application-steps2.jsx). */

const AREA =
  "w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand";

function YesNo({
  value,
  onChange,
  unknown,
}: {
  value: string;
  onChange: (v: string) => void;
  unknown?: boolean;
}) {
  const opts = unknown ? ["Yes", "No", "Unknown"] : ["Yes", "No"];
  return (
    <div className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "h-9 flex-1 rounded-md border text-[12.5px] font-semibold transition-colors",
            value === o
              ? o === "Yes"
                ? "border-brand bg-brand-soft text-brand-hover"
                : o === "No"
                  ? "border-red bg-red-soft text-red"
                  : "border-amber-border bg-amber-soft text-amber"
              : "border-border-strong text-muted-foreground hover:bg-hover",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- Step 3 ------------------------------- */
export function Step3({ f, set, products, paymentChannels }: StepProps) {
  if (!f.category)
    return (
      <div className="flex gap-2.5 rounded-md border border-amber-border bg-amber-soft p-3.5 text-[13px]">
        <I.alertTri size={16} className="mt-0.5 shrink-0 text-amber" />
        Select a product in Step 1 to configure product-specific details.
      </div>
    );
  if (f.category === "hmo") return <Step3Group f={f} set={set} />;
  if (f.category === "travel") return <Step3Travel f={f} set={set} products={products} paymentChannels={paymentChannels} />;
  return <Step3Health f={f} set={set} products={products} />;
}

/** Two boxes, one value: the carrier form asks for ft. & in., the schema stores total inches. */
function HeightInput({ value, onChange, idPrefix }: { value: string; onChange: (v: string) => void; idPrefix: string }) {
  const total = parseFloat(value);
  const feet = isFinite(total) && total > 0 ? Math.floor(total / 12) : "";
  const inches = isFinite(total) && total > 0 ? Math.round(total % 12) : "";
  const push = (nextFeet: number | string, nextInches: number | string) => {
    const ft = parseFloat(String(nextFeet)) || 0;
    const inch = parseFloat(String(nextInches)) || 0;
    const sum = ft * 12 + inch;
    onChange(sum > 0 ? String(sum) : "");
  };
  return (
    <div className="flex items-center gap-1.5">
      <input aria-label={`${idPrefix} height feet`} className={DRAWER_INPUT} value={feet} onChange={(e) => push(e.target.value, inches)} placeholder="ft" inputMode="numeric" />
      <input aria-label={`${idPrefix} height inches`} className={DRAWER_INPUT} value={inches} onChange={(e) => push(feet, e.target.value)} placeholder="in" inputMode="numeric" />
    </div>
  );
}

/**
 * Shows the computed BMI and which panels it triggers, so staff can see why the checklist grew.
 * The thresholds are Asia-Pacific and unconfirmed by the carrier — see `BMI_THRESHOLDS`.
 */
function BmiReadout({ heightInches, weightLbs }: { heightInches: string; weightLbs: string }) {
  const bmi = bmiFrom(heightInches, weightLbs);
  if (bmi == null) return <div />;
  const obese = bmi >= BMI_THRESHOLDS.obeseClass1Min && bmi <= BMI_THRESHOLDS.obeseClass1Max;
  const over = bmi >= BMI_THRESHOLDS.overweight;
  return (
    <div className="self-end rounded-md border border-border-soft bg-surface-2 px-3 py-2.5 text-[12.5px]">
      <b>BMI {bmi}</b>
      {obese ? " · Obese Class 1 — adds chest X-ray, ECG and TMST" : over ? " · adds the lipid/HbA1c blood panel" : " · no extra panel"}
    </div>
  );
}

function Step3Health({ f, set, products }: Pick<StepProps, "f" | "set" | "products">) {
  const plans = products.find((product) => product.productVersionId === f.productVersionId)?.planOptions ?? [];
  return (
    <div>
      <Section title="Plan & coverage">
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Plan option" required>
            <select className={DRAWER_INPUT} value={f.planOptionId} onChange={(e) => set({ planOptionId: e.target.value })}>
              <option value="">Select…</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
          </DrawerField>
          <DrawerField label="Coverage type" required>
            <select className={DRAWER_INPUT} value={f.coverage} onChange={(e) => set({ coverage: e.target.value })}>
              <option value="">Select…</option>
              {WIZ_OPTS.coverage.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Desired coverage start date">
            <input className={DRAWER_INPUT} type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </DrawerField>
        </div>
        {f.coverage === "Family" && <div className="mt-4 space-y-2"><div className="text-[12px] font-semibold">Covered dependents</div>{f.healthDependents.map((person, index) => <div key={index} className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.9fr_0.6fr_1.1fr_1.1fr_0.9fr_auto] gap-2 rounded-md border border-border-soft p-2"><input aria-label={`Dependent ${index + 1} name`} className={DRAWER_INPUT} value={person.name} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, name: e.target.value } : item) })} placeholder="Full name" /><input aria-label={`Dependent ${index + 1} birthdate`} className={DRAWER_INPUT} type="date" value={person.dob} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, dob: e.target.value } : item) })} /><input aria-label={`Dependent ${index + 1} relationship`} className={DRAWER_INPUT} value={person.rel} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, rel: e.target.value } : item) })} placeholder="Relationship" /><select aria-label={`Dependent ${index + 1} conditions`} className={DRAWER_INPUT} value={person.preExisting ?? "Unknown"} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, preExisting: e.target.value } : item) })}><option>No</option><option>Yes</option><option>Unknown</option></select><select aria-label={`Dependent ${index + 1} smoker`} className={DRAWER_INPUT} value={person.smokerStatus ?? ""} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, smokerStatus: e.target.value } : item) })}><option value="">Smoker…</option>{SMOKER_STATUSES.map((status) => <option key={status}>{status}</option>)}</select><input aria-label={`Dependent ${index + 1} weight lbs`} className={DRAWER_INPUT} value={person.weightLbs ?? ""} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, weightLbs: e.target.value } : item) })} placeholder="lbs" inputMode="decimal" /><HeightInput value={person.heightInches ?? ""} onChange={(v) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, heightInches: v } : item) })} idPrefix={`Dependent ${index + 1}`} /><input aria-label={`Dependent ${index + 1} beneficiary name`} className={DRAWER_INPUT} value={person.beneficiaryName ?? ""} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, beneficiaryName: e.target.value } : item) })} placeholder="Beneficiary" /><input aria-label={`Dependent ${index + 1} beneficiary relationship`} className={DRAWER_INPUT} value={person.beneficiaryRelationship ?? ""} onChange={(e) => set({ healthDependents: f.healthDependents.map((item, i) => i === index ? { ...item, beneficiaryRelationship: e.target.value } : item) })} placeholder="Relation" /><button type="button" aria-label={`Remove ${person.name || "dependent"}`} onClick={() => set({ healthDependents: f.healthDependents.filter((_, i) => i !== index) })} className="px-2 text-red"><I.fileMissing size={15} /></button></div>)}<button type="button" onClick={() => set({ healthDependents: [...f.healthDependents, { name: "", dob: "", rel: "Dependent", email: "", preExisting: "Unknown", medicalNotes: "" }] })} className="text-[12px] font-semibold text-brand-hover"><I.plus size={13} className="mr-1 inline" />Add dependent</button></div>}
      </Section>

      <Section title="Underwriting">
        <label className="mb-4 flex items-center gap-2 rounded-md border border-border-soft bg-surface-2 px-3 py-2.5 text-[12.5px]"><input type="checkbox" checked={f.remoteSale} onChange={(e) => set({ remoteSale: e.target.checked })} /> Remote / online sale — requires the Advisor&rsquo;s Declaration instead of the Agent&rsquo;s Attestation</label>
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Existing Pacific Cross client?">
            <YesNo value={f.existingPC} onChange={(v) => set({ existingPC: v })} />
          </DrawerField>
          <DrawerField label="Pre-existing conditions?" required hint="Required before Pacific Cross submission.">
            <YesNo value={f.preExisting} onChange={(v) => set({ preExisting: v })} unknown />
          </DrawerField>
        </div>

        {/* Smoker status and the BMI inputs drive Pacific Cross's three conditional medical panels
            (G3). Units match the carrier's own application form — WEIGHT (lbs.), HEIGHT (ft. & in.)
            — so staff transcribe straight across instead of converting. */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <DrawerField label="Smoker" hint="A current smoker needs a chest X-ray from the last 6 months.">
            <select className={DRAWER_INPUT} value={f.smokerStatus} onChange={(e) => set({ smokerStatus: e.target.value })}>
              <option value="">Select…</option>
              {SMOKER_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </DrawerField>
          <DrawerField label="Weight (lbs.)">
            <input className={DRAWER_INPUT} value={f.weightLbs} onChange={(e) => set({ weightLbs: e.target.value })} placeholder="0" inputMode="decimal" />
          </DrawerField>
          <DrawerField label="Height (ft. & in.)">
            <HeightInput value={f.heightInches} onChange={(v) => set({ heightInches: v })} idPrefix="principal" />
          </DrawerField>
          <BmiReadout heightInches={f.heightInches} weightLbs={f.weightLbs} />
        </div>

        {/* Pacific Cross requires a valid ID for the beneficiary as well as the insured, so the
            beneficiary has to exist as a person before that requirement has anyone to attach to.
            The carrier form gives the principal and each dependent their own block (G4). */}
        <div className="mt-4 rounded-md border border-border-soft bg-surface-2 p-3.5">
          <div className="mb-1 text-[12px] font-semibold">Beneficiary</div>
          <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
            Naming a beneficiary adds a valid-ID requirement for them. Leave blank if none is
            nominated — nothing is requested.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="Beneficiary name">
              <input aria-label="Principal beneficiary name" className={DRAWER_INPUT} value={f.beneficiaryName} onChange={(e) => set({ beneficiaryName: e.target.value })} placeholder="Full name" />
            </DrawerField>
            <DrawerField label="Relationship to applicant">
              <input aria-label="Principal beneficiary relationship" className={DRAWER_INPUT} value={f.beneficiaryRelationship} onChange={(e) => set({ beneficiaryRelationship: e.target.value })} placeholder="e.g. Spouse" />
            </DrawerField>
            <DrawerField label="Beneficiary date of birth">
              <input aria-label="Principal beneficiary birth date" className={DRAWER_INPUT} type="date" value={f.beneficiaryBirthDate} onChange={(e) => set({ beneficiaryBirthDate: e.target.value })} />
            </DrawerField>
            <DrawerField label="Beneficiary contact number">
              <input aria-label="Principal beneficiary contact" className={DRAWER_INPUT} value={f.beneficiaryContact} onChange={(e) => set({ beneficiaryContact: e.target.value })} placeholder="+63 9XX XXX XXXX" />
            </DrawerField>
          </div>
        </div>

        {/* FlexiShield only: it is second-layer cover, so Pacific Cross needs the first layer
            declared — the MBL in particular, since FlexiShield pays once that limit is exhausted.
            Same product test the requirement builder and the carrier-form lookup use, so the three
            never disagree about what counts as FlexiShield. */}
        {isFlexiShieldProduct(f.productName) && (
          <div className="mt-4 rounded-md border border-border-soft bg-surface-2 p-3.5">
            <div className="mb-1 text-[12px] font-semibold">First-layer HMO coverage</div>
            <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
              FlexiShield pays after the client&rsquo;s existing plan is exhausted, so Pacific Cross
              needs that plan declared. Take these from the client&rsquo;s Certificate of Coverage —
              the same document the checklist asks them to send.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <DrawerField label="Type of existing cover">
                <select className={DRAWER_INPUT} value={f.firstLayerType} onChange={(e) => set({ firstLayerType: e.target.value })}>
                  {EXTERNAL_COVERAGE_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </DrawerField>
              <DrawerField label="Name of existing HMO">
                <input className={DRAWER_INPUT} value={f.firstLayerProvider} onChange={(e) => set({ firstLayerProvider: e.target.value })} placeholder="e.g. Maxicare" />
              </DrawerField>
              <DrawerField label="Type / name of plan">
                <input className={DRAWER_INPUT} value={f.firstLayerPlan} onChange={(e) => set({ firstLayerPlan: e.target.value })} placeholder="e.g. Prima Gold" />
              </DrawerField>
              <DrawerField label="Maximum benefit limit (₱)" hint="The figure FlexiShield pays above.">
                <input className={DRAWER_INPUT} value={f.firstLayerMbl} onChange={(e) => set({ firstLayerMbl: e.target.value })} placeholder="0.00" inputMode="decimal" />
              </DrawerField>
              <DrawerField label="Effective date">
                <input className={DRAWER_INPUT} type="date" value={f.firstLayerEffective} onChange={(e) => set({ firstLayerEffective: e.target.value })} />
              </DrawerField>
              <DrawerField label="Expiry date">
                <input className={DRAWER_INPUT} type="date" value={f.firstLayerExpiry} onChange={(e) => set({ firstLayerExpiry: e.target.value })} />
              </DrawerField>
            </div>
          </div>
        )}
        {f.preExisting === "Yes" && (
          <>
            <DrawerField label="Medical notes" required className="mt-4">
              <textarea className={AREA} value={f.medicalNotes} onChange={(e) => set({ medicalNotes: e.target.value })} placeholder="Describe condition(s), treatment history, and current status" />
            </DrawerField>
            <div className="mt-3 flex gap-2.5 rounded-md border border-amber-border bg-amber-soft p-3.5 text-[12.5px] leading-relaxed">
              <I.alertTri size={16} className="mt-0.5 shrink-0 text-amber" />
              <div>
                <b>Because pre-existing conditions = Yes:</b> the application is typed{" "}
                <b>Medical Evaluation</b>, and medical records + the Pacific Cross questionnaire are
                flagged required on the checklist.
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="Commercials" last>
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Preferred payment frequency">
            <select className={DRAWER_INPUT} value={f.payFreq} onChange={(e) => set({ payFreq: e.target.value })}>
              {WIZ_OPTS.payFreq.map((p) => (
                <option key={p} value={p}>
                  {p || "Select…"}
                </option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Estimated premium (₱)">
            <input className={DRAWER_INPUT} inputMode="numeric" value={f.premium} onChange={(e) => set({ premium: e.target.value.replace(/[^0-9,]/g, "") })} placeholder="0" />
          </DrawerField>
        </div>
      </Section>
    </div>
  );
}

/** CET (Corporate Enrollment Template) fields beyond name/DOB/role — see migration 0030. */
function CetMemberFields({
  m,
  index,
  onChange,
}: {
  m: WizardMember;
  index: number;
  onChange: (patch: Partial<WizardMember>) => void;
}) {
  const field = (key: keyof WizardMember) => (m[key] as string | undefined) ?? "";
  return (
    <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
      <DrawerField label="Last name">
        <input aria-label={`Member ${index + 1} last name`} className={DRAWER_INPUT} value={field("lastName")} onChange={(e) => onChange({ lastName: e.target.value })} />
      </DrawerField>
      <DrawerField label="First name">
        <input aria-label={`Member ${index + 1} first name`} className={DRAWER_INPUT} value={field("firstName")} onChange={(e) => onChange({ firstName: e.target.value })} />
      </DrawerField>
      <DrawerField label="M.I.">
        <input aria-label={`Member ${index + 1} middle initial`} className={DRAWER_INPUT} value={field("middleInitial")} onChange={(e) => onChange({ middleInitial: e.target.value })} />
      </DrawerField>
      <DrawerField label="Gender">
        <select aria-label={`Member ${index + 1} gender`} className={DRAWER_INPUT} value={field("gender")} onChange={(e) => onChange({ gender: e.target.value })}>
          {WIZ_OPTS.gender.map((g) => (
            <option key={g} value={g}>
              {g || "Select…"}
            </option>
          ))}
        </select>
      </DrawerField>
      <DrawerField label="Civil status">
        <select aria-label={`Member ${index + 1} civil status`} className={DRAWER_INPUT} value={field("civilStatus")} onChange={(e) => onChange({ civilStatus: e.target.value })}>
          {WIZ_OPTS.civil.map((c) => (
            <option key={c} value={c}>
              {c || "Select…"}
            </option>
          ))}
        </select>
      </DrawerField>
      <DrawerField label="Nationality">
        <input aria-label={`Member ${index + 1} nationality`} className={DRAWER_INPUT} value={field("nationality")} onChange={(e) => onChange({ nationality: e.target.value })} />
      </DrawerField>
      <DrawerField label="Place of birth">
        <input aria-label={`Member ${index + 1} place of birth`} className={DRAWER_INPUT} value={field("placeOfBirth")} onChange={(e) => onChange({ placeOfBirth: e.target.value })} />
      </DrawerField>
      <DrawerField label="Coverage effective date" hint="CET effective date, per member">
        <input aria-label={`Member ${index + 1} effective date`} className={DRAWER_INPUT} type="date" value={field("effectiveDate")} onChange={(e) => onChange({ effectiveDate: e.target.value })} />
      </DrawerField>
      <DrawerField label="Occupation / grade">
        <input aria-label={`Member ${index + 1} occupation or grade`} className={DRAWER_INPUT} value={field("occupationGrade")} onChange={(e) => onChange({ occupationGrade: e.target.value })} />
      </DrawerField>
      <DrawerField label="Room & board plan">
        <input aria-label={`Member ${index + 1} room and board plan`} className={DRAWER_INPUT} value={field("roomAndBoardPlan")} onChange={(e) => onChange({ roomAndBoardPlan: e.target.value })} />
      </DrawerField>
      <DrawerField label="Maximum benefit limit (₱)">
        <input aria-label={`Member ${index + 1} maximum benefit limit`} className={DRAWER_INPUT} inputMode="numeric" value={field("maximumBenefitLimit")} onChange={(e) => onChange({ maximumBenefitLimit: e.target.value.replace(/[^0-9,]/g, "") })} placeholder="0" />
      </DrawerField>
      <DrawerField label="PhilHealth member?">
        <YesNo value={field("philhealthMember")} onChange={(v) => onChange({ philhealthMember: v })} />
      </DrawerField>
      <DrawerField label="Email" className="col-span-2">
        <input aria-label={`Member ${index + 1} email`} className={DRAWER_INPUT} type="email" value={m.email} onChange={(e) => onChange({ email: e.target.value })} />
      </DrawerField>
      <DrawerField label="Mobile number">
        <input aria-label={`Member ${index + 1} mobile number`} className={DRAWER_INPUT} value={field("mobileNumber")} onChange={(e) => onChange({ mobileNumber: e.target.value })} />
      </DrawerField>
      <DrawerField label="Landline number">
        <input aria-label={`Member ${index + 1} landline number`} className={DRAWER_INPUT} value={field("landlineNumber")} onChange={(e) => onChange({ landlineNumber: e.target.value })} />
      </DrawerField>
      <DrawerField label="Address" className="col-span-4 max-[900px]:col-span-2">
        <input aria-label={`Member ${index + 1} address`} className={DRAWER_INPUT} value={field("address")} onChange={(e) => onChange({ address: e.target.value })} />
      </DrawerField>
      <DrawerField label="Beneficiary name" className="col-span-2">
        <input aria-label={`Member ${index + 1} beneficiary name`} className={DRAWER_INPUT} value={field("beneficiaryName")} onChange={(e) => onChange({ beneficiaryName: e.target.value })} />
      </DrawerField>
      <DrawerField label="Beneficiary birth date" className="col-span-2">
        <input aria-label={`Member ${index + 1} beneficiary birth date`} className={DRAWER_INPUT} type="date" value={field("beneficiaryBirthDate")} onChange={(e) => onChange({ beneficiaryBirthDate: e.target.value })} />
      </DrawerField>
    </div>
  );
}

function Step3Group({ f, set }: { f: WizardForm; set: (p: Partial<WizardForm>) => void }) {
  const members = f.members;
  const setMember = (i: number, m: WizardMember) =>
    set({ members: members.map((x, idx) => (idx === i ? m : x)) });
  const named = members.filter((m) => m.name.trim()).length;
  const tooFew = named < 3;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <Section title="Coverage & commercials">
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Coverage start date">
            <input className={DRAWER_INPUT} type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </DrawerField>
          <DrawerField label="Estimated premium (₱)">
            <input className={DRAWER_INPUT} inputMode="numeric" value={f.premium} onChange={(e) => set({ premium: e.target.value.replace(/[^0-9,]/g, "") })} placeholder="0" />
          </DrawerField>
        </div>
      </Section>

      <Section title="Member list" last>
        <div className={cn("mb-2 text-[12px] font-semibold", tooFew ? "text-red" : "text-brand")}>
          {named} member{named === 1 ? "" : "s"} {tooFew ? "· minimum 3" : "✓"}
        </div>
        <div className="overflow-x-auto rounded-md border border-border-soft">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border-soft text-[10.5px] font-bold uppercase tracking-[0.05em] text-subtle">
                <th className="px-3 py-2">Full name</th>
                <th className="px-3 py-2">Date of birth</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2" />
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const isOpen = expanded.has(i);
                return (
                  <Fragment key={i}>
                    <tr className={cn("border-b border-border-soft", !isOpen && "last:border-0")}>
                      <td className="px-2 py-1.5">
                        <input className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[12.5px] outline-none focus:border-brand focus:bg-card" value={m.name} onChange={(e) => setMember(i, { ...m, name: e.target.value })} placeholder="Full name" />
                      </td>
                      <td className="w-[140px] px-2 py-1.5">
                        <input className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-[12.5px] outline-none focus:border-brand focus:bg-card" type="date" value={m.dob} onChange={(e) => setMember(i, { ...m, dob: e.target.value })} />
                      </td>
                      <td className="w-[44px] px-3 py-1.5 tabular-nums text-muted-foreground">
                        {ageFromDob(m.dob) !== "" ? ageFromDob(m.dob) : "—"}
                      </td>
                      <td className="w-[120px] px-2 py-1.5">
                        <select className="h-8 w-full rounded-md border border-transparent bg-transparent px-1 text-[12.5px] outline-none focus:border-brand focus:bg-card" value={m.rel} onChange={(e) => setMember(i, { ...m, rel: e.target.value })}>
                          {WIZ_OPTS.relationship.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td className="w-[40px] px-2 py-1.5">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? `Hide CET details for member ${i + 1}` : `Show CET details for member ${i + 1}`}
                          onClick={() => toggleExpanded(i)}
                          className="grid size-7 place-items-center rounded-md text-subtle hover:bg-hover hover:text-foreground"
                        >
                          {isOpen ? <I.eyeOff size={14} /> : <I.eye size={14} />}
                        </button>
                      </td>
                      <td className="w-[40px] px-2 py-1.5">
                        <button
                          onClick={() => {
                            set({ members: members.filter((_, idx) => idx !== i) });
                            setExpanded((prev) => {
                              const next = new Set<number>();
                              prev.forEach((idx) => {
                                if (idx < i) next.add(idx);
                                else if (idx > i) next.add(idx - 1);
                              });
                              return next;
                            });
                          }}
                          className="grid size-7 place-items-center rounded-md text-subtle hover:bg-hover hover:text-red"
                        >
                          <I.fileMissing size={14} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border-soft bg-surface-2 last:border-0">
                        <td colSpan={6} className="p-3">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtle">
                            CET (Corporate Enrollment Template) details
                          </div>
                          <CetMemberFields m={m} index={i} onChange={(patch) => setMember(i, { ...m, ...patch })} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => set({ members: [...members, { name: "", dob: "", rel: "Employee", email: "" }] })}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-hover"
        >
          <I.plus size={14} /> Add member
        </button>
        {tooFew && (
          <div className="mt-3 flex gap-2.5 rounded-md border border-amber-border bg-amber-soft p-3.5 text-[12.5px]">
            <I.alertTri size={16} className="mt-0.5 shrink-0 text-amber" />
            <div>
              <b>Minimum 3 members required.</b> You can save a draft now, but final submission is
              blocked until at least 3 members are added.
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Step3Travel({ f, set, products, paymentChannels }: Pick<StepProps, "f" | "set" | "products" | "paymentChannels">) {
  const days = daysBetween(f.departure, f.returnDate);
  const plans = products.find((product) => product.productVersionId === f.productVersionId)?.planOptions ?? [];
  const addApplicant = () => set({ travelers: [...f.travelers, { name: f.displayName || [f.firstName, f.lastName].filter(Boolean).join(" "), dob: f.dob, nationality: f.nationality, gender: f.gender, contact: f.mobile, idType: "Passport", idNumber: f.passport, planOptionId: f.planOptionId, beneficiaryName: "", beneficiaryDob: "", beneficiaryRelationship: "", beneficiaryContact: "" }] });
  return (
    <div>
      <div className="mb-5 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
        <I.plane size={16} className="mt-0.5 shrink-0 text-brand" />
        <div>
          Travel insurance is a <b>lighter, per-trip workflow</b> — saving creates a TRV- request at
          Awaiting Payment; the policy is purchased in the portal after payment.
        </div>
      </div>
      <Section title="Traveler">
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Passport number" required hint="Before issuance">
            <input className={DRAWER_INPUT} value={f.passport} onChange={(e) => set({ passport: e.target.value })} placeholder="P1234567A" />
          </DrawerField>
          <DrawerField label="Travel purpose">
            <select className={DRAWER_INPUT} value={f.travelPurpose} onChange={(e) => set({ travelPurpose: e.target.value })}>
              {WIZ_OPTS.travelPurpose.map((p) => (
                <option key={p} value={p}>
                  {p || "Select…"}
                </option>
              ))}
            </select>
          </DrawerField>
        </div>
      </Section>
      <Section title="Persons to be insured">
        <div className="mb-2 flex items-center justify-between"><span className="text-[12px] text-muted-foreground">Capture each traveler and beneficiary needed for portal processing.</span><button type="button" onClick={addApplicant} className="text-[12px] font-semibold text-brand-hover">Use applicant</button></div>
        <div className="space-y-2">{f.travelers.map((traveler, index) => <div key={index} className="rounded-md border border-border-soft p-3"><div className="grid grid-cols-3 gap-2"><input aria-label={`Traveler ${index + 1} name`} className={DRAWER_INPUT} value={traveler.name} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, name: e.target.value } : item) })} placeholder="Full name" /><input aria-label={`Traveler ${index + 1} birthdate`} className={DRAWER_INPUT} type="date" value={traveler.dob} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, dob: e.target.value } : item) })} /><select aria-label={`Traveler ${index + 1} plan`} className={DRAWER_INPUT} value={traveler.planOptionId} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, planOptionId: e.target.value } : item) })}><option value="">Plan…</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><select aria-label={`Traveler ${index + 1} ID type`} className={DRAWER_INPUT} value={traveler.idType} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, idType: e.target.value } : item) })}><option>Passport</option><option>Government-issued ID</option></select><input aria-label={`Traveler ${index + 1} ID number`} className={DRAWER_INPUT} value={traveler.idNumber} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, idNumber: e.target.value } : item) })} placeholder="ID / passport number" /><input aria-label={`Traveler ${index + 1} beneficiary`} className={DRAWER_INPUT} value={traveler.beneficiaryName} onChange={(e) => set({ travelers: f.travelers.map((item, i) => i === index ? { ...item, beneficiaryName: e.target.value } : item) })} placeholder="Beneficiary name" /></div><button type="button" onClick={() => set({ travelers: f.travelers.filter((_, i) => i !== index) })} className="mt-2 text-[11px] font-semibold text-red">Remove traveler</button></div>)}</div>
        <button type="button" onClick={() => set({ travelers: [...f.travelers, { name: "", dob: "", nationality: "", gender: "", contact: "", idType: "Passport", idNumber: "", planOptionId: f.planOptionId, beneficiaryName: "", beneficiaryDob: "", beneficiaryRelationship: "", beneficiaryContact: "" }] })} className="mt-2 text-[12px] font-semibold text-brand-hover"><I.plus size={13} className="mr-1 inline" />Add traveler</button>
      </Section>
      <Section title="Trip">
        <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-1">
          <DrawerField label="Destination country" required>
            <input className={DRAWER_INPUT} value={f.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="e.g. Japan" />
          </DrawerField>
          <DrawerField label="Departure date" required>
            <input className={DRAWER_INPUT} type="date" value={f.departure} onChange={(e) => set({ departure: e.target.value })} />
          </DrawerField>
          <DrawerField label="Return date" required>
            <input className={DRAWER_INPUT} type="date" value={f.returnDate} onChange={(e) => set({ returnDate: e.target.value })} />
          </DrawerField>
        </div>
        {days !== "" && (
          <div className="mt-2 text-[12.5px] text-muted-foreground">
            Travel days: <b className="text-foreground">{days}</b> (auto-calculated)
          </div>
        )}
        <DrawerField label="Itinerary / route" className="mt-4"><textarea className={AREA} value={f.itinerary} onChange={(e) => set({ itinerary: e.target.value })} placeholder="Cities, flight route, or trip notes" /></DrawerField>
      </Section>
      <Section title="Payment" last>
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Travelers"><input className={DRAWER_INPUT} readOnly value={f.travelers.filter((traveler) => traveler.name.trim()).length || "—"} /></DrawerField>
          <DrawerField label="Quoted premium (₱)">
            <input className={DRAWER_INPUT} inputMode="numeric" value={f.premium} onChange={(e) => set({ premium: e.target.value.replace(/[^0-9,]/g, "") })} placeholder="0" />
          </DrawerField>
          <DrawerField label="Official payment channel" hint="Business payee; may be selected later"><select className={DRAWER_INPUT} value={f.paymentChannelId} onChange={(e) => set({ paymentChannelId: e.target.value })}><option value="">Select later…</option>{paymentChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></DrawerField>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------- Step 4 ------------------------------- */
export function Step4({ f, set }: StepProps) {
  const list = f.checklist;
  return (
    <div>
      <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
        <I.clipboard size={16} className="mt-0.5 shrink-0 text-brand" />
        <div>
          This checklist was <b>auto-generated from the selected product</b>. Check off items as
          they&apos;re received; request the rest with the split Create button.
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {list.map((r) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3.5 py-2.5",
              r.checked ? "border-brand/40 bg-brand-soft/50" : "border-border-soft",
            )}
          >
            <button
              onClick={() =>
                set({
                  checklist: list.map((x) => (x.name === r.name ? { ...x, checked: !x.checked } : x)),
                })
              }
              className={cn(
                "grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px] transition-colors",
                r.checked ? "border-brand bg-brand text-white" : "border-border-strong text-transparent",
              )}
            >
              <I.check size={13} />
            </button>
            <span className="flex-1 text-[13px] font-[550]">
              {r.name}
              {r.cond && <span className="ml-2 text-[11px] font-semibold text-subtle">({r.cond})</span>}
            </span>
            <select
              className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12px] outline-none focus:border-brand"
              value={r.status}
              onChange={(e) =>
                set({
                  checklist: list.map((x) => (x.name === r.name ? { ...x, status: e.target.value } : x)),
                })
              }
            >
              {WIZ_OPTS.docStatus.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
        {list.length === 0 && (
          <div className="rounded-md bg-surface-2 px-4 py-6 text-center text-[13px] text-subtle">
            Select a product in Step 1 to generate the checklist.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Step 5 ------------------------------- */
export function Step5({
  f,
  set,
  templates,
  agentName,
}: StepProps & { templates: EmailTemplate[]; agentName: string }) {
  const applyTemplate = (name: string) => {
    const t = templates.find((x) => x.name === name);
    // A staged carrier asset belongs to the template that required it — clear it on every switch,
    // the same way `EmailForm` (../send-email.tsx) does.
    if (!t) {
      set({ emailTemplate: name, emailLibraryDocumentId: "" });
      return;
    }
    const ctx = {
      first_name: (f.displayName || f.companyName || "there").split(" ")[0],
      product: f.productName || "your plan",
      premium: f.premium ? "₱" + f.premium : undefined,
      agent: agentName,
    };
    set({
      emailTemplate: name,
      emailSubject: fillTemplate(t.subject, ctx),
      emailBody: fillTemplate(t.body, ctx),
      emailRecipient: f.emailRecipient || f.email,
      emailLibraryDocumentId: "",
    });
  };

  return (
    <div>
      <Section title="Initial email">
        <Toggle
          on={f.sendEmail}
          onToggle={() => set({ sendEmail: !f.sendEmail, emailRecipient: f.emailRecipient || f.email })}
          label="Compose an initial email from a template"
        />
        {f.sendEmail && (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-4">
              <DrawerField label="Email template" required>
                <select className={DRAWER_INPUT} value={f.emailTemplate} onChange={(e) => applyTemplate(e.target.value)}>
                  <option value="">Select…</option>
                  {templates.map((t) => (
                    <option key={t.id}>{t.name}</option>
                  ))}
                </select>
              </DrawerField>
              <DrawerField label="Recipient" required>
                <input className={DRAWER_INPUT} type="email" value={f.emailRecipient} onChange={(e) => set({ emailRecipient: e.target.value })} placeholder="client@email.com" />
              </DrawerField>
            </div>
            <DrawerField label="Subject" className="mt-4">
              <input className={DRAWER_INPUT} value={f.emailSubject} onChange={(e) => set({ emailSubject: e.target.value })} />
            </DrawerField>
            <DrawerField label="Message" className="mt-4">
              <textarea className={cn(AREA, "min-h-[130px]")} value={f.emailBody} onChange={(e) => set({ emailBody: e.target.value })} />
            </DrawerField>
            <WizardAttachmentPicker
              templateName={f.emailTemplate}
              productName={f.productName}
              dob={f.dob}
              value={f.emailLibraryDocumentId}
              onChange={(id) => set({ emailLibraryDocumentId: id })}
            />
          </div>
        )}
      </Section>

      <Section title="Follow-up task" last>
        <Toggle
          on={f.createTask}
          onToggle={() => set({ createTask: !f.createTask })}
          label="Create a follow-up task on the board + dashboard"
        />
        {f.createTask && (
          <DrawerField label="Follow-up date" className="mt-3">
            <input className={DRAWER_INPUT} type="date" value={f.followDate} onChange={(e) => set({ followDate: e.target.value })} />
          </DrawerField>
        )}
        <DrawerField label="Internal note" className="mt-4" hint="Adds a private note to the record">
          <textarea className={AREA} value={f.internalNote} onChange={(e) => set({ internalNote: e.target.value })} />
        </DrawerField>
      </Section>
    </div>
  );
}

/**
 * Step 5's carrier-attachment picker — the wizard's half of the gate `sendEmailAction` enforces
 * everywhere else. Not `../library-attachment-picker`'s `LibraryAttachmentPicker`, which resolves
 * eligibility from a `clientId`: the contact this email is about may not exist until Create, so
 * this one asks against the form's product and birthdate instead. Same markup and copy, so the two
 * surfaces read identically. `createFromWizardAction` re-checks the choice before it logs anything.
 */
function WizardAttachmentPicker({
  templateName,
  productName,
  dob,
  value,
  onChange,
}: {
  templateName: string;
  productName: string;
  dob: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  // Read inside the async callback only, so the lookup keys off the query inputs alone — `onChange`
  // is an inline closure here and would otherwise re-fire the effect on every render.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    if (!templateNeedsLibraryAttachment(templateName)) return;
    let current = true;
    listWizardEmailAttachmentsAction({ templateName, productName, dob }).then((result) => {
      if (!current) return;
      const found = result.ok ? result.data.documents : [];
      setDocuments(found);
      setReason(result.ok ? result.data.reason : result.error);
      // Drop a pick the product or age band no longer makes eligible.
      if (latest.current.value && !found.some((doc) => doc.id === latest.current.value)) latest.current.onChange("");
    });
    return () => {
      current = false;
    };
  }, [templateName, productName, dob]);

  if (!templateNeedsLibraryAttachment(templateName)) return null;
  return (
    <div className="mt-4 rounded-md border border-border-soft bg-surface-2 p-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.05em] text-subtle">
        <I.folder size={13} /> Carrier attachment <span className="text-red">*</span>
      </div>
      {reason ? (
        <div className="rounded-md border border-amber-border bg-amber-soft px-3 py-2 text-[12px] text-amber">{reason}</div>
      ) : (
        <select className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[12.5px]" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select approved asset…</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.documentName} · {doc.versionLabel}{doc.variant ? ` · ${doc.variant}` : ""} · {doc.ageBand}
            </option>
          ))}
        </select>
      )}
      <p className="mt-2 text-[11.5px] text-faint">Logged for audit only — this file and email are not delivered.</p>
    </div>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5 text-left"
    >
      <span className="text-[13px] font-[550]">{label}</span>
      <span className={cn("relative h-[22px] w-[40px] rounded-full transition-colors", on ? "bg-brand" : "bg-border-strong")}>
        <span className={cn("absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-all", on ? "left-[20px]" : "left-[2px]")} />
      </span>
    </button>
  );
}

/* ------------------------------- Step 6 ------------------------------- */
export function Step6({ f, set }: StepProps) {
  const clientName = f.convertClientName ?? (f.displayName || f.companyName || f.existingClientName || "—");
  const contact = f.email || f.mobile || "—";
  const willCreate: string[] = [
    f.category === "hmo"
      ? `Company / group account — ${f.companyName || clientName}`
      : f.convertClientId
        // Only promise the conversion when it will actually happen. The server gates it on
        // `form.status !== "Lead"` (wizard-actions.ts `startsApplication`), and status is derived
        // from the application type — which defaults to the inquiry type for a convert, so
        // by default this save does NOT convert.
        ? f.status === "Lead"
          ? `Application for ${clientName} — ${clientName} stays a Lead (application type is “${f.appType || INQUIRY_APP_TYPE}”)`
          : `Lead → Applicant conversion for ${clientName} (same record)`
        : f.clientMode === "existing"
          ? `Application under ${clientName}'s existing record`
          : `Client record — ${clientName} · status ${f.status}`,
    f.category === "travel"
      ? `Travel request — ${f.destination || "trip"} · Awaiting Payment`
      : `Application record linked to ${f.productName || "product"}`,
    `Document checklist (${f.checklist.length} items)`,
    `Timeline entry — application created`,
  ];
  // Matches `createFromWizardAction`'s pre-flight condition: no recipient means no email is
  // logged, so nothing to attach to.
  const needsAttachment = f.sendEmail && !!(f.emailRecipient || f.email) && templateNeedsLibraryAttachment(f.emailTemplate);
  const attachmentMissing = needsAttachment && !f.emailLibraryDocumentId;
  if (f.createTask) willCreate.push("Follow-up task on the board + dashboard");
  if (f.sendEmail)
    willCreate.push(
      `Logged email — ${f.emailTemplate || "initial email"} (not delivered)${needsAttachment && !attachmentMissing ? " · with its carrier attachment" : ""}`,
    );
  if (f.preExisting === "Yes") willCreate.push("Medical Evaluation type — records + questionnaire required");

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <ReviewCard
          title={f.category === "hmo" ? "Group account" : f.convertClientId ? "Lead" : "Client"}
          icon="user"
        >
          <ReviewRow k="Name" v={clientName} />
          <ReviewRow k="Contact" v={contact} />
          {f.category !== "hmo" && <ReviewRow k="Channels" v={f.channels.join(", ") || "Not set"} />}
        </ReviewCard>
        <ReviewCard title="Product & ownership" icon="shield">
          <ReviewRow k="Product" v={f.productName || "Not set"} />
          <ReviewRow k="Type" v={f.appType || "Not set"} />
          <ReviewRow k="Source" v={f.source || "Not set"} />
          <ReviewRow k="Priority" v={f.priority} />
        </ReviewCard>
      </div>

      <DrawerField label="Initial application status" required className="mt-5">
        <select className={DRAWER_INPUT} value={f.status} onChange={(e) => set({ status: e.target.value })}>
          {WIZ_OPTS.statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </DrawerField>

      <div className="mt-5">
        <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.07em] text-subtle">
          This will automatically create
        </div>
        <div className="flex flex-col gap-1.5">
          {willCreate.map((t, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3.5 py-2 text-[12.5px]">
              <I.check size={14} className="shrink-0 text-brand" />
              {t}
            </div>
          ))}
        </div>
        {attachmentMissing && (
          <div className="mt-3 flex gap-2.5 rounded-md border border-red-border bg-red-soft p-3.5 text-[12.5px] leading-relaxed text-red">
            <I.alertTri size={16} className="mt-0.5 shrink-0" />
            <div>
              <b>Carrier attachment required.</b> “{f.emailTemplate}” must carry an approved carrier asset before
              this application can be created. Go back to <b>Step 5</b> to select one, or pick a template that
              doesn’t need an attachment.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: "user" | "shield";
  children: React.ReactNode;
}) {
  const Ico = I[icon];
  return (
    <div className="rounded-md border border-border-soft bg-surface-2 p-4">
      <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        <Ico size={14} /> {title}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border-soft py-1.5 text-[13px] last:border-0">
      <span className="text-subtle">{k}</span>
      <span className="text-right font-[600]">{v}</span>
    </div>
  );
}
