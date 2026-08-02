"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import {
  addDependentAction,
  removeDependentAction,
} from "@/app/(app)/clients/actions";
import {
  addNoteAction,
  completeDiscoveryAction,
  logCallAction,
  logMessageAction,
  sendEmailAction,
  toggleContactFlagAction,
  type LeadAdvanceSuggestion,
} from "@/app/(app)/clients/engage-actions";
import { setProposalStatusAction } from "@/app/(app)/prospects/actions";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import type { TimelineEntry, TimelineKind } from "@/lib/queries/contact-timeline";
import type { ClientRelatedCounts } from "@/lib/queries/client-summary";
import type { Client } from "@/lib/repositories/clients/client.entity";
import type { Application } from "@/lib/repositories/applications";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate, pesoMerge, type MergeContext } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import type { Tone } from "../data";
import { I, type IconName } from "../icons";
import { STAGE_TONE, STATUS_TONE } from "../lead-config";
import { AdvanceLeadModal, type AdvanceLeadPreset } from "../overlays/advance-lead";
import { useOverlays } from "../overlays/overlay-provider";
import { RequestProposalModal } from "../overlays/request-proposal";
import { LibraryAttachmentPicker, templateNeedsLibraryAttachment } from "../overlays/library-attachment-picker";
import { usePersona } from "../persona";
import { Avatar, Btn, Card, CardHead, TONE_BADGE, TONE_SOFT } from "../primitives";

/**
 * Contact Profile — the unified record view for one contact (design
 * contact-profile.jsx / web/contact-profile.md), replacing the old client
 * detail page. Real identity data + wired composer, timeline, flags,
 * dependents and documents. One record per person; only the lifecycle stage
 * changes.
 */

interface Dependent {
  id: string;
  fullName: string;
  relationship: string | null;
  dateOfBirth: string | null;
}
interface Doc {
  id: string;
  name: string;
  documentType: string | null;
  visibility: string | null;
}

interface Props {
  client: Client;
  counts: ClientRelatedCounts;
  dependents: Dependent[];
  documents: Doc[];
  timeline: TimelineEntry[];
  templates: EmailTemplate[];
  userNames: Record<string, string>;
  pacificCrossPortalUrl: string | null;
  origin: "clients" | "prospects";
  draftApplications: Application[];
}

const INPUT =
  "h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20";
const AREA =
  "w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand";

const LIFECYCLE_TONE: Record<string, Tone> = {
  Lead: "blue",
  Applicant: "violet",
  Client: "green",
  Policyholder: "green",
  Renewal: "amber",
  Lost: "red",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

type ComposerTab = "Email" | "Log Message" | "Log Call" | "Note" | "Task";

export function ContactProfile({
  client,
  counts,
  dependents,
  documents,
  timeline,
  templates,
  userNames,
  pacificCrossPortalUrl,
  origin,
  draftApplications,
}: Props) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const isLead = client.lifecycleStage === "Lead";
  const owner = userNames[client.assignedUserId ?? ""] ?? null;

  /* ---------- composer state ---------- */
  const composerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ComposerTab>("Email");
  const ctx = useMemo<MergeContext>(
    () => ({
      first_name: client.firstName,
      product: client.productInterest ?? undefined,
      premium: pesoMerge(client.estPremium),
      agent: persona.userName,
    }),
    [client, persona.userName],
  );

  const [tpl, setTpl] = useState("");
  const [recipient, setRecipient] = useState(client.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msgChannel, setMsgChannel] = useState("WhatsApp");
  const [msgAt, setMsgAt] = useState("");
  const [msgText, setMsgText] = useState("");
  const [outcome, setOutcome] = useState("Reached");
  const [callNote, setCallNote] = useState("");
  const [callBudget, setCallBudget] = useState("");
  const [callFamily, setCallFamily] = useState("");
  const [callInterest, setCallInterest] = useState(client.productInterest ?? "");
  const [callTier, setCallTier] = useState(client.coverageTier ?? "");
  const [callFollow, setCallFollow] = useState("");
  const [note, setNote] = useState("");
  const [libraryDocumentId, setLibraryDocumentId] = useState("");

  const [advanceOpen, setAdvanceOpen] = useState<(AdvanceLeadPreset & Partial<LeadAdvanceSuggestion>) | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState("All");

  const applyTemplate = (name: string) => {
    setTpl(name);
    setLibraryDocumentId("");
    const t = templates.find((x) => x.name === name);
    if (t) {
      setSubject(fillTemplate(t.subject, ctx));
      setBody(fillTemplate(t.body, ctx));
    }
  };

  /** Nurture chips: focus the inline composer with a template preselected. */
  const focusEmail = (templateName?: string) => {
    setTab("Email");
    if (templateName) applyTemplate(templateName);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const focusCall = () => {
    setTab("Log Call");
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toast = overlays.toast;

  const sendEmail = () =>
    startTransition(async () => {
      const res = await sendEmailAction({
        clientId: client.id,
        recipient,
        subject,
        body,
        templateName: tpl || null,
        libraryDocumentIds: libraryDocumentId ? [libraryDocumentId] : [],
      });
      if (!res.ok) return toast("Couldn’t log email", res.error);
      toast("Email logged", `“${tpl || subject}” recorded for ${client.fullName}; nothing was delivered.`);
      setSubject("");
      setBody("");
      setTpl("");
      router.refresh();
      if (res.data.advance) setAdvanceOpen(res.data.advance);
    });

  const logMessage = () =>
    startTransition(async () => {
      const res = await logMessageAction({
        clientId: client.id,
        channel: msgChannel,
        transcript: msgText,
        occurredAt: msgAt ? new Date(msgAt).toISOString() : null,
      });
      if (!res.ok) return toast("Couldn’t log message", res.error);
      toast("Message logged", `Inbound ${msgChannel} message saved to ${client.fullName}’s timeline.`);
      setMsgText("");
      router.refresh();
      if (res.data.advance) setAdvanceOpen(res.data.advance);
    });

  const logCall = () =>
    startTransition(async () => {
      const reached = outcome === "Reached";
      const res = await logCallAction({
        clientId: client.id,
        outcome,
        notes: callNote || null,
        // Structured discovery (design contact-profile.jsx) — Reached calls only.
        discovery: reached
          ? {
              estPremium: callBudget ? Number(callBudget) : null,
              familySize: callFamily ? Number(callFamily) : null,
              productInterest: callInterest || null,
              coverageTier: callTier || null,
            }
          : undefined,
        followUpDate: callFollow || null,
      });
      if (!res.ok) return toast("Couldn’t log call", res.error);
      toast("Call logged", reached ? `Discovery details saved to ${client.fullName}’s record.` : `Call with ${client.fullName} saved to the timeline.`);
      setCallNote("");
      setCallFollow("");
      router.refresh();
      if (res.data.advance) setAdvanceOpen(res.data.advance);
    });

  const completeDiscovery = () =>
    startTransition(async () => {
      const res = await completeDiscoveryAction(client.id);
      if (!res.ok) return toast("Couldn’t complete discovery", res.error);
      toast("Discovery completed", `${client.fullName} is now qualified.`);
      router.refresh();
      if (res.data.advance) setAdvanceOpen(res.data.advance);
    });

  const addNote = () =>
    startTransition(async () => {
      const res = await addNoteAction({ clientId: client.id, note });
      if (!res.ok) return toast("Couldn’t add note", res.error);
      toast("Note added", "Private note saved to the timeline.");
      setNote("");
      router.refresh();
    });

  const toggleFlag = (flag: "earlyPayer" | "doNotContact", value: boolean) =>
    startTransition(async () => {
      const res = await toggleContactFlagAction({ clientId: client.id, flag, value });
      if (!res.ok) toast("Couldn’t update flag", res.error);
      router.refresh();
    });

  const markProposal = (status: string) =>
    startTransition(async () => {
      const res = await setProposalStatusAction(client.id, status);
      if (res.ok) toast(`Proposal ${status.toLowerCase()}`, `${client.fullName} — proposal marked ${status}.`);
      else toast("Couldn’t update proposal", res.error);
      router.refresh();
    });

  /* ---------- timeline ---------- */
  const FILTERS: { label: string; kinds: TimelineKind[] | null }[] = [
    { label: "All", kinds: null },
    { label: "Emails", kinds: ["email"] },
    { label: "Messages", kinds: ["message"] },
    { label: "Calls", kinds: ["call"] },
    { label: "Notes", kinds: ["note"] },
    { label: "Status", kinds: ["status"] },
    { label: "Tasks", kinds: ["task"] },
    { label: "Payments", kinds: ["payment"] },
  ];
  const activeFilter = FILTERS.find((f) => f.label === timelineFilter) ?? FILTERS[0];
  const visibleTimeline = activeFilter.kinds
    ? timeline.filter((e) => activeFilter.kinds!.includes(e.kind))
    : timeline;

  const TL_META: Record<TimelineKind, { icon: IconName; tone: Tone }> = {
    email: { icon: "mail", tone: "blue" },
    message: { icon: "phone", tone: "green" },
    call: { icon: "phone", tone: "green" },
    note: { icon: "doc2", tone: "slate" },
    status: { icon: "refresh", tone: "violet" },
    task: { icon: "checkSquare", tone: "amber" },
    payment: { icon: "peso", tone: "green" },
    doc: { icon: "folder", tone: "amber" },
  };

  const NURTURE: { label: string; icon: IconName; run: () => void }[] = [
    { label: "Log Email", icon: "mail", run: () => focusEmail("New inquiry response") },
    { label: "Send Brochure", icon: "folder", run: () => focusEmail("Send brochure") },
    { label: "Send Intake Form", icon: "clipboard", run: () => focusEmail("Send application form") },
    { label: "Request Proposal", icon: "fileText", run: () => setProposalOpen(true) },
    { label: "Log Discovery Call", icon: "phone", run: focusCall },
  ];
  if (isLead && client.proposalStatus === "Received") {
    NURTURE.splice(4, 0, {
      label: "Log Proposal Email",
      icon: "send",
      run: () => focusEmail("Proposal / Quote Delivery"),
    });
  }

  const assoc = [
    { label: "Applications", val: counts.applications, icon: "fileText", href: "/applications" },
    { label: "Policies", val: counts.policies, icon: "shield", href: "/policies" },
    { label: "Renewals", val: counts.renewals, icon: "refresh", href: "/renewals" },
    { label: "Claims", val: counts.claims, icon: "clipboard", href: "/claims" },
    { label: "Travel", val: counts.travelRequests, icon: "plane", href: "/travel" },
  ] as const;

  return (
    <div>
      <Link href={origin === "prospects" ? "/prospects" : "/clients"} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-subtle hover:text-foreground">
        <I.arrowRight size={14} className="rotate-180" /> {origin === "prospects" ? "Prospects" : "Clients"}
      </Link>

      {/* ---------- header ---------- */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={client.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">{client.fullName}</h1>
              <span className="font-mono text-[12px] text-subtle">#{client.referenceNo ?? client.id.slice(0, 6)}</span>
              <span className={cn("inline-flex h-[22px] items-center rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[LIFECYCLE_TONE[client.lifecycleStage] ?? "slate"])}>
                {client.lifecycleStage}
              </span>
              {isLead && (
                <>
                  <span className={cn("inline-flex h-[22px] items-center rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[STAGE_TONE[client.leadStage ?? ""] ?? "slate"])}>
                    {client.leadStage}
                  </span>
                  <span className={cn("inline-flex h-[22px] items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[STATUS_TONE[client.leadStatus ?? ""] ?? "slate"])}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {client.leadStatus}
                  </span>
                  <Btn size="sm" onClick={() => setAdvanceOpen({ label: "Advance from profile" })}>
                    <I.trendUp size={14} /> Advance
                  </Btn>
                  {client.leadStage === "Discovery" && (
                    <Btn
                      size="sm"
                      onClick={completeDiscovery}
                    >
                      <I.check size={14} /> Mark Discovery Complete
                    </Btn>
                  )}
                </>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              {client.email && (
                <span className="inline-flex items-center gap-1.5">
                  <I.mail size={13} /> {client.email}
                </span>
              )}
              {owner && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={owner} size={18} /> {owner} · Owner
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Btn onClick={() => focusEmail()}>
              <I.mail size={15} /> Email
            </Btn>
            <Btn onClick={focusCall}>
              <I.phone size={15} /> Log Call
            </Btn>
            {isLead && (
              <Btn
                variant="primary"
                onClick={() =>
                  overlays.openWizard({
                    convertClientId: client.id,
                    convertClientName: client.fullName,
                    productInterest: client.productInterest,
                    email: client.email,
                  })
                }
              >
                <I.arrowRight size={15} /> Convert to Application
              </Btn>
            )}
            {draftApplications.length > 0 && (
              <Btn
                variant="primary"
                onClick={() => {
                  const draft = draftApplications[0];
                  overlays.openWizard({
                    draftApplicationId: draft.id,
                  });
                }}
              >
                <I.arrowRight size={15} /> Continue Application
              </Btn>
            )}
            <Link
              href={`/clients/${client.id}/edit${origin === "prospects" ? "?from=prospects" : ""}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3.5 text-[13px] font-semibold transition-colors hover:bg-hover"
            >
              <I.edit size={15} /> Edit
            </Link>
            <DeleteClientButton id={client.id} />
          </div>
        </div>

        {/* nurture chips */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-soft pt-3.5">
          {NURTURE.map((n) => {
            const Ico = I[n.icon];
            return (
              <button
                key={n.label}
                onClick={n.run}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <Ico size={14} /> {n.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-4 max-[1200px]:grid-cols-1">
        {/* ---------- left: identity ---------- */}
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          <Card>
            <CardHead iconName="user" title="Contact properties" />
            <dl className="flex flex-col gap-3 px-[18px] py-4">
              {(
                [
                  ["Email", client.email],
                  ["Phone", client.mobileNumber],
                  ["Preferred channel", client.preferredChannel],
                  ["Source", client.leadSource],
                  ["Product interest", client.productInterest],
                  ["Lifecycle stage", client.lifecycleStage],
                  ["Date of birth", fmtDate(client.dateOfBirth)],
                  ["Address", client.address],
                  ["Record ID", client.referenceNo],
                  ["Created", fmtDate(client.createdAt)],
                ] as [string, string | null][]
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.03em] text-subtle">{k}</dt>
                  <dd className="mt-0.5 break-words text-[13px]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHead iconName="settings" title="State flags" />
            <div className="px-[18px] py-3">
              {(
                [
                  ["earlyPayer", "Early payer", "Suppresses renewal reminders", client.earlyPayer],
                  ["doNotContact", "Lost / Do not contact", "Archives from queues, keeps history", client.doNotContact],
                ] as const
              ).map(([flag, label, sub, value]) => (
                <div key={flag} className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-[600]">{label}</div>
                    <div className="text-[11.5px] text-subtle">{sub}</div>
                  </div>
                  <button
                    disabled={pending}
                    onClick={() => toggleFlag(flag, !value)}
                    className={cn(
                      "relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors",
                      value ? "bg-brand" : "bg-border-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-all",
                        value ? "left-[20px]" : "left-[2px]",
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Dependents (preserved from the previous detail page) */}
          <Card>
            <CardHead iconName="users" title="Dependents" count={dependents.length} />
            <div>
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <Avatar name={d.fullName} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">{d.fullName}</div>
                    <div className="text-[11px] text-subtle">
                      {[d.relationship, d.dateOfBirth ? fmtDate(d.dateOfBirth) : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <form action={removeDependentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-subtle hover:bg-hover hover:text-red">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <form action={addDependentAction} className="flex flex-col gap-2 border-t border-border-soft px-[18px] py-3">
              <input type="hidden" name="clientId" value={client.id} />
              <input name="fullName" required placeholder="Full name" className={INPUT} />
              <div className="grid grid-cols-2 gap-2">
                <input name="relationship" placeholder="Relationship" className={INPUT} />
                <input name="dateOfBirth" type="date" className={INPUT} />
              </div>
              <button
                type="submit"
                className="inline-flex h-[32px] items-center justify-center gap-1 rounded-md border border-transparent bg-brand px-3 text-[12.5px] font-semibold text-on-brand hover:bg-brand-hover"
              >
                <I.plus size={14} /> Add dependent
              </button>
            </form>
          </Card>
        </div>

        {/* ---------- center: composer + timeline ---------- */}
        <div className="col-span-6 flex flex-col gap-4 max-[1200px]:col-span-1">
          <Card>
            <div ref={composerRef} className="flex items-center gap-1 overflow-x-auto border-b border-border-soft px-3 pt-2.5">
              {(["Email", "Log Message", "Log Call", "Note", "Task"] as ComposerTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => (t === "Task" ? overlays.openAddTask({ contact: { id: client.id, name: client.fullName } }) : setTab(t))}
                  className={cn(
                    "whitespace-nowrap rounded-t-md border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors",
                    tab === t ? "border-brand text-brand-hover" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="px-[18px] py-4">
              {tab === "Email" && (
                <>
                  <div className="grid grid-cols-2 gap-3.5">
                    <ComposerField label="Template">
                      <select className={INPUT} value={tpl} onChange={(e) => applyTemplate(e.target.value)}>
                        <option value="">Select…</option>
                        {templates.map((t) => (
                          <option key={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </ComposerField>
                    <ComposerField label="Recipient" required>
                      <input className={INPUT} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                    </ComposerField>
                  </div>
                  <ComposerField label="Subject" required className="mt-3.5">
                    <input className={INPUT} value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </ComposerField>
                  <ComposerField label="Message" className="mt-3.5">
                    <textarea className={cn(AREA, "min-h-[150px]")} value={body} onChange={(e) => setBody(e.target.value)} />
                  </ComposerField>
                  <LibraryAttachmentPicker clientId={client.id} templateName={tpl} value={libraryDocumentId} onChange={setLibraryDocumentId} />
                  <div className="mt-3.5 flex items-center justify-between">
                    <span className="text-[11.5px] text-faint">
                      Logged only — neither the email nor selected attachments are delivered. Actor: {persona.userName}.
                    </span>
                    <Btn variant="primary" disabled={pending || !recipient.trim() || !subject.trim() || (templateNeedsLibraryAttachment(tpl) && !libraryDocumentId)} onClick={sendEmail}>
                      <I.send size={15} /> {pending ? "Logging…" : "Log email"}
                    </Btn>
                  </div>
                </>
              )}

              {tab === "Log Message" && (
                <>
                  <div className="grid grid-cols-2 gap-3.5">
                    <ComposerField label="Channel" required>
                      <select className={INPUT} value={msgChannel} onChange={(e) => setMsgChannel(e.target.value)}>
                        {["WhatsApp", "Viber", "iMessage", "SMS", "Other"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </ComposerField>
                    <ComposerField label="Received at">
                      <input className={INPUT} type="datetime-local" value={msgAt} onChange={(e) => setMsgAt(e.target.value)} />
                    </ComposerField>
                  </div>
                  <ComposerField label="Transcript / summary" required className="mt-3.5">
                    <textarea
                      className={cn(AREA, "min-h-[130px]")}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="Paste or summarize the inbound message…"
                    />
                  </ComposerField>
                  <div className="mt-3.5 flex items-center justify-between">
                    <span className="text-[11.5px] text-faint">Logs an inbound (Received) entry to the timeline.</span>
                    <Btn variant="primary" disabled={pending || !msgText.trim()} onClick={logMessage}>
                      <I.check size={15} /> Log message
                    </Btn>
                  </div>
                </>
              )}

              {tab === "Log Call" && (
                <>
                  <ComposerField label="Outcome" required>
                    <select className={INPUT} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                      {["Reached", "No answer", "Voicemail", "Wrong number"].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </ComposerField>
                  {outcome === "Reached" && (
                    <>
                      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                        <ComposerField label="Budget / est. premium">
                          <input className={INPUT} type="number" value={callBudget} onChange={(e) => setCallBudget(e.target.value)} placeholder="₱ annual premium" />
                        </ComposerField>
                        <ComposerField label="Family size / dependents">
                          <input className={INPUT} type="number" value={callFamily} onChange={(e) => setCallFamily(e.target.value)} placeholder="# people to cover" />
                        </ComposerField>
                      </div>
                      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                        <ComposerField label="Product interest">
                          <input className={INPUT} value={callInterest} onChange={(e) => setCallInterest(e.target.value)} placeholder="e.g. Blue Royale" />
                        </ComposerField>
                        <ComposerField label="Coverage tier / room">
                          <select className={INPUT} value={callTier} onChange={(e) => setCallTier(e.target.value)}>
                            {["", "Standard / Ward", "Semi-private room", "Private room", "Suite / Executive"].map((t) => (
                              <option key={t} value={t}>{t || "— not captured —"}</option>
                            ))}
                          </select>
                        </ComposerField>
                      </div>
                    </>
                  )}
                  <ComposerField label="Call notes" className="mt-3.5">
                    <textarea
                      className={cn(AREA, "min-h-[120px]")}
                      value={callNote}
                      onChange={(e) => setCallNote(e.target.value)}
                      placeholder={outcome === "Reached" ? "Anything the fields above don’t capture…" : "What happened on the attempt…"}
                    />
                  </ComposerField>
                  <ComposerField label="Next follow-up" className="mt-3.5">
                    <input className={INPUT} type="date" value={callFollow} onChange={(e) => setCallFollow(e.target.value)} />
                  </ComposerField>
                  <div className="mt-3.5 flex items-center justify-between gap-3">
                    {outcome === "Reached" ? (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                        <I.check size={12} /> Structured discovery writes to the record — budget &amp; product
                        interest carry into Convert to Application.
                      </span>
                    ) : (
                      <span />
                    )}
                    <Btn variant="primary" disabled={pending} onClick={logCall}>
                      <I.phone size={15} /> Log call
                    </Btn>
                  </div>
                </>
              )}

              {tab === "Note" && (
                <>
                  <ComposerField label="Internal note" required>
                    <textarea
                      className={cn(AREA, "min-h-[130px]")}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Private note — visible to staff only…"
                    />
                  </ComposerField>
                  <div className="mt-3.5 flex justify-end">
                    <Btn variant="primary" disabled={pending || !note.trim()} onClick={addNote}>
                      <I.plus size={15} /> Add note
                    </Btn>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHead iconName="clock" title="Timeline" count={visibleTimeline.length} />
            <div className="flex flex-wrap gap-1.5 border-b border-border-soft px-[18px] py-2.5">
              {FILTERS.map((f) => (
                <button
                  key={f.label}
                  onClick={() => setTimelineFilter(f.label)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                    timelineFilter === f.label
                      ? "border-brand bg-brand-soft text-brand-hover"
                      : "border-border bg-card text-muted-foreground hover:bg-hover",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="py-1.5">
              {visibleTimeline.length === 0 && (
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">Nothing here yet.</p>
              )}
              {visibleTimeline.map((e, idx) => {
                const meta = TL_META[e.kind];
                const Ico = I[meta.icon];
                return (
                  <div key={e.id} className="relative flex gap-3 px-[18px] py-2.5">
                    <div className="relative flex shrink-0 flex-col items-center">
                      <div className={cn("z-10 grid size-[28px] place-items-center rounded-lg", TONE_SOFT[meta.tone])}>
                        <Ico size={14} />
                      </div>
                      {idx < visibleTimeline.length - 1 && (
                        <div className="absolute -bottom-[18px] left-1/2 top-[28px] w-0.5 -translate-x-1/2 bg-border" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-[600] leading-snug">
                        {e.title}
                        {e.direction && (
                          <span
                            className={cn(
                              "rounded-[5px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.04em]",
                              e.direction === "sent" ? "bg-blue-soft text-blue" : e.direction === "logged" ? "bg-amber-soft text-amber" : "bg-green-soft text-green",
                            )}
                          >
                            {e.direction}
                          </span>
                        )}
                      </div>
                      {e.body && (
                        <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{e.body}</div>
                      )}
                      <div className="mt-0.5 text-[11.5px] text-subtle">
                        {[e.actorName, e.atLabel].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ---------- right: associated records ---------- */}
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          {isLead && (
            <Card>
              <CardHead iconName="fileText" title="Proposal tracking" />
              <div className="px-[18px] py-3.5">
                <div className="mb-3 flex items-center gap-1.5">
                  {["Requested", "Received", "Sent", "Decision"].map((s, i) => {
                    const idx = ["Requested", "Received", "Sent", "Decision"].indexOf(client.proposalStatus ?? "");
                    return (
                      <span
                        key={s}
                        title={s}
                        className={cn("h-1.5 flex-1 rounded-full", idx >= 0 && i < idx ? "bg-brand" : idx === i ? "bg-violet" : "bg-surface-3")}
                      />
                    );
                  })}
                </div>
                <div className="mb-3 text-[12.5px] text-muted-foreground">
                  {client.proposalStatus
                    ? `Proposal ${client.proposalStatus.toLowerCase()} — ${client.productInterest ?? "carrier"} quote.`
                    : "No proposal requested yet."}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pacificCrossPortalUrl && (
                    <a
                      href={pacificCrossPortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      <I.arrowUpRight size={14} /> Open Pacific Cross portal
                    </a>
                  )}
                  {!client.proposalStatus && (
                    <Btn size="sm" onClick={() => setProposalOpen(true)}>
                      Request proposal
                    </Btn>
                  )}
                  {client.proposalStatus === "Requested" && (
                    <Btn size="sm" onClick={() => markProposal("Received")}>
                      Mark Received
                    </Btn>
                  )}
                  {client.proposalStatus === "Received" && (
                    <Btn size="sm" variant="primary" onClick={() => focusEmail("Proposal / Quote Delivery")}>
                      Log Proposal Email
                    </Btn>
                  )}
                  {client.proposalStatus === "Sent" && (
                    <Btn size="sm" onClick={() => markProposal("Decision")}>
                      Record decision
                    </Btn>
                  )}
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHead iconName="folder" title="Associated records" />
            <div className="px-[18px] py-2">
              {assoc.map((a) => {
                const Ico = I[a.icon];
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="flex items-center gap-2.5 border-b border-border-soft py-2.5 transition-colors last:border-0 hover:bg-hover"
                  >
                    <span className="grid size-[28px] place-items-center rounded-lg bg-brand-soft text-brand-hover">
                      <Ico size={14} />
                    </span>
                    <span className="flex-1 text-[13px] font-[550]">{a.label}</span>
                    <span className="text-[14px] font-bold tabular-nums">{a.val}</span>
                    <I.chevRight size={14} className="text-faint" />
                  </Link>
                );
              })}
            </div>
          </Card>
          {draftApplications.length > 0 && (
            <Card>
              <CardHead iconName="fileText" title="Application drafts" count={draftApplications.length} />
              <div className="divide-y divide-border-soft">
                {draftApplications.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-2 px-[18px] py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11.5px] text-subtle">{draft.referenceNo ?? "Draft"}</div>
                      <div className="truncate text-[12.5px] font-semibold">{draft.productName ?? draft.applicationType}</div>
                    </div>
                    <Btn
                      size="sm"
                      onClick={() =>
                        overlays.openWizard({
                          draftApplicationId: draft.id,
                        })
                      }
                    >
                      Continue
                    </Btn>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Documents (preserved) */}
          <Card>
            <CardHead iconName="folder" title="Documents" count={documents.length} />
            <div>
              {documents.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <span className="grid size-[28px] shrink-0 place-items-center rounded-[8px] bg-surface-3 text-muted-foreground">
                    <I.doc2 size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold">{d.name}</div>
                    <div className="text-[11px] text-subtle">
                      {[d.documentType, d.visibility].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-brand-hover hover:bg-hover"
                  >
                    <I.download size={13} />
                  </a>
                  <form action={deleteDocumentAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-subtle hover:bg-hover hover:text-red">
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
            <div className="border-t border-border-soft px-[18px] py-3">
              <DocumentUploadForm clientId={client.id} />
            </div>
          </Card>
        </div>
      </div>

      {/* ---------- overlays ---------- */}
      {advanceOpen && (
        <AdvanceLeadModal
          lead={{
            clientId: client.id,
            name: client.fullName,
            referenceNo: client.referenceNo,
            stage: advanceOpen.currentStage ?? client.leadStage,
            status: advanceOpen.currentStatus ?? client.leadStatus,
          }}
          preset={advanceOpen}
          onClose={() => setAdvanceOpen(null)}
        />
      )}
      {proposalOpen && (
        <RequestProposalModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setProposalOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}

function ComposerField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
    </div>
  );
}
