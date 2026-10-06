"use client";

import { I } from "../../icons";
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
  return (
    <Section title="Requirements">
      <p className="-mt-1 mb-3 text-[12px] text-muted-foreground">
        Attach what the client sent back. Files upload when the request is created; payment proof and the issued policy are
        added later in the Travel workflow.
      </p>
      <div className="space-y-2">
        {rows.map((row) => {
          const file = files[row.key];
          return (
            <div key={row.key} className="flex items-center gap-3 rounded-md border border-border-soft px-3 py-2.5">
              <div
                className={`grid size-7 shrink-0 place-items-center rounded-full ${file ? "bg-green text-white" : "bg-surface-3 text-muted-foreground"}`}
              >
                {file ? <I.check size={14} /> : <I.upload size={13} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{row.label}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{file ? file.name : row.sub}</div>
              </div>
              {file ? (
                <button
                  type="button"
                  onClick={() => onFile(row.key, null)}
                  className="rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground hover:bg-hover"
                >
                  Remove
                </button>
              ) : (
                <label className="cursor-pointer rounded-md border border-border-strong px-2.5 py-1 text-[12px] font-semibold hover:bg-hover">
                  Attach
                  <input
                    type="file"
                    aria-label={`Attach ${row.label}`}
                    accept={TRAVEL_UPLOAD_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (picked) onFile(row.key, picked);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
        {rows.length === 1 && (
          <p className="text-[11.5px] text-subtle">Add a traveler above to attach their passport or ID.</p>
        )}
      </div>
    </Section>
  );
}
