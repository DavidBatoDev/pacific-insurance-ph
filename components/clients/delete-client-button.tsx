"use client";

import { useActionState } from "react";

import { deleteClientAction, type ClientFormState } from "@/app/(app)/clients/actions";

const DEFAULT_CLASS =
  "inline-flex h-9 items-center rounded-md border border-red-border bg-red-soft px-3.5 text-[13px] font-semibold text-red transition-colors hover:opacity-90 disabled:opacity-60";

/** `className` lets callers render this as a menu row; the confirm + error handling stay put. */
export function DeleteClientButton({ id, className }: { id: string; className?: string }) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(
    deleteClientAction,
    {},
  );

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this client? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={className ?? DEFAULT_CLASS}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error ? <p className="px-3.5 py-1.5 text-[12px] leading-snug text-red">{state.error}</p> : null}
    </form>
  );
}
