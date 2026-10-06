"use client";

import { FilePickField } from "@/components/documents/file-pick-field";
import { Section } from "./steps-1";
import type { WizardForm } from "./wizard-data";

/** Files picked on the travel screen, keyed "form" or "traveler:<index into f.travelers>". */
export type TravelUploadFiles = Record<string, File>;

export const TRAVEL_UPLOAD_ACCEPT = "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

/** The traveler rows the server will create requirements for: named travelers, in form order. */
export function namedTravelerIndexes(f: WizardForm): number[] {
  return f.travelers.flatMap((traveler, index) => (traveler.name.trim() ? [index] : []));
}

/**
 * H6d — the travel requirements Eman collects from the client (the signed application form and a
 * passport/ID per traveler), attached right on the travel screen. Files are held in memory and
 * uploaded against the server's requirement rows once the request is created; nothing is stored
 * in the draft.
 */
export function TravelRequirementUploads({
  f,
  files,
  onFile,
}: {
  f: WizardForm;
  files: TravelUploadFiles;
  onFile: (key: string, file: File | null) => void;
}) {
  const rows = [
    { key: "form", label: "Signed Travel application form", sub: "Returned by the client, signed" },
    ...namedTravelerIndexes(f).map((index) => {
      const traveler = f.travelers[index];
      const idLabel = traveler.idType === "Government-issued ID" ? "Valid government-issued ID" : "Passport copy";
      return { key: `traveler:${index}`, label: `${idLabel} — ${traveler.name}`, sub: traveler.idNumber ? `No. ${traveler.idNumber}` : "Traveler ID" };
    }),
  ];
  const attached = rows.filter((row) => files[row.key]).length;
  return (
    <Section
      title="Requirements"
      state={{
        status: attached === rows.length ? "done" : "todo",
        label: `${attached} of ${rows.length} attached`,
      }}
    >
      <p className="mb-2 text-[12px] text-muted-foreground">
        Attach what the client sent back. Files upload when the request is created; payment proof and the issued policy
        are added later in the Travel workflow.
      </p>
      <ul className="divide-y divide-border-soft">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 first:pt-1 last:pb-0">
            <div className="min-w-[180px] flex-1">
              <div className="text-[13px] font-semibold">{row.label}</div>
              <div className="text-[11.5px] text-muted-foreground">{row.sub}</div>
            </div>
            <FilePickField
              className="flex-none"
              file={files[row.key] ?? null}
              onChange={(file) => onFile(row.key, file)}
              accept={TRAVEL_UPLOAD_ACCEPT}
              ariaLabel={`Attach ${row.label}`}
            />
          </li>
        ))}
      </ul>
      {rows.length === 1 && <p className="mt-2 text-[11.5px] text-subtle">Add a traveler above to attach their passport or ID.</p>}
    </Section>
  );
}
