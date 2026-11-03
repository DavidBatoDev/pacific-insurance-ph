import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentsRepository } from "@/lib/repositories/documents";
import { createSignedUrl } from "@/lib/supabase/storage";
import { toAppRole } from "@/lib/auth/permissions";
import { getClientsRepository } from "@/lib/repositories/clients";

/**
 * Authenticated document download: verifies the staff session, logs the download
 * to the audit trail, then redirects to a short-lived signed Storage URL.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (user.status !== "Active") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const doc = await getDocumentsRepository().findById(id);
  if (!doc?.filePath) return new NextResponse("Not found", { status: 404 });
  if (toAppRole(user.role) === "agent") {
    const client = doc.clientId ? await getClientsRepository().findById(doc.clientId) : null;
    if (!client || client.assignedUserId !== user.id) return new NextResponse("Not found", { status: 404 });
  }

  const signedUrl = await createSignedUrl(doc.filePath, 60);

  await recordAudit({
    actorId: user.id,
    action: "download",
    tableName: "documents",
    recordId: id,
  });

  return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
