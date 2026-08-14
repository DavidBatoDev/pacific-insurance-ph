"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  addDependentAction,
  removeDependentAction,
} from "@/app/(app)/clients/actions";
import {
  addNoteAction,
  logMessageAction,
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
import { cn } from "@/lib/utils";
import { peso, type Tone } from "../data";
import { I, type IconName } from "../icons";
import { STAGE_TONE, STATUS_TONE, canConvertLead } from "../lead-config";
import { AdvanceLeadModal, type AdvanceLeadPreset } from "../overlays/advance-lead";
import { ConvertConfirmModal } from "../overlays/convert-confirm";
import { GenerateProposalModal } from "../overlays/generate-proposal";
import { useOverlays } from "../overlays/overlay-provider";
import { RequestProposalModal } from "../overlays/request-proposal";
import { LogCallForm } from "../overlays/log-call";
import { MarkLostModal } from "../overlays/mark-lost";
import { MarkNurturingModal } from "../overlays/mark-nurturing";
import { EmailForm } from "../overlays/send-email";
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
  applications: Application[];
  draftApplications: Application[];
}

const INPUT =
  "h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20";
const AREA =
  "w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

type ComposerTab = "Email" | "Log Message" | "Log Call" | "Note" | "Task";

const isIndividualProposalProduct = (product: string | null) =>
  ["select", "blue royale"].includes(product?.trim().toLowerCase() ?? "");

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
  applications,
  draftApplications,
}: Props) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const isLead = client.lifecycleStage === "Lead";
  const owner = userNames[client.assignedUserId ?? ""] ?? null;

  /* ---------- composer state ---------- */
  const composerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ComposerTab>("Email");

  const [msgChannel, setMsgChannel] = useState("WhatsApp");
  const [msgAt, setMsgAt] = useState("");
  const [msgText, setMsgText] = useState("");
  // The call and email forms own their own state (LogCallForm / EmailForm); focusCall/focusEmail
  // bump these to remount them fresh, same mechanism.
  const [callFormKey, setCallFormKey] = useState(0);
  const [emailFormKey, setEmailFormKey] = useState(0);
  const [initialEmailTemplate, setInitialEmailTemplate] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");

  const [advanceOpen, setAdvanceOpen] = useState<(AdvanceLeadPreset & Partial<LeadAdvanceSuggestion>) | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [generateProposalOpen, setGenerateProposalOpen] = useState(false);
  const [nurturingOpen, setNurturingOpen] = useState(false);
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [convertConfirmOpen, setConvertConfirmOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);

  // Converting is the Product-Selected payoff; earlier is possible but has to be deliberate.
  const convertReady = canConvertLead(client.leadStage);
  /** `skipAhead` is set only by the confirm dialog — the server rejects the convert without it. */
  const openConvertWizard = (skipAhead = false) =>
    overlays.openWizard({
      convertClientId: client.id,
      convertClientName: client.fullName,
      productInterest: client.productInterest,
      email: client.email,
      ...(skipAhead ? { confirmedSkip: true } : {}),
    });
  const [timelineFilter, setTimelineFilter] = useState("All");

  /** Nurture chips: focus the inline composer with a template preselected. */
  const focusEmail = (templateName?: string) => {
    setTab("Email");
    setInitialEmailTemplate(templateName);
    setEmailFormKey((k) => k + 1);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  /** Land on the discovery inputs: they only render for a Reached call, so remount preset to it. */
  const focusCall = () => {
    setTab("Log Call");
    setCallFormKey((k) => k + 1);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toast = overlays.toast;

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

  const [proposalMarking, setProposalMarking] = useState<string | null>(null);
  const markProposal = (status: string) => {
    setProposalMarking(status);
    startTransition(async () => {
      const res = await setProposalStatusAction(client.id, status);
      if (res.ok) toast(`Proposal ${status.toLowerCase()}`, `${client.fullName} — proposal marked ${status}.`);
      else toast("Couldn’t update proposal", res.error);
      router.refresh();
    });
  };

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
    {
      label: isIndividualProposalProduct(client.productInterest) ? "Generate Proposal" : "Request Proposal",
      icon: "fileText",
      run: () => isIndividualProposalProduct(client.productInterest) ? setGenerateProposalOpen(true) : setProposalOpen(true),
    },
    // One `Log Call`, not three (../docs/web/lead-workflow.md §4) — same form the composer tab uses.
    { label: "Log Call", icon: "phone", run: focusCall },
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
      <div className="relative mb-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        {/* Record-level actions (edit / delete) live behind the ⋮ so they don't sit next to the
            everyday ones — pr-9 keeps the row clear of the absolutely-placed trigger. */}
        <div className="absolute right-4 top-4 z-30">
          <button
            aria-label="More actions"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <I.more size={17} />
          </button>
          {menuOpen && (
            <>
              {/* Click-away catcher, below the menu but above the page. */}
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-40 w-[200px] overflow-hidden rounded-md border border-border bg-card py-1 shadow-pop">
                <Link
                  href={`/clients/${client.id}/edit${origin === "prospects" ? "?from=prospects" : ""}`}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover"
                >
                  <I.edit size={15} className="text-subtle" /> Edit
                </Link>
                {/* A draft already resuming this same lead is the one path forward — starting a
                    second, unrelated wizard here would leave two open application rows on one
                    person instead of continuing the one that exists. */}
                {isLead && !convertReady && draftApplications.length === 0 && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setConvertConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] transition-colors hover:bg-hover"
                  >
                    <I.arrowRight size={15} className="text-subtle" /> Convert to Application…
                  </button>
                )}
                {/* Contextual at `Unresponsive` only (docs/lead-stage-status.md:48,51): Lost is
                    only ever reached through Unresponsive, never directly — same hide-when-
                    ineligible precedent as `Mark as Nurturing` below. */}
                {isLead && client.leadStatus === "Unresponsive" && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setMarkLostOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] text-red transition-colors hover:bg-red-soft"
                  >
                    <I.x size={15} /> Mark Lost
                  </button>
                )}
                <DeleteClientButton
                  id={client.id}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-[550] text-red transition-colors hover:bg-red-soft disabled:opacity-60"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-4 pr-9">
          <Avatar name={client.fullName} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">{client.fullName}</h1>
              {/* Lifecycle type sits inline with the ID as subtle gray text — deliberately
                  NOT a colored pill, so it doesn't compete with the lead stage/status chips. */}
              <span className="font-mono text-[12px] text-subtle">
                #{client.referenceNo ?? client.id.slice(0, 6)} · {client.lifecycleStage}
              </span>
              {/* Identity only — name, record id, and the two read-only chips. Every button lives
                  in the action cluster below, so this row never mixes controls with the chips and
                  never strands one on its own line when it wraps. */}
              {isLead && (
                <>
                  <span className={cn("inline-flex h-[22px] items-center rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[STAGE_TONE[client.leadStage ?? ""] ?? "slate"])}>
                    {client.leadStage}
                  </span>
                  <span className={cn("inline-flex h-[22px] items-center gap-1 rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[STATUS_TONE[client.leadStatus ?? ""] ?? "slate"])}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {client.leadStatus}
                  </span>
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
          {/* Every action for this record, in one cluster: the lead-lifecycle ones first, then the
              application CTAs. On narrower widths (tablet) the whole cluster drops to its own
              full-width row instead of crushing the identity column; it sits inline only when
              there's room (xl). */}
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 xl:w-auto">
            {/* No `Email` / `Log Call` buttons here: the nurture chip row directly below already
                surfaces both, and two controls for one action is the duplication this header had
                (../docs/web/contact-profile.md — "One set of buttons, not two"). */}
            {isLead && (
              <>
                <Btn onClick={() => setAdvanceOpen({ label: "Advance from profile" })}>
                  <I.trendUp size={15} /> Advance
                </Btn>
                {/* Contextual at `Qualified` only (../docs/web/contact-profile.md): a hold is a
                    deliberate call on a lead who is ready but not now, and it is the sole route
                    into `Nurturing` — the Advance popup can't capture the re-engagement date. */}
                {client.leadStatus === "Qualified" && (
                  <Btn onClick={() => setNurturingOpen(true)}>
                    <I.clock size={15} /> Mark as Nurturing
                  </Btn>
                )}
              </>
            )}
            {/* Only the sanctioned convert (at Product Selected or later) gets to be the primary
                action; before that it lives in the ⋮ menu behind a skip confirmation. Hidden once
                a draft exists — Convert starts a brand-new wizard with no draftApplicationId, so
                saving it would create a second application row instead of continuing the one
                already open; Continue Application below is the only path in that case. */}
            {isLead && convertReady && draftApplications.length === 0 && (
              <Btn variant="primary" onClick={() => openConvertWizard()}>
                <I.arrowRight size={15} /> Convert to Application
              </Btn>
            )}
            {applications.length > 0 && (
              <Btn onClick={() => overlays.openApplicationRequirements(applications[0].id)}>
                <I.clipboard size={15} /> Requirements
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
            <CardHead
              iconName="user"
              title="Contact properties"
              action={
                <button
                  aria-label={propertiesOpen ? "Collapse contact properties" : "Expand contact properties"}
                  aria-expanded={propertiesOpen}
                  onClick={() => setPropertiesOpen((open) => !open)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                >
                  <I.chevDown size={16} className={cn("transition-transform", propertiesOpen && "rotate-180")} />
                </button>
              }
            />
            {/* One column while the card sits in the narrow sidebar; two once the profile grid
                collapses to full width at ≤1200px, so the list doesn't become a long scroll. */}
            <dl
              className={cn(
                "grid grid-cols-1 gap-3 px-[18px] py-4 max-[1200px]:grid-cols-2",
                !propertiesOpen && "hidden",
              )}
            >
              {(
                [
                  ["Email", client.email],
                  ["Phone", client.mobileNumber],
                  ["Preferred channel", client.preferredChannel],
                  ["Source", client.leadSource],
                  // The four discovery answers a quote needs, shown together so it is obvious
                  // at a glance which are still outstanding (they gate the move to Proposal).
                  ["Product interest", client.productInterest],
                  ["Budget / est. premium", client.estPremium != null ? peso(client.estPremium) : null],
                  ["Family size", client.familySize != null ? String(client.familySize) : null],
                  ["Coverage tier", client.coverageTier],
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
              {dependents.length === 0 && (
                <p className="px-[18px] py-3 text-[12.5px] text-subtle">No dependents added yet.</p>
              )}
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
                <EmailForm
                  key={emailFormKey}
                  target={{
                    clientId: client.id,
                    name: client.fullName,
                    email: client.email,
                    product: client.productInterest,
                    premium: client.estPremium,
                  }}
                  templates={templates}
                  initialTemplate={initialEmailTemplate}
                  onSent={(advance, sent) => {
                    toast("Email logged", `“${sent.template || sent.subject}” recorded for ${client.fullName}; nothing was delivered.`);
                    if (advance) setAdvanceOpen(advance);
                  }}
                />
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
                <LogCallForm
                  key={callFormKey}
                  target={{
                    clientId: client.id,
                    name: client.fullName,
                    estPremium: client.estPremium,
                    familySize: client.familySize,
                    productInterest: client.productInterest,
                    coverageTier: client.coverageTier,
                  }}
                  onLogged={(advance) => {
                    if (advance) setAdvanceOpen(advance);
                  }}
                />
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
                <p className="px-[18px] py-4 text-[13px] text-muted-foreground">
                  {timeline.length === 0 ? "No calls logged yet — log the first touch." : "Nothing here yet."}
                </p>
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
                    : `No proposal ${isIndividualProposalProduct(client.productInterest) ? "generated" : "requested"} yet.`}
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
                  {!pacificCrossPortalUrl && isIndividualProposalProduct(client.productInterest) && (
                    <Link
                      href="/settings"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-amber-border bg-amber-soft px-3 text-[12.5px] font-semibold text-amber transition-colors hover:bg-hover"
                    >
                      <I.settings size={14} /> Configure portal in Settings
                    </Link>
                  )}
                  {!client.proposalStatus && (
                    <Btn size="sm" onClick={() => isIndividualProposalProduct(client.productInterest) ? setGenerateProposalOpen(true) : setProposalOpen(true)}>
                      {isIndividualProposalProduct(client.productInterest) ? "Generate proposal" : "Request proposal"}
                    </Btn>
                  )}
                  {client.proposalStatus === "Requested" && (
                    <Btn size="sm" disabled={pending} onClick={() => markProposal("Received")}>
                      {pending && proposalMarking === "Received" ? "Marking received…" : "Mark Received"}
                    </Btn>
                  )}
                  {client.proposalStatus === "Received" && (
                    <>
                      <Btn size="sm" variant="primary" onClick={() => focusEmail("Proposal / Quote Delivery")}>
                        Log Proposal Email
                      </Btn>
                      <Btn size="sm" disabled={pending} onClick={() => markProposal("Sent")}>
                        {pending && proposalMarking === "Sent" ? "Marking sent…" : "Mark Sent"}
                      </Btn>
                    </>
                  )}
                  {client.proposalStatus === "Sent" && (
                    <Btn size="sm" disabled={pending} onClick={() => markProposal("Decision")}>
                      {pending && proposalMarking === "Decision" ? "Recording…" : "Record decision"}
                    </Btn>
                  )}
                </div>
                {client.proposalStatus === "Received" && (
                  <p className="mt-2 text-[11.5px] text-faint">
                    Click <b>Mark Sent</b>{" "}
                    once you&apos;ve actually sent this to the client yourself — the app doesn&apos;t deliver
                    emails yet.
                  </p>
                )}
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

          {applications.length > 0 && (
            <Card>
              <CardHead iconName="clipboard" title="Application requirements" count={applications.length} />
              <div className="divide-y divide-border-soft">
                {applications.map((application) => (
                  <div key={application.id} className="flex items-center gap-2 px-[18px] py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11.5px] text-subtle">{application.referenceNo ?? "Application"}</div>
                      <div className="truncate text-[12.5px] font-semibold">{application.productName ?? application.applicationType}</div>
                    </div>
                    <Btn size="sm" onClick={() => overlays.openApplicationRequirements(application.id)}>
                      View requirements
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
              {documents.length === 0 && (
                <p className="px-[18px] py-3 text-[12.5px] text-subtle">No documents uploaded yet.</p>
              )}
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
            estPremium: client.estPremium,
            familySize: client.familySize,
            productInterest: client.productInterest,
            coverageTier: client.coverageTier,
          }}
          preset={advanceOpen}
          onClose={() => setAdvanceOpen(null)}
          onCompleteDiscovery={focusCall}
        />
      )}
      {convertConfirmOpen && (
        <ConvertConfirmModal
          lead={{
            name: client.fullName,
            stage: client.leadStage,
            proposalStatus: client.proposalStatus,
          }}
          onClose={() => setConvertConfirmOpen(false)}
          onConfirm={() => openConvertWizard(true)}
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
      {generateProposalOpen && (
        <GenerateProposalModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setGenerateProposalOpen(false)}
          onDone={() => router.refresh()}
        />
      )}
      {nurturingOpen && (
        <MarkNurturingModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setNurturingOpen(false)}
        />
      )}
      {markLostOpen && (
        <MarkLostModal
          clientId={client.id}
          clientName={client.fullName}
          onClose={() => setMarkLostOpen(false)}
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
