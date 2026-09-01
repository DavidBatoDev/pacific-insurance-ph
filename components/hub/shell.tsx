"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/permissions";
import type { ShellStats } from "@/lib/queries/shell";
import { I, type IconName } from "./icons";
import { useOverlays } from "./overlays/overlay-provider";
import { SearchDropdown } from "./overlays/search-dropdown";
import { usePersona } from "./persona";
import { Avatar } from "./primitives";

export type ScreenId =
  | "dashboard" | "prospects" | "clients" | "applications" | "policies"
  | "renewals" | "claims" | "travel" | "payments" | "commissions" | "documents" | "tasks"
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
  commissions: "/commissions",
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
  { id: "prospects", label: "Leads", icon: "trendUp" },
  { id: "clients", label: "Clients", icon: "users" },
  { id: "applications", label: "Applications", icon: "fileText" },
  { id: "policies", label: "Policies", icon: "shield" },
  { id: "renewals", label: "Renewals", icon: "refresh", alert: true },
  { id: "claims", label: "Claims", icon: "clipboard" },
  { id: "travel", label: "Travel Insurance", icon: "plane" },
];
const NAV_WORK: NavEntry[] = [
  { id: "tasks", label: "Tasks", icon: "checkSquare" },
  { id: "payments", label: "Payments", icon: "peso" },
  { id: "commissions", label: "Commissions", icon: "chart" },
  { id: "documents", label: "Documents", icon: "folder" },
  { id: "relationship", label: "Relationship Mgmt", icon: "heart" },
];
const NAV_SYS: NavEntry[] = [
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "products", label: "Products", icon: "folder" },
  { id: "templates", label: "Email Templates", icon: "mail" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const COUNT_KEY: Partial<Record<ScreenId, keyof ShellStats>> = {
  prospects: "leads",
  clients: "clients",
  applications: "applications",
  renewals: "renewals",
  claims: "claims",
  travel: "travel",
  tasks: "tasks",
};

const compactCount = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function withLiveBadge(item: NavEntry, stats: ShellStats): NavEntry {
  const key = COUNT_KEY[item.id];
  const value = key ? stats[key] : null;
  return value != null && value > 0 ? { ...item, badge: compactCount.format(value) } : item;
}

export function BrandGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 15c2.5 0 2.5-2.2 5-2.2S11.5 15 14 15s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19c2.5 0 2.5-2.2 5-2.2S11.5 19 14 19s2.5-2.2 5-2.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M12 4.2 6.8 6.3v3.1c0 3.2 5.2 5 5.2 5s5.2-1.8 5.2-5V6.3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

function NavItem({
  item,
  active,
  collapsed = false,
}: {
  item: NavEntry;
  active: boolean;
  collapsed?: boolean;
}) {
  const Ico = I[item.icon];
  return (
    <Link
      href={SCREEN_PATH[item.id]}
      // On the rail the icon is the only label, so carry the name in the tooltip and
      // the accessible name instead of dropping it.
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group relative mb-px flex h-[37px] items-center rounded-sm text-[13.5px] font-[550] transition-colors",
        collapsed ? "justify-center px-0" : "gap-[11px] px-[11px]",
        active
          ? "bg-brand-soft font-[650] text-brand-hover"
          : "text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      <Ico size={18} className={cn("shrink-0", active ? "text-brand" : "text-subtle group-hover:text-muted-foreground")} />
      {!collapsed && item.label}
      {item.badge &&
        (collapsed ? (
          // No room for a count — keep only the fact that there is something waiting.
          <span
            aria-hidden
            className={cn(
              "absolute right-1.5 top-1.5 size-[7px] rounded-full ring-2 ring-sidebar",
              item.alert ? "bg-red" : active ? "bg-brand" : "bg-subtle",
            )}
          />
        ) : (
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
        ))}
    </Link>
  );
}

/** Collapsible nav group — default open. */
function NavSection({
  label,
  items,
  isActive,
  collapsed = false,
}: {
  label: string;
  items: NavEntry[];
  isActive: (id: ScreenId) => boolean;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(true);

  // A rail has no room for the group name, and a toggle whose label you can't read is a
  // trap — so the group becomes a plain divider and its items stay reachable.
  if (collapsed) {
    return (
      <>
        <div role="separator" aria-label={label} className="mx-2 my-1.5 h-px bg-border-soft" />
        {items.map((it) => (
          <NavItem key={it.id} item={it} active={isActive(it.id)} collapsed />
        ))}
      </>
    );
  }

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

/**
 * The nav itself — one definition for the docked sidebar, the desktop icon rail and the
 * mobile drawer. `collapsed` strips it to icons only.
 */
function SidebarNav({
  isActive,
  stats,
  collapsed = false,
}: {
  isActive: (id: ScreenId) => boolean;
  stats: ShellStats;
  collapsed?: boolean;
}) {
  const main = NAV_MAIN.map((item) => withLiveBadge(item, stats));
  const work = NAV_WORK.map((item) => withLiveBadge(item, stats));
  const workloadReady = stats.renewals != null && stats.applications != null;
  const renewalCount = stats.renewals ?? 0;
  const applicationCount = stats.applications ?? 0;
  const hasWork = renewalCount > 0 || applicationCount > 0;
  return (
    <>
      {main.map((it) => (
        <NavItem key={it.id} item={it} active={isActive(it.id)} collapsed={collapsed} />
      ))}
      <NavSection label="Workspace" items={work} isActive={isActive} collapsed={collapsed} />
      <NavSection label="System" items={NAV_SYS} isActive={isActive} collapsed={collapsed} />

      {/* Prose can't survive the icon rail; failed counts omit the card rather than showing zero. */}
      {workloadReady && (
        <div className={cn("mt-auto pt-3", collapsed && "hidden")}>
          <div className="rounded-md border border-green-border bg-gradient-to-br from-brand-soft to-card p-[13px]">
            <h5 className="mb-[3px] text-[12.5px] font-semibold">Current workload</h5>
            <p className="mb-2.5 text-[11.5px] leading-snug text-muted-foreground">
              {hasWork
                ? `${renewalCount} open renewal${renewalCount === 1 ? "" : "s"} and ${applicationCount} application${applicationCount === 1 ? "" : "s"} in progress.`
                : "No open renewals or applications right now."}
            </p>
            <Link href={SCREEN_PATH.dashboard} className={cn(BTN_PRIMARY, "h-[30px] w-full rounded-sm px-2.5 text-[12.5px]")}>
              Review dashboard
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Navigation in all three of its forms. On desktop it stays docked in the grid's first
 * column, which `collapsed` narrows to an icon-only rail. At ≤900px that column is 0-wide,
 * so the nav can only appear as an overlay drawer opened from the topbar burger — before
 * this, it was simply unreachable. All three render the same `SidebarNav`, so they can
 * never drift apart.
 */
export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onClose,
  stats,
}: {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
  stats: ShellStats;
}) {
  const pathname = usePathname();
  const isActive = (id: ScreenId) => {
    const p = SCREEN_PATH[id];
    return pathname === p || pathname.startsWith(p + "/");
  };

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  return (
    <>
      <aside
        className={cn(
          "col-start-1 row-start-2 flex flex-col overflow-y-auto border-r border-border bg-sidebar pb-3.5 pt-2.5 max-[900px]:hidden",
          collapsed ? "px-2" : "px-3",
        )}
      >
        <SidebarNav isActive={isActive} stats={stats} collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] min-[901px]:hidden">
          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            // Following a link is the drawer's whole purpose, so dismiss on link clicks —
            // but not on the section toggles, which are meant to be used in place.
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) onClose?.();
            }}
            className="absolute inset-y-0 left-0 flex w-[262px] max-w-[85vw] flex-col overflow-y-auto border-r border-border bg-sidebar px-3 pb-3.5 pt-2.5 shadow-pop"
          >
            {/* The desktop brand corner is hidden at this width, so the drawer carries it. */}
            <div className="mb-1.5 flex items-center gap-[11px] px-1">
              <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#10b981] to-[#047857] shadow-[0_2px_6px_rgba(4,120,87,0.35),inset_0_1px_0_rgba(255,255,255,0.25)]">
                <BrandGlyph size={19} />
              </div>
              <div className="flex flex-col leading-[1.05]">
                <b className="text-[15px] font-bold tracking-[-0.02em]">Pacific</b>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-subtle">
                  Insurance PH
                </span>
              </div>
              <button
                aria-label="Close navigation"
                onClick={onClose}
                className="ml-auto grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
              >
                <I.x size={17} />
              </button>
            </div>
            <SidebarNav isActive={isActive} stats={stats} />
          </div>
        </div>
      )}
    </>
  );
}

export function Topbar({
  dark,
  setDark,
  userName,
  navCollapsed = false,
  onToggleNav,
  onOpenNav,
}: {
  dark: boolean;
  setDark: (v: boolean) => void;
  userName: string;
  /** Desktop only — whether the docked sidebar column is currently emptied. */
  navCollapsed?: boolean;
  /** Desktop only — collapse/expand the docked sidebar. */
  onToggleNav?: () => void;
  /** ≤900px only — open the nav drawer. */
  onOpenNav?: () => void;
  /** @deprecated display role now comes from the persona context. */
  userRole?: string;
}) {
  const [open, setOpen] = useState<null | "notif" | "profile">(null);
  const [search, setSearch] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const dropKeysRef = useRef<((e: React.KeyboardEvent) => boolean) | null>(null);
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
  const firstName = userName.split(" ")[0];

  return (
    <header
      ref={wrapRef}
      className="relative z-30 col-start-2 row-start-1 flex items-center gap-3.5 border-b border-border bg-surface px-5"
    >
      {/* Two controls for the same nav, one per layout: the burger is the *only* way in
          below 900px, where the sidebar column has no width to occupy. */}
      <button
        aria-label="Open navigation"
        onClick={onOpenNav}
        className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground min-[901px]:hidden"
      >
        <I.menu size={19} />
      </button>
      <button
        aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!navCollapsed}
        onClick={onToggleNav}
        className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground max-[900px]:hidden"
      >
        <I.panelLeft size={18} />
      </button>

      <div className="relative max-w-[460px] flex-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const term = search.trim();
            if (term) {
              setDropOpen(false);
              router.push(`/search?q=${encodeURIComponent(term)}`);
            }
          }}
          className="flex h-[38px] items-center gap-2.5 rounded-md border border-transparent bg-surface-3 px-[13px] text-muted-foreground transition-colors focus-within:border-brand focus-within:bg-surface focus-within:ring-[3px] focus-within:ring-brand/20"
        >
          <I.search size={17} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDropOpen(true);
            }}
            onFocus={() => setDropOpen(true)}
            onBlur={() => setDropOpen(false)}
            onKeyDown={(e) => {
              // Results dropdown consumes ↑/↓/Enter/Escape while open.
              if (dropOpen && dropKeysRef.current?.(e)) e.preventDefault();
            }}
            placeholder="Search clients, policies, applications, claims…"
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
        {dropOpen && search.trim() && (
          <SearchDropdown
            term={search}
            onClose={() => setDropOpen(false)}
            bindKeys={(h) => (dropKeysRef.current = h)}
          />
        )}
      </div>
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
          aria-label="Open notifications"
          className="relative grid size-[38px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <I.bell size={19} />
        </button>
        {open === "notif" && (
          <div className="absolute right-0 top-[46px] w-[360px] overflow-hidden rounded-md border border-border bg-card shadow-pop">
            <div className="border-b border-border-soft px-[15px] py-[13px]">
              <h4 className="text-[13.5px] font-[650]">Notifications</h4>
            </div>
            <div className="px-[15px] py-8 text-center">
              <div className="mx-auto grid size-9 place-items-center rounded-full bg-surface-3 text-subtle">
                <I.bell size={17} />
              </div>
              <div className="mt-2.5 text-[12.5px] font-semibold">No notifications yet</div>
              <div className="mt-0.5 text-[11.5px] text-subtle">
                Updates will appear here when notifications are enabled.
              </div>
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
