"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/app/(app)/clients/actions";
import type { Client } from "@/lib/repositories/clients";
import { cn } from "@/lib/utils";

const CLIENT_TYPES = [
  "Prospect",
  "Individual Client",
  "Family Client",
  "Corporate Contact",
  "Former Client",
];
const CHANNELS = ["Gmail", "Phone", "Viber", "WhatsApp", "iMessage", "In-Person", "Other"];

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand";

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  clientType: string;
  leadSource: string;
  preferredChannel: string;
  status: string;
  vipStatus: boolean;
  address: string;
  notes: string;
}

function initialValues(client?: Client): Values {
  return {
    firstName: client?.firstName ?? "",
    lastName: client?.lastName ?? "",
    email: client?.email ?? "",
    mobileNumber: client?.mobileNumber ?? "",
    dateOfBirth: client?.dateOfBirth ?? "",
    clientType: client?.clientType ?? "Prospect",
    leadSource: client?.leadSource ?? "",
    preferredChannel: client?.preferredChannel ?? "",
    status: client?.status ?? "Active",
    vipStatus: client?.vipStatus ?? false,
    address: client?.address ?? "",
    notes: client?.notes ?? "",
  };
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cn("flex flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  const isEdit = !!client;
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    isEdit ? updateClientAction : createClientAction,
    {},
  );
  // Controlled inputs: React 19 resets the form after each action, so values must
  // live in state to survive a validation error / duplicate round-trip.
  const [v, setV] = useState<Values>(() => initialValues(client));
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={client.id} />}
      {/* Rendered only after a duplicate is flagged; the next submit carries this
          controlled value so the action proceeds. */}
      {state.duplicate && <input type="hidden" name="confirmDuplicate" value="true" />}

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input
              name="firstName"
              required
              value={v.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Last name">
            <input
              name="lastName"
              required
              value={v.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              value={v.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Mobile number">
            <input
              name="mobileNumber"
              value={v.mobileNumber}
              onChange={(e) => set("mobileNumber", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Date of birth">
            <input
              name="dateOfBirth"
              type="date"
              value={v.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Client type">
            <select
              name="clientType"
              value={v.clientType}
              onChange={(e) => set("clientType", e.target.value)}
              className={inputCls}
            >
              {CLIENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lead source">
            <input
              name="leadSource"
              value={v.leadSource}
              onChange={(e) => set("leadSource", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Preferred channel">
            <select
              name="preferredChannel"
              value={v.preferredChannel}
              onChange={(e) => set("preferredChannel", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <input
              name="status"
              value={v.status}
              onChange={(e) => set("status", e.target.value)}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2.5 pt-6">
            <input
              type="checkbox"
              name="vipStatus"
              checked={v.vipStatus}
              onChange={(e) => set("vipStatus", e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            <span className="text-[13px] font-medium">VIP client</span>
          </label>
          <Field label="Address" wide>
            <input
              name="address"
              value={v.address}
              onChange={(e) => set("address", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea
              name="notes"
              rows={3}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {state.error && (
          <p className="mt-4 rounded-lg border border-amber-border bg-amber-soft px-3 py-2 text-[12.5px] font-medium text-amber">
            {state.error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5">
        <Link
          href={isEdit ? `/clients/${client.id}` : "/clients"}
          className="inline-flex h-9 items-center rounded-md border border-border-strong bg-card px-3.5 text-[13px] font-semibold transition-colors hover:bg-hover"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-9 items-center rounded-md border px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
            state.duplicate
              ? "border-amber-border bg-amber-soft text-amber hover:opacity-90"
              : "border-transparent bg-brand text-on-brand hover:bg-brand-hover",
          )}
        >
          {pending
            ? "Saving…"
            : state.duplicate
              ? "Create anyway"
              : isEdit
                ? "Save changes"
                : "Create client"}
        </button>
      </div>
    </form>
  );
}
