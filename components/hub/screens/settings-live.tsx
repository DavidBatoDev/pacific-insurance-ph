"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  removeCarrierPortalAction,
  saveCarrierPortalAction,
  savePaymentChannelAction,
  togglePaymentChannelAction,
  toggleUserStatusAction,
  updateUserRoleAction,
  saveExternalContactAction,
} from "@/app/(app)/settings/actions";
import { EXTERNAL_CONTACT_TYPES, type ExternalContact, type NewExternalContact } from "@/lib/repositories/external-contacts/external-contact.entity";
import type { IntegrationProvider, PacificCrossIntegrationSettings } from "@/lib/repositories/integration-settings";
import { CHANNEL_TYPES, type PaymentChannel } from "@/lib/repositories/payment-channels/payment-channel.entity";
import type { User } from "@/lib/repositories/users/user.entity";
import type { LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import type { CatalogProductVersion } from "@/lib/repositories/products/product.entity";
import { CarrierLibraryTab } from "@/components/settings/carrier-library-tab";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Modal } from "../overlays/modal";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Avatar, Card, DraftBadge, INPUT as INPUT_BASE, PageHead, Pill } from "../primitives";

/**
 * Settings — 6-tab workspace configuration (see settings-page.md). Team is wired to the real users table (Admin-only);
 * the config-store tabs stay draft until their backing tables land.
 */

const TABS = [
  { id: "General", adminOnly: false },
  { id: "Team", adminOnly: true },
  { id: "Notifications", adminOnly: false },
  { id: "Payment Channels", adminOnly: false },
  { id: "Pacific Cross Contacts", adminOnly: false },
  { id: "Carrier Library", adminOnly: true },
  { id: "Billing", adminOnly: true },
  { id: "Integrations", adminOnly: false },
] as const;

export function SettingsLive({
  users,
  channels,
  proposalPortal,
  travelPortal,
  contacts,
  libraryDocuments,
  productVersions,
  canManageLibrary,
}: {
  users: User[];
  channels: PaymentChannel[];
  proposalPortal: PacificCrossIntegrationSettings | null;
  travelPortal: PacificCrossIntegrationSettings | null;
  contacts: ExternalContact[];
  libraryDocuments: LibraryDocument[];
  productVersions: CatalogProductVersion[];
  canManageLibrary: boolean;
}) {
  const persona = usePersona();
  const isAdmin = persona.role === "admin" && canManageLibrary;
  const tabs = TABS.filter((t) => isAdmin || !t.adminOnly);
  const [tab, setTab] = useState<string>(tabs[0].id);
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div>
      <PageHead
        iconName="settings"
        title="Settings"
        sub="Manage your agency workspace and preferences"
      />

      {!isAdmin && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-amber-border bg-amber-soft px-4 py-3 text-[12.5px] text-amber">
          <I.shield size={16} className="mt-px shrink-0" />
          <span>
            Viewing as <b>{persona.userName} · {persona.roleLabel}</b>. Most settings are view-only
            for your role; Staff can maintain Pacific Cross contacts, while Team and Billing remain Admin-managed.
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
        {active === "Pacific Cross Contacts" && <PacificCrossContactsTab contacts={contacts} canEdit={persona.role !== "agent"} />}
        {active === "Carrier Library" && <CarrierLibraryTab documents={libraryDocuments} productVersions={productVersions} />}
        {active === "Billing" && <StaticTab title="Billing" body="The CRM's own subscription (distinct from client premium collection). Post-MVP." />}
        {active === "Integrations" && <IntegrationsTab proposalPortal={proposalPortal} travelPortal={travelPortal} canEdit={isAdmin} />}
      </Card>
    </div>
  );
}

/* Read-only team fields render disabled, hence the extra disabled: styles. */
const INPUT = INPUT_BASE + " disabled:bg-surface-3 disabled:text-muted-foreground";

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
                  <Pill tone={u.status === "Active" ? "green" : "red"} dot>
                    {u.status}
                  </Pill>
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

const EMPTY_CONTACT: NewExternalContact = {
  name: "", organization: "Pacific Cross", role: "", contactType: "Other", department: "",
  email: "", phone: "", status: "Active", lastVerifiedDate: "", notes: "",
};

function PacificCrossContactsTab({ contacts, canEdit }: { contacts: ExternalContact[]; canEdit: boolean }) {
  const router = useRouter();
  const overlays = useOverlays();
  const [editing, setEditing] = useState<ExternalContact | null>(null);
  const [contactEditorOpen, setContactEditorOpen] = useState(false);
  const [form, setForm] = useState<NewExternalContact>(EMPTY_CONTACT);
  const [pending, startTransition] = useTransition();
  const field = (key: keyof NewExternalContact, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const begin = (contact?: ExternalContact) => {
    setContactEditorOpen(true);
    setEditing(contact ?? null);
    setForm(contact ? {
      name: contact.name, organization: contact.organization, role: contact.role,
      contactType: contact.contactType, department: contact.department, email: contact.email,
      phone: contact.phone, status: contact.status, effectiveDate: contact.effectiveDate,
      endDate: contact.endDate, lastVerifiedDate: contact.lastVerifiedDate, notes: contact.notes,
      replacementContactId: contact.replacementContactId,
    } : EMPTY_CONTACT);
  };
  const save = () => startTransition(async () => {
    const result = await saveExternalContactAction(editing?.id ?? null, form);
    if (result.ok) {
      overlays.toast("Pacific Cross contact saved", `${result.data.name} is available in the contact directory.`);
      setEditing(null); setContactEditorOpen(false); setForm(EMPTY_CONTACT); router.refresh();
    } else overlays.toast("Couldn’t save contact", result.error);
  });
  return <div>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h3 className="text-[15px] font-bold">Pacific Cross contact directory</h3><p className="mt-0.5 text-[12.5px] text-muted-foreground">Operational recipients by department. Inactive contacts remain visible for history but cannot be selected for new messages.</p></div>
      {canEdit && <button className="rounded-md bg-brand px-3 py-2 text-[12.5px] font-semibold text-white" onClick={() => begin()}>Add contact</button>}
    </div>
    <div className="overflow-x-auto rounded-md border border-border-soft"><table className="w-full min-w-[760px] text-left text-[12.5px]"><thead><tr className="border-b border-border-soft text-[11px] uppercase tracking-[.05em] text-subtle">{["Contact","Department / role","Email","Verified","Status", ""].map((h) => <th className="px-3 py-2.5" key={h}>{h}</th>)}</tr></thead><tbody>{contacts.map((contact) => <tr key={contact.id} className={cn("border-b border-border-soft last:border-0", contact.status === "Inactive" && "opacity-60")}><td className="px-3 py-2.5 font-semibold">{contact.name}</td><td className="px-3 py-2.5"><span>{contact.department ?? "—"}</span><span className="block text-[11px] text-subtle">{contact.role ?? contact.contactType ?? "—"}</span></td><td className="px-3 py-2.5 font-mono text-[11.5px]">{contact.email ?? "—"}</td><td className="px-3 py-2.5">{contact.lastVerifiedDate ?? "Not verified"}</td><td className="px-3 py-2.5">{contact.status}</td><td className="px-3 py-2.5 text-right">{canEdit && <button className="font-semibold text-brand-hover" onClick={() => begin(contact)}>Edit</button>}</td></tr>)}</tbody></table></div>
    {contactEditorOpen && canEdit && <Modal onClose={() => { setEditing(null); setContactEditorOpen(false); setForm(EMPTY_CONTACT); }} maxWidth={620}>
      <h3 className="mb-4 text-[16px] font-bold">{editing ? "Edit" : "Add"} Pacific Cross contact</h3>
      <div className="grid grid-cols-2 gap-3">{([['name','Name'],['department','Department'],['role','Role'],['email','Email'],['phone','Phone'],['lastVerifiedDate','Last verified date']] as const).map(([key,label]) => <label key={key} className="text-[11.5px] font-bold uppercase text-subtle">{label}<input type={key === 'lastVerifiedDate' ? 'date' : key === 'email' ? 'email' : 'text'} className={`${INPUT} mt-1.5 normal-case font-normal`} value={(form[key] as string | null) ?? ""} onChange={(event) => field(key, event.target.value)} /></label>)}</div>
      <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[11.5px] font-bold uppercase text-subtle">Contact type<select className={`${INPUT} mt-1.5 normal-case font-normal`} value={form.contactType ?? "Other"} onChange={(event) => field('contactType', event.target.value)}>{EXTERNAL_CONTACT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-[11.5px] font-bold uppercase text-subtle">Status<select className={`${INPUT} mt-1.5 normal-case font-normal`} value={form.status ?? "Active"} onChange={(event) => field('status', event.target.value)}><option>Active</option><option>Inactive</option></select></label></div>
      <label className="mt-3 block text-[11.5px] font-bold uppercase text-subtle">Notes<textarea className="mt-1.5 min-h-20 w-full rounded-md border border-border-strong bg-card p-3 text-[13px] font-normal normal-case" value={form.notes ?? ""} onChange={(event) => field('notes', event.target.value)} /></label>
      <div className="mt-5 flex justify-end gap-2"><button className="rounded-md border px-3 py-2 text-[13px]" onClick={() => { setEditing(null); setContactEditorOpen(false); setForm(EMPTY_CONTACT); }}>Cancel</button><button disabled={pending || !form.name.trim()} className="rounded-md bg-brand px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50" onClick={save}>{pending ? "Saving…" : "Save contact"}</button></div>
    </Modal>}
  </div>;
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
  proposalPortal,
  travelPortal,
  canEdit,
}: {
  proposalPortal: PacificCrossIntegrationSettings | null;
  travelPortal: PacificCrossIntegrationSettings | null;
  canEdit: boolean;
}) {
  return (
    <div className="max-w-[640px] space-y-6">
      <PortalSetting
        provider="pacific_cross_proposal"
        title="Pacific Cross proposal portal"
        description="Open the carrier calculator and proposal generator in a separate tab. Opening it does not claim that a proposal was received."
        settings={proposalPortal}
        canEdit={canEdit}
      />
      <PortalSetting
        provider="pacific_cross_travel"
        title="Pacific Cross Travel portal"
        description="Open the carrier Travel portal for manual policy purchase and issuance tracking."
        settings={travelPortal}
        canEdit={canEdit}
      />
      <p className="text-[12px] text-faint">Portal credentials are kept in the agency password manager and are never stored in this app.</p>
    </div>
  );
}

function PortalSetting({ provider, title, description, settings, canEdit }: {
  provider: IntegrationProvider;
  title: string;
  description: string;
  settings: PacificCrossIntegrationSettings | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const [portalUrl, setPortalUrl] = useState(settings?.portalUrl ?? "");
  const [configuredUrl, setConfiguredUrl] = useState(settings?.portalUrl ?? null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await saveCarrierPortalAction(provider, portalUrl);
      if (res.ok) {
        setPortalUrl(res.data.portalUrl ?? "");
        setConfiguredUrl(res.data.portalUrl);
        overlays.toast("Pacific Cross portal saved", "Staff can now open the configured portal from its workflow.");
        router.refresh();
      } else {
        overlays.toast("Couldn’t save portal", res.error);
      }
    });

  const restore = (removedUrl: string) =>
    startTransition(async () => {
      const res = await saveCarrierPortalAction(provider, removedUrl);
      if (res.ok) {
        setPortalUrl(res.data.portalUrl ?? "");
        setConfiguredUrl(res.data.portalUrl);
        overlays.toast("Pacific Cross portal restored", `${title} is available to staff again.`);
        router.refresh();
      } else {
        overlays.toast("Couldn’t restore portal", res.error);
      }
    });

  const remove = async () => {
    if (!configuredUrl) return;
    const confirmed = await overlays.confirm({
      kind: "danger",
      title: `Remove ${title} URL?`,
      message: (
        <>
          You’re about to remove <span className="break-all font-semibold text-foreground">{configuredUrl}</span>.
          {" "}This carrier handoff will be unavailable until an admin adds or restores the URL.
        </>
      ),
      confirmLabel: "Remove URL",
    });
    if (!confirmed) return;

    startTransition(async () => {
      const res = await removeCarrierPortalAction(provider);
      if (res.ok) {
        setPortalUrl("");
        setConfiguredUrl(null);
        overlays.toast(
          "Pacific Cross portal URL removed",
          `${title} is unavailable until a portal URL is configured.`,
          { label: "Undo", onClick: () => restore(res.data.removedUrl) },
        );
        router.refresh();
      } else {
        overlays.toast("Couldn’t remove portal", res.error);
      }
    });
  };

  return (
    <div className="max-w-[640px]">
      <div className="mb-4 flex items-start gap-3.5 rounded-md border border-border-soft bg-surface-2 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-hover">
          <I.building size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold">{title}</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
          {configuredUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={configuredUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <I.arrowUpRight size={14} /> Open portal
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-md px-3 text-[12.5px] font-semibold text-red transition-colors hover:bg-red-soft disabled:opacity-50"
                >
                  Remove URL
                </button>
              )}
            </div>
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
                {c.isDefault && <Pill size="sm" tone="green">Default</Pill>}
                {!c.active && <Pill size="sm" tone="slate">Inactive</Pill>}
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
