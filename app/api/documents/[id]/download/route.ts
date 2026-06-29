import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { createSignedUrl } from "@/lib/supabase/storage";

/**
 * Authenticated document download: verifies the staff session, logs the download
 * to the audit trail, then redirects to a short-lived signed Storage URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { id } = await params;
  const doc = await getDocumentsRepository().findById(id);
  if (!doc?.filePath) return new NextResponse("Not found", { status: 404 });

  const signedUrl = await createSignedUrl(doc.filePath, 60);

  await recordAudit({
    actorId: user.id,
    action: "download",
    tableName: "documents",
    recordId: id,
  });

  return NextResponse.redirect(signedUrl);
}
