"use client";

import { RequirementAttachmentPicker } from "@/components/documents/requirement-attachment-picker";
import type { RequirementAttachmentSelection } from "@/lib/documents/requirement-attachment.types";
import { Section } from "./steps-1";
import type { WizardForm } from "./wizard-data";
import { travelWizardRequirements } from "./wizard-requirements";

/** Memory-only choices. A selection is not a receipt, nor a saved draft attachment. */
export function TravelRequirementUploads({
  f, clientId, selections, onSelect, disabled,
}: {
  f: WizardForm;
  clientId?: string;
  selections: Record<string, RequirementAttachmentSelection>;
  onSelect: (key: string, selection: RequirementAttachmentSelection | null) => void;
  disabled?: boolean;
}) {
  const rows = travelWizardRequirements(f);
  const selected = rows.filter((row) => selections[row.key]).length;
  return (
    <Section title="Requirements" state={{ status: selected === rows.length ? "done" : "todo", label: `${selected} of ${rows.length} selected` }}>
      <p className="mb-2 text-[12px] text-muted-foreground">
        Choose a device file or an email attachment for each requirement. Choices attach only after the request is created;
        they are not saved with a draft. Payment proof and the issued policy may also be added later in the Travel workflow.
      </p>
      <ul className="divide-y divide-border-soft">
        {rows.map((row) => {
          const label = `${row.documentName}${row.appliesTo ? ` — ${row.appliesTo}` : ""}`;
          return (
            <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 first:pt-1 last:pb-0">
              <div className="min-w-[180px] flex-1">
                <div className="text-[13px] font-semibold">{label}</div>
                <div className="text-[11.5px] text-muted-foreground">{row.isRequired === false ? "After issuance · not required yet" : "Pending until attached after creation"}</div>
              </div>
              <RequirementAttachmentPicker
                clientId={clientId}
                label={label}
                value={selections[row.key] ?? null}
                onSelect={(selection) => onSelect(row.key, selection)}
                disabled={disabled}
              />
            </li>
          );
        })}
      </ul>
      {!f.travelers.some((person) => person.name.trim()) && <p className="mt-2 text-[11.5px] text-subtle">Add a traveler above to choose their passport or ID.</p>}
    </Section>
  );
}
