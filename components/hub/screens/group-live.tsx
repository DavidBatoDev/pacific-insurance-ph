"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { addGroupMemberAction, issueGroupEcardsAction } from "@/app/(app)/group/actions";
import type { TimelineEntry } from "@/lib/activity/read";
import type { GroupAccount, GroupMember } from "@/lib/repositories/groups/group.entity";
import { cn } from "@/lib/utils";
import { peso, pesoShort } from "@/lib/format";
import type { Tone } from "../tone";
import { I } from "../icons";
import { useRecordNav } from "../nav";
import { Drawer } from "../overlays/drawer";
import { useOverlays } from "../overlays/overlay-provider";
import { Avatar, Btn, Card, CardHead, Field, INPUT, Pill } from "../primitives";

/**
 * Group Account detail — the company-level equivalent of the Contact Profile
 * for a Group HMO account, wired to group_accounts +
 * group_members.
 */

const GA_TONE: Record<string, Tone> = {
  Active: "green",
  Onboarding: "blue",
  Lapsing: "amber",
  Lapsed: "red",
  Pending: "slate",
  Issued: "green",
};

const TIER_SHARE: Record<string, number> = { Executive: 96000, Premium: 62000, Standard: 44000 };

const gaBadge = (val: string) => (
  <Pill size="sm" tone={GA_TONE[val] ?? "slate"} dot>{val}</Pill>
);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function GroupLive({
  group,
  members,
  activity,
}: {
  group: GroupAccount;
  members: GroupMember[];
  activity: TimelineEntry[];
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const { openContact } = useRecordNav();
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const [, startTransition] = useTransition();

  const active = members.filter((m) => m.status === "Active").length;
  const pending = members.filter((m) => m.status === "Pending").length;
  const pendingEcards = members.filter((m) => m.ecardStatus === "Pending").length;
  const renewalDays = group.expiryDate
    ? Math.round((new Date(group.expiryDate + "T00:00:00").getTime() - Date.now()) / 86_400_000)
    : null;

  const cycleUnit =
    group.premiumAmount != null
      ? group.billingCycle === "Monthly"
        ? group.premiumAmount / 12
        : group.billingCycle === "Quarterly"
          ? group.premiumAmount / 4
          : group.billingCycle === "Semi-Annual"
            ? group.premiumAmount / 2
            : group.premiumAmount
      : null;

  const tierRows = useMemo(
    () =>
      (["Executive", "Premium", "Standard"] as const)
        .map((tier) => {
          const list = members.filter((m) => m.coverageTier === tier);
          return { tier, count: list.length, total: list.length * TIER_SHARE[tier] };
        })
        .filter((r) => r.count > 0),
    [members],
  );

  const visible =
    filter === "All"
      ? members
      : filter === "Dependents"
        ? members.filter((m) => m.relationship === "Dependent")
        : members.filter((m) => m.status === filter);

  const issueEcards = () => {
    if (!pendingEcards) {
      overlays.toast("All e-cards issued", `No pending e-cards for ${group.name}.`);
      return;
    }
    startTransition(async () => {
      const res = await issueGroupEcardsAction(group.id);
      if (res.ok) overlays.toast("E-cards issued", `${res.data} e-card${res.data === 1 ? "" : "s"} delivered.`);
      else overlays.toast("Couldn’t issue e-cards", res.error);
      router.refresh();
    });
  };

  const sendBilling = () => {
    if (!group.primaryContactId) {
      overlays.toast("No primary contact", "Link a company contact to send billing.");
      return;
    }
    overlays.openEngage("Send Payment Instruction", {
      clientId: group.primaryContactId,
      name: group.primaryContactName ?? group.name,
      email: group.primaryContactEmail,
      product: group.productName,
      premium: cycleUnit != null ? Math.round(cycleUnit) : null,
    });
  };

  const renewGroup = () => {
    if (!group.primaryContactId) return;
    overlays.openEngage("Send Renewal Notice", {
      clientId: group.primaryContactId,
      name: group.primaryContactName ?? group.name,
      email: group.primaryContactEmail,
      product: group.productName,
      premium: group.premiumAmount,
    });
  };

  return (
    <div>
      <Link href="/clients?view=groups" className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-subtle hover:text-foreground">
        <I.arrowRight size={14} className="rotate-180" /> Clients
      </Link>

      {/* header */}
      <div className="mb-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-14 place-items-center rounded-[14px] bg-blue-soft text-blue">
            <I.building size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[22px] font-bold tracking-[-0.02em]">{group.name}</h1>
              <span className="font-mono text-[12px] text-subtle">{group.referenceNo ?? group.id.slice(0, 8)}</span>
              {gaBadge(group.status)}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <I.shield size={13} /> {group.productName ?? "—"}
                {group.policyRef && <> · {group.policyRef}</>}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <I.users size={13} /> {members.length} members
              </span>
              <span className="inline-flex items-center gap-1.5">
                <I.refresh size={13} /> Renews {fmtDate(group.expiryDate)}
              </span>
              {group.primaryContactName && (
                <button
                  onClick={() => group.primaryContactId && openContact(group.primaryContactId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-semibold transition-colors hover:border-brand hover:text-brand"
                  title={`Open ${group.primaryContactName}'s Contact Profile`}
                >
                  <Avatar name={group.primaryContactName} size={18} /> {group.primaryContactName} · Primary contact
                </button>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Btn size="sm" onClick={() => setAddOpen(true)}>
              <I.plus size={14} /> Add member
            </Btn>
            <Btn size="sm" onClick={renewGroup}>
              <I.refresh size={14} /> Renew group
            </Btn>
            <Btn size="sm" onClick={issueEcards}>
              <I.shield size={14} /> Issue e-cards
            </Btn>
            <Btn size="sm" variant="primary" onClick={sendBilling}>
              <I.peso size={14} /> Send billing
            </Btn>
          </div>
        </div>
      </div>

      {/* stat strip */}
      <div className="mb-4 grid grid-cols-5 gap-3 max-[1000px]:grid-cols-2">
        {[
          { val: `${active} / ${pending} pending`, label: "Members active" },
          { val: group.productName ?? "—", label: "Coverage plan" },
          { val: group.premiumAmount != null ? pesoShort(group.premiumAmount) : "—", label: `Group premium · ${group.billingCycle}`, cls: "text-brand" },
          { val: renewalDays != null ? `${fmtDate(group.expiryDate)?.split(",")[0]}` : "—", label: renewalDays != null ? `Renewal · in ${renewalDays} days` : "Renewal" },
          { val: pendingEcards, label: "Pending e-cards", cls: pendingEcards ? "text-amber" : undefined },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-card px-4 py-3">
            <div className={cn("truncate text-[17px] font-bold tabular-nums", s.cls)}>{s.val}</div>
            <div className="text-[11.5px] font-semibold text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 items-start gap-4 max-[1200px]:grid-cols-1">
        {/* roster */}
        <Card className="col-span-8 overflow-hidden max-[1200px]:col-span-1">
          <CardHead iconName="users" title="Member roster" count={members.length} />
          <div className="flex flex-wrap gap-2 border-b border-border-soft px-4 py-2.5">
            {["All", "Active", "Pending", "Dependents", "Lapsed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  filter === f ? "border-brand bg-brand-soft text-brand-hover" : "border-border bg-card text-muted-foreground hover:bg-hover",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border-soft text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                  {["Member", "Relationship", "Coverage tier", "E-card", "Join date", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => m.clientId && openContact(m.clientId)}
                    title={m.clientId ? "Open Contact Profile" : "Roster-only member"}
                    className={cn("border-b border-border-soft transition-colors last:border-0 hover:bg-hover", m.clientId && "cursor-pointer")}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.fullName} size={30} />
                        <div>
                          <div className="text-[13px] font-[600]">{m.fullName}</div>
                          {!m.clientId && <div className="text-[11px] text-subtle">Roster only</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill size="sm" tone={m.relationship === "Principal" ? "green" : m.relationship === "Dependent" ? "violet" : "slate"}>
                        {m.relationship}
                      </Pill>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.coverageTier}</td>
                    <td className="px-4 py-2.5">{gaBadge(m.ecardStatus)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(m.joinDate)}</td>
                    <td className="px-4 py-2.5">{gaBadge(m.status)}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-subtle">No members in this view.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* right panels */}
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <Card>
            <CardHead iconName="peso" title="Billing & census" />
            <div className="px-[18px] py-3 text-[13px]">
              {(
                [
                  ["Billing cycle", group.billingCycle],
                  ["This invoice", cycleUnit != null ? peso(Math.round(cycleUnit)) : "—"],
                  ["Billed to", group.primaryContactName ?? "—"],
                  ["Effective", fmtDate(group.effectiveDate)],
                  ["Expiry", fmtDate(group.expiryDate)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border-soft py-2 last:border-0">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-subtle">{k}</span>
                  <span className="font-[600]">{v}</span>
                </div>
              ))}
              {tierRows.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                    Per-member breakdown / yr
                  </div>
                  {tierRows.map((r) => (
                    <div key={r.tier} className="flex justify-between py-1 text-[12.5px]">
                      <span>
                        {r.tier} <span className="text-subtle">× {r.count}</span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums">{peso(r.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead iconName="refresh" title="Group activity" count={activity.length} />
            <div className="py-1.5">
              {activity.length === 0 && (
                <div className="px-[18px] py-3 text-[12.5px] text-subtle">No group activity yet.</div>
              )}
              {activity.map((a) => (
                <div key={a.id} className="border-b border-border-soft px-[18px] py-2.5 last:border-0">
                  <div className="text-[12.5px] font-[550] leading-snug">{a.summary}</div>
                  <div className="mt-0.5 text-[11px] text-subtle">
                    {[a.actorName, new Date(a.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {addOpen && (
        <AddMemberDrawer group={group} onClose={() => setAddOpen(false)} onDone={() => router.refresh()} />
      )}
    </div>
  );
}

/** Add Member drawer (modals.md §13). */
function AddMemberDrawer({
  group,
  onClose,
  onDone,
}: {
  group: GroupAccount;
  onClose: () => void;
  onDone: () => void;
}) {
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Employee");
  const [tier, setTier] = useState("Standard");
  const [join, setJoin] = useState("");
  const [ecardNow, setEcardNow] = useState(true);

  const save = () =>
    startTransition(async () => {
      const res = await addGroupMemberAction({
        groupId: group.id,
        fullName: name,
        relationship,
        coverageTier: tier,
        ecardStatus: ecardNow ? "Issued" : "Pending",
        joinDate: join || null,
      });
      if (res.ok) {
        overlays.toast("Member added", `${res.data.fullName} enrolled under ${group.name} (status Pending).`);
        onDone();
        onClose();
      } else {
        overlays.toast("Couldn’t add member", res.error);
      }
    });

  return (
    <Drawer
      icon="users"
      title="Add member"
      sub={`Enroll a person under ${group.name}'s group policy`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!name.trim() || pending} onClick={save}>
            <I.plus size={15} /> {pending ? "Adding…" : "Add member"}
          </Btn>
        </>
      }
    >
      <Field label="Full name" required>
        <input autoFocus className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" />
      </Field>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Field label="Relationship / role" required>
          <select className={INPUT} value={relationship} onChange={(e) => setRelationship(e.target.value)}>
            {["Principal", "Employee", "Dependent"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Coverage tier" required>
          <select className={INPUT} value={tier} onChange={(e) => setTier(e.target.value)}>
            {["Standard", "Premium", "Executive"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Join date" className="mt-4">
        <input className={INPUT} type="date" value={join} onChange={(e) => setJoin(e.target.value)} />
      </Field>
      <button
        onClick={() => setEcardNow(!ecardNow)}
        className={cn(
          "mt-4 flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
          ecardNow ? "border-brand bg-brand-soft" : "border-border-strong text-muted-foreground hover:bg-hover",
        )}
      >
        <span className={cn("grid size-[18px] place-items-center rounded-md border-[1.6px]", ecardNow ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
          {ecardNow && <I.check size={13} />}
        </span>
        Issue e-card immediately — otherwise queued as Pending for the next batch
      </button>
      <div className="mt-4 flex gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-3.5 text-[12.5px] leading-relaxed">
        <I.command size={15} className="mt-0.5 shrink-0 text-brand" />
        <div>
          Adds <b>{name.trim() || "the member"}</b> to the roster (status Pending), updates the
          census, and logs <b>Member added</b> to the group timeline.
        </div>
      </div>
    </Drawer>
  );
}
