"use client";

import { deleteClientAction } from "@/app/(app)/clients/actions";

export function DeleteClientButton({ id }: { id: string }) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(e) => {
        if (!confirm("Delete this client? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md border border-red-border bg-red-soft px-3.5 text-[13px] font-semibold text-red transition-colors hover:opacity-90"
      >
        Delete
      </button>
    </form>
  );
}
