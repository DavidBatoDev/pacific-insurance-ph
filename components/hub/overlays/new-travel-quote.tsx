"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTravelQuoteAction } from "@/app/(app)/travel/actions";
import { I } from "../icons";
import { Btn, INPUT } from "../primitives";
import { ClientPicker, DrawerField, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/** New Travel Quote drawer (modals.md §7) — lighter per-trip workflow. */
export function NewTravelQuoteDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [destination, setDestination] = useState("");
  const [departure, setDeparture] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState("1");
  const [premium, setPremium] = useState("");

  const days =
    departure && returnDate
      ? Math.max(0, Math.round((new Date(returnDate).getTime() - new Date(departure).getTime()) / 86_400_000))
      : null;

  const canSave = client && destination.trim() && !pending;

  const save = () => {
    if (!client) return;
    startTransition(async () => {
      const res = await createTravelQuoteAction({
        clientId: client.id,
        destination: destination.trim(),
        departureDate: departure || undefined,
        returnDate: returnDate || undefined,
        travelerCount: Number(travelers) || 1,
        quotedPremium: premium ? Number(premium.replace(/[^0-9]/g, "")) : undefined,
      });
      if (res.ok) {
        overlays.toast("Travel quote created", `${res.data.referenceNo ?? "Quote"} — ${client.name} · ${destination}.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t create quote", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="plane"
      title="New travel quote"
      sub="Per-trip travel insurance — payment is collected before the policy is purchased"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.plane size={15} /> {pending ? "Creating…" : "Create quote"}
          </Btn>
        </>
      }
    >
      <DrawerField label="Traveler" required>
        <ClientPicker value={client} onPick={setClient} onClear={() => setClient(null)} />
      </DrawerField>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <DrawerField label="Destination" required>
          <input className={INPUT} value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Japan" />
        </DrawerField>
        <DrawerField label="Travelers">
          <input className={INPUT} type="number" min="1" value={travelers} onChange={(e) => setTravelers(e.target.value)} />
        </DrawerField>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <DrawerField label="Departure">
          <input className={INPUT} type="date" value={departure} onChange={(e) => setDeparture(e.target.value)} />
        </DrawerField>
        <DrawerField label="Return">
          <input className={INPUT} type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </DrawerField>
      </div>
      {days != null && (
        <div className="mt-1.5 text-[12px] text-muted-foreground">
          Travel days: <b>{days}</b> (auto-calculated)
        </div>
      )}

      <DrawerField label="Quoted premium (₱)" className="mt-4">
        <input className={INPUT} inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
      </DrawerField>

      <div className="mt-4 flex gap-2.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <I.plane size={15} className="mt-0.5 shrink-0" />
        <div>
          Creates a TRV- request at <b>Awaiting Payment</b>. Send the payment instruction from the
          contact&apos;s composer; the policy is purchased in the portal after payment is verified.
        </div>
      </div>
    </Drawer>
  );
}
