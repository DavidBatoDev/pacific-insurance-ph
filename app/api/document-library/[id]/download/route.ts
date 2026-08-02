import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { toAppRole } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { createSignedUrl } from "@/lib/supabase/storage";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (toAppRole(user.role) !== "admin") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const asset = await getDocumentLibraryRepository().findById(id);
  if (!asset?.filePath) return new NextResponse("Not found", { status: 404 });
  await recordAudit({ actorId: user.id, action: "download", tableName: "document_library", recordId: id });
  return NextResponse.redirect(await createSignedUrl(asset.filePath, 60));
}
