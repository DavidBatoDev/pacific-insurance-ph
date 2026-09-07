import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { inlineDisposition } from "@/lib/http/content-disposition";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { downloadObject } from "@/lib/supabase/storage";

/**
 * Streams a library asset through our own origin so it can be rendered in place.
 *
 * The sibling `download/route.ts` redirects to a short-lived Supabase URL, which
 * is right for "give me the file" but wrong for a viewer: it is cross-origin,
 * expires after 60s mid-read, sets no content type, and logs every look as a
 * download. This route is same-origin, sets the headers itself, and audits as
 * `preview` so real download counts stay clean.
 *
 * Whole-body responses only — no Range support. The largest asset is under 5 MB
 * against a 25 MB upload ceiling, so partial requests would be complexity with
 * nothing to buy. That is a decision, not an oversight.
 */
export const dynamic = "force-dynamic";

/**
 * Derived from a literal allowlist rather than reflected from the row. Uploads
 * already validate the type, but this is the one place a stray database value
 * could become `text/html` served from our own origin.
 */
const CONTENT_TYPES: Record<string, string> = {
  "application/pdf": "application/pdf",
  "application/msword": "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function resolve(request: Request, id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.redirect(new URL("/login", request.url)) };
  if (toAppRole(user.role) !== "admin") return { error: new NextResponse("Forbidden", { status: 403 }) };
  const asset = await getDocumentLibraryRepository().findById(id);
  if (!asset?.filePath) return { error: new NextResponse("Not found", { status: 404 }) };
  // The stored path is always `library/<uuid>.<ext>`, so it is a more reliable
  // extension source than the display name.
  const ext = asset.filePath.split(".").pop() ?? "bin";
  return {
    user,
    asset,
    headers: {
      "Content-Type": CONTENT_TYPES[asset.mimeType ?? ""] ?? "application/octet-stream",
      "Content-Disposition": inlineDisposition(asset.originalFileName ?? `${asset.documentName}.${ext}`),
      // No CSP exists app-wide, so this is what stops a mislabelled body being
      // sniffed as HTML on our own origin.
      "X-Content-Type-Options": "nosniff",
      // Never cached: a cached response would render without producing the
      // audit row that records who looked at the document.
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolve(request, id);
  if (resolved.error) return resolved.error;

  let body: Blob;
  try {
    body = await downloadObject(resolved.asset.filePath!);
  } catch (e) {
    // The row outlived its object, or storage is down. A status code is what the
    // caller wants — this URL is only ever an `iframe src` or a `fetch`, never a
    // navigation, so the export routes' redirect-with-an-error-flag recovery
    // would just render an error page inside the viewer.
    console.error(`Library preview failed for ${id}:`, e);
    return new NextResponse("Preview unavailable", { status: 502 });
  }

  // Logged once the bytes exist, so a storage failure never records a view that
  // did not happen.
  await recordAudit({ actorId: resolved.user.id, action: "preview", tableName: "document_library", recordId: id });
  return new NextResponse(body, { headers: resolved.headers });
}

/**
 * Explicit so Next does not derive HEAD from GET — that would write a second
 * audit row every time a browser probes the URL before rendering it.
 */
export async function HEAD(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resolved = await resolve(request, id);
  if (resolved.error) return resolved.error;
  return new NextResponse(null, { headers: resolved.headers });
}
