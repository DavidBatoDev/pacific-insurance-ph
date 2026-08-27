"use client";

import { useState, useTransition, type RefObject } from "react";
import { useRouter } from "next/navigation";

import { addNoteAction, logMessageAction, type LeadAdvanceSuggestion } from "@/app/(app)/clients/engage-actions";
import type { Client } from "@/lib/repositories/clients/client.entity";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { cn } from "@/lib/utils";
import { I } from "../../icons";
import type { AdvanceLeadPreset } from "../../overlays/advance-lead";
import { LogCallForm } from "../../overlays/log-call";
import { useOverlays } from "../../overlays/overlay-provider";
import { EmailForm } from "../../overlays/send-email";
import { AREA, Btn, Card, Field, INPUT } from "../../primitives";

export type ComposerTab = "Email" | "Log Message" | "Log Call" | "Note" | "Task";

/**
 * The five-tab composer. Email and Log Call delegate to the shared forms and
 * are remounted via the parent-owned keys (focusEmail / focusCall); the
 * Log Message and Note tabs own their drafts here.
 */
export function ContactComposer({
  client,
  templates,
  tab,
  setTab,
  composerRef,
  emailFormKey,
  callFormKey,
  initialEmailTemplate,
  onAdvanceSuggestion,
}: {
  client: Client;
  templates: EmailTemplate[];
  tab: ComposerTab;
  setTab: (tab: ComposerTab) => void;
  composerRef: RefObject<HTMLDivElement | null>;
  emailFormKey: number;
  callFormKey: number;
  initialEmailTemplate: string | undefined;
  onAdvanceSuggestion: (advance: AdvanceLeadPreset & Partial<LeadAdvanceSuggestion>) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const toast = overlays.toast;
  const [pending, startTransition] = useTransition();

  const [msgChannel, setMsgChannel] = useState("WhatsApp");
  const [msgAt, setMsgAt] = useState("");
  const [msgText, setMsgText] = useState("");
  const [note, setNote] = useState("");

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
      if (res.data.advance) onAdvanceSuggestion(res.data.advance);
    });

  const addNote = () =>
    startTransition(async () => {
      const res = await addNoteAction({ clientId: client.id, note });
      if (!res.ok) return toast("Couldn’t add note", res.error);
      toast("Note added", "Private note saved to the timeline.");
      setNote("");
      router.refresh();
    });

  return (
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
                    if (advance) onAdvanceSuggestion(advance);
                  }}
                />
              )}

              {tab === "Log Message" && (
                <>
                  <div className="grid grid-cols-2 gap-3.5">
                    <Field label="Channel" required>
                      <select className={INPUT} value={msgChannel} onChange={(e) => setMsgChannel(e.target.value)}>
                        {["WhatsApp", "Viber", "iMessage", "SMS", "Other"].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Received at">
                      <input className={INPUT} type="datetime-local" value={msgAt} onChange={(e) => setMsgAt(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Transcript / summary" required className="mt-3.5">
                    <textarea
                      className={cn(AREA, "min-h-[130px]")}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="Paste or summarize the inbound message…"
                    />
                  </Field>
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
                    if (advance) onAdvanceSuggestion(advance);
                  }}
                />
              )}

              {tab === "Note" && (
                <>
                  <Field label="Internal note" required>
                    <textarea
                      className={cn(AREA, "min-h-[130px]")}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Private note — visible to staff only…"
                    />
                  </Field>
                  <div className="mt-3.5 flex justify-end">
                    <Btn variant="primary" disabled={pending || !note.trim()} onClick={addNote}>
                      <I.plus size={15} /> Add note
                    </Btn>
                  </div>
                </>
              )}
            </div>
    </Card>
  );
}
