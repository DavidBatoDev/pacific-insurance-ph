"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { beginGmailConnectionAction, checkGmailConnectionAction, enableIncomingGmailAction, syncIncomingGmailAction } from "@/app/(app)/settings/gmail-actions";
import { GMAIL_CALLBACK_MESSAGES, type GmailConnectionStatus } from "@/lib/gmail/types";
import { Btn } from "@/components/hub/primitives";

const LABELS = {
  disconnected: "Disconnected",
  connected: "Connected",
  reconnect_required: "Reconnect required",
};

export function GmailConnectionCard({ connection, canManage, callbackResult }: {
  connection: GmailConnectionStatus;
  canManage: boolean;
  callbackResult: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const callbackMessage = callbackResult && Object.hasOwn(GMAIL_CALLBACK_MESSAGES, callbackResult)
    ? GMAIL_CALLBACK_MESSAGES[callbackResult] : null;
  const unavailable = Boolean(connection.setupProblem || connection.loadProblem);

  const connect = () => startTransition(async () => {
    setNotice(null);
    try {
      const result = await beginGmailConnectionAction();
      if (!result.ok) setNotice(result.error);
    } catch {
      setNotice("Could not start Google authorization. Refresh this page and try again.");
    }
  });

  const check = () => startTransition(async () => {
    setNotice(null);
    try {
      const result = await checkGmailConnectionAction();
      setNotice(result.ok ? "Mailbox authorization checked. Email delivery remains disabled." : result.error);
      router.refresh();
    } catch {
      setNotice("Could not check the mailbox. The last verified status is unchanged.");
    }
  });

  const incoming = (enable: boolean) => startTransition(async () => {
    setNotice(null);
    try {
      const result = await (enable ? enableIncomingGmailAction() : syncIncomingGmailAction());
      setNotice(result.ok ? result.data : result.error);
      router.refresh();
    } catch {
      setNotice("Incoming email could not be updated. Refresh this page and check the integration status.");
    }
  });

  return <section aria-labelledby="gmail-connection-title" className="rounded-md border border-border-soft bg-surface-2 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="gmail-connection-title" className="text-[15px] font-bold">Gmail mailbox</h3>
      <span className="rounded-full border border-border-soft bg-card px-2.5 py-1 text-[11.5px] font-semibold">
        {connection.status ? LABELS[connection.status] : "Status unavailable"}
      </span>
    </div>
    <p className="mt-2 break-all text-[13px] font-semibold">{connection.mailboxEmail ?? "admin@pacificinsuranceph.com"}</p>
    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
      Authorize the agency mailbox with Google. Admin and Staff can send individual emails after reviewing them; campaigns and bulk payment links are still logged only, never sent automatically. Incoming access is read-only: the CRM does not mark read, move or delete mailbox messages.
    </p>
    <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
      Sending · {connection.sendAuthorized ? "Recorded as authorized" : "Not authorized — reconnect and approve sending permission"}. This is the recorded grant, not a live provider check; use Check connection to verify it now.
    </p>
    {connection.lastCheckedAt && <p className="mt-2 text-[11.5px] text-subtle">
      Last checked: {new Date(connection.lastCheckedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Manila).
    </p>}
    <div className="mt-4 border-t border-border-soft pt-3 text-[12.5px] leading-relaxed">
      <p className="font-semibold">Incoming email · {connection.inboxLoadProblem ? "Status unavailable" : connection.inbox?.enabled ? (connection.inbox.lastError ? "Needs attention" : connection.inbox.pending ? "Catching up" : "Enabled") : "Not enabled"}</p>
      {!connection.readAuthorized && <p className="mt-1 text-muted-foreground">Reconnect Gmail and approve read permission. The existing send-only connection remains valid.</p>}
      <p className="mt-1 text-muted-foreground">Enablement starts from now, without importing old mail. Admins review unassigned messages; linked correspondence is limited to the relevant records. Record matching and PDF filing require staff confirmation.</p>
      {connection.inbox?.lastSyncedAt && <p className="mt-1 text-subtle">Last synced: {new Date(connection.inbox.lastSyncedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Manila).</p>}
      {connection.inbox?.watchExpiresAt && <p className="mt-1 text-subtle">Gmail watch expires: {new Date(connection.inbox.watchExpiresAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Manila). Renewed daily; missed notifications are reconciled daily or with Sync now.</p>}
      {connection.inbox?.lastError && <p className="mt-2 text-amber">Incoming synchronization or watch renewal needs attention. Check authorization and topic permissions, then select Sync now. Saved messages and the last completed cursor are retained.</p>}
      {(connection.inboxSetupProblem || connection.inboxLoadProblem) && <p role="alert" className="mt-2 text-amber">{connection.inboxSetupProblem ?? connection.inboxLoadProblem}</p>}
      <Link href="/inbox" className="mt-2 inline-block font-semibold text-primary underline underline-offset-2">Open incoming email</Link>
    </div>
    {(connection.setupProblem || connection.loadProblem) && <p role="alert" className="mt-3 text-[12.5px] text-amber">{connection.setupProblem ?? connection.loadProblem}</p>}
    {(notice || callbackMessage) && <p role="status" aria-live="polite" className="mt-3 text-[12.5px] text-muted-foreground">{notice ?? callbackMessage}</p>}
    {canManage ? <div className="mt-4 flex flex-wrap gap-2">
      <Btn size="sm" disabled={pending || unavailable} onClick={connect}>
        {pending ? "Working…" : connection.status === "disconnected" ? "Connect Gmail" : "Reconnect Gmail"}
      </Btn>
      {connection.status && connection.status !== "disconnected" && <Btn size="sm" disabled={pending || unavailable} onClick={check}>Check connection</Btn>}
      <Btn size="sm" disabled={pending || unavailable || !connection.readAuthorized || connection.status !== "connected" || Boolean(connection.inboxSetupProblem || connection.inboxLoadProblem) || !connection.inbox} onClick={() => incoming(!connection.inbox?.enabled)}>
        {connection.inbox?.enabled ? "Sync now" : "Enable incoming email from now"}
      </Btn>
    </div> : <p className="mt-3 text-[12px] text-subtle">Only an active Admin can connect or check this mailbox.</p>}
  </section>;
}
