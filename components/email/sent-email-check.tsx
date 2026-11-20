"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { checkEmailSendAction } from "@/app/(app)/email/actions";
import { Btn } from "@/components/hub/primitives";

/** Explicit reconciliation for one uncertain send. Reads Gmail; never sends. Keeps the detail on failure. */
export function SentEmailCheck({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const check = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await checkEmailSendAction(id);
      if (result.ok) {
        setMessage(result.data.notice ? { tone: "info", text: result.data.notice } : null);
        router.refresh();
      } else setMessage({ tone: "error", text: result.error });
    } catch {
      setMessage({ tone: "error", text: "Status could not be checked. Try again shortly; do not resend." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn size="sm" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Check status"}</Btn>
      <p role="status" aria-live="polite" className={message?.tone === "error" ? "text-[12px] text-red" : "text-[12px] text-muted-foreground"}>
        {message?.text}
      </p>
    </div>
  );
}
