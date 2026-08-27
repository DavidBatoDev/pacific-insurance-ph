"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { issuePolicyAction, listProductOptionsAction, type ProductOption } from "@/app/(app)/policies/actions";
import { I } from "../icons";
import { Btn, INPUT } from "../primitives";
import { ClientPicker, DrawerField, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/** Issue Policy drawer (modals.md §4) — manually encode/activate a policy. */
export function IssuePolicyDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productVersionId, setProductVersionId] = useState("");
  const [planOptionId, setPlanOptionId] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [premium, setPremium] = useState("");
  const [paymentMode, setPaymentMode] = useState("Annual");
  const [effective, setEffective] = useState("");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    listProductOptionsAction().then(setProducts).catch(() => setProducts([]));
  }, []);

  const plans = products.find((p) => p.productVersionId === productVersionId)?.planOptions ?? [];
  const canSave = client && productVersionId && !pending;

  const save = () => {
    if (!client) return;
    startTransition(async () => {
      const res = await issuePolicyAction({
        clientId: client.id,
        productVersionId,
        planOptionId: planOptionId || undefined,
        policyNumber: policyNumber.trim() || undefined,
        premiumAmount: premium ? Number(premium.replace(/[^0-9]/g, "")) : undefined,
        paymentMode,
        effectiveDate: effective || undefined,
        expiryDate: expiry || undefined,
        status: "Active",
      });
      if (res.ok) {
        overlays.toast("Policy issued", `${res.data.referenceNo ?? "Policy"} — ${client.name} · ${res.data.productName ?? ""}.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t issue policy", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="shield"
      title="Issue policy"
      sub="Manually encode a policy or activate an approved application"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.shield size={15} /> {pending ? "Issuing…" : "Issue policy"}
          </Btn>
        </>
      }
    >
      <DrawerField label="Client" required>
        <ClientPicker value={client} onPick={setClient} onClear={() => setClient(null)} />
      </DrawerField>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <DrawerField label="Product" required>
          <select
            className={INPUT}
            value={productVersionId}
            onChange={(e) => {
              setProductVersionId(e.target.value);
              setPlanOptionId("");
            }}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => (
              <option key={p.productVersionId} value={p.productVersionId}>
                {p.productName}
              </option>
            ))}
          </select>
        </DrawerField>
        <DrawerField label="Plan option">
          <select
            className={INPUT}
            value={planOptionId}
            onChange={(e) => setPlanOptionId(e.target.value)}
            disabled={!plans.length}
          >
            <option value="">Select…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </DrawerField>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <DrawerField label="Pacific Cross policy no." hint="Distinct from the POL- reference">
          <input className={INPUT} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="PC-000000" />
        </DrawerField>
        <DrawerField label="Premium (₱)">
          <input className={INPUT} inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
        </DrawerField>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <DrawerField label="Payment mode">
          <select className={INPUT} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            <option>Annual</option>
            <option>Semi-Annual</option>
          </select>
        </DrawerField>
        <DrawerField label="Effective date">
          <input className={INPUT} type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
        </DrawerField>
        <DrawerField label="Expiry date">
          <input className={INPUT} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </DrawerField>
      </div>

      <div className="mt-4 flex gap-2.5 rounded-md border border-border-soft bg-surface-2 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <I.shield size={15} className="mt-0.5 shrink-0" />
        <div>
          Creates an <b>Active</b> policy with a POL- reference number and logs{" "}
          <b>Policy issued</b> to the client&apos;s timeline.
        </div>
      </div>
    </Drawer>
  );
}
