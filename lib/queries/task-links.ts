import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** A record a task can attach to (Add Task modal → "Specific record"). */
export interface TaskLinkOption {
  kind: "application" | "policy" | "renewal" | "claim" | "travel";
  id: string;
  label: string;
}

const SOURCES: { kind: TaskLinkOption["kind"]; table: string; noun: string }[] = [
  { kind: "application", table: "applications", noun: "Application" },
  { kind: "policy", table: "policies", noun: "Policy" },
  { kind: "renewal", table: "renewals", noun: "Renewal" },
  { kind: "claim", table: "claims", noun: "Claim" },
  { kind: "travel", table: "travel_requests", noun: "Travel" },
];

/** All records under a contact that a task can link to, labelled by reference. */
export async function taskLinkOptionsForClient(clientId: string): Promise<TaskLinkOption[]> {
  const supabase = getSupabaseAdmin();
  const results = await Promise.all(
    SOURCES.map(async ({ kind, table, noun }) => {
      const { data, error } = await supabase
        .from(table as "applications")
        .select("id, reference_no")
        .eq("client_id", clientId)
        .limit(20);
      if (error) return [] as TaskLinkOption[];
      return (data ?? []).map((r) => ({
        kind,
        id: r.id,
        label: `${r.reference_no ?? r.id.slice(0, 8)} · ${noun}`,
      }));
    }),
  );
  return results.flat();
}
