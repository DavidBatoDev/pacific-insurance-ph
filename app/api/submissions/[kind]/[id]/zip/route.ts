import { zipSync } from "fflate";
import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { downloadObject } from "@/lib/supabase/storage";
import { safeFileName, zipEntryNames, type SubmissionKind } from "@/lib/submissions/submission-email";
import { loadSubmissionSource } from "@/lib/submissions/submission-files";

/**
 * Every file uploaded against an application's or claim's checklist, as one ZIP, so Eman can
 * attach the whole package to her email to Pacific Cross. Entries are numbered in checklist order.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { kind, id } = await params;
  if (kind !== "application" && kind !== "claim") return new NextResponse("Not found", { status: 404 });
  const source = await loadSubmissionSource(kind as SubmissionKind, id);
  if (!source) return new NextResponse("Not found", { status: 404 });

  const entries = zipEntryNames(source.items);
  if (!entries.length) return new NextResponse("No documents have been uploaded yet.", { status: 404 });

  const files: Record<string, Uint8Array> = {};
  for (const { documentId, entry } of entries) {
    const blob = await downloadObject(source.filePaths.get(documentId)!);
    // Scans and PDFs are already compressed; storing them keeps the ZIP fast to build.
    files[entry] = new Uint8Array(await blob.arrayBuffer());
  }
  const zip = zipSync(files, { level: 0 });

  await recordAudit({
    actorId: user.id, action: "download_package",
    tableName: kind === "application" ? "applications" : "claims", recordId: id,
    newValue: { documents: entries.map((entry) => entry.documentId) },
  });

  const name = `${safeFileName([source.referenceNo, source.clientName].filter(Boolean).join(" - "))}.zip`;
  return new NextResponse(zip as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
