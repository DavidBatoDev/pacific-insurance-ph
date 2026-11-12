"use client";

import { useState, useTransition } from "react";

import { I } from "@/components/hub/icons";
import { cn } from "@/lib/utils";

import { setPasswordAction } from "./actions";
import { PASSWORD_MIN_LENGTH } from "./password-policy";

const INPUT = "w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm outline-none focus:border-brand";

/**
 * Password chooser with the rules shown and checked on the page as the user types. Native
 * browser validation is off (`noValidate`) so the only feedback is ours; the server action
 * re-checks the same rules and reports anything else through `serverError`.
 */
export function SetPasswordForm({ submitLabel, serverError }: { submitLabel: string; serverError: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const matches = confirm.length > 0 && confirm === password;
  const showMismatch = touchedConfirm && confirm.length > 0 && confirm !== password;
  const ready = longEnough && matches && !pending;

  const Eye = show ? I.eyeOff : I.eye;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => setPasswordAction(data));
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">New password</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            className={INPUT}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            onClick={() => setShow((value) => !value)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Eye size={16} />
          </button>
        </div>
        <ul className="space-y-1 text-xs" aria-live="polite">
          <Rule met={longEnough} active={password.length > 0}>
            At least {PASSWORD_MIN_LENGTH} characters{password.length > 0 && !longEnough ? ` (${PASSWORD_MIN_LENGTH - password.length} more to go)` : ""}
          </Rule>
          <Rule met={matches} active={touchedConfirm && confirm.length > 0}>Both passwords match</Rule>
        </ul>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
        <input
          id="confirm"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={cn(INPUT, "pr-3", showMismatch && "border-red focus:border-red")}
          aria-invalid={showMismatch || undefined}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          onBlur={() => setTouchedConfirm(true)}
        />
        {showMismatch && <p className="text-red text-xs">These don’t match yet.</p>}
      </div>

      {serverError ? <p className="text-red text-sm">{serverError}</p> : null}

      <button
        type="submit"
        disabled={!ready}
        className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Rule({ met, active, children }: { met: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", met ? "text-green" : active ? "text-red" : "text-muted-foreground")}>
      {met ? <I.check size={13} className="shrink-0" /> : active ? <I.x size={13} className="shrink-0" /> : <span aria-hidden className="mx-[5px] size-[5px] shrink-0 rounded-full bg-current opacity-60" />}
      <span>{children}</span>
    </li>
  );
}
