"use client";

import type { ProductOption } from "@/app/(app)/policies/actions";
import type { AssignableUser } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { Avatar } from "../../primitives";
import { ClientPicker, DRAWER_INPUT, DrawerField, type PickedClient } from "../client-picker";
import {
  ageFromDob,
  categoryForProduct,
  WIZ_OPTS,
  type WizardForm,
} from "./wizard-data";

/** Wizard steps 1–2 (design new-application-steps1.jsx). */

export interface StepProps {
  f: WizardForm;
  set: (patch: Partial<WizardForm>) => void;
  products: ProductOption[];
  users: AssignableUser[];
}

const AREA =
  "w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand";

export function Step1({ f, set, products, users }: StepProps) {
  return (
    <div>
      <Section title="Workflow">
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Application type" required>
            <select className={DRAWER_INPUT} value={f.appType} onChange={(e) => set({ appType: e.target.value })}>
              <option value="">Select…</option>
              {WIZ_OPTS.appType.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Source" required>
            <select className={DRAWER_INPUT} value={f.source} onChange={(e) => set({ source: e.target.value })}>
              <option value="">Select…</option>
              {WIZ_OPTS.sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </DrawerField>
        </div>
      </Section>

      <Section title="Product">
        <DrawerField label="Product" required hint="Products come from the editable Products module; the category drives the workflow.">
          <select
            className={DRAWER_INPUT}
            value={f.productVersionId}
            onChange={(e) => {
              const p = products.find((x) => x.productVersionId === e.target.value);
              set({
                productVersionId: e.target.value,
                productName: p?.productName ?? "",
                category: p ? categoryForProduct(p.productName) : "",
              });
            }}
          >
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.productVersionId} value={p.productVersionId}>
                {p.productName}
              </option>
            ))}
          </select>
        </DrawerField>
        {f.category && (
          <div className="mt-2 text-[12px] text-muted-foreground">
            Workflow:{" "}
            <b>{f.category === "hmo" ? "Group HMO" : f.category === "travel" ? "Travel Insurance" : "Health Insurance"}</b>
          </div>
        )}
      </Section>

      <Section title="Client">
        {f.draftApplicationId ? (
          <div className="flex items-center gap-3 rounded-md border border-brand/30 bg-brand-soft px-3.5 py-3">
            <Avatar name={f.existingClientName || f.displayName || "Linked client"} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-[650]">Linked lead/client</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                {f.existingClientName || f.displayName} · This draft always updates the same record.
              </div>
            </div>
            <span className="rounded-full border border-green-border bg-green-soft px-2 py-0.5 text-[10.5px] font-bold text-green">
              Linked
            </span>
          </div>
        ) : (
          <>
            <DrawerField label="New or existing client" required>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    ["new", "New client", "Create a fresh client profile"],
                    ["existing", "Existing client", "Add application under an existing record"],
                  ] as const
                ).map(([modeVal, title, desc]) => (
                  <button
                    key={modeVal}
                    type="button"
                    onClick={() =>
                      set({
                        clientMode: modeVal,
                        ...(modeVal === "new" ? { existingClientId: null, existingClientName: "" } : {}),
                      })
                    }
                    className={cn(
                      "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-left transition-colors",
                      f.clientMode === modeVal ? "border-brand bg-brand-soft" : "border-border-strong hover:bg-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 place-items-center rounded-full border-[1.5px]",
                        f.clientMode === modeVal ? "border-brand" : "border-border-strong",
                      )}
                    >
                      {f.clientMode === modeVal && <span className="size-2 rounded-full bg-brand" />}
                    </span>
                    <span>
                      <span className="block text-[13px] font-[650]">{title}</span>
                      <span className="block text-[11.5px] text-subtle">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </DrawerField>
            {f.clientMode === "existing" && !f.convertClientId && (
              <DrawerField label="Search existing client" required className="mt-3" hint="Contact details are pulled from the existing record — the same record is used, no duplicate.">
                <ClientPicker
                  value={f.existingClientId ? { id: f.existingClientId, name: f.existingClientName } : null}
                  onPick={(c: PickedClient) =>
                    set({ existingClientId: c.id, existingClientName: c.name, displayName: c.name })
                  }
                  onClear={() => set({ existingClientId: null, existingClientName: "" })}
                />
              </DrawerField>
            )}
          </>
        )}
      </Section>

      <Section title="Ownership" last>
        <div className="grid grid-cols-2 gap-4">
          <DrawerField label="Assigned agent" required>
            <select className={DRAWER_INPUT} value={f.assignedUserId} onChange={(e) => set({ assignedUserId: e.target.value })}>
              <option value="">Me</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Application priority">
            <select className={DRAWER_INPUT} value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
              {WIZ_OPTS.priority.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </DrawerField>
        </div>
      </Section>
    </div>
  );
}

export function Step2({ f, set, linkedClientName }: StepProps & { linkedClientName?: string | null }) {
  if (f.category === "hmo") {
    return (
      <div>
        <div className="mb-5 flex gap-2.5 rounded-md border border-blue-border bg-blue-soft p-3.5 text-[12.5px] leading-relaxed">
          <I.building size={16} className="mt-0.5 shrink-0 text-blue" />
          <div>
            Group HMO creates a <b>Company / Group account</b> with multiple members. Enter the
            primary contact here — members are added in the next step.
          </div>
        </div>
        <Section title="Company / group" last>
          <DrawerField label="Company / group name" required>
            <input className={DRAWER_INPUT} value={f.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="e.g. Northwind Logistics Inc." />
          </DrawerField>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <DrawerField label="Company contact person" required>
              <input className={DRAWER_INPUT} value={f.companyContact} onChange={(e) => set({ companyContact: e.target.value })} placeholder="Full name" />
            </DrawerField>
            <DrawerField label="Contact number" required>
              <input className={DRAWER_INPUT} value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="+63 9XX XXX XXXX" />
            </DrawerField>
            <DrawerField label="Contact email" required>
              <input className={DRAWER_INPUT} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="hr@company.com" />
            </DrawerField>
            <DrawerField label="Number of members" required hint="Minimum 3 members required.">
              <input className={DRAWER_INPUT} type="number" min={3} value={f.memberCount} onChange={(e) => set({ memberCount: e.target.value })} placeholder="3" />
            </DrawerField>
          </div>
          <DrawerField label="Company address" className="mt-4">
            <textarea className={AREA} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Building, street, city, province" />
          </DrawerField>
        </Section>
      </div>
    );
  }

  const linked = (f.clientMode === "existing" && f.existingClientId) || f.convertClientId;
  const resumedDraft = Boolean(f.draftApplicationId);
  const linkedName = linkedClientName ?? f.convertClientName ?? f.existingClientName;
  const lockIdentity = linked && !resumedDraft;
  const age = ageFromDob(f.dob);

  return (
    <div>
      {linked && (
        <div className="mb-5 flex items-center gap-3 rounded-md border border-border-soft bg-surface-2 px-4 py-3">
          <Avatar name={linkedName || "Client"} size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-[650]">{linkedName}</div>
            <div className="text-[12px] text-subtle">
              {resumedDraft
                ? "Linked lead/client · the same record is updated when this draft is saved."
                : f.convertClientId
                ? "Converting from Lead → Applicant. The same record is used — no duplicate is created."
                : "Linked existing client · profile pulled in automatically."}
            </div>
          </div>
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-green-border bg-green-soft px-2.5 text-[11.5px] font-[650] text-green">
            <span className="size-1.5 rounded-full bg-current" />
            {resumedDraft ? "Linked" : f.convertClientId ? "Converting" : "Existing"}
          </span>
        </div>
      )}
      {!lockIdentity && (
        <Section title="Name">
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="First name" required>
              <input
                className={DRAWER_INPUT}
                value={f.firstName}
                onChange={(e) => set({ firstName: e.target.value, displayName: (e.target.value + " " + f.lastName).trim() })}
              />
            </DrawerField>
            <DrawerField label="Last name" required>
              <input
                className={DRAWER_INPUT}
                value={f.lastName}
                onChange={(e) => set({ lastName: e.target.value, displayName: (f.firstName + " " + e.target.value).trim() })}
              />
            </DrawerField>
          </div>
        </Section>
      )}

      <Section title="Contact">
        {!lockIdentity && (
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="Email address" hint="Required if email communication will be used.">
              <input className={DRAWER_INPUT} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@email.com" />
            </DrawerField>
            <DrawerField label="Mobile number" required hint="Enables call, WhatsApp, and Viber documentation.">
              <input className={DRAWER_INPUT} value={f.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="+63 9XX XXX XXXX" />
            </DrawerField>
          </div>
        )}
        <DrawerField label="Preferred communication channel" className={lockIdentity ? "" : "mt-4"}>
          <div className="flex flex-wrap gap-1.5">
            {WIZ_OPTS.channels.map((c) => {
              const on = f.channels.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    set({ channels: on ? f.channels.filter((x) => x !== c) : [...f.channels, c] })
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    on ? "border-brand bg-brand-soft text-brand-hover" : "border-border-strong text-muted-foreground hover:bg-hover",
                  )}
                >
                  {on && <I.check size={13} />}
                  {c}
                </button>
              );
            })}
          </div>
        </DrawerField>
      </Section>

      <Section title="Personal details" last>
        <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-2">
          {!lockIdentity && (
            <>
              <DrawerField label="Date of birth">
                <input className={DRAWER_INPUT} type="date" value={f.dob} onChange={(e) => set({ dob: e.target.value })} />
              </DrawerField>
              <DrawerField label="Age" hint="Auto-calculated">
                <input className={cn(DRAWER_INPUT, "bg-surface-3 text-muted-foreground")} readOnly value={age !== "" ? age + " years" : ""} placeholder="—" />
              </DrawerField>
            </>
          )}
          <DrawerField label="Gender">
            <select className={DRAWER_INPUT} value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
              {WIZ_OPTS.gender.map((g) => (
                <option key={g} value={g}>
                  {g || "Select…"}
                </option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Civil status">
            <select className={DRAWER_INPUT} value={f.civil} onChange={(e) => set({ civil: e.target.value })}>
              {WIZ_OPTS.civil.map((c) => (
                <option key={c} value={c}>
                  {c || "Select…"}
                </option>
              ))}
            </select>
          </DrawerField>
          <DrawerField label="Occupation">
            <input className={DRAWER_INPUT} value={f.occupation} onChange={(e) => set({ occupation: e.target.value })} />
          </DrawerField>
        </div>
        <DrawerField label="Address" className="mt-4" hint="Optional now; may be required before final submission.">
          <textarea className={AREA} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Unit, street, barangay, city, province" />
        </DrawerField>
        <DrawerField label="Notes" className="mt-4">
          <textarea className={AREA} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Discovery notes and client context" />
        </DrawerField>
      </Section>
    </div>
  );
}

export function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-6"}>
      <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.07em] text-subtle">{title}</div>
      {children}
    </div>
  );
}
