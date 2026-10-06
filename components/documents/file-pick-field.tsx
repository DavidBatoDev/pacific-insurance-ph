"use client";

import { forwardRef, useId } from "react";

import { I } from "@/components/hub/icons";
import { cn } from "@/lib/utils";

/**
 * One file chooser for every upload surface (requirement rows, the travel quote, Documents): a
 * styled "Choose file" control over a hidden native input, then the picked file as a chip with
 * Remove. Presentational only — the caller decides when and how the file is uploaded. Pass `name`
 * to have the native input submit with a surrounding form.
 */
export const FilePickField = forwardRef<
  HTMLInputElement,
  {
    file: File | null;
    onChange: (file: File | null) => void;
    accept?: string;
    name?: string;
    disabled?: boolean;
    ariaLabel?: string;
    hint?: string;
    className?: string;
  }
>(function FilePickField(
  { file, onChange, accept, name, disabled, ariaLabel, hint = "PDF, JPG or PNG · up to 25 MB", className },
  ref,
) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2", className)}>
      <input
        ref={ref}
        id={id}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        aria-label={ariaLabel}
        className="peer sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <span className="flex min-w-0 items-center gap-1.5 rounded-md border border-green-border bg-green-soft px-2.5 py-1.5 text-[12.5px]">
          <I.check size={13} className="shrink-0 text-green" />
          <span className="truncate font-semibold">{file.name}</span>
          <span className="shrink-0 text-[11.5px] text-muted-foreground">{formatSize(file.size)}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="ml-1 shrink-0 rounded px-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/25"
          >
            Remove
          </button>
        </span>
      ) : (
        <>
          <label
            htmlFor={id}
            className={cn(
              "inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold transition-colors hover:border-faint hover:bg-hover",
              "peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand/25",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <I.upload size={13} /> Choose file
          </label>
          <span className="truncate text-[11.5px] text-faint">{hint}</span>
        </>
      )}
    </div>
  );
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
