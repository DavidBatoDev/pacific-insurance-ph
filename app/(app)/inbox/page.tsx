import { notFound, redirect } from "next/navigation";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { getInboxReviewData, InboxReviewError, requireInboxActor } from "@/lib/gmail/review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox · Pacific Insurance PH" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ message?: string; page?: string }> }) {
  const actor = await requireInboxActor().catch((error: unknown) => {
    if (error instanceof InboxReviewError && error.status === 401) redirect("/login");
    throw error;
  });
  const query = await searchParams;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await getInboxReviewData(actor.id, typeof query.message === "string" ? query.message : undefined, page).catch((error: unknown) => {
    if (error instanceof InboxReviewError && error.status === 404) notFound();
    throw error;
  });
  return <InboxWorkspace data={data} />;
}
