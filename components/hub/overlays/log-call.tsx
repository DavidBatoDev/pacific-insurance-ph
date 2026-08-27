"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { logCallAction, type LeadAdvanceSuggestion } from "@/app/(app)/clients/engage-actions";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import type { DiscoveryValues } from "../lead-config";
import { Btn } from "../primitives";
import { ClientPicker, DrawerField, DRAWER_INPUT, type PickedClient } from "./client-picker";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";

/**
 * The one `Log Call` form (../docs/web/lead-workflow.md §4: "There is one `Log Call`, not three").
 *
 * It is a structured discovery capture, not a diary entry and not part of the templated Engage
 * composer — no recipient, no template, no email body. The four fields it collects on a `Reached`
 * outcome are exactly the four `discoveryGaps()` checks before a lead may go `Qualified` or move to
 * `Proposal`, so anywhere a call can be logged has to offer them; a call form that omits them is a
 * dead end that can never complete discovery.
 *
 * Two containers, one form: the Contact Profile composer tab renders {@link LogCallForm} inline,
 * everywhere else opens {@link LogCallModal}.
 */

const AREA =
  "w-full rounded-md border border-border-strong bg-card px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-brand";

const OUTCOMES = ["Reached", "No answer", "Voicemail", "Wrong number"];
export const TIERS = ["", "Standard / Ward", "Semi-private room", "Private room", "Suite / Executive"];

/** Who the call was with, plus whatever discovery is already on file to prefill. */
export interface LogCallTarget extends DiscoveryValues {
  clientId: string;
  name: string;
}

export function LogCallForm({
  target,
  initialOutcome = "Reached",
  onLogged,
}: {
  target: LogCallTarget;
  /** Preset so the discovery fields are already open when this is opened *as* a discovery call. */
  initialOutcome?: string;
  onLogged: (advance?: LeadAdvanceSuggestion) => void;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [outcome, setOutcome] = useState(initialOutcome);
  // Prefilled from the record so the form shows what is already on file rather than blanks
  // (logCallAction patches each field only when non-null, so re-sending them is harmless).
  const [budget, setBudget] = useState(target.estPremium != null ? String(target.estPremium) : "");
  const [family, setFamily] = useState(target.familySize != null ? String(target.familySize) : "");
  const [interest, setInterest] = useState(target.productInterest ?? "");
  const [tier, setTier] = useState(target.coverageTier ?? "");
  const [note, setNote] = useState("");
  const [follow, setFollow] = useState("");

  const reached = outcome === "Reached";

  const submit = () =>
    startTransition(async () => {
      const res = await logCallAction({
        clientId: target.clientId,
        outcome,
        notes: note || null,
        // Structured discovery — Reached calls only.
        discovery: reached
          ? {
              estPremium: budget ? Number(budget) : null,
              familySize: family ? Number(family) : null,
              productInterest: interest || null,
              coverageTier: tier || null,
            }
          : undefined,
        followUpDate: follow || null,
      });
      if (!res.ok) return overlays.toast("Couldn’t log call", res.error);
      overlays.toast(
        "Call logged",
        reached
          ? `Discovery details saved to ${target.name}’s record.`
          : `Call with ${target.name} saved to the timeline.`,
      );
      setNote("");
      setFollow("");
      router.refresh();
      onLogged(res.data.advance);
    });

  return (
    <>
      <DrawerField label="Outcome" required>
        <select className={DRAWER_INPUT} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOMES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </DrawerField>

      {reached && (
        <>
          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
            <DrawerField label="Budget / est. premium">
              <input className={DRAWER_INPUT} type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="₱ annual premium" />
            </DrawerField>
            <DrawerField label="Family size / dependents">
              <input className={DRAWER_INPUT} type="number" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="# people to cover" />
            </DrawerField>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
            <DrawerField label="Product interest">
              <input className={DRAWER_INPUT} value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. Blue Royale" />
            </DrawerField>
            <DrawerField label="Coverage tier / room">
              <select className={DRAWER_INPUT} value={tier} onChange={(e) => setTier(e.target.value)}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t || "— not captured —"}
                  </option>
                ))}
              </select>
            </DrawerField>
          </div>
        </>
      )}

      <DrawerField label="Call notes" className="mt-3.5">
        <textarea
          className={cn(AREA, "min-h-[120px]")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reached ? "Anything the fields above don’t capture…" : "What happened on the attempt…"}
        />
      </DrawerField>
      <DrawerField label="Next follow-up" className="mt-3.5">
        <input className={DRAWER_INPUT} type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
      </DrawerField>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        {reached ? (
          <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
            <I.check size={12} /> Structured discovery writes to the record — budget &amp; product
            interest carry into Convert to Application.
          </span>
        ) : (
          <span />
        )}
        <Btn variant="primary" disabled={pending} onClick={submit}>
          <I.phone size={15} /> Log call
        </Btn>
      </div>
    </>
  );
}

/**
 * The same form as a standalone overlay, for every entry point that isn't the Contact Profile
 * composer. Without a `target` it resolves the contact first — the Lead Lifecycle quick-action row
 * fires with nobody selected.
 */
export function LogCallModal({ target, onClose }: { target?: LogCallTarget; onClose: () => void }) {
  const overlays = useOverlays();
  const [picked, setPicked] = useState<PickedClient | null>(null);
  // A picked contact carries no discovery values, so those fields open blank. That is safe:
  // logCallAction only patches non-null fields, so a blank never clears what is already on file.
  const resolved: LogCallTarget | null = target ?? (picked ? { clientId: picked.id, name: picked.name } : null);

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.phone size={20} />
        </div>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em]">Log call</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {resolved
              ? `Outcome and discovery details for ${resolved.name}.`
              : "Pick the contact this call was with."}
          </p>
        </div>
      </div>

      {!target && (
        <DrawerField label="Contact" required className="mb-3.5">
          <ClientPicker value={picked} onPick={setPicked} onClear={() => setPicked(null)} />
        </DrawerField>
      )}

      {resolved && (
        <LogCallForm
          target={resolved}
          onLogged={(advance) => {
            onClose();
            // Logging a Reached call is what suggests Contacted → Discovery; hand straight over
            // rather than making the user find the Advance button afterwards.
            if (advance) overlays.openAdvanceLead(advance);
          }}
        />
      )}
    </Modal>
  );
}
