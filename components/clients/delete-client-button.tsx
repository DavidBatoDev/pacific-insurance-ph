"use client";

import { useActionState } from "react";

import { deleteClientAction, type ClientFormState } from "@/app/(app)/clients/actions";

export function DeleteClientButton({ id }: { id: string }) {
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
        className="inline-flex h-9 items-center rounded-md border border-red-border bg-red-soft px-3.5 text-[13px] font-semibold text-red transition-colors hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error ? <p className="mt-1.5 text-[13px] text-red">{state.error}</p> : null}
    </form>
  );
}
