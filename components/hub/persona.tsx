"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  can as canFor,
  narrowerOrEqual,
  toAppRole,
  type AppRole,
  type PermAction,
  type PermModule,
} from "@/lib/auth/permissions";

/**
 * "View as" persona preview (design chrome: profile menu → View as · Preview).
 *
 * The signed-in user's REAL role comes from the server. The preview lets them
 * see the app as a narrower role (e.g. an Admin previewing Staff) — it only
 * ever narrows the effective role, is persisted in localStorage (`pi_persona`),
 * and never affects real auth or server-side checks.
 */

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin · Owner",
  staff: "Staff · Broker",
  agent: "Agent",
};

interface PersonaValue {
  userName: string;
  /** Role resolved from the authenticated users row. */
  realRole: AppRole;
  /** Preview-narrowed role that drives UI gating. */
  role: AppRole;
  roleLabel: string;
  /** Roles offered by the "View as" switcher (real role first). */
  previewOptions: AppRole[];
  setPreviewRole: (r: AppRole) => void;
  isPreviewing: boolean;
  can: (module: PermModule, action: PermAction) => boolean;
  labelFor: (r: AppRole) => string;
}

const PersonaContext = createContext<PersonaValue | null>(null);

export function PersonaProvider({
  userName,
  userRole,
  children,
}: {
  userName: string;
  /** Raw `users.role` value from the DB (Owner/Admin/Assistant/Viewer). */
  userRole: string;
  children: ReactNode;
}) {
  const realRole = toAppRole(userRole);
  const [preview, setPreview] = useState<AppRole>(realRole);

  // Restore a saved preview on mount; ignore anything broader than the real role.
  useEffect(() => {
    const saved = localStorage.getItem("pi_persona") as AppRole | null;
    if (saved && saved !== realRole && narrowerOrEqual(saved, realRole)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe preview restore
      setPreview(saved);
    }
  }, [realRole]);

  const setPreviewRole = useCallback(
    (r: AppRole) => {
      if (!narrowerOrEqual(r, realRole)) return; // never widen
      setPreview(r);
      localStorage.setItem("pi_persona", r);
    },
    [realRole],
  );

  const value = useMemo<PersonaValue>(() => {
    const role = narrowerOrEqual(preview, realRole) ? preview : realRole;
    const previewOptions = (["admin", "staff", "agent"] as AppRole[]).filter((r) =>
      narrowerOrEqual(r, realRole),
    );
    return {
      userName,
      realRole,
      role,
      roleLabel: ROLE_LABEL[role],
      previewOptions,
      setPreviewRole,
      isPreviewing: role !== realRole,
      can: (module, action) => canFor(role, module, action),
      labelFor: (r) => ROLE_LABEL[r],
    };
  }, [preview, realRole, setPreviewRole, userName]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona(): PersonaValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside <PersonaProvider>");
  return ctx;
}
