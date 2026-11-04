"use client";

import { useEffect, useRef, useState } from "react";

import { EmailAttachmentChoices } from "@/components/email/email-attachment-choices";
import { EmailSendControls } from "@/components/email/email-send-controls";
import { RecentEmailSends } from "@/components/email/recent-email-sends";
import type { ActionResult } from "@/lib/actions/context";
import type { EmailDraftSeed, EmailOrigin } from "@/lib/communications/outbound-email.types";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { AREA, Btn, Field, INPUT } from "../primitives";
import { useOverlays } from "./overlay-provider";

type MissingDocumentsDraft = { clientId: string; outstanding: number; draft: EmailDraftSeed };
type EmailOriginal = { messageId: string; partId: string };

/**
 * Inline review of the "request missing documents" email (applications and claims). The server
 * builds the draft from the checklist; staff may edit recipient/subject/body and add real
 * attachments. Nothing is recorded until Gmail accepts the send through the shared control.
 */
export function MissingDocumentsEmail({
  load,
  onClose,
}: {
  /** Server draft builder for this record (origin application_missing / claim_missing). */
  load: () => Promise<ActionResult<MissingDocumentsDraft>>;
  onClose: () => void;
}) {
  const overlays = useOverlays();
  const [loaded, setLoaded] = useState<MissingDocumentsDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [emailAttachments, setEmailAttachments] = useState<EmailOriginal[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const loadRef = useRef(load);

  // Loads once per mount: re-running would discard the staff member's edits.
  useEffect(() => {
    let live = true;
    loadRef.current().then((result) => {
      if (!live) return;
      if (!result.ok) return setError(result.error);
      setLoaded(result.data);
      setRecipient(result.data.draft.recipient);
      setSubject(result.data.draft.subject);
      setBody(result.data.draft.body);
    }).catch(() => { if (live) setError("The email could not be prepared. Try again shortly."); });
    return () => { live = false; };
  }, []);

  const origin = loaded?.draft.origin;
  const sameSource = (candidate: EmailOrigin) =>
    !!origin && candidate.type === origin.type && "id" in candidate && "id" in origin && candidate.id === origin.id;

  return (
    <section aria-label="Request missing documents" className="mb-4 rounded-md border border-border-soft bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold"><I.mail size={14} /> Request missing documents</div>
        <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-red">{error}</p>}
      {!loaded && !error && <p className="mt-2 text-[12.5px] text-muted-foreground">Preparing the email…</p>}
      {loaded && (
        <>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Lists {loaded.outstanding} outstanding required document{loaded.outstanding === 1 ? "" : "s"}. Review it before sending; nothing is recorded until Gmail accepts it.
          </p>
          <RecentEmailSends clientId={loaded.clientId} matches={sameSource} title="Earlier requests" refreshKey={sentCount} />
          <div className="mt-3 space-y-3">
            <Field label="To">
              <input aria-label="Recipient" type="email" className={INPUT} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="client@example.com" />
            </Field>
            <Field label="Subject">
              <input aria-label="Subject" className={INPUT} value={subject} onChange={(event) => setSubject(event.target.value)} />
            </Field>
            <Field label="Message">
              <textarea aria-label="Message" className={cn(AREA, "text-[13px]")} rows={9} value={body} onChange={(event) => setBody(event.target.value)} />
            </Field>
          </div>
          <EmailAttachmentChoices
            clientId={loaded.clientId}
            documentIds={documentIds}
            onDocumentIds={setDocumentIds}
            emailAttachments={emailAttachments}
            onEmailAttachments={setEmailAttachments}
          />
          <EmailSendControls
            draft={{ ...loaded.draft, recipient, subject, body, documentIds, emailAttachments }}
            ready={Boolean(recipient.trim() && subject.trim() && body.trim())}
            blockedReason={recipient.trim() ? null : "Add the client’s email address."}
            sendLabel="Send request"
            onSent={() => {
              setSentCount((count) => count + 1);
              overlays.toast("Request sent", "Accepted by Gmail. Delivery and reading are not confirmed.");
            }}
          />
        </>
      )}
    </section>
  );
}
