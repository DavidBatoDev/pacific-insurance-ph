"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useState } from "react";

import { I } from "../icons";

/**
 * One reason an action is blocked, phrased as something to act on. `target` is the DOM id of the
 * control (or section card) that resolves it, so the "Still needed" list can take the user there.
 */
export interface Blocker {
  label: string;
  target?: string;
}

// Editable controls only: a jump should land the caret where typing fixes the gap, not on a
// checkbox, a hidden file input or a read-only mirror field.
const EDITABLE =
  "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]):not([readonly])";
const ATTENTION_MS = 1800;
const attentionTimers = new WeakMap<HTMLElement, number>();

/**
 * Bring a blocker's target into view: centre it in its scroll container, focus it (or the first
 * visible editable control inside it) and flash the attention ring (`[data-attention]` in
 * globals.css). Returns false when the target is not rendered.
 */
export function revealField(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const control = el.matches(EDITABLE)
    ? el
    : Array.from(el.querySelectorAll<HTMLElement>(EDITABLE)).find((node) => node.getClientRects().length > 0);
  control?.focus({ preventScroll: true });
  el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });

  window.clearTimeout(attentionTimers.get(el));
  delete el.dataset.attention;
  void el.offsetWidth; // restart the animation when the same field is revealed twice in a row
  el.dataset.attention = "";
  attentionTimers.set(el, window.setTimeout(() => delete el.dataset.attention, ATTENTION_MS));
  return true;
}

/**
 * `revealField`, deferred until after the next commit — for a jump that first switches step, so
 * the target exists by the time it is looked up.
 */
export function useRevealAfterRender(): (target: string) => void {
  const [request, setRequest] = useState<{ target: string; seq: number } | null>(null);
  useEffect(() => {
    if (request) revealField(request.target);
  }, [request]);
  return useCallback((target: string) => setRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 })), []);
}

/**
 * Inline messages for blocked fields, keyed by `Blocker.target`. A form provides this once the user
 * has tried to proceed, so a fresh form is not covered in warnings.
 */
export const BlockerFlags = createContext<ReadonlyMap<string, string>>(new Map());

/** Reads `BlockerFlags`: the message for a target id, or undefined when it is not blocked. */
export function useBlockerFlag(): (target: string) => string | undefined {
  const flags = useContext(BlockerFlags);
  return (target) => flags.get(target);
}

/**
 * The full-width amber bar above a footer's buttons while its main action is blocked: it names
 * the greyed-out action and lists what unblocks it. A chip with a target (or any chip, when
 * `onJump` is given) is a button that takes the user to the field; the rest are plain labels.
 */
export function BlockedNotice<T extends Blocker>({ action, items, onJump, id }: { action: string; items: T[]; onJump?: (item: T) => void; id?: string }) {
  return (
    <div id={id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-amber-border bg-amber-soft px-5 py-2.5 text-[12.5px]">
      <I.alertTri size={15} aria-hidden className="shrink-0 text-amber" />
      <span className="font-semibold text-foreground">{action} stays greyed out until you add:</span>
      {items.map((item) => {
        const jump = onJump ? () => onJump(item) : item.target ? () => revealField(item.target!) : null;
        return (
          // The space keeps the bar's text content readable ("…add: Source"); flex ignores it.
          <Fragment key={item.label}>
            {" "}
            {jump ? (
              <button
                type="button"
                onClick={jump}
                aria-label={`Go to ${item.label}`}
                className="inline-flex h-6 items-center gap-1 rounded-full border border-amber-border bg-card pl-2.5 pr-2 text-[12px] font-semibold text-foreground transition-colors hover:border-amber focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-amber/30"
              >
                {item.label}
                <I.arrowRight size={12} aria-hidden className="text-amber" />
              </button>
            ) : (
              <span className="inline-flex h-6 items-center rounded-full border border-amber-border bg-card px-2.5 text-[12px] font-semibold text-foreground">
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
