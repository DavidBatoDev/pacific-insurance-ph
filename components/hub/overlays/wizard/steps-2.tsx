"use client";

import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { DRAWER_INPUT, DrawerField } from "../client-picker";
import { Section, type StepProps } from "./steps-1";
import {
  ageFromDob,
  daysBetween,
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
export function Step3({ f, set }: StepProps) {
  if (!f.category)
    return (
      <div className="flex gap-2.5 rounded-md border border-amber-border bg-amber-soft p-3.5 text-[13px]">
        <I.alertTri size={16} className="mt-0.5 shrink-0 text-amber" />
        Select a product in Step 1 to configure product-specific details.
      </div>
    );
  if (f.category === "hmo") return <Step3Group f={f} set={set} />;
  if (f.category === "travel") return <Step3Travel f={f} set={set} />;
  return <Step3Health f={f} set={set} />;
}

function Step3Health({ f, set }: { f: WizardForm; set: (p: Partial<WizardForm>) => void }) {
  return (
    <div>
      <Section title="Plan & coverage">
        <div className="grid grid-cols-2 gap-4">
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
        {f.coverage === "Family" && (
          <DrawerField label="Number of applicants / dependents" required className="mt-4">
            <input className={DRAWER_INPUT} type="number" min={1} value={f.dependents} onChange={(e) => set({ dependents: e.target.value })} placeholder="e.g. 3" />
          </DrawerField>
        )}
      </Section>

      <Section title="Underwriting">
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Existing Pacific Cross client?">
            <YesNo value={f.existingPC} onChange={(v) => set({ existingPC: v })} />
          </DrawerField>
          <DrawerField label="Pre-existing conditions?" required hint="Required before Pacific Cross submission.">
            <YesNo value={f.preExisting} onChange={(v) => set({ preExisting: v })} unknown />
          </DrawerField>
        </div>
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

function Step3Group({ f, set }: { f: WizardForm; set: (p: Partial<WizardForm>) => void }) {
  const members = f.members;
  const setMember = (i: number, m: WizardMember) =>
    set({ members: members.map((x, idx) => (idx === i ? m : x)) });
  const named = members.filter((m) => m.name.trim()).length;
  const tooFew = named < 3;

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
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i} className="border-b border-border-soft last:border-0">
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
                      onClick={() => set({ members: members.filter((_, idx) => idx !== i) })}
                      className="grid size-7 place-items-center rounded-md text-subtle hover:bg-hover hover:text-red"
                    >
                      <I.fileMissing size={14} />
                    </button>
                  </td>
                </tr>
              ))}
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

function Step3Travel({ f, set }: { f: WizardForm; set: (p: Partial<WizardForm>) => void }) {
  const days = daysBetween(f.departure, f.returnDate);
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
      </Section>
      <Section title="Payment" last>
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Travelers">
            <input className={DRAWER_INPUT} type="number" min={1} value={f.dependents} onChange={(e) => set({ dependents: e.target.value })} placeholder="1" />
          </DrawerField>
          <DrawerField label="Quoted premium (₱)">
            <input className={DRAWER_INPUT} inputMode="numeric" value={f.premium} onChange={(e) => set({ premium: e.target.value.replace(/[^0-9,]/g, "") })} placeholder="0" />
          </DrawerField>
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
    if (!t) {
      set({ emailTemplate: name });
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
        ? `Lead → Applicant conversion for ${clientName} (same record)`
        : f.clientMode === "existing"
          ? `Application under ${clientName}'s existing record`
          : `Client record — ${clientName} · status ${f.status}`,
    f.category === "travel"
      ? `Travel request — ${f.destination || "trip"} · Awaiting Payment`
      : `Application record linked to ${f.productName || "product"}`,
    `Document checklist (${f.checklist.length} items)`,
    `Timeline entry — application created`,
  ];
  if (f.createTask) willCreate.push("Follow-up task on the board + dashboard");
  if (f.sendEmail) willCreate.push(`Logged email — ${f.emailTemplate || "initial email"} (not delivered)`);
  if (f.preExisting === "Yes") willCreate.push("Medical Evaluation type — records + questionnaire required");

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
        <ReviewCard title={f.category === "hmo" ? "Group account" : "Client"} icon="user">
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
