"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  savePacificCrossPortalAction,
  savePaymentChannelAction,
  togglePaymentChannelAction,
  toggleUserStatusAction,
  updateUserRoleAction,
} from "@/app/(app)/settings/actions";
import type { PacificCrossIntegrationSettings } from "@/lib/repositories/integration-settings";
import { CHANNEL_TYPES, type PaymentChannel } from "@/lib/repositories/payment-channels/payment-channel.entity";
import type { User } from "@/lib/repositories/users/user.entity";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Modal } from "../overlays/modal";
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

export function SettingsLive({
  users,
  channels,
  pacificCross,
}: {
  users: User[];
  channels: PaymentChannel[];
  pacificCross: PacificCrossIntegrationSettings | null;
}) {
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
        {active === "Payment Channels" && <PaymentChannelsTab channels={channels} canEdit={isAdmin} />}
        {active === "Billing" && <StaticTab title="Billing" body="The CRM's own subscription (distinct from client premium collection). Post-MVP." />}
        {active === "Integrations" && <IntegrationsTab pacificCross={pacificCross} canEdit={isAdmin} />}
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

/* -------------------------- Pacific Cross portal -------------------------- */

function IntegrationsTab({
  pacificCross,
  canEdit,
}: {
  pacificCross: PacificCrossIntegrationSettings | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [portalUrl, setPortalUrl] = useState(pacificCross?.portalUrl ?? "");
  const [pending, startTransition] = useTransition();
  const configuredUrl = pacificCross?.portalUrl ?? null;

  const save = () =>
    startTransition(async () => {
      const res = await savePacificCrossPortalAction(portalUrl);
      if (res.ok) {
        setPortalUrl(res.data.portalUrl ?? "");
        overlays.toast("Pacific Cross portal saved", "Staff can now open the configured portal from Settings and proposal tracking.");
        router.refresh();
      } else {
        overlays.toast("Couldn’t save portal", res.error);
      }
    });

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-start gap-3.5 rounded-md border border-border-soft bg-surface-2 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-hover">
          <I.building size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">Pacific Cross portal</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Open the carrier portal in a separate tab when preparing or generating a proposal.
          </p>
          {configuredUrl ? (
            <a
              href={configuredUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            >
              <I.arrowUpRight size={14} /> Open Pacific Cross portal
            </a>
          ) : (
            <p className="mt-3 text-[12px] text-subtle">
              {canEdit
                ? "Add the official portal URL below to make it available to staff."
                : "Your admin has not configured the portal link yet."}
            </p>
          )}
        </div>
      </div>

      {canEdit && (
        <div>
          <label className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle">
            Portal URL
          </label>
          <div className="flex gap-2.5">
            <input
              className={INPUT}
              type="url"
              inputMode="url"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              placeholder="https://…"
            />
            <button
              onClick={save}
              disabled={pending || !portalUrl.trim()}
              className="inline-flex h-9 shrink-0 items-center rounded-md border border-transparent bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save URL"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-faint">Only admins can change this shared integration setting.</p>
        </div>
      )}
    </div>
  );
}

/* ---------------------- Official Payment Channels tab ---------------------- */

function PaymentChannelsTab({ channels, canEdit }: { channels: PaymentChannel[]; canEdit: boolean }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [, startTransition] = useTransition();
  const [modal, setModal] = useState<PaymentChannel | "new" | null>(null);

  const toggle = (c: PaymentChannel) =>
    startTransition(async () => {
      const res = await togglePaymentChannelAction(c.id);
      if (!res.ok) overlays.toast("Couldn’t update channel", res.error);
      router.refresh();
    });

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold">Official Payment Channels</h3>
          <p className="mt-0.5 max-w-[560px] text-[12.5px] text-muted-foreground">
            Business GCash / company bank accounts that collections route through —{" "}
            <b>never personal accounts</b>. These back the Send Payment Links payee picker.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModal("new")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-transparent bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover"
          >
            <I.plus size={15} /> Add channel
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {channels.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-3.5 rounded-md border border-border-soft bg-surface-2 px-4 py-3",
              !c.active && "opacity-60",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-hover">
              {c.channelType === "GCash for Business" ? <I.wallet size={17} /> : <I.building size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[13.5px] font-[650]">
                {c.label}
                {c.isDefault && (
                  <span className={cn("inline-flex h-[19px] items-center rounded-full border px-2 text-[10.5px] font-bold", TONE_BADGE.green)}>
                    Default
                  </span>
                )}
                {!c.active && (
                  <span className={cn("inline-flex h-[19px] items-center rounded-full border px-2 text-[10.5px] font-bold", TONE_BADGE.slate)}>
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {c.channelType} · {c.accountName} · <span className="font-mono">{c.accountNumber}</span>
              </div>
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setModal(c)} className="text-[12px] font-semibold text-brand-hover hover:text-brand">
                  Edit
                </button>
                <button onClick={() => toggle(c)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                  {c.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            )}
          </div>
        ))}
        {channels.length === 0 && (
          <div className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-[13px] text-subtle">
            No payment channels yet{canEdit && " — add the business GCash or bank account collections should route to"}.
          </div>
        )}
      </div>

      {modal && (
        <ChannelModal channel={modal === "new" ? null : modal} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ChannelModal({ channel, onClose }: { channel: PaymentChannel | null; onClose: () => void }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(channel?.label ?? "");
  const [channelType, setChannelType] = useState(channel?.channelType ?? "GCash for Business");
  const [accountName, setAccountName] = useState(channel?.accountName ?? "Pacific Insurance PH Inc.");
  const [accountNumber, setAccountNumber] = useState(channel?.accountNumber ?? "");
  const [isDefault, setIsDefault] = useState(channel?.isDefault ?? false);

  const save = () =>
    startTransition(async () => {
      const res = await savePaymentChannelAction(channel?.id ?? null, {
        label,
        channelType,
        accountName,
        accountNumber,
        isDefault,
      });
      if (res.ok) {
        overlays.toast(channel ? "Channel saved" : "Channel added", `“${res.data.label}”.`);
        router.refresh();
        onClose();
      } else {
        overlays.toast("Couldn’t save channel", res.error);
      }
    });

  const field = "mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.05em] text-subtle";
  return (
    <Modal onClose={onClose} maxWidth={440}>
      <h3 className="mb-4 text-[16px] font-bold tracking-[-0.01em]">
        {channel ? "Edit payment channel" : "Add payment channel"}
      </h3>
      <label className={field}>Label</label>
      <input autoFocus className={INPUT} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Pacific GCash for Business" />
      <div className="mt-3.5 grid grid-cols-2 gap-3.5">
        <div>
          <label className={field}>Type</label>
          <select className={INPUT} value={channelType} onChange={(e) => setChannelType(e.target.value)}>
            {CHANNEL_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={field}>Account number</label>
          <input className={INPUT} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0917 888 2100" />
        </div>
      </div>
      <div className="mt-3.5">
        <label className={field}>Account name</label>
        <input className={INPUT} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
      </div>
      <button
        onClick={() => setIsDefault(!isDefault)}
        className={cn(
          "mt-4 flex w-full items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-[13px] font-[550] transition-colors",
          isDefault ? "border-brand bg-brand-soft" : "border-border-strong text-muted-foreground hover:bg-hover",
        )}
      >
        <span className={cn("grid size-[18px] place-items-center rounded-md border-[1.6px]", isDefault ? "border-brand bg-brand text-white" : "border-border-strong text-transparent")}>
          {isDefault && <I.check size={13} />}
        </span>
        Default channel for payment instructions
      </button>
      <div className="mt-5 flex justify-end gap-2.5">
        <button onClick={onClose} className="inline-flex h-9 items-center rounded-md border border-border-strong bg-card px-3.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-hover">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={pending || !label.trim() || !accountNumber.trim()}
          className="inline-flex h-9 items-center rounded-md border border-transparent bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : channel ? "Save changes" : "Add channel"}
        </button>
      </div>
    </Modal>
  );
}
