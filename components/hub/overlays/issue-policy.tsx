"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { issuePolicyAction, listProductOptionsAction, type ProductOption, type UploadedPolicyPdf } from "@/app/(app)/policies/actions";
import { PdfUpload } from "@/components/documents/pdf-upload";
import { I } from "../icons";
import { Btn, Field, INPUT } from "../primitives";
import { ClientPicker, type PickedClient } from "./client-picker";
import { Drawer } from "./drawer";
import { Section } from "./wizard/steps-1";
import type { SectionState } from "./wizard/wizard-data";
import { useOverlays } from "./overlay-provider";

/** Prefill when the policy is logged from an application's workflow; the client is then locked. */
export interface PolicyFromApplication {
  applicationId: string;
  referenceNo: string | null;
  client: PickedClient;
  productVersionId: string | null;
  productName: string | null;
  planOptionId: string | null;
  premium: number | null;
  paymentMode: string | null;
}

const addOneYear = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year + 1, month - 1, day));
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
};

/**
 * Log policy copy form. One implementation, rendered by the standalone drawer and inline in the
 * application workflow's last step (prefilled from the application, which also converts the client).
 */
export function usePolicyCopyForm({ fromApplication, onSaved }: { fromApplication?: PolicyFromApplication; onSaved: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();

  const [client, setClient] = useState<PickedClient | null>(fromApplication?.client ?? null);
  // Seeded with the application's product so the select reads right before the options load.
  const [products, setProducts] = useState<ProductOption[]>(
    fromApplication?.productVersionId
      ? [{ productVersionId: fromApplication.productVersionId, productName: fromApplication.productName ?? "Application product", productCategory: null, planOptions: [] }]
      : [],
  );
  const [productVersionId, setProductVersionId] = useState(fromApplication?.productVersionId ?? "");
  const [planOptionId, setPlanOptionId] = useState(fromApplication?.planOptionId ?? "");
  const [policyNumber, setPolicyNumber] = useState("");
  const [premium, setPremium] = useState(fromApplication?.premium != null ? String(Math.round(fromApplication.premium)) : "");
  const [paymentMode, setPaymentMode] = useState(fromApplication?.paymentMode === "Semi-Annual" ? "Semi-Annual" : "Annual");
  const [effective, setEffective] = useState("");
  const [expiry, setExpiry] = useState("");
  // Uploaded to storage under the picked client; registered against the policy on save.
  const [pdf, setPdf] = useState<UploadedPolicyPdf | null>(null);

  useEffect(() => {
    listProductOptionsAction()
      .then((options) => {
        // The application may sit on a product version that has since been retired; keep it pickable.
        const pinned = fromApplication?.productVersionId;
        if (pinned && !options.some((option) => option.productVersionId === pinned)) {
          options = [...options, { productVersionId: pinned, productName: fromApplication?.productName ?? "Application product", productCategory: null, planOptions: [] }];
        }
        setProducts(options);
      })
      .catch(() => setProducts([]));
  }, [fromApplication?.productVersionId, fromApplication?.productName]);

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
      }, pdf, fromApplication ? { applicationId: fromApplication.applicationId } : undefined);
      if (res.ok) {
        overlays.toast(
          fromApplication ? `${client.name} is now a policyholder` : "Policy copy logged",
          `${res.data.policyNumber ?? res.data.referenceNo ?? "Policy"} — ${client.name} · ${res.data.productName ?? ""}${pdf ? " · PDF filed" : ""}.`,
        );
        router.refresh();
        onSaved();
      } else {
        overlays.toast("Couldn’t log the policy copy", res.error);
      }
    });
  };

  const submitLabel = pending ? "Saving…" : fromApplication ? "Log policy & convert" : "Log policy copy";

  // Grouped like the New Application wizard: each card's dot says whether it is complete.
  const missing = [...(client ? [] : ["client"]), ...(productVersionId ? [] : ["product"])];
  const recommended = [policyNumber.trim(), premium, effective, expiry].filter(Boolean).length;
  const clientState: SectionState = missing.length
    ? { status: "todo", label: `${missing.length} needed` }
    : { status: "done", label: "Complete" };
  const detailsState: SectionState = recommended === 4
    ? { status: "done", label: "Complete" }
    : { status: "todo", label: `${recommended} of 4 filled` };

  const fields = (
    <>
      <Section title="Client & product" state={clientState}>
        <Field label="Client" required>
          {fromApplication ? (
            <div className="flex h-9 items-center gap-2 rounded-md border border-border-soft bg-surface-2 px-3 text-[13px] font-semibold">
              <I.user size={14} className="text-subtle" /> {fromApplication.client.name}
              {fromApplication.referenceNo && <span className="font-normal text-muted-foreground">· {fromApplication.referenceNo}</span>}
            </div>
          ) : (
            <ClientPicker
              value={client}
              onPick={(picked) => { setClient(picked); setPdf(null); }}
              onClear={() => { setClient(null); setPdf(null); }}
            />
          )}
        </Field>
        <p className="mt-2 text-[12px] text-muted-foreground">
          {fromApplication
            ? "Logging this policy closes the application and makes the client a policyholder. Prefilled from the application — check it against Pacific Cross’s copy."
            : "Pacific Cross issues the policy to the client. Log the details of the agency’s copy and file its PDF."}
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
      </Section>

      <Section title="Policy details" state={detailsState}>
        <div className="grid grid-cols-2 gap-4">
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
            <input
              className={INPUT}
              type="date"
              value={effective}
              onChange={(e) => {
                const value = e.target.value;
                // Health policies run a year; prefill the expiry once, never over a typed one.
                if (value && !expiry && /^\d{4}-\d{2}-\d{2}$/.test(value)) setExpiry(addOneYear(value));
                setEffective(value);
              }}
            />
          </Field>
          <Field label="Expiry date">
            <input className={INPUT} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </Field>
        </div>

      </Section>

      <Section title="Policy copy" state={pdf ? { status: "done", label: "Attached" } : undefined}>
        <Field label="PDF file" hint="Optional — you can attach it later from the client's profile.">
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
      </Section>
    </>
  );

  return { fields, missing, canSave: !!canSave, pending, save, submitLabel };
}

/**
 * Log policy copy drawer (modals.md §4; TO-BE-UPDATE-PLAN.md H4a). Pacific Cross issues the policy
 * directly to the policyholder; the agency logs its details and files the copy PDF here.
 */
export function IssuePolicyDrawer({ onClose }: { onClose: () => void }) {
  const form = usePolicyCopyForm({ onSaved: onClose });
  return (
    <Drawer
      icon="shield"
      title="Log policy copy"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!form.canSave} onClick={form.save}>
            <I.shield size={15} /> {form.submitLabel}
          </Btn>
        </>
      }
    >
      {form.fields}
    </Drawer>
  );
}
