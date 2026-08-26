"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  listAwaitingPaymentsAction,
  listPaymentChannelOptionsAction,
  sendPaymentLinksAction,
} from "@/app/(app)/payments/actions";
import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { Payment } from "@/lib/repositories/payments/payment.entity";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import { peso } from "../data";
import { I } from "../icons";
import { usePersona } from "../persona";
import { Avatar, Btn } from "../primitives";
import { DRAWER_INPUT, DrawerField } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/**
 * Send Payment Links — batch drawer from the Dashboard revenue widget
 * (design payment-links.jsx / new-modals.md §12). Every awaiting-payment
 * recipient is pre-checked across the three queues; each send is logged to
 * the contact's timeline and the source status advances.
 */

const QUEUE_TEMPLATE: Record<string, string> = {
  Application: "Payment instruction",
  Renewal: "Renewal reminder",
  Travel: "Travel insurance payment instruction",
};

export function PaymentLinksDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<string[]>([]);
  const [payChannel, setPayChannel] = useState("");
  const [channelsFailed, setChannelsFailed] = useState(false);
  const [via, setVia] = useState<string[]>(["Email"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listAwaitingPaymentsAction(),
      listActiveTemplatesAction(),
      listPaymentChannelOptionsAction().then(
        (chans) => ({ chans, failed: false }),
        () => ({ chans: [], failed: true }),
      ),
    ])
      .then(([pays, tpls, channelResult]) => {
        setPayments(pays);
        setTemplates(tpls);
        setChecked(new Set(pays.map((p) => p.id))); // all pre-checked (§12)
        setChannelsFailed(channelResult.failed);
        const chans = channelResult.chans;
        setChannels(chans.map((c) => c.label));
        // Options arrive default-first; an explicit isDefault flag wins if present.
        const preferred = chans.find((c) => "isDefault" in c && c.isDefault === true) ?? chans[0];
        setPayChannel(preferred?.label ?? "");
      })
      .catch(() => overlays.toast("Couldn’t load payment queues", "Try again."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const selected = payments.filter((p) => checked.has(p.id));
  const total = selected.reduce((a, p) => a + (p.amount ?? 0), 0);
  const bySource = useMemo(() => {
    const groups: Record<string, Payment[]> = {};
    for (const p of payments) (groups[p.source] ??= []).push(p);
    return groups;
  }, [payments]);

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = () =>
    startTransition(async () => {
      const subjectBySource: Record<string, string> = {};
      const bodyBySource: Record<string, string> = {};
      for (const source of Object.keys(bySource)) {
        const t = templates.find((x) => x.name === QUEUE_TEMPLATE[source]);
        const ctx = { agent: persona.userName, channel: payChannel.split(" — ")[0] };
        subjectBySource[source] = t ? fillTemplate(t.subject, ctx) : "Payment instruction";
        bodyBySource[source] = t ? fillTemplate(t.body, ctx) : "";
      }
      const res = await sendPaymentLinksAction({
        paymentIds: [...checked],
        payChannel,
        via,
        subjectBySource,
        bodyBySource,
      });
      if (res.ok) {
        overlays.toast(
          "Payment links logged",
          `${res.data} personalized payment instruction${res.data === 1 ? "" : "s"} logged to timelines; nothing was delivered.`,
        );
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t log payment links", res.error);
      }
    });

  return (
    <Drawer
      icon="send"
      title="Log payment links"
      sub="Record intended payment instructions for everyone with money awaiting collection"
      wide
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={selected.length === 0 || via.length === 0 || !payChannel || pending} onClick={send}>
            <I.send size={15} /> {pending ? "Logging…" : `Log all (${selected.length})`}
          </Btn>
        </>
      }
    >
      <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <b>Human-in-the-loop batch.</b> Every recipient is pre-selected across the queues —
          uncheck anyone to exclude them, then <b>Log all</b>. Each personalized instruction is
          recorded to the timeline but is not delivered.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DrawerField label="Official payment channel" required hint="Business payee — never a personal account">
          {channels.length > 0 ? (
            <select className={DRAWER_INPUT} value={payChannel} onChange={(e) => setPayChannel(e.target.value)}>
              {channels.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : loading ? (
            <select className={DRAWER_INPUT} disabled />
          ) : channelsFailed ? (
            <div className="rounded-md border border-amber-border bg-amber-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-amber">
              Couldn’t load the official payment channels. Close this drawer and try again.
            </div>
          ) : (
            <div className="rounded-md border border-amber-border bg-amber-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-amber">
              No official payment channels are configured.{" "}
              <Link className="font-bold underline" href="/settings">Open Settings → Payment Channels</Link>{" "}
              to add one before logging instructions.
            </div>
          )}
        </DrawerField>
        <DrawerField label="Send via" required>
          <div className="flex gap-1.5">
            {["Email", "WhatsApp", "Viber"].map((c) => {
              const on = via.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setVia(on ? via.filter((x) => x !== c) : [...via, c])}
                  className={cn(
                    "h-9 flex-1 rounded-md border text-[12.5px] font-semibold transition-colors",
                    on ? "border-brand bg-brand-soft text-brand-hover" : "border-border-strong text-muted-foreground hover:bg-hover",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </DrawerField>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5 text-[13px]">
        <span>
          <b>{selected.length}</b> of {payments.length} recipients · <b>{peso(total)}</b> selected
        </span>
        <span className="flex gap-3 text-[12px] font-semibold text-brand-hover">
          <button onClick={() => setChecked(new Set(payments.map((p) => p.id)))}>Select all</button>
          <button onClick={() => setChecked(new Set())}>None</button>
        </span>
      </div>

      {loading && <div className="py-6 text-center text-[13px] text-subtle">Loading queues…</div>}
      {!loading && payments.length === 0 && (
        <div className="py-6 text-center text-[13px] text-subtle">
          Nothing awaiting payment right now — the queues are clear. 🎉
        </div>
      )}

      {Object.entries(bySource).map(([source, rows]) => {
        const selRows = rows.filter((r) => checked.has(r.id));
        return (
          <div key={source} className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
              <span>{source}s · template “{QUEUE_TEMPLATE[source] ?? "Payment instruction"}”</span>
              <span>
                {selRows.length}/{rows.length} · {peso(selRows.reduce((a, r) => a + (r.amount ?? 0), 0))}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {rows.map((p) => {
                const on = checked.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
                      on ? "border-brand/40 bg-brand-soft/40" : "border-border-soft opacity-70 hover:opacity-100",
                    )}
                  >
                    <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px]", on ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
                      <I.check size={13} />
                    </span>
                    <Avatar name={p.clientName ?? "—"} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-[600]">{p.clientName ?? "—"}</span>
                      <span className="block text-[11.5px] text-subtle">
                        {p.sourceRef ?? p.referenceNo} {p.status === "Overdue" && <b className="text-red">· Overdue</b>}
                      </span>
                    </span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums">
                      {p.amount != null ? peso(p.amount) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Drawer>
  );
}
