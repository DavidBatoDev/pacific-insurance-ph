import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can, toAppRole } from "@/lib/auth/permissions";
import {
  isExportFormat,
  renderDashboardExport,
  EXPORT_FORMATS,
} from "@/lib/exports/dashboard-export";

/**
 * Dashboard spreadsheet export: `?format=xlsx|ods|csv`.
 *
 * A route handler rather than a Server Action because the response is a file —
 * Server Function return values are serialised for the client, so binary would
 * have to be base64'd and re-assembled, and the browser's own download
 * machinery (Content-Disposition) would go unused. Keeping SheetJS server-side
 * also keeps it out of the client bundle entirely.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  if (!can(toAppRole(user.role), "dashboard", "export")) {
    return new NextResponse("You do not have permission to export the dashboard.", { status: 403 });
  }

  const requested = new URL(request.url).searchParams.get("format") ?? "xlsx";
  if (!isExportFormat(requested)) {
    return new NextResponse(
      `Unsupported export format "${requested}". Expected one of: ${EXPORT_FORMATS.join(", ")}.`,
      { status: 400 },
    );
  }

  try {
    const { body, contentType, filename } = await renderDashboardExport(requested);

    await recordAudit({
      actorId: user.id,
      action: "export",
      tableName: "dashboard",
      newValue: { format: requested, filename },
    });

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Dashboard export failed:", e);
    // The browser navigated here expecting a download, so a JSON error body
    // would render as a dead-end page. Bounce back to the dashboard with a flag
    // it can turn into a toast.
    return NextResponse.redirect(new URL("/dashboard?exportError=1", request.url));
  }
}
