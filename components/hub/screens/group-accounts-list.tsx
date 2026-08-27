"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { GroupAccount } from "@/lib/repositories/groups/group.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "@/lib/format";
import type { Tone } from "../tone";
import { I } from "../icons";
import { Card, PageHead, Pill } from "../primitives";

/** Clients → Group Accounts segment: company-level Group HMO records. */

const GA_TONE: Record<string, Tone> = {
  Active: "green",
  Onboarding: "blue",
  Lapsing: "amber",
  Lapsed: "red",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** Segmented Individuals / Group Accounts control shared by the two views. */
export function ClientsViewToggle({ view }: { view: "individuals" | "groups" }) {
  return (
    <div className="mb-4 flex items-center rounded-md border border-border bg-surface-3 p-0.5 self-start w-fit">
      <Link
        href="/clients"
        className={cn(
          "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
          view === "individuals" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Individuals
      </Link>
      <Link
        href="/clients?view=groups"
        className={cn(
          "rounded-[7px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
          view === "groups" ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Group Accounts
      </Link>
    </div>
  );
}

export function GroupAccountsList({ groups }: { groups: GroupAccount[] }) {
  const router = useRouter();
  const totalMembers = groups.reduce((a, g) => a + g.memberCount, 0);
  const totalPremium = groups.reduce((a, g) => a + (g.premiumAmount ?? 0), 0);

  return (
    <div>
      <PageHead
        iconName="users"
        title="Clients"
        sub={`${groups.length} group HMO accounts · company-level records`}
      />
      <ClientsViewToggle view="groups" />

      <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {[
          { val: groups.length, label: "Group accounts" },
          { val: totalMembers, label: "Total members" },
          { val: pesoShort(totalPremium), label: "Group premium", cls: "text-brand" },
          { val: groups.filter((g) => g.status === "Lapsing").length, label: "Lapsing soon", cls: "text-amber" },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-card px-4 py-3">
            <div className={cn("text-[19px] font-bold tabular-nums", s.cls)}>{s.val}</div>
            <div className="text-[11.5px] font-semibold text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border-soft text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                {["Company", "Group ID", "Plan", "Members", "Group premium", "Renewal", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/group/${g.id}`)}
                  className="cursor-pointer border-b border-border-soft transition-colors last:border-0 hover:bg-hover"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-[30px] place-items-center rounded-[9px] bg-blue-soft text-blue">
                        <I.building size={16} />
                      </span>
                      <div>
                        <div className="text-[13px] font-[650]">{g.name}</div>
                        <div className="text-[11.5px] text-subtle">{g.address ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><span className="font-mono text-[12px] text-muted-foreground">{g.referenceNo ?? "—"}</span></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.productName ?? "—"}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{g.memberCount}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                    {g.premiumAmount != null ? peso(g.premiumAmount) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(g.expiryDate)}</td>
                  <td className="px-4 py-2.5">
                    <Pill tone={GA_TONE[g.status] ?? "slate"} dot>
                      {g.status}
                    </Pill>
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-subtle">
                    No group accounts yet — a Group HMO application creates one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
