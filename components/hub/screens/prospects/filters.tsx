"use client";

import { Popover } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { LEAD_STATUSES, PRODUCT_COLORS, STATUS_TONE } from "../../lead-config";

export function LeadFilters({
  statuses,
  products,
  overdueOnly,
  productOptions,
  onToggleStatus,
  onToggleProduct,
  onToggleOverdue,
  onClear,
}: {
  statuses: string[];
  products: string[];
  overdueOnly: boolean;
  productOptions: string[];
  onToggleStatus: (status: string) => void;
  onToggleProduct: (product: string) => void;
  onToggleOverdue: () => void;
  onClear: () => void;
}) {
  const activeCount = Number(statuses.length > 0) + Number(products.length > 0) + Number(overdueOnly);
  const optionClass =
    "flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-hover focus-within:bg-hover";

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={activeCount ? `Filter leads, ${activeCount} active` : "Filter leads"}
        title="Filter leads"
        className={cn(
          "relative grid size-[34px] shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/20",
          activeCount
            ? "border-brand bg-brand-soft text-brand-hover"
            : "border-border bg-card text-muted-foreground hover:bg-hover hover:text-foreground",
        )}
      >
        <I.filter size={15} />
        {activeCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid size-[17px] place-items-center rounded-full bg-brand text-[10px] font-bold text-white ring-2 ring-background">
            {activeCount}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Popover.Popup className="w-[320px] max-w-[calc(100vw-24px)] rounded-lg border border-border bg-card shadow-pop outline-none">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
              <Popover.Title className="text-[13.5px] font-bold">Filter leads</Popover.Title>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[12px] font-semibold text-brand-hover hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-[min(520px,calc(100vh-120px))] overflow-y-auto p-3">
              <fieldset>
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Status
                </legend>
                <div className="grid grid-cols-2 gap-0.5">
                  {LEAD_STATUSES.map((status) => (
                    <label key={status} className={optionClass}>
                      <input
                        type="checkbox"
                        checked={statuses.includes(status)}
                        onChange={() => onToggleStatus(status)}
                        className="size-3.5 rounded border-border-strong accent-brand"
                      />
                      <span className="size-2 rounded-full" style={{ background: `var(--${STATUS_TONE[status]})` }} />
                      {status}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-3 border-t border-border-soft pt-3">
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Product interest
                </legend>
                {productOptions.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0.5">
                    {productOptions.map((product) => (
                      <label key={product} className={optionClass}>
                        <input
                          type="checkbox"
                          checked={products.includes(product)}
                          onChange={() => onToggleProduct(product)}
                          className="size-3.5 rounded border-border-strong accent-brand"
                        />
                        <span
                          className="size-2 rounded-full"
                          style={{ background: PRODUCT_COLORS[product] ?? "var(--slate)" }}
                        />
                        <span className="truncate">{product}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-1 text-[12px] text-subtle">No product interests recorded.</p>
                )}
              </fieldset>

              <fieldset className="mt-3 border-t border-border-soft pt-3">
                <legend className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                  Follow-up date
                </legend>
                <label className={optionClass}>
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={onToggleOverdue}
                    className="size-3.5 rounded border-border-strong accent-brand"
                  />
                  <I.clock size={14} className="text-red" />
                  Overdue only
                </label>
              </fieldset>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
