"use client";

import { coverageTierGroupsFor } from "@/lib/coverage-tiers";

/**
 * Discovery coverage-tier picker shared by Log Call and the client form (H1a). Options are the
 * product's catalog tiers, narrowed to the product interest when it names one. A stored value
 * outside the list (captured before H1a) stays selectable so editing never silently blanks it.
 */
export function CoverageTierSelect({
  value,
  onChange,
  productInterest,
  name,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  productInterest: string | null | undefined;
  name?: string;
  className?: string;
}) {
  const groups = coverageTierGroupsFor(productInterest);
  const known = groups.some((group) => group.tiers.includes(value));
  return (
    <select name={name} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— not captured —</option>
      {groups.map((group) => (
        <optgroup key={group.product} label={group.note ? `${group.product} (${group.note})` : group.product}>
          {group.tiers.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </optgroup>
      ))}
      {value && !known && <option value={value}>{value} (old value)</option>}
    </select>
  );
}
