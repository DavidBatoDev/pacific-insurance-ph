"use client";

import { useState } from "react";

import { beginPdfUploadAction } from "@/app/(app)/documents/actions";
import { I } from "@/components/hub/icons";
import type { ActionResult } from "@/lib/actions/context";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

/**
 * Drop zone that uploads one PDF straight to Storage, then hands the stored path
 * to `onUploaded` — the caller's server action registers it and applies whatever
 * the upload means (proposal received, policy issued).
 */
export function PdfUpload({
  clientId,
  prompt,
  disabled,
  onUploaded,
}: {
  clientId: string;
  prompt: string;
  disabled?: boolean;
  onUploaded: (path: string, fileName: string) => Promise<ActionResult<unknown>>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const begin = await beginPdfUploadAction({ clientId, fileName: file.name, mimeType: file.type, size: file.size });
      if (!begin.ok) return setError(begin.error);
      const put = await getSupabaseBrowser()
        .storage.from("documents")
        .uploadToSignedUrl(begin.data.path, begin.data.token, file, { contentType: "application/pdf" });
      if (put.error) return setError(`Upload failed: ${put.error.message}`);
      const done = await onUploaded(begin.data.path, file.name);
      if (!done.ok) setError(done.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-md border border-dashed px-3.5 py-3 text-[12.5px] transition-colors",
          busy || disabled
            ? "cursor-not-allowed border-border-strong text-subtle opacity-70"
            : "cursor-pointer border-border-strong text-muted-foreground hover:bg-hover",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) void upload(e.dataTransfer.files?.[0]);
        }}
      >
        <I.upload size={16} className="shrink-0" />
        {busy ? "Uploading…" : prompt}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy || disabled}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && <div className="mt-1.5 text-[12px] text-red">{error}</div>}
    </div>
  );
}
