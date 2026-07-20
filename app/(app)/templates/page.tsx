import { TemplatesScreen } from "@/components/hub/screens/templates";
import { getTemplatesRepository } from "@/lib/repositories/templates";

export const dynamic = "force-dynamic";

/** Email Templates — the single source of outbound copy (wired). */
export default async function Page() {
  const templates = await getTemplatesRepository().list();
  return <TemplatesScreen templates={templates} />;
}
