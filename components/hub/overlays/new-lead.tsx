"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createLeadAction } from "@/app/(app)/prospects/actions";
import { I } from "../icons";
import { LEAD_STAGES, LEAD_STATUSES, PRODUCT_COLORS } from "../lead-config";
import { Btn, INPUT } from "../primitives";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/**
 * New Lead drawer (modals.md §1). Creates a unified contact record at
 * lifecycle_stage = Lead with a starting stage/status.
 */

const SOURCES = [
  "Referral",
  "Personal network",
  "Business network",
  "Existing client",
  "Website",
  "Social media",
  "Other",
];


export function NewLeadDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [estPremium, setEstPremium] = useState("");
  const [source, setSource] = useState("Referral");
  const [stage, setStage] = useState("New Lead");
  const [status, setStatus] = useState("New");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [follow, setFollow] = useState("");
  const [notes, setNotes] = useState("");

  const canSave =
    firstName.trim() && lastName.trim() && dateOfBirth && (email.trim() || mobile.trim()) && !pending;

  const save = () => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await createLeadAction({
        firstName,
        lastName,
        email: email.trim() || null,
        mobileNumber: mobile.trim() || null,
        productInterest: product || null,
        estPremium: estPremium ? Number(estPremium.replace(/[^0-9]/g, "")) : null,
        leadSource: source,
        startingStage: stage,
        startingStatus: status,
        dateOfBirth,
        nextFollowUpDate: follow || null,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        overlays.toast(
          "Lead created",
          `${res.data.fullName} — ${stage} · ${status}${product ? " · " + product : ""}.`,
        );
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t create lead", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="trendUp"
      title="New lead"
      sub="Creates a unified contact record at lifecycle stage Lead"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.plus size={15} /> {pending ? "Creating…" : "Create lead"}
          </Btn>
        </>
      }
    >
      <FieldGroup title="Lead identity" sub="The details needed to identify this prospective client.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" required>
            <input autoFocus className={INPUT} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name" required>
            <input className={INPUT} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
          <Field label="Date of birth" required>
            <input className={INPUT} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Contact details" sub="Enter an email address or mobile number — one is required.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
          </Field>
          <Field label="Mobile number">
            <input className={INPUT} type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+63 9XX XXX XXXX" />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Lead context" sub="Optional details that help prioritize the first follow-up.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product interest">
            <select className={INPUT} value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">Choose a product…</option>
              {Object.keys(PRODUCT_COLORS).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Estimated premium (₱)">
            <input
              className={INPUT}
              inputMode="numeric"
              value={estPremium}
              onChange={(e) => setEstPremium(e.target.value.replace(/[^0-9,]/g, ""))}
              placeholder="0"
            />
          </Field>
          <Field label="Source">
            <select className={INPUT} value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Next follow-up">
            <input className={INPUT} type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Pipeline placement" sub="Leave the defaults for a new inquiry; change them only for a warm or migrated lead.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting stage">
            <select className={INPUT} value={stage} onChange={(e) => setStage(e.target.value)}>
              {LEAD_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Starting status">
            <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
              {LEAD_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Notes">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Inquiry context, discovery notes…"
        />
      </FieldGroup>

      <div className="mt-4 flex gap-2.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <I.trendUp size={15} className="mt-0.5 shrink-0" />
        <div>
          The lead lands in the <b>{stage}</b> column with status <b>{status}</b>. One record per
          person — converting later flips the same record to Applicant, never a duplicate.
        </div>
      </div>
    </Drawer>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}

function FieldGroup({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-border-soft pt-4 first:mt-0 first:border-0 first:pt-0">
      <div className="mb-3">
        <h3 className="text-[12.5px] font-bold text-foreground">{title}</h3>
        {sub && <p className="mt-0.5 text-[11.5px] text-subtle">{sub}</p>}
      </div>
      {children}
    </section>
  );
}
