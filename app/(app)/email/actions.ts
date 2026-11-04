"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/actions/context";
import { outboundEmailErrorMessage, outboundEmailService, requireEmailSender } from "@/lib/communications/outbound-email";
import type { EmailDocumentOption, EmailDraftSeed, EmailSendView, PrepareEmailInput } from "@/lib/communications/outbound-email.types";
import { getReplyDraft } from "@/lib/gmail/reply";
import { getDocumentsRepository } from "@/lib/repositories/documents";

/**
 * Staff-reviewed Gmail sending. Every action re-derives the active sender from the session
 * (direct POSTs included). `ok: true` means a status was returned, not that Gmail accepted it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function settled(view: EmailSendView): EmailSendView {
  // Accepted sends change workflow state across screens; refresh server-rendered data.
  if (view.state === "accepted") revalidatePath("/", "layout");
  return view;
}

/** Real session capability for the send controls; persona previews never grant it. */
export async function getEmailSenderAction(): Promise<ActionResult<{ actorId: string }>> {
  try { return { ok: true, data: { actorId: (await requireEmailSender()).id } }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

export async function prepareEmailAction(input: PrepareEmailInput): Promise<ActionResult<EmailSendView>> {
  try { return { ok: true, data: await outboundEmailService.prepare(input) }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

export async function sendPreparedEmailAction(id: string): Promise<ActionResult<EmailSendView>> {
  try { return { ok: true, data: settled(await outboundEmailService.sendPrepared(id)) }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

/** State only: never refreshes OAuth or sends. */
export async function getEmailSendAction(id: string): Promise<ActionResult<EmailSendView>> {
  try { return { ok: true, data: await outboundEmailService.get(id) }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

/** Reconciles an uncertain outcome by reading Gmail; never sends. */
export async function checkEmailSendAction(id: string): Promise<ActionResult<EmailSendView>> {
  try { return { ok: true, data: settled(await outboundEmailService.check(id)) }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

/** Recent sends for a client (optionally replies to one message), newest first. */
export async function listEmailSendsAction(clientId: string, replyToMessageId?: string): Promise<ActionResult<EmailSendView[]>> {
  try { return { ok: true, data: await outboundEmailService.list(clientId, replyToMessageId) }; }
  catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

/** Current stored files of this client that can be attached. */
export async function listEmailDocumentsAction(clientId: string): Promise<ActionResult<EmailDocumentOption[]>> {
  try {
    await requireEmailSender();
    if (!UUID.test(clientId)) return { ok: false, error: "Contact not found." };
    const documents = await getDocumentsRepository().listByClient(clientId);
    return {
      ok: true,
      data: documents
        .filter((document) => document.clientId === clientId && document.filePath && document.status !== "Replaced")
        .map((document) => ({ id: document.id, name: document.name, documentType: document.documentType, uploadedAt: document.uploadedAt, recordLabel: document.documentType })),
    };
  } catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}

/** Locked reply draft for linked correspondence; recipient and subject come from Gmail. */
export async function getReplyDraftAction(messageId: string): Promise<ActionResult<{ draft: EmailDraftSeed; clientId: string }>> {
  try {
    await requireEmailSender();
    const reply = await getReplyDraft(messageId);
    return { ok: true, data: { clientId: reply.clientId, draft: { origin: { type: "reply", messageId: reply.messageId }, recipient: reply.recipient, subject: reply.subject, body: "" } } };
  } catch (error) { return { ok: false, error: outboundEmailErrorMessage(error) }; }
}
