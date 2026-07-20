"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createTemplateAction, updateTemplateAction } from "@/app/(app)/templates/actions";
import type { EmailTemplate } from "@/lib/repositories/templates";
import { fillTemplate, MERGE_FIELDS } from "@/lib/templates/merge";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Btn, Card, CardHead, CountPill, PageHead } from "../primitives";

/**
 * Email Templates — two-pane list + editor over the email_templates table
 * (design: email-templates.jsx §14). Wired via server actions.
 */

const PREVIEW_CTX = {
  first_name: "Grace",
  product: "Maxicare Plus",
  premium: "₱73,000",
  agent: "Eman Bondoc",
};

interface Draft {
  name: string;
  channel: string;
  subject: string;
  body: string;
}

export function TemplatesScreen({ templates }: { templates: EmailTemplate[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const canEdit = persona.can("templates", "edit");

  const [selId, setSelId] = useState<string | null>(templates[0]?.id ?? null);
  const sel = useMemo(
    () => templates.find((t) => t.id === selId) ?? templates[0] ?? null,
    [templates, selId],
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the editor draft whenever the selection (or its server copy) changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync editor to selection
    setDraft(
      sel
        ? { name: sel.name, channel: sel.channel, subject: sel.subject, body: sel.body }
        : null,
    );
  }, [sel]);

  const dirty =
    !!sel &&
    !!draft &&
    (draft.name !== sel.name ||
      draft.channel !== sel.channel ||
      draft.subject !== sel.subject ||
      draft.body !== sel.body);

  const save = () => {
    if (!sel || !draft || !dirty) return;
    startTransition(async () => {
      const res = await updateTemplateAction(sel.id, draft);
      if (res.ok) {
        overlays.toast("Template saved", `“${res.data.name}” updated.`);
        router.refresh();
      } else {
        overlays.toast("Couldn’t save template", res.error);
      }
    });
  };

  const toggleActive = () => {
    if (!sel) return;
    startTransition(async () => {
      const res = await updateTemplateAction(sel.id, { active: !sel.active });
      if (res.ok) router.refresh();
      else overlays.toast("Couldn’t update template", res.error);
    });
  };

  const createNew = () => {
    const name = window.prompt("Name for the new template:");
    if (!name) return;
    startTransition(async () => {
      const res = await createTemplateAction(name);
      if (res.ok) {
        setSelId(res.data.id);
        overlays.toast("Template created", `“${res.data.name}” added.`);
        router.refresh();
      } else {
        overlays.toast("Couldn’t create template", res.error);
      }
    });
  };

  const activeCount = templates.filter((t) => t.active).length;

  return (
    <div>
      <PageHead
        iconName="mail"
        title="Email Templates"
        draft={false}
        sub="One source of truth for outbound copy — reused by the Contact Profile composer, the application wizard, and every send-enabled modal."
        actions={
          canEdit ? (
            <Btn variant="primary" onClick={createNew} disabled={pending}>
              <I.plus size={15} /> New template
            </Btn>
          ) : undefined
        }
      />

      <div className="mb-[18px] grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {[
          { val: templates.length, label: "Templates" },
          { val: activeCount, label: "Active", cls: "text-brand" },
          { val: MERGE_FIELDS.length, label: "Merge fields" },
          { val: 3, label: "Consumers wired" },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-card px-4 py-3">
            <div className={cn("text-[19px] font-bold tabular-nums", s.cls)}>{s.val}</div>
            <div className="text-[11.5px] font-semibold text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[340px_1fr] items-start gap-4 max-[1100px]:grid-cols-1">
        {/* List */}
        <Card>
          <CardHead iconName="folder" title="Templates" count={templates.length} />
          <div className="max-h-[560px] overflow-y-auto py-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelId(t.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b border-border-soft px-4 py-2.5 text-left transition-colors last:border-0",
                  sel?.id === t.id ? "bg-brand-soft" : "hover:bg-hover",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-[600]">{t.name}</div>
                  <div className="truncate text-[11.5px] text-subtle">{t.subject || "No subject"}</div>
                </div>
                <span
                  title={t.active ? "Active" : "Inactive"}
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    t.active ? "bg-brand" : "bg-border-strong",
                  )}
                />
              </button>
            ))}
          </div>
        </Card>

        {/* Editor */}
        {sel && draft ? (
          <Card>
            <CardHead
              iconName="mail"
              title={sel.name}
              action={
                <div className="flex items-center gap-2.5">
                  <span className="text-[12.5px] font-semibold text-muted-foreground">
                    {sel.active ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={toggleActive}
                    disabled={!canEdit || pending}
                    className={cn(
                      "relative h-[22px] w-[40px] rounded-full transition-colors",
                      sel.active ? "bg-brand" : "bg-border-strong",
                      (!canEdit || pending) && "opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-all",
                        sel.active ? "left-[20px]" : "left-[2px]",
                      )}
                    />
                  </button>
                </div>
              }
            />
            <div className="px-[18px] py-4">
              {!canEdit && (
                <div className="mb-4 flex items-center gap-2.5 rounded-md border border-amber-border bg-amber-soft px-3.5 py-2.5 text-[12.5px] text-amber">
                  <I.shield size={15} className="shrink-0" />
                  Viewing as {persona.roleLabel} — templates are view-only for your role.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
                <Field label="Template name">
                  <input
                    className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-surface-3"
                    value={draft.name}
                    disabled={!canEdit}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="Channel">
                  <select
                    className="h-9 w-full rounded-md border border-border-strong bg-card px-2.5 text-[13.5px] outline-none focus:border-brand disabled:bg-surface-3"
                    value={draft.channel}
                    disabled={!canEdit}
                    onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
                  >
                    <option>Email</option>
                    <option>WhatsApp</option>
                  </select>
                </Field>
              </div>
              <Field label="Subject" className="mt-4">
                <input
                  className="h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-surface-3"
                  value={draft.subject}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </Field>
              <Field label="Body · rich text with merge fields" className="mt-4">
                <textarea
                  className="min-h-[220px] w-full rounded-md border border-border-strong bg-card px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:bg-surface-3"
                  value={draft.body}
                  disabled={!canEdit}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />
              </Field>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
                  Insert merge field:
                </span>
                {MERGE_FIELDS.map((m) => (
                  <button
                    key={m}
                    disabled={!canEdit}
                    onClick={() => setDraft({ ...draft, body: draft.body + " " + m })}
                    className="rounded-full border border-border bg-surface-3 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-muted-foreground transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {m}
                  </button>
                ))}
              </div>

              {canEdit && (
                <div className="mt-4 flex items-center gap-2.5">
                  <Btn variant="primary" onClick={save} disabled={!dirty || pending}>
                    {pending ? "Saving…" : "Save changes"}
                  </Btn>
                  {dirty && (
                    <Btn
                      onClick={() =>
                        setDraft({
                          name: sel.name,
                          channel: sel.channel,
                          subject: sel.subject,
                          body: sel.body,
                        })
                      }
                    >
                      Discard
                    </Btn>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-md border border-border-soft bg-surface-2 p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                  Preview — merged for Grace Castillo · Maxicare Plus
                </div>
                <div className="text-[13.5px] font-[650]">{fillTemplate(draft.subject, PREVIEW_CTX)}</div>
                <div className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  {fillTemplate(draft.body, PREVIEW_CTX)}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-8 text-center text-[13px] text-subtle">
            No templates yet{canEdit ? " — create the first one." : "."}
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label}
      </label>
      {children}
    </div>
  );
}
