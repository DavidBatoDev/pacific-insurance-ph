"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { listTouchpointsAction, sendCampaignAction } from "@/app/(app)/relationship/actions";
import { listActiveTemplatesAction } from "@/app/(app)/templates/actions";
import type { TouchpointRow } from "@/lib/queries/relationship";
import type { EmailTemplate } from "@/lib/repositories/templates/email-template.entity";
import { fillTemplate } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import { usePersona } from "../persona";
import { Avatar, Btn } from "../primitives";
import { DRAWER_INPUT, DrawerField } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/**
 * New Campaign — two-step batch drawer (see new-modals.md §11): Build → Review & preview, human-in-the-loop. Audience
 * auto-segments per type from real touchpoints; each recipient gets a merged
 * message logged to their timeline.
 */

const NC_TYPES: Record<
  string,
  { tpl: string; seg: TouchpointRow["type"] | "manual"; icon: IconName; segLabel: string }
> = {
  Birthday: { tpl: "Birthday greeting", seg: "birthday", icon: "cake", segLabel: "Birthdays in the next 45 days" },
  Anniversary: { tpl: "Anniversary greeting", seg: "anniversary", icon: "award", segLabel: "Client anniversaries coming up" },
  Loyalty: { tpl: "Loyalty / thank-you", seg: "manual", icon: "gift", segLabel: "Hand-picked loyal clients" },
  "Re-nurture": { tpl: "New inquiry response", seg: "renurture", icon: "refresh", segLabel: "Nurturing leads" },
};

export function NewCampaignDrawer({
  presetType,
  onClose,
}: {
  presetType?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState(presetType && NC_TYPES[presetType] ? presetType : "Birthday");
  const meta = NC_TYPES[type];

  const [name, setName] = useState(`${type} campaign`);
  const [tpl, setTpl] = useState(meta.tpl);
  const [channels, setChannels] = useState<string[]>(["Email"]);
  const [touchpoints, setTouchpoints] = useState<TouchpointRow[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([listTouchpointsAction(), listActiveTemplatesAction()])
      .then(([tps, tpls]) => {
        setTouchpoints(tps);
        setTemplates(tpls);
      })
      .catch(() => overlays.toast("Couldn’t load the audience", "Try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const pool = useMemo(
    () => (meta.seg === "manual" ? touchpoints : touchpoints.filter((t) => t.type === meta.seg)),
    [touchpoints, meta.seg],
  );
  const recipients = pool.filter((r) => !excluded.has(r.clientId));
  const template = templates.find((t) => t.name === tpl);

  const changeType = (t: string) => {
    setType(t);
    setTpl(NC_TYPES[t].tpl);
    setExcluded(new Set());
    if (/campaign$/.test(name) || !name.trim()) setName(`${t} campaign`);
  };

  const merged = (r: TouchpointRow) => {
    const ctx = { first_name: r.name.split(" ")[0], agent: persona.userName };
    return {
      subject: template ? fillTemplate(template.subject, ctx) : "",
      body: template ? fillTemplate(template.body, ctx) : "",
    };
  };

  const send = () =>
    startTransition(async () => {
      const res = await sendCampaignAction({
        campaignName: name,
        type,
        channels,
        recipients: recipients.map((r) => ({
          clientId: r.clientId,
          name: r.name,
          email: r.email,
          ...merged(r),
        })),
      });
      if (res.ok) {
        overlays.toast(
          "Campaign logged",
          `${res.data} personalized ${type.toLowerCase()} message${res.data === 1 ? "" : "s"} logged to timelines; nothing was delivered.`,
        );
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t log campaign", res.error);
      }
    });

  const preview = recipients[0];

  return (
    <Drawer
      icon="heart"
      title="New campaign"
      sub={step === 1 ? "Batch a personal touchpoint to a segment of contacts" : "Review the segment and preview before sending"}
      wide
      onClose={onClose}
      footer={
        step === 1 ? (
          <>
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn
              variant="primary"
              disabled={!name.trim() || !template || channels.length === 0 || recipients.length === 0}
              onClick={() => setStep(2)}
            >
              Review &amp; preview <I.arrowRight size={15} />
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={() => setStep(1)}>
              <I.arrowRight size={15} className="rotate-180" /> Back
            </Btn>
            <Btn variant="primary" disabled={pending} onClick={send}>
              <I.send size={15} /> {pending ? "Logging…" : `Log campaign (${recipients.length})`}
            </Btn>
          </>
        )
      }
    >
      {/* step indicator */}
      <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold">
        {(["Build", "Review & preview"] as const).map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            {i === 1 && <span className="h-px w-8 bg-border-strong" />}
            <span
              className={cn(
                "flex items-center gap-1.5",
                step === i + 1 ? "text-brand-hover" : i + 1 < step ? "text-brand" : "text-subtle",
              )}
            >
              <span className={cn("grid size-5 place-items-center rounded-full text-[10.5px] font-bold", step === i + 1 ? "border-2 border-brand" : i + 1 < step ? "bg-brand text-white" : "border border-border-strong")}>
                {i + 1 < step ? <I.check size={11} /> : i + 1}
              </span>
              {label}
            </span>
          </span>
        ))}
      </div>

      {step === 1 && (
        <>
          <DrawerField label="Campaign name" required>
            <input className={DRAWER_INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Internal label" />
          </DrawerField>

          <DrawerField label="Type" required hint="Picking a type pre-fills the audience segment and greeting template" className="mt-4">
            <div className="grid grid-cols-4 gap-2 max-[700px]:grid-cols-2">
              {Object.keys(NC_TYPES).map((t) => {
                const TI = I[NC_TYPES[t].icon];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => changeType(t)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-[12.5px] font-semibold transition-colors",
                      type === t ? "border-brand bg-brand-soft text-brand-hover" : "border-border-strong text-muted-foreground hover:bg-hover",
                    )}
                  >
                    <TI size={17} />
                    {t}
                  </button>
                );
              })}
            </div>
          </DrawerField>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <DrawerField label="Template" required hint="From Email Templates — merged per recipient">
              <select className={DRAWER_INPUT} value={tpl} onChange={(e) => setTpl(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id}>{t.name}</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Channel" required>
              <div className="flex gap-1.5">
                {["Email", "WhatsApp", "Viber"].map((c) => {
                  const on = channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChannels(on ? channels.filter((x) => x !== c) : [...channels, c])}
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

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
                Audience · {meta.segLabel}
              </span>
              <span className="text-[12px] font-semibold text-muted-foreground">
                {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
                {excluded.size > 0 && ` · ${excluded.size} excluded`}
              </span>
            </div>
            {pool.length === 0 && (
              <div className="rounded-md bg-surface-2 px-4 py-5 text-center text-[12.5px] text-subtle">
                No contacts in this segment right now.
              </div>
            )}
            <div className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
              {pool.map((r) => {
                const on = !excluded.has(r.clientId);
                return (
                  <button
                    key={r.clientId + r.type}
                    onClick={() =>
                      setExcluded((s) => {
                        const n = new Set(s);
                        if (n.has(r.clientId)) n.delete(r.clientId);
                        else n.add(r.clientId);
                        return n;
                      })
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3.5 py-2 text-left transition-colors",
                      on ? "border-brand/40 bg-brand-soft/40" : "border-border-soft opacity-60 hover:opacity-100",
                    )}
                  >
                    <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-md border-[1.6px]", on ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
                      <I.check size={13} />
                    </span>
                    <Avatar name={r.name} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-[600]">{r.name}</span>
                      <span className="block text-[11.5px] text-subtle">{r.sub}</span>
                    </span>
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      {r.when}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="mb-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
            <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <b>Logged only.</b> Clicking <b>Log campaign</b> records each personalized message on
              the timeline; no message is delivered.
            </div>
          </div>

          <div className="mb-4 rounded-md border border-border-soft bg-surface-2 px-3.5 py-3 text-[12.5px]">
            {(
              [
                ["Campaign", name],
                ["Type", `${type} · template “${tpl}”`],
                ["Audience", `${recipients.length} recipients · ${meta.segLabel}`],
                ["Channel", channels.join(", ")],
                ["Sender", persona.userName],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border-soft py-1.5 last:border-0">
                <span className="font-semibold uppercase tracking-[0.03em] text-subtle">{k}</span>
                <span className="text-right font-[600]">{v}</span>
              </div>
            ))}
          </div>

          {preview && template && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                Preview — merged for {preview.name}
              </div>
              <div className="rounded-md border border-border-soft bg-surface-2 p-4">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <Avatar name={persona.userName} size={32} />
                  <div>
                    <div className="text-[13px] font-[650]">
                      {persona.userName} <span className="font-normal text-subtle">· Pacific Insurance PH</span>
                    </div>
                    <div className="text-[11.5px] text-subtle">
                      To: {preview.email ?? preview.name} · via {channels.join(", ")}
                    </div>
                  </div>
                </div>
                <div className="text-[13.5px] font-[650]">{merged(preview).subject}</div>
                <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  {merged(preview).body}
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
              All {recipients.length} recipients
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recipients.map((r) => (
                <span key={r.clientId + r.type} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[12px] font-semibold">
                  <Avatar name={r.name} size={20} /> {r.name}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
