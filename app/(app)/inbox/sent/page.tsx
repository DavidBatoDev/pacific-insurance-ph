import { notFound, redirect } from "next/navigation";

import { MailboxTabs } from "@/components/email/mailbox-tabs";
import { SentEmailWorkspace } from "@/components/email/sent-email-workspace";
import { isEmailSender, OutboundEmailError } from "@/lib/communications/outbound-email";
import { parseSelectedMessage, parseSentEmailFilters, sentEmailService } from "@/lib/communications/sent-email";
import { DEFAULT_SENT_EMAIL_FILTERS, type SentEmailFilters, type SentEmailPage } from "@/lib/communications/sent-email.types";
import { InboxReviewError, requireInboxActor } from "@/lib/gmail/review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sent email · Pacific Insurance PH" };

export default async function SentEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireInboxActor().catch((error: unknown) => {
    if (error instanceof InboxReviewError && error.status === 401) redirect("/login");
    throw error;
  });
  // Agency-wide outgoing history is Admin/Staff only; Agents keep their scoped Inbox.
  if (!isEmailSender(actor)) notFound();

  const params = await searchParams;
  const selected = parseSelectedMessage(params);
  if (selected === "invalid") notFound();

  let filters: SentEmailFilters = DEFAULT_SENT_EMAIL_FILTERS;
  let filterError: string | null = null;
  try {
    filters = parseSentEmailFilters(params);
  } catch (error) {
    if (!(error instanceof OutboundEmailError)) throw error;
    filterError = error.message;
  }

  const detail = selected
    ? await sentEmailService.detail(selected).catch((error: unknown) => {
      if (error instanceof OutboundEmailError && error.status === 404) notFound();
      throw error;
    })
    : null;
  const page: SentEmailPage | null = detail || filterError ? null : await sentEmailService.page(filters);

  return <>
    <MailboxTabs current="sent" canViewSent />
    <SentEmailWorkspace filters={filters} filterError={filterError} page={page} detail={detail} />
  </>;
}
