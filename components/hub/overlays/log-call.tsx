"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { getDiscoveryValuesAction, logCallAction } from "@/app/(app)/clients/engage-actions";
import type { LeadAdvanceSuggestion } from "@/lib/communications/outbound-email.types";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import type { DiscoveryValues } from "../lead-config";
import { AREA, Btn, Field, INPUT } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { CoverageTierSelect } from "./coverage-tier-select";
import { Modal } from "./modal";
import { useOverlays } from "./overlay-provider";
import { isSelectProduct, SELECT_VARIANTS, selectLimitBasis, selectVariantFromInterest, type SelectVariant } from "@/lib/products/select-variant";

/**
 * The one `Log Call` form (../docs/web/lead-workflow.md §4: "There is one `Log Call`, not three").
 *
 * It is a structured discovery capture, not a diary entry and not part of the templated Engage
 * composer — no recipient, no template, no email body. Reached calls capture every answer checked
 * by `discoveryGaps()`, including the conditional Select variant, before qualification or Proposal.
 * Anywhere a call can be logged must offer these fields; a form that omits them is a
 * dead end that can never complete discovery.
 *
 * Two containers, one form: the Contact Profile composer tab renders {@link LogCallForm} inline,
 * everywhere else opens {@link LogCallModal}.
 */


const OUTCOMES = ["Reached", "No answer", "Voicemail", "Wrong number"];

/** Who the call was with, plus whatever discovery is already on file to prefill. */
export interface LogCallTarget extends DiscoveryValues {
  clientId: string;
  name: string;
}

function LogCallFields({
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
  const [interest, setInterest] = useState(isSelectProduct(target.productInterest) ? "Select" : target.productInterest ?? "");
  const [variant, setVariant] = useState<SelectVariant | "">(target.selectVariant ?? selectVariantFromInterest(target.productInterest) ?? "");
  const [interestEdited, setInterestEdited] = useState(false);
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
              productInterest: interest || (interestEdited ? null : undefined),
              selectVariant: interest || interestEdited ? (isSelectProduct(interest) ? variant || null : null) : undefined,
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
      <Field label="Outcome" required>
        <select className={INPUT} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOMES.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Field>

      {reached && (
        <>
          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
            <Field label="Budget / est. premium">
              <input className={INPUT} type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="₱ annual premium" />
            </Field>
            <Field label="Family size / dependents">
              <input className={INPUT} type="number" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="# people to cover" />
            </Field>
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-3.5">
            <Field label="Product interest">
              <input className={INPUT} value={interest} onChange={(e) => { setInterest(e.target.value); setInterestEdited(true); if (!isSelectProduct(e.target.value)) setVariant(""); }} placeholder="e.g. Blue Royale" />
            </Field>
            <Field label="Coverage tier / room">
              <CoverageTierSelect className={INPUT} value={tier} onChange={setTier} productInterest={interest} />
            </Field>
          </div>
          {isSelectProduct(interest) && <Field label="Select variant" required className="mt-3.5">
            <select className={INPUT} value={variant} onChange={(e) => setVariant(e.target.value as SelectVariant | "")}>
              <option value="">Choose Plus or Standard…</option>
              {SELECT_VARIANTS.map((value) => <option key={value}>{value}</option>)}
            </select>
            <p className="mt-1 text-[12px] text-muted-foreground">{variant ? selectLimitBasis(variant) : "Required before qualification; an incomplete call can still be saved."}</p>
          </Field>}
        </>
      )}

      <Field label="Call notes" className="mt-3.5">
        <textarea
          className={cn(AREA, "min-h-[120px]")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={reached ? "Anything the fields above don’t capture…" : "What happened on the attempt…"}
        />
      </Field>
      <Field label="Next follow-up" className="mt-3.5">
        <input className={INPUT} type="date" value={follow} onChange={(e) => setFollow(e.target.value)} />
      </Field>

      <div className="mt-3.5 flex items-center justify-end gap-3">
        <Btn variant="primary" disabled={pending} onClick={submit}>
          <I.phone size={15} /> Log call
        </Btn>
      </div>
    </>
  );
}

/** Pickers and communication suggestions have an ID, not a discovery snapshot. */
export function LogCallForm(props: Parameters<typeof LogCallFields>[0]) {
  const [loaded, setLoaded] = useState<{ clientId: string; values?: DiscoveryValues; error?: string } | null>(null);
  const needsLoad = props.target.productInterest === undefined;
  useEffect(() => {
    if (!needsLoad) return;
    let cancelled = false;
    getDiscoveryValuesAction(props.target.clientId).then((result) => {
      if (!cancelled) setLoaded(result.ok
        ? { clientId: props.target.clientId, values: result.data }
        : { clientId: props.target.clientId, error: result.error });
    }).catch(() => { if (!cancelled) setLoaded({ clientId: props.target.clientId, error: "Could not load discovery details. Reopen this call form." }); });
    return () => { cancelled = true; };
  }, [needsLoad, props.target.clientId]);
  if (needsLoad && loaded?.clientId !== props.target.clientId) return <p className="text-[12px] text-muted-foreground">Loading discovery details…</p>;
  if (needsLoad && loaded?.error) return <p role="alert" className="text-[12px] text-amber">{loaded.error}</p>;
  return <LogCallFields key={props.target.clientId} {...props} target={{ ...props.target, ...(needsLoad ? loaded?.values : {}) }} />;
}

/**
 * The same form as a standalone overlay, for every entry point that isn't the Contact Profile
 * composer. Without a `target` it resolves the contact first — the Lead Lifecycle quick-action row
 * fires with nobody selected.
 */
export function LogCallModal({ target, onClose }: { target?: LogCallTarget; onClose: () => void }) {
  const overlays = useOverlays();
  const [picked, setPicked] = useState<PickedClient | null>(null);
  // ID-only picker results are hydrated by LogCallForm before discovery can be saved.
  const resolved: LogCallTarget | null = target ?? (picked ? { clientId: picked.id, name: picked.name } : null);

  return (
    <Modal onClose={onClose} maxWidth={480}>
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-[10px] bg-brand-soft text-brand-hover">
          <I.phone size={20} />
        </div>
        <h3 className="text-[16px] font-bold tracking-[-0.01em]">Log call</h3>
      </div>

      {!target && (
        <Field label="Contact" required className="mb-3.5">
          <ClientPicker value={picked} onPick={setPicked} onClear={() => setPicked(null)} />
        </Field>
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
