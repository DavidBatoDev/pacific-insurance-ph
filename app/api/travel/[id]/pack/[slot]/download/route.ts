import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDocumentLibraryRepository } from "@/lib/repositories/document-library";
import { getTravelRepository } from "@/lib/repositories/travel";
import { createSignedUrl } from "@/lib/supabase/storage";
import { resolveTravelPackReferences, TRAVEL_PACK_REFERENCE_SLOTS } from "@/lib/travel/post-issuance-pack";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; slot: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { id, slot } = await params;
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!documentId || !TRAVEL_PACK_REFERENCE_SLOTS.some((candidate) => candidate.key === slot))
    return new NextResponse("Not found", { status: 404 });

  try {
    const travel = await getTravelRepository().findById(id);
    if (!travel) return new NextResponse("Not found", { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const libraryDocuments = await getDocumentLibraryRepository().listEligible({
      productName: "TravelSafe",
      documentTypes: ["Reference Document", "Claim Form"],
      ageBand: "All Ages",
      onDate: today,
    });
    const document = resolveTravelPackReferences(libraryDocuments, today)
      .find((candidate) => candidate.key === slot)
      ?.documents.find((candidate) => candidate.id === documentId);
    if (!document?.filePath) return new NextResponse("Not found", { status: 404 });

    const signedUrl = await createSignedUrl(document.filePath, 60);
    await recordAudit({
      actorId: user.id,
      action: "download",
      tableName: "document_library",
      recordId: document.id,
    });
    const response = NextResponse.redirect(signedUrl);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse("Travel reference unavailable", { status: 502 });
  }
}
