"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { issuePolicyAction, listProductOptionsAction, type ProductOption, type UploadedPolicyPdf } from "@/app/(app)/policies/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/**
 * Log policy copy drawer (modals.md §4; TO-BE-UPDATE-PLAN.md H4a). Pacific Cross issues the policy
 * directly to the policyholder; the agency logs its details and files the copy PDF here.
 */
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
  // Uploaded to storage under the picked client; registered against the policy on save.
  const [pdf, setPdf] = useState<UploadedPolicyPdf | null>(null);

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
      }, pdf);
      if (res.ok) {
        overlays.toast("Policy copy logged", `${res.data.policyNumber ?? res.data.referenceNo ?? "Policy"} — ${client.name} · ${res.data.productName ?? ""}${pdf ? " · PDF filed" : ""}.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t log the policy copy", res.error);
      }
    });
  };

  return (
    <Drawer
      icon="shield"
      title="Log policy copy"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!canSave} onClick={save}>
            <I.shield size={15} /> {pending ? "Saving…" : "Log policy copy"}
          </Btn>
        </>
      }
    >
      <Field label="Client" required>
        <ClientPicker
          value={client}
          onPick={(picked) => { setClient(picked); setPdf(null); }}
          onClear={() => { setClient(null); setPdf(null); }}
        />
      </Field>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Pacific Cross issues the policy to the client. Log the details of the agency&apos;s copy and file its PDF.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Product" required>
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
        </Field>
        <Field label="Plan option">
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
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Pacific Cross policy no." hint="Distinct from the POL- reference">
          <input className={INPUT} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="PC-000000" />
        </Field>
        <Field label="Premium (₱)">
          <input className={INPUT} inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0" />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Payment mode">
          <select className={INPUT} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            <option>Annual</option>
            <option>Semi-Annual</option>
          </select>
        </Field>
        <Field label="Effective date">
          <input className={INPUT} type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
        </Field>
        <Field label="Expiry date">
          <input className={INPUT} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
      </div>

      <Field label="Policy copy (PDF)" className="mt-4" hint="Optional — you can attach it later from the client's profile.">
        {!client ? (
          <div className="rounded-md border border-dashed border-border-strong px-3.5 py-3 text-[12.5px] text-subtle">Pick a client first.</div>
        ) : pdf ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-green-border bg-green-soft/50 px-3.5 py-2.5 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2"><I.check size={14} className="shrink-0 text-green" /><span className="truncate">{pdf.fileName}</span></span>
            <button type="button" className="text-[12px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => setPdf(null)}>Replace</button>
          </div>
        ) : (
          <PdfUpload
            clientId={client.id}
            prompt="Drop the policy PDF here, or click to choose. Remove the carrier password first."
            disabled={pending}
            onUploaded={async (path, fileName) => { setPdf({ path, fileName }); return { ok: true, data: null }; }}
          />
        )}
      </Field>
    </Drawer>
  );
}
