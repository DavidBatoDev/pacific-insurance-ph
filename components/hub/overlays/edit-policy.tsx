"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { listProductOptionsAction, updatePolicyAction, type ProductOption } from "@/app/(app)/policies/actions";
import type { Policy } from "@/lib/repositories/policies";
import { isSelectProduct, isSelectVariant, plansForSelectVariant, planLimitDescription, SELECT_VARIANTS, selectLimitBasis, type SelectVariant } from "@/lib/products/select-variant";
import { I } from "../icons";
import { AREA, Btn, Field, INPUT } from "../primitives";
import { Drawer } from "./drawer";
import { useOverlays } from "./overlay-provider";

/** `policies.status` CHECK (0005_operations.sql). */
const POLICY_STATUSES = ["Pending", "Active", "Expired", "Renewed", "Cancelled", "Lapsed"];

/**
 * Edit a logged policy from the contact profile (TO-BE-UPDATE-PLAN.md H1c) — chiefly to correct
 * the carrier policy number and product/plan as staging surfaces mistakes. The product picker
 * only lists Active catalog versions, so the policy's current product/plan is kept as an extra
 * "(current)" option when it isn't in that list; saving never silently drops it.
 */
export function EditPolicyDrawer({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [policyNumber, setPolicyNumber] = useState(policy.policyNumber ?? "");
  const [productVersionId, setProductVersionId] = useState(policy.productVersionId ?? "");
  const [planOptionId, setPlanOptionId] = useState(policy.planOptionId ?? "");
  const [selectVariant, setSelectVariant] = useState<SelectVariant | "">(isSelectVariant(policy.planFamily) ? policy.planFamily : "");
  const [paymentMode, setPaymentMode] = useState(policy.paymentMode ?? "");
  const [premium, setPremium] = useState(policy.premiumAmount != null ? String(policy.premiumAmount) : "");
  const [effective, setEffective] = useState(policy.effectiveDate ?? "");
  const [expiry, setExpiry] = useState(policy.expiryDate ?? "");
  const [renewal, setRenewal] = useState(policy.renewalDate ?? "");
  const [status, setStatus] = useState(policy.status);
  const [notes, setNotes] = useState(policy.notes ?? "");

  useEffect(() => {
    listProductOptionsAction().then(setProducts).catch(() => setProducts([]));
  }, []);

  const product = products.find((p) => p.productVersionId === productVersionId);
  const productName = product?.productName ?? (productVersionId === policy.productVersionId ? policy.productName : null);
  const plans = plansForSelectVariant(product?.planOptions ?? [], productName, selectVariant);
  const selectedPlan = plans.find((plan) => plan.id === planOptionId);
  const select = isSelectProduct(productName);
  const currentProductMissing =
    !!policy.productVersionId && productVersionId === policy.productVersionId && !product;
  const currentPlanMissing =
    !!policy.planOptionId && planOptionId === policy.planOptionId && !plans.some((p) => p.id === planOptionId);

  const save = () =>
    startTransition(async () => {
      const res = await updatePolicyAction(policy.id, {
        policyNumber: policyNumber.trim() || null,
        productVersionId: productVersionId || null,
        planOptionId: planOptionId || null,
        selectVariant: selectVariant || null,
        paymentMode: paymentMode || null,
        premiumAmount: premium ? Number(premium.replace(/[^0-9.]/g, "")) : null,
        effectiveDate: effective || null,
        expiryDate: expiry || null,
        renewalDate: renewal || null,
        status,
        notes: notes.trim() || null,
      });
      if (!res.ok) return overlays.toast("Couldn’t update the policy", res.error);
      overlays.toast("Policy updated", `${res.data.policyNumber ?? res.data.referenceNo ?? "Policy"} saved.`);
      router.refresh();
      onClose();
    });

  return (
    <Drawer
      icon="shield"
      title="Edit policy"
      sub={policy.referenceNo ?? undefined}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={pending} onClick={save}>
            <I.check size={15} /> {pending ? "Saving…" : "Save changes"}
          </Btn>
        </>
      }
    >
      <Field label="Pacific Cross policy no." hint="Distinct from the POL- reference">
        <input className={INPUT} value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="PC-000000" />
      </Field>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Product">
          <select
            className={INPUT}
            value={productVersionId}
            onChange={(e) => {
              setProductVersionId(e.target.value);
              setPlanOptionId("");
              setSelectVariant("");
            }}
          >
            <option value="">Choose a product…</option>
            {currentProductMissing && <option value={policy.productVersionId!}>{policy.productName ?? "Current product"} (current)</option>}
            {products.map((p) => (
              <option key={p.productVersionId} value={p.productVersionId}>
                {p.productName}
              </option>
            ))}
          </select>
        </Field>
        {select && <Field label="Select variant" required>
          <select className={INPUT} value={selectVariant} onChange={(e) => {
            const variant = e.target.value as SelectVariant | "";
            setSelectVariant(variant);
            if (!product?.planOptions.some((plan) => plan.id === planOptionId && plan.planFamily === variant)) setPlanOptionId("");
          }}>
            <option value="">Not recorded / choose a variant…</option>
            {SELECT_VARIANTS.map((variant) => <option key={variant}>{variant}</option>)}
          </select>
          <p className="mt-1 text-[12px] text-muted-foreground">{selectVariant ? selectLimitBasis(selectVariant) : "Not recorded. An unrelated edit preserves the unresolved historical selection."}</p>
        </Field>}
        <Field label="Plan option">
          <select className={INPUT} value={planOptionId} onChange={(e) => setPlanOptionId(e.target.value)}>
            <option value="">{productVersionId === (policy.productVersionId ?? "") && !policy.planOptionId ? "Not recorded (current / unresolved)" : "Select…"}</option>
            {currentPlanMissing && <option value={policy.planOptionId!}>{policy.planName ?? "Not recorded"} (current / unresolved)</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-muted-foreground">{planLimitDescription(selectedPlan ?? (planOptionId === policy.planOptionId && productVersionId === policy.productVersionId ? policy : null))}</p>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Payment mode">
          <select className={INPUT} value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            <option value="">—</option>
            <option>Annual</option>
            <option>Semi-Annual</option>
            {paymentMode && !["Annual", "Semi-Annual"].includes(paymentMode) && <option>{paymentMode}</option>}
          </select>
        </Field>
        <Field label={`Premium (${policy.currency ?? "PHP"})`}>
          <input className={INPUT} inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9.,]/g, ""))} placeholder="0" />
        </Field>
        <Field label="Status">
          <select className={INPUT} value={status} onChange={(e) => setStatus(e.target.value)}>
            {[...new Set([status, ...POLICY_STATUSES])].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Field label="Effective date">
          <input className={INPUT} type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
        </Field>
        <Field label="Expiry date">
          <input className={INPUT} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>
        <Field label="Renewal date">
          <input className={INPUT} type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
        </Field>
      </div>

      <Field label="Notes" className="mt-4">
        <textarea className={AREA} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Drawer>
  );
}
