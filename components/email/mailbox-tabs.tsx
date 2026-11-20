import Link from "next/link";
import { Inbox, Send } from "lucide-react";

import { SENT_EMAIL_PATH } from "@/lib/communications/sent-email.types";
import { cn } from "@/lib/utils";

/** Inbox | Sent. `canViewSent` must come from the server-resolved real role, never persona preview. */
export function MailboxTabs({ current, canViewSent }: { current: "inbox" | "sent"; canViewSent: boolean }) {
  if (!canViewSent) return null;
  const tabs = [
    { id: "inbox", label: "Inbox", href: "/inbox", Icon: Inbox },
    { id: "sent", label: "Sent", href: SENT_EMAIL_PATH, Icon: Send },
  ] as const;
  return (
    <nav aria-label="Mailbox" className="mb-4 flex gap-1 border-b border-border">
      {tabs.map(({ id, label, href, Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-ring",
            current === id ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={14} aria-hidden="true" />{label}
        </Link>
      ))}
    </nav>
  );
}
