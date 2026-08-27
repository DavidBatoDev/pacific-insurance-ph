"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";
import {
  createTaskAction,
  listAssignableUsersAction,
  taskLinkOptionsAction,
  type AssignableUser,
} from "@/app/(app)/tasks/actions";
import type { TaskLinkOption } from "@/lib/queries/task-links";
import { TASK_TAGS } from "@/lib/repositories/tasks/task.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { BUCKET_LABEL, BUCKET_TONE, taskBucket } from "../task-buckets";
import { Avatar, Btn, INPUT } from "../primitives";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/**
 * Add Task drawer (see new-modals.md §10). Fired from the
 * Tasks board, the Dashboard My-tasks widget, and Contact Profiles. Writes a
 * real tasks row; the board and widget re-read the same table.
 */

const PRIORITIES = ["Low", "Normal", "High"];

export interface AddTaskPrefill {
  title?: string;
  tag?: string;
  contact?: { id: string; name: string; sub?: string };
}

export function AddTaskDrawer({
  prefill,
  onClose,
}: {
  prefill?: AddTaskPrefill;
  onClose: () => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [tag, setTag] = useState(prefill?.tag ?? "General");
  const [assignee, setAssignee] = useState<string>("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [notes, setNotes] = useState("");

  const [contact, setContact] = useState<{ id: string; name: string; sub?: string } | null>(
    prefill?.contact ?? null,
  );
  const [linkOptions, setLinkOptions] = useState<TaskLinkOption[]>([]);
  const [linked, setLinked] = useState("");

  useEffect(() => {
    listAssignableUsersAction().then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setLinked("");
    if (!contact) {
      setLinkOptions([]);
      return;
    }
    taskLinkOptionsAction(contact.id).then(setLinkOptions).catch(() => setLinkOptions([]));
  }, [contact]);

  const { bucket } = taskBucket(due || null);
  const canSave = title.trim() && tag && due && !pending;

  const save = () => {
    if (!canSave) return;
    const link = linkOptions.find((o) => `${o.kind}:${o.id}` === linked);
    startTransition(async () => {
      const res = await createTaskAction({
        title,
        tag,
        clientId: contact?.id ?? null,
        applicationId: link?.kind === "application" ? link.id : null,
        policyId: link?.kind === "policy" ? link.id : null,
        renewalId: link?.kind === "renewal" ? link.id : null,
        claimId: link?.kind === "claim" ? link.id : null,
        travelRequestId: link?.kind === "travel" ? link.id : null,
        assignedUserId: assignee || null,
        dueDate: due,
        priority,
        notes: notes.trim() || null,
      });
      if (res.ok) {
        overlays.toast(
          "Task created",
          `“${res.data.title}” added to ${BUCKET_LABEL[bucket]}${contact ? " · linked to " + contact.name : ""}.`,
        );
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t create task", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="checkSquare"
      title="New task"
      sub="Create a follow-up — it lands on the board and your dashboard"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.plus size={15} /> {pending ? "Creating…" : "Create task"}
          </Btn>
        </>
      }
    >
      <FieldBlock label="Task title" required>
        <input
          autoFocus
          className={INPUT}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Follow up payment for APP-2026-000131"
        />
      </FieldBlock>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FieldBlock label="Type / Tag" required>
          <select className={INPUT} value={tag} onChange={(e) => setTag(e.target.value)}>
            {TASK_TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock label="Assigned to" hint="Defaults to you">
          <select className={INPUT} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Me</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </FieldBlock>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <FieldBlock label="Due date" required>
          <input className={INPUT} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          {due && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", "bg-" + BUCKET_TONE[bucket])} />
              Lands in <b>{BUCKET_LABEL[bucket]}</b>
            </div>
          )}
        </FieldBlock>
        <FieldBlock label="Priority" hint="Optional">
          <div className="flex gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={cn(
                  "h-9 flex-1 rounded-md border text-[12.5px] font-semibold transition-colors",
                  priority === p
                    ? "border-brand bg-brand-soft text-brand-hover"
                    : "border-border-strong bg-card text-muted-foreground hover:bg-hover",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </FieldBlock>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
          Link to a contact <span className="font-medium normal-case tracking-normal">· optional</span>
        </div>
        <ContactPicker contact={contact} onPick={setContact} onClear={() => setContact(null)} />
        {contact && linkOptions.length > 0 && (
          <FieldBlock label="Specific record" hint="Attach to one of this contact's records" className="mt-3">
            <select className={INPUT} value={linked} onChange={(e) => setLinked(e.target.value)}>
              <option value="">None — contact only</option>
              {linkOptions.map((o) => (
                <option key={o.kind + o.id} value={`${o.kind}:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldBlock>
        )}
        {contact && linkOptions.length === 0 && (
          <div className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-[12px] text-subtle">
            No open records under {contact.name} — the task links to the contact.
          </div>
        )}
      </div>

      <FieldBlock label="Notes" hint="Optional detail or context" className="mt-4">
        <textarea
          className={cn(INPUT, "min-h-[80px] py-2")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the assignee should know…"
        />
      </FieldBlock>

      <div className="mt-4 flex gap-2.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <I.checkSquare size={15} className="mt-0.5 shrink-0" />
        <div>
          Saving adds this to the <b>{BUCKET_LABEL[bucket]}</b> column and the dashboard My-tasks
          widget.
          {contact ? (
            <>
              {" "}
              Marking it done later logs <b>Task completed</b> to {contact.name}&apos;s timeline.
            </>
          ) : null}
        </div>
      </div>
    </Drawer>
  );
}


function FieldBlock({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
        {label} {required && <span className="text-red">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-faint">{hint}</div>}
    </div>
  );
}

function ContactPicker({
  contact,
  onPick,
  onClear,
}: {
  contact: { id: string; name: string; sub?: string } | null;
  onPick: (c: { id: string; name: string; sub?: string }) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PaletteClientHit[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      searchClientsForPalette(term)
        .then((rows) => {
          if (seq.current === mySeq) setResults(rows.slice(0, 5));
        })
        .catch(() => setResults([]));
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  if (contact) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-brand bg-brand-soft px-3 py-2.5">
        <Avatar name={contact.name} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-[600]">{contact.name}</div>
          {contact.sub && <div className="text-[11.5px] text-subtle">{contact.sub}</div>}
        </div>
        <button
          onClick={onClear}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-hover"
        >
          <I.plus size={15} className="rotate-45" />
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="flex h-[38px] items-center gap-2.5 rounded-md border border-border-strong bg-card px-3 text-muted-foreground focus-within:border-brand">
        <I.search size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a client or lead…"
          className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle"
        />
      </div>
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => {
            onPick({
              id: r.id,
              name: r.name,
              sub: [r.clientType, r.email].filter(Boolean).join(" · "),
            });
            setQ("");
          }}
          className="mt-1.5 flex w-full items-center gap-2.5 rounded-md border border-border-soft px-3 py-2 text-left transition-colors hover:bg-hover"
        >
          <Avatar name={r.name} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[600]">{r.name}</div>
            <div className="truncate text-[11.5px] text-subtle">
              {[r.clientType, r.email].filter(Boolean).join(" · ")}
            </div>
          </div>
          <I.plus size={16} className="text-subtle" />
        </button>
      ))}
    </div>
  );
}
