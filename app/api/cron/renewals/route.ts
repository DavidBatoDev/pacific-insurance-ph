import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit/log";
import { getRenewalAutomationRepository } from "@/lib/repositories/renewal-automation";

export const dynamic = "force-dynamic";

/** Vercel Cron: 00:00 UTC / 08:00 Manila. Queues staff work, never delivers email. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Renewal cron is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const counts = await getRenewalAutomationRepository().queueDue();
    await recordAudit({ action: "cron_queue_due", tableName: "renewal_email_drafts", newValue: { ...counts } });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return Response.json(counts);
  } catch (error) {
    console.error("Renewal cron failed:", error);
    return Response.json({ error: "Could not queue renewal drafts." }, { status: 500 });
  }
}
