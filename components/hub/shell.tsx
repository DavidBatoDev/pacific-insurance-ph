"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/permissions";
import { NOTIFICATIONS, type Tone } from "./data";
import { I, type IconName } from "./icons";
import { useOverlays } from "./overlays/overlay-provider";
import { usePersona } from "./persona";
import { Avatar, TONE_SOFT } from "./primitives";

export type ScreenId =
  | "dashboard" | "prospects" | "clients" | "applications" | "policies"
  | "renewals" | "claims" | "travel" | "payments" | "documents" | "tasks"
  | "relationship" | "reports" | "products" | "templates" | "settings";

/** Single source of truth mapping a screen id to its App Router path. */
export const SCREEN_PATH: Record<ScreenId, string> = {
  dashboard: "/dashboard",
  prospects: "/prospects",
  clients: "/clients",
  applications: "/applications",
  policies: "/policies",
  renewals: "/renewals",
  claims: "/claims",
  travel: "/travel",
  payments: "/payments",
  documents: "/documents",
  tasks: "/tasks",
  relationship: "/relationship",
  reports: "/reports",
  products: "/products",
  templates: "/templates",
  settings: "/settings",
};

const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-primary font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(4,120,87,0.25)] transition-colors hover:bg-brand-hover";

type NavEntry = { id: ScreenId; label: string; icon: IconName; badge?: string; alert?: boolean };

const NAV_MAIN: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid" },
  { id: "prospects", label: "Leads", icon: "trendUp", badge: "42" },
  { id: "clients", label: "Clients", icon: "users", badge: "1.2k" },
  { id: "applications", label: "Applications", icon: "fileText", badge: "41" },
  { id: "policies", label: "Policies", icon: "shield" },
  { id: "renewals", label: "Renewals", icon: "refresh", badge: "8", alert: true },
  { id: "claims", label: "Claims", icon: "clipboard", badge: "18" },
  { id: "travel", label: "Travel Insurance", icon: "plane", badge: "15" },
];
const NAV_WORK: NavEntry[] = [
  { id: "payments", label: "Payments", icon: "peso" },
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "tasks", label: "Tasks", icon: "checkSquare", badge: "6" },
  { id: "relationship", label: "Relationship Mgmt", icon: "heart" },
];
const NAV_SYS: NavEntry[] = [
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "products", label: "Products", icon: "folder" },
  { id: "templates", label: "Email Templates", icon: "mail" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function BrandGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 15c2.5 0 2.5-2.2 5-2.2S11.5 15 14 15s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19c2.5 0 2.5-2.2 5-2.2S11.5 19 14 19s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M12 4.2 6.8 6.3v3.1c0 3.2 5.2 5 5.2 5s5.2-1.8 5.2-5V6.3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

function NavItem({ item, active }: { item: NavEntry; active: boolean }) {
  const Ico = I[item.icon];
  return (
    <Link
      href={SCREEN_PATH[item.id]}
      className={cn(
        "group relative mb-px flex h-[37px] items-center gap-[11px] rounded-sm px-[11px] text-[13.5px] font-[550] transition-colors",
        active
          ? "bg-brand-soft font-[650] text-brand-hover"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      <Ico size={18} className={cn("shrink-0", active ? "text-brand" : "text-subtle group-hover:text-muted-foreground")} />
      {item.label}
      {item.badge && (
        <span
          className={cn(
            "ml-auto grid h-[19px] min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold",
            active
              ? "bg-brand text-white"
              : item.alert
                ? "bg-red text-white"
                : "bg-surface-3 text-muted-foreground",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/** Collapsible nav group (design chrome.jsx NavSection) — default open. */
function NavSection({
  label,
  items,
  isActive,
}: {
  label: string;
  items: NavEntry[];
  isActive: (id: ScreenId) => boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between px-2.5 pb-1.5 pt-3.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint transition-colors hover:text-muted-foreground"
      >
        {label}
        <I.chevDown
          size={13}
          className={cn("transition-transform duration-150", !open && "-rotate-90")}
        />
      </button>
      {open && items.map((it) => <NavItem key={it.id} item={it} active={isActive(it.id)} />)}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (id: ScreenId) => {
    const p = SCREEN_PATH[id];
    return pathname === p || pathname.startsWith(p + "/");
  };

  return (
    <aside className="col-start-1 row-start-2 flex flex-col overflow-y-auto border-r border-border bg-sidebar px-3 pb-3.5 pt-2.5 max-[900px]:hidden">
      {NAV_MAIN.map((it) => (
        <NavItem key={it.id} item={it} active={isActive(it.id)} />
      ))}
      <NavSection label="Workspace" items={NAV_WORK} isActive={isActive} />
      <NavSection label="System" items={NAV_SYS} isActive={isActive} />

      <div className="mt-auto pt-3">
        <div className="rounded-md border border-green-border bg-gradient-to-br from-brand-soft to-card p-[13px]">
          <h5 className="mb-[3px] text-[12.5px] font-semibold">June close-out</h5>
          <p className="mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
            23 renewals and 14 applications still awaiting payment this cycle.
          </p>
          <Link href={SCREEN_PATH.renewals} className={cn(BTN_PRIMARY, "h-[30px] w-full rounded-sm px-2.5 text-[12.5px]")}>
            Review queue
          </Link>
        </div>
      </div>
    </aside>
  );
}

const NOTIF_TONE: Record<string, Tone> = { payment: "green", claim: "red", renewal: "amber", travel: "blue", doc: "slate" };
const NOTIF_ICON: Record<string, IconName> = { payment: "peso", claim: "clipboard", renewal: "refresh", travel: "plane", doc: "doc2" };

export function Topbar({
  dark,
  setDark,
  userName,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  userName: string;
  /** @deprecated display role now comes from the persona context. */
  userRole?: string;
}) {
  const [open, setOpen] = useState<null | "notif" | "profile">(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const wrapRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  // Global ⌘K / Ctrl-K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        overlays.openCommandPalette();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlays]);
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  const firstName = userName.split(" ")[0];

  return (
    <header
      ref={wrapRef}
      className="relative z-30 col-start-2 row-start-1 flex items-center gap-3.5 border-b border-border bg-surface px-5"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const term = search.trim();
          if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
        }}
        className="flex h-[38px] max-w-[460px] flex-1 items-center gap-2.5 rounded-md border border-transparent bg-surface-3 px-[13px] text-muted-foreground transition-colors focus-within:border-brand focus-within:bg-surface focus-within:ring-[3px] focus-within:ring-brand/20"
      >
        <I.search size={17} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients by name, email, mobile, reference…"
          className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-subtle"
        />
        <button
          type="button"
          onClick={() => overlays.openCommandPalette()}
          title="Command palette (⌘K)"
          className="rounded-[5px] border border-border bg-surface px-1.5 py-px text-[11px] font-semibold text-subtle transition-colors hover:text-foreground"
        >
          ⌘K
        </button>
      </form>
      <div className="flex-1" />

      <button onClick={() => overlays.openWizard()} className={cn(BTN_PRIMARY, "h-9 px-[13px] text-[13px]")}>
        <I.plus size={16} /> New application
      </button>

      <button
        onClick={() => setDark(!dark)}
        title="Toggle theme"
        className="grid size-[38px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
      >
        {dark ? <I.sun size={19} /> : <I.moon size={19} />}
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen(open === "notif" ? null : "notif")}
          className="relative grid size-[38px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <I.bell size={19} />
          {unread > 0 && (
            <span className="absolute right-[9px] top-2 size-[7px] rounded-full border-2 border-surface bg-red" />
          )}
        </button>
        {open === "notif" && (
          <div className="absolute right-0 top-[46px] w-[360px] overflow-hidden rounded-md border border-border bg-card shadow-pop">
            <div className="flex items-center justify-between border-b border-border-soft px-[15px] py-[13px]">
              <h4 className="text-[13.5px] font-[650]">Notifications</h4>
              <span className="text-[12.5px] font-semibold text-brand-hover">Mark all read</span>
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              {NOTIFICATIONS.map((n) => {
                const Ico = I[NOTIF_ICON[n.type]];
                return (
                  <div
                    key={n.id}
                    onClick={() => setOpen(null)}
                    className={cn(
                      "flex cursor-pointer gap-[11px] border-b border-border-soft px-[15px] py-3 transition-colors hover:bg-hover",
                      n.unread && "bg-brand-soft hover:bg-brand-soft-2",
                    )}
                  >
                    <div className={cn("grid size-8 shrink-0 place-items-center rounded-lg", TONE_SOFT[NOTIF_TONE[n.type]])}>
                      <Ico size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold leading-snug">{n.title}</div>
                      <div className="mt-0.5 text-[11px] text-subtle">{n.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen(open === "profile" ? null : "profile")}
          className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-hover"
        >
          <Avatar name={userName} size={30} />
          <span className="text-[13px] font-semibold tracking-[-0.01em] max-[900px]:hidden">{firstName}</span>
          <I.chevDown size={15} className="text-subtle" />
        </button>
        {open === "profile" && (
          <div className="absolute right-0 top-[50px] w-[258px] overflow-hidden rounded-md border border-border bg-card shadow-pop">
            <div className="flex items-center gap-[11px] border-b border-border-soft px-[15px] py-[13px]">
              <Avatar name={userName} size={38} />
              <div className="min-w-0">
                <div className="text-[13.5px] font-[650]">{userName}</div>
                <div className="text-[12px] text-subtle">{persona.roleLabel}</div>
              </div>
            </div>

            {persona.previewOptions.length > 1 && (
              <div className="border-b border-border-soft px-2 py-2">
                <div className="flex items-center justify-between px-2 pb-1.5 pt-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
                    View as
                  </span>
                  <span className="rounded-full bg-amber-soft px-2 py-px text-[10px] font-bold uppercase tracking-[0.04em] text-amber">
                    Preview
                  </span>
                </div>
                {persona.previewOptions.map((r: AppRole) => {
                  const on = r === persona.role;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        persona.setPreviewRole(r);
                        setOpen(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-sm px-2 py-[7px] text-left transition-colors",
                        on ? "bg-brand-soft" : "hover:bg-hover",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-[600]">{persona.labelFor(r)}</div>
                        <div className="text-[11px] text-subtle">
                          {r === persona.realRole ? "Your role" : "Preview a narrower role"}
                        </div>
                      </div>
                      {on && <I.check size={15} className="text-brand" />}
                    </button>
                  );
                })}
                <div className="px-2 pb-1 pt-1.5 text-[10.5px] leading-snug text-faint">
                  Preview only — narrows what you see; server permissions are unchanged.
                </div>
              </div>
            )}

            <div className="py-1.5">
              {[
                { icon: I.user, label: "My profile" },
                { icon: I.building, label: "Agency settings", href: SCREEN_PATH.settings },
                { icon: I.settings, label: "Preferences", href: SCREEN_PATH.settings },
                { icon: I.help, label: "Help & support" },
              ].map((m) => (
                <button
                  key={m.label}
                  onClick={() => {
                    setOpen(null);
                    if (m.href) router.push(m.href);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-[9px] text-[13px] font-[550] transition-colors hover:bg-hover"
                >
                  <m.icon size={16} className="text-subtle" />
                  {m.label}
                </button>
              ))}
              <div className="my-1 h-px bg-border-soft" />
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-3.5 py-[9px] text-[13px] font-[550] text-red transition-colors hover:bg-hover"
                >
                  <I.logout size={16} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
