"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { saveCommissionRateAction } from "@/app/(app)/settings/actions";
import { Modal } from "@/components/hub/overlays/modal";
import { useOverlays } from "@/components/hub/overlays/overlay-provider";
import { INPUT } from "@/components/hub/primitives";
import { fmtDate } from "@/lib/format";
import type { CommissionRate } from "@/lib/repositories/commission-rates/commission-rate.entity";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Rows grouped per product x business type, newest first (rows[0] = current). */
interface RateGroup {
  key: string;
  current: CommissionRate;
  history: CommissionRate[];
}

function RateValue({ rate }: { rate: CommissionRate }) {
  return rate.ratePct == null ? (
    <span className="font-semibold text-amber">Pending</span>
  ) : (
    <span className="font-mono font-semibold tabular-nums">{rate.ratePct}%</span>
  );
}

export function CommissionRatesTab({ rates, canEdit }: { rates: CommissionRate[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<CommissionRate | null>(null);
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});

  const groups = useMemo<RateGroup[]>(() => {
    const today = todayIso();
    const map = new Map<string, CommissionRate[]>();
    for (const r of rates) {
      const key = `${r.productId}|${r.businessType}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
      // Current = latest row already in effect; future-dated rows count as history-ahead.
      const current = sorted.find((r) => r.effectiveDate <= today) ?? sorted[sorted.length - 1];
      return { key, current, history: sorted.filter((r) => r.id !== current.id) };
    });
  }, [rates]);

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-[15px] font-bold">Commission rates</h3>
        <p className="mt-0.5 max-w-[620px] text-[12.5px] text-muted-foreground">
          Estimates use these rates on the premium. VAT and withholding tax are not applied yet (H9b).
        </p>
        {!canEdit && (
          <p className="mt-1 text-[12px] text-faint">Only admins can change commission rates.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border-soft">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-surface-2 text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Business</th>
              <th className="px-4 py-2.5">Rate</th>
              <th className="px-4 py-2.5">Effective</th>
              <th className="px-4 py-2.5">Notes</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows
                key={g.key}
                group={g}
                canEdit={canEdit}
                open={!!openHistory[g.key]}
                onToggle={() => setOpenHistory((s) => ({ ...s, [g.key]: !s[g.key] }))}
                onEdit={setEditing}
              />
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-subtle">
                  No commission rates configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <RateModal rate={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GroupRows({
  group,
  canEdit,
  open,
  onToggle,
  onEdit,
}: {
  group: RateGroup;
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
  onEdit: (r: CommissionRate) => void;
}) {
  const { current, history } = group;
  return (
    <>
      <tr className="border-t border-border-soft">
        <td className="px-4 py-2.5 font-[650]">{current.productName}</td>
        <td className="px-4 py-2.5 text-muted-foreground">{current.businessType}</td>
        <td className="px-4 py-2.5">
          <RateValue rate={current} />
        </td>
        <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(current.effectiveDate)}</td>
        <td className="max-w-[260px] truncate px-4 py-2.5 text-muted-foreground">{current.notes ?? "—"}</td>
        <td className="whitespace-nowrap px-4 py-2.5 text-right">
          {history.length > 0 && (
            <button onClick={onToggle} className="mr-3 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
              {open ? "Hide history" : `History (${history.length})`}
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(current)} className="text-[12px] font-semibold text-brand-hover hover:text-brand">
              Edit
            </button>
          )}
        </td>
      </tr>
      {open &&
        history.map((r) => (
          <tr key={r.id} className="bg-surface-2/60 text-[12.5px]">
            <td className="px-4 py-1.5 pl-8 text-subtle" colSpan={2}>
              Earlier rate
            </td>
            <td className="px-4 py-1.5">
              <RateValue rate={r} />
            </td>
            <td className="px-4 py-1.5 text-muted-foreground">{fmtDate(r.effectiveDate)}</td>
            <td className="max-w-[260px] truncate px-4 py-1.5 text-muted-foreground" colSpan={2}>
              {r.notes ?? "—"}
            </td>
          </tr>
        ))}
    </>
  );
}

function RateModal({ rate, onClose }: { rate: CommissionRate; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [ratePct, setRatePct] = useState(rate.ratePct == null ? "" : String(rate.ratePct));
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [notes, setNotes] = useState(rate.notes ?? "");

  const parsed = ratePct.trim() === "" ? null : Number(ratePct);
  const invalid = parsed != null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100);
  const sameDate = effectiveDate === rate.effectiveDate;

  const save = () =>
    startTransition(async () => {
      const res = await saveCommissionRateAction(rate.id, {
        productId: rate.productId,
        businessType: rate.businessType,
        ratePct: parsed,
        effectiveDate,
        notes,
      });
      if (res.ok) {
        overlays.toast("Commission rate saved", `${res.data.productName} · ${res.data.businessType}.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t save commission rate", res.error);
      }
    });

  const field = "mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle";
  return (
    <Modal onClose={onClose} maxWidth={440}>
      <h3 className="mb-1 text-[16px] font-bold tracking-[-0.01em]">Edit commission rate</h3>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        {rate.productName} · {rate.businessType} business
      </p>
      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label className={field}>Rate (% of premium)</label>
          <input
            autoFocus
            type="number"
            min={0}
            max={100}
            step="0.01"
            className={INPUT}
            value={ratePct}
            onChange={(e) => setRatePct(e.target.value)}
            placeholder="Blank = pending"
          />
        </div>
        <div>
          <label className={field}>Effective date</label>
          <input type="date" className={INPUT} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-3.5">
        <label className={field}>Notes</label>
        <input className={INPUT} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Per Pacific Cross schedule" />
      </div>
      <p className="mt-3 text-[12px] text-faint">
        {sameDate
          ? "Same effective date: this row is updated in place."
          : "A new effective date adds a new row; the earlier rate stays in history."}
      </p>
      {invalid && <p className="mt-2 text-[12px] text-amber">Rate must be between 0 and 100.</p>}
      <div className="mt-5 flex justify-end gap-2.5">
        <button onClick={onClose} className="inline-flex h-9 items-center rounded-md border border-border-strong bg-card px-3.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-hover">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending || invalid || !effectiveDate}
          className="inline-flex h-9 items-center rounded-md border border-transparent bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
