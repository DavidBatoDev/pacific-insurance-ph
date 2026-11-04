"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { queueDueRenewalEmailsAction, saveRenewalEmailRuleAction } from "@/app/(app)/renewals/automation-actions";
import type { ExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import type { RenewalDateBasis, RenewalEmailRule, RenewalEmailRuleUpdate, RenewalQueueCounts } from "@/lib/repositories/renewal-automation/renewal-automation.entity";
import type { EmailTemplate } from "@/lib/repositories/templates";
import { MERGE_FIELDS } from "@/lib/templates/merge";
import { INPUT } from "@/components/hub/primitives";

const CONTROL = INPUT + " disabled:bg-surface-3 disabled:text-muted-foreground";
const LABEL = "mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle";
const BUTTON = "rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60";
const TEMPLATE_FIELDS = [...MERGE_FIELDS, "{{name}}", "{{budget}}", "{{family_size}}", "{{coverage_tier}}", "{{reference}}", "{{channel}}"];
const RULE_HELP: Record<RenewalEmailRule["key"], string> = {
  notice_received: "Draft immediately when the renewal notice is received.",
  client_reminder: "Remind the client before renewal. The default is 30 days before the renewal due date.",
  missing_notice: "Ask the carrier for a missing notice, only while no notice has been received. The default is 60 days before renewal.",
  premium_breakdown: "Request a premium breakdown for every renewal, regardless of a premium increase. The default is 60 days before renewal.",
};

export function RenewalEmailRulesTab({ rules, templates, contacts, canEdit }: {
  rules: RenewalEmailRule[];
  templates: EmailTemplate[];
  contacts: ExternalContact[];
  canEdit: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<RenewalQueueCounts | null>(null);

  async function queueDue() {
    setRunning(true);
    setError(null);
    setCounts(null);
    try {
      const result = await queueDueRenewalEmailsAction();
      if (result.ok) setCounts(result.data);
      else setError(result.error);
    } catch {
      setError("Could not queue renewal drafts. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[720px]">
          <h3 className="text-[15px] font-bold">Renewal email rules</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Due rules create email drafts for review, with one draft per rule per renewal cycle. Re-running refreshes eligible drafts without creating duplicates. Nothing is sent automatically: Admin or Staff review each draft and send it from admin@pacificinsuranceph.com. Drafts logged before Gmail sending stay marked as logged only.
          </p>
          {!canEdit && <p className="mt-2 text-[12.5px] text-muted-foreground">Admin controls rule settings and queue runs. Staff can view rules and review drafts from Tasks.</p>}
        </div>
        {canEdit && <button type="button" className={BUTTON} onClick={queueDue} disabled={running}>{running ? "Queuing drafts…" : "Queue due now"}</button>}
      </div>
      {error && <p role="alert" className="mb-4 text-[12.5px] text-destructive">{error}</p>}
      {counts && <p role="status" className="mb-4 rounded-md border border-border-soft bg-surface-3 px-4 py-3 text-[12.5px]">Queue complete: {counts.queued} queued · {counts.refreshed} refreshed · {counts.dismissed} dismissed · {counts.unchanged} unchanged.</p>}
      <div className="space-y-4">
        {rules.map((rule) => <RuleForm key={`${rule.id}:${canEdit}`} rule={rule} templates={templates} contacts={contacts} canEdit={canEdit} />)}
        {rules.length === 0 && <p className="text-[12.5px] text-muted-foreground">No renewal email rules are configured.</p>}
      </div>
      <div className="mt-5 border-t border-border-soft pt-4">
        <p className="text-[12.5px] text-muted-foreground">Edit subject and body copy in <Link href="/templates" className="font-semibold text-brand hover:underline">Email templates</Link>. Rules select a template; draft review lets Staff adjust the individual email.</p>
        <p className="mt-3 text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">Template merge fields</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATE_FIELDS.map((token) => <code key={token} className="rounded border border-border-soft bg-surface-3 px-2 py-1 text-[11.5px]">{token}</code>)}
        </div>
      </div>
    </div>
  );
}

function RuleForm({ rule, templates, contacts, canEdit }: {
  rule: RenewalEmailRule;
  templates: EmailTemplate[];
  contacts: ExternalContact[];
  canEdit: boolean;
}) {
  const [savedRule, setSavedRule] = useState(rule);
  const [dateBasis, setDateBasis] = useState(rule.dateBasis);
  const [offset, setOffset] = useState(String(rule.offsetDays));
  const [templateId, setTemplateId] = useState(rule.templateId);
  const [contactId, setContactId] = useState(rule.externalContactId ?? "");
  const [active, setActive] = useState(rule.active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const eligibleTemplates = templates.filter((template) => template.active && template.channel === "Email");
  const eligibleContacts = contacts.filter((contact) => contact.status === "Active" && !!contact.email?.trim());
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const templateValid = eligibleTemplates.some((template) => template.id === templateId);
  const contactValid = eligibleContacts.some((contact) => contact.id === contactId);
  const immediate = rule.key === "notice_received";
  const fixedBasis = immediate || rule.key === "missing_notice";
  const prefix = `renewal-rule-${rule.id}`;
  const days = Number(offset);
  const timing = offset.trim() && Number.isInteger(days)
    ? days === 0 ? "On the selected date (immediate)." : `${Math.abs(days)} days ${days < 0 ? "before" : "after"} the selected date.`
    : "Enter a signed whole number: negative is before, positive is after, zero is on the date.";

  function changed() {
    setError(null);
    setSuccess(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changed();
    if (!offset.trim() || !Number.isSafeInteger(days)) {
      setError("Enter a signed whole number for the day offset.");
      return;
    }
    if (immediate && (dateBasis !== "notice_received_date" || days !== 0)) {
      setError("Notice received must use the notice received date with an offset of 0.");
      return;
    }
    if (rule.key === "missing_notice" && dateBasis !== "renewal_due_date") {
      setError("Missing notice must use the renewal due date.");
      return;
    }
    if (!templateValid) {
      setError("Choose an active Email template before saving.");
      return;
    }
    if (rule.recipient === "carrier" && !contactValid) {
      setError("Choose an active carrier contact with an email address before saving.");
      return;
    }
    const update: RenewalEmailRuleUpdate = { dateBasis, offsetDays: days, templateId, externalContactId: rule.recipient === "carrier" ? contactId : null, active };
    setPending(true);
    try {
      const result = await saveRenewalEmailRuleAction(rule.id, update);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const saved = result.data;
      setSavedRule(saved);
      setDateBasis(saved.dateBasis);
      setOffset(String(saved.offsetDays));
      setTemplateId(saved.templateId);
      setContactId(saved.externalContactId ?? "");
      setActive(saved.active);
      setSuccess(true);
    } catch {
      setError("Could not save this rule. Your edits are retained; check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-md border border-border-soft p-4" aria-labelledby={`${prefix}-title`}>
      <div className="mb-4">
        <h4 id={`${prefix}-title`} className="text-[13.5px] font-bold">{savedRule.name}</h4>
        <p className="mt-1 text-[12.5px] text-muted-foreground">{RULE_HELP[rule.key]}</p>
      </div>
      <fieldset disabled={!canEdit || pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-basis`} className={LABEL}>Date basis</label>
          <select id={`${prefix}-basis`} className={CONTROL} value={dateBasis} disabled={fixedBasis || !canEdit || pending} onChange={(event) => { changed(); setDateBasis(event.target.value as RenewalDateBasis); }}>
            {rule.key !== "notice_received" && <option value="renewal_due_date">Renewal due date</option>}
            {rule.key !== "missing_notice" && <option value="notice_received_date">Notice received date</option>}
            {fixedBasis && ((immediate && dateBasis !== "notice_received_date") || (!immediate && dateBasis !== "renewal_due_date")) && <option value={dateBasis}>Invalid basis: {dateBasis}</option>}
          </select>
          {fixedBasis && <p className="mt-1 text-[11.5px] text-muted-foreground">Required for this rule.</p>}
        </div>
        <div>
          <label htmlFor={`${prefix}-offset`} className={LABEL}>Day offset</label>
          <input id={`${prefix}-offset`} type="number" step="1" required className={CONTROL} value={offset} readOnly={immediate} aria-describedby={`${prefix}-timing`} onChange={(event) => { changed(); setOffset(event.target.value); }} />
          <p id={`${prefix}-timing`} className="mt-1 text-[11.5px] text-muted-foreground">{immediate ? "Required: 0 days, immediately on notice receipt." : timing}</p>
        </div>
        <div>
          <label htmlFor={`${prefix}-template`} className={LABEL}>Email template</label>
          <select id={`${prefix}-template`} className={CONTROL} required value={templateId} onChange={(event) => { changed(); setTemplateId(event.target.value); }}>
            <option value="" disabled>Choose an active Email template</option>
            {templateId && !templateValid && <option value={templateId} disabled>{selectedTemplate?.name ?? `Unavailable template (${templateId})`} · not an active Email template</option>}
            {eligibleTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          {!templateValid && <p className="mt-1 text-[11.5px] text-amber">The assigned template is unavailable or not active Email. Admin must choose a valid template before saving.</p>}
        </div>
        <div>
          {rule.recipient === "client" ? <><span className={LABEL}>Recipient</span><p className="py-2 text-[13px]">Client · policy holder email</p></> : <>
            <label htmlFor={`${prefix}-contact`} className={LABEL}>Carrier recipient</label>
            <select id={`${prefix}-contact`} className={CONTROL} required value={contactId} onChange={(event) => { changed(); setContactId(event.target.value); }}>
              <option value="" disabled>Choose an active contact with email</option>
              {contactId && !contactValid && <option value={contactId} disabled>{selectedContact?.name ?? `Unavailable contact (${contactId})`} · inactive or missing email</option>}
              {eligibleContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email}</option>)}
            </select>
            {!contactValid && <p className="mt-1 text-[11.5px] text-amber">Admin must choose an active contact with an email address before saving.</p>}
          </>}
        </div>
        <label className="flex items-center gap-2 text-[13px]" htmlFor={`${prefix}-active`}>
          <input id={`${prefix}-active`} type="checkbox" checked={active} onChange={(event) => { changed(); setActive(event.target.checked); }} className="accent-brand" />
          Active rule
        </label>
        {canEdit && <div className="sm:text-right"><button type="submit" className={BUTTON}>{pending ? "Saving…" : "Save rule"}</button></div>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{error}</p>}
      {success && <p role="status" className="mt-3 text-[12.5px] text-brand">Rule saved.</p>}
    </form>
  );
}
