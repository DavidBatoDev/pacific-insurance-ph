"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleUserStatusAction, updateUserRoleAction } from "@/app/(app)/settings/actions";
import type { User } from "@/lib/repositories/users/user.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Avatar, Card, DraftBadge, PageHead, TONE_BADGE } from "../primitives";

/**
 * Settings — 6-tab workspace configuration (design settings.jsx /
 * settings-page.md). Team is wired to the real users table (Admin-only);
 * the config-store tabs stay draft until their backing tables land.
 */

const TABS = [
  { id: "General", adminOnly: false },
  { id: "Team", adminOnly: true },
  { id: "Notifications", adminOnly: false },
  { id: "Payment Channels", adminOnly: false },
  { id: "Billing", adminOnly: true },
  { id: "Integrations", adminOnly: false },
] as const;

export function SettingsLive({ users }: { users: User[] }) {
  const persona = usePersona();
  const isAdmin = persona.role === "admin";
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const [tab, setTab] = useState<string>(tabs[0].id);
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div>
      <PageHead
        iconName="settings"
        title="Settings"
        draft={false}
        sub="Manage your agency workspace and preferences"
      />

      {!isAdmin && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-amber-border bg-amber-soft px-4 py-3 text-[12.5px] text-amber">
          <I.shield size={16} className="mt-px shrink-0" />
          <span>
            Viewing as <b>{persona.userName} · {persona.roleLabel}</b>. Settings are view-only for
            your role; Team and Billing are managed by your Admin.
          </span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              active === t.id
                ? "border-transparent bg-brand-soft text-brand-hover"
                : "border-border-strong bg-card text-muted-foreground hover:bg-hover",
            )}
          >
            {t.id}
          </button>
        ))}
      </div>

      <Card className="p-6">
        {active === "General" && <GeneralTab canEdit={isAdmin} />}
        {active === "Team" && <TeamTab users={users} />}
        {active === "Notifications" && <StaticTab title="Notification & automation rules" body="Renewal, payment and missing-document reminders queue drafted messages for review (WhatsApp preferred; Viber is manual-log only). Rule configuration is stored once the automation engine lands." />}
        {active === "Payment Channels" && <StaticTab title="Official Payment Channels" body="Business GCash / company bank accounts that collections route through — never personal accounts. The channel store backs the Send Payment Links payee picker." />}
        {active === "Billing" && <StaticTab title="Billing" body="The CRM's own subscription (distinct from client premium collection). Post-MVP." />}
        {active === "Integrations" && <StaticTab title="Integrations" body="Gmail (inbound sync + send-in-app), WhatsApp (preferred automation channel), Viber (manual logging only), and the Pacific Cross portal link-out. OAuth flows land in a later release." />}
      </Card>
    </div>
  );
}

const INPUT =
  "h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13.5px] outline-none transition-colors focus:border-brand disabled:bg-surface-3 disabled:text-muted-foreground";

function GeneralTab({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-[15px] font-bold">Agency profile</h3>
        <DraftBadge />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(
          [
            ["Agency name", "Pacific Insurance PH"],
            ["Primary carrier", "Pacific Cross"],
            ["Contact email", "ops@pacificinsurance.ph"],
            ["Timezone", "Asia/Manila (GMT+8)"],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
              {label}
            </label>
            <input className={INPUT} defaultValue={value} disabled={!canEdit} />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
          Business address
        </label>
        <input className={INPUT} defaultValue="6789 Ayala Avenue, Makati City, Metro Manila 1226" disabled={!canEdit} />
      </div>
      <p className="mt-4 text-[12px] text-faint">
        The agency profile store lands with the automation phase — these fields preview the design.
      </p>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  Owner: "Admin · Owner",
  Admin: "Admin",
  Assistant: "Staff",
  Viewer: "Agent",
};

function TeamTab({ users }: { users: User[] }) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const [, startTransition] = useTransition();

  const changeRole = (u: User, role: string) =>
    startTransition(async () => {
      const res = await updateUserRoleAction(u.id, role);
      if (res.ok) overlays.toast("Role updated", `${u.fullName} is now ${ROLE_LABEL[role] ?? role}.`);
      else overlays.toast("Couldn’t update role", res.error);
      router.refresh();
    });

  const toggleStatus = (u: User) =>
    startTransition(async () => {
      const res = await toggleUserStatusAction(u.id);
      if (!res.ok) overlays.toast("Couldn’t update user", res.error);
      router.refresh();
    });

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-[15px] font-bold">Users &amp; roles</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {users.filter((u) => u.status === "Active").length} active · soft-deactivate preserves
          history. Role changes preview through the topbar &ldquo;View as&rdquo; switcher.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border-soft">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border-soft text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
              {["User", "Email", "Role", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={cn("border-b border-border-soft last:border-0", u.status !== "Active" && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.fullName} size={30} />
                    <span className="font-[600]">{u.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select
                    className="h-8 rounded-md border border-border-strong bg-card px-2 text-[12.5px] outline-none focus:border-brand disabled:opacity-60"
                    value={u.role}
                    disabled={u.status !== "Active"}
                    onChange={(e) => changeRole(u, e.target.value)}
                  >
                    {Object.entries(ROLE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-[650]", TONE_BADGE[u.status === "Active" ? "green" : "red"])}>
                    <span className="size-1.5 rounded-full bg-current" />
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => toggleStatus(u)}
                    className="text-[12px] font-semibold text-brand-hover hover:text-brand"
                  >
                    {u.status === "Active" ? "Deactivate" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-faint">
        <I.shield size={13} /> Signed in as {persona.userName} — invitations & real auth enrolment
        land in a later release.
      </p>
    </div>
  );
}

function StaticTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-[640px]">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <DraftBadge />
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
