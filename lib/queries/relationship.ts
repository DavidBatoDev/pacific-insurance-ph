import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Relationship touchpoints (design screens-extra.jsx RelationshipScreen /
 * new-campaign.jsx audiences), derived from real client records: birthdays
 * from date_of_birth, anniversaries from created_at, re-nurture from
 * Nurturing/Lost leads.
 */

export interface TouchpointRow {
  clientId: string;
  name: string;
  email: string | null;
  sub: string;
  when: string;
  daysUntil: number;
  type: "birthday" | "anniversary" | "renurture";
}

const dayDiffThisYear = (month: number, day: number): number => {
  const now = new Date();
  const next = new Date(now.getFullYear(), month, day);
  if (next.getTime() < now.getTime() - 86_400_000) next.setFullYear(now.getFullYear() + 1);
  return Math.round((next.getTime() - now.getTime()) / 86_400_000);
};

const whenLabel = (d: number) => (d <= 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);

export async function getRelationshipTouchpoints(windowDays = 45): Promise<TouchpointRow[]> {
  const s = getSupabaseAdmin();
  // Birthday/anniversary windows need month-day math, so filtering stays in JS
  // over a narrow column set — but bounded, so this never becomes a full-table
  // payload as the client base grows.
  const { data: clients } = await s
    .from("clients")
    .select("id, first_name, last_name, email, date_of_birth, created_at, lifecycle_stage, lead_status, product_interest")
    .neq("lifecycle_stage", "Lost")
    .limit(2000);

  const rows: TouchpointRow[] = [];
  for (const c of clients ?? []) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (c.date_of_birth) {
      const dob = new Date(c.date_of_birth + "T00:00:00");
      const d = dayDiffThisYear(dob.getMonth(), dob.getDate());
      if (d <= windowDays)
        rows.push({
          clientId: c.id,
          name,
          email: c.email,
          sub: `Birthday · ${c.product_interest ?? c.lifecycle_stage}`,
          when: whenLabel(d),
          daysUntil: d,
          type: "birthday",
        });
    }
    if (c.lifecycle_stage === "Client" || c.lifecycle_stage === "Policyholder") {
      const created = new Date(c.created_at);
      const years = new Date().getFullYear() - created.getFullYear();
      const d = dayDiffThisYear(created.getMonth(), created.getDate());
      if (years >= 1 && d <= windowDays)
        rows.push({
          clientId: c.id,
          name,
          email: c.email,
          sub: `${years}-year client anniversary`,
          when: whenLabel(d),
          daysUntil: d,
          type: "anniversary",
        });
    }
    if (c.lifecycle_stage === "Lead" && c.lead_status === "Nurturing") {
      rows.push({
        clientId: c.id,
        name,
        email: c.email,
        sub: `${c.product_interest ?? "Lead"} · Nurturing`,
        when: "re-nurture",
        daysUntil: 0,
        type: "renurture",
      });
    }
  }
  return rows.sort((a, b) => a.daysUntil - b.daysUntil);
}
