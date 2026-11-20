"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";

import { markRenewalRenewedAction } from "@/app/(app)/renewals/actions";
import { manilaTodayIso, renewedExpiryProblem, suggestedRenewedExpiry } from "@/lib/renewals/lifecycle";
import type { Renewal } from "@/lib/repositories/renewals";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function RenewalMarkRenewedModal({ renewal, onClose }: { renewal: Renewal; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [today] = useState(() => manilaTodayIso());
  // A straight annual renewal starts one year after the current expiry; staff change it when the
  // carrier's renewed term differs.
  const [date, setDate] = useState(() => suggestedRenewedExpiry(renewal, today));
  const [serverError, setServerError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const policyLabel = renewal.policyNumber ?? renewal.policyRef ?? "Policy";
  // An empty field is just "not filled yet": it disables Save without shouting.
  const problem = date ? renewedExpiryProblem(renewal, date, today) : null;
  const error = problem ?? serverError;
  const invalid = !!problem;

  // The dialog cannot be dismissed (Escape, backdrop or Cancel) while the request is in flight.
  const close = () => {
    if (!pending) onClose();
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (pending || !date || problem) return;
    startTransition(async () => {
      setServerError(null);
      try {
        const result = await markRenewalRenewedAction(renewal.id, renewal.updatedAt, date);
        if (!result.ok) {
          setServerError(result.error);
          overlays.toast("Couldn't complete renewal", result.error);
          return;
        }
        overlays.toast("Renewal completed", `${policyLabel} · new expiry ${fmtDate(date)}`);
        router.refresh();
        onClose();
      } catch {
        const message = "Couldn't save the renewal. Check your connection and try again.";
        setServerError(message);
        overlays.toast("Couldn't complete renewal", message);
      }
    });
  };

  return (
    <Modal onClose={close} maxWidth={460}>
      <form onSubmit={save} noValidate>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand">
            <I.refresh size={20} />
          </div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Mark renewed</h3>
        </div>
        <p className="mb-3 text-[13px] text-muted-foreground">
          {renewal.clientName ?? "Client"} · {policyLabel}
        </p>
        <dl className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-border-soft bg-surface-2 px-3 py-2.5 text-[13px]">
          <div>
            <dt className="text-[11.5px] font-semibold text-subtle">Current expiry</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{fmtDate(renewal.policyExpiryDate)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-semibold text-subtle">Renewal due</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{fmtDate(renewal.renewalDueDate)}</dd>
          </div>
        </dl>
        <Field label="New expiry date" required htmlFor={inputId}>
          <input
            id={inputId}
            className={INPUT}
            type="date"
            max="9999-12-31"
            required
            value={date}
            disabled={pending}
            aria-invalid={invalid}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setDate(e.target.value);
              setServerError(null);
            }}
          />
        </Field>
        {error && (
          <p id={errorId} role={serverError && !problem ? "alert" : undefined} className="mt-2 text-[13px] text-red">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <Btn type="button" onClick={close} disabled={pending}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={pending || !date || invalid}>
            {pending ? "Saving…" : "Mark renewed"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
