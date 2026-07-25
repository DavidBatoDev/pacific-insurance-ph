"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ConfirmDialog, type ConfirmOptions } from "./modal";
import { ToastStack, type ToastData } from "./toast";

/**
 * App-wide overlay state. Replaces the prototype's window CustomEvents
 * (open-page-modal / open-engage / open-new-application / app-toast) with a
 * typed context: components call `useOverlays().openX(...)` and the
 * <OverlayHost> (rendered by the provider) mounts the matching portal.
 */

export type PageModalKind =
  | "new-lead"
  | "add-client"
  | "issue-policy"
  | "send-renewal-notice"
  | "file-claim"
  | "new-travel-quote"
  | "upload-document"
  | "advance-lead"
  | "add-member"
  | "request-proposal";

/** Contact context handed to composers/modals (resolved from real records). */
export interface EngageContact {
  clientId?: string;
  name: string;
  email?: string | null;
  product?: string | null;
  premium?: number | null;
}

export interface AdvanceLeadOverlay {
  clientId: string;
  name: string;
  referenceNo: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  stage: string;
  status: string;
  label: string;
}

export type OverlayState =
  | { kind: "page-modal"; modal: PageModalKind; prefill?: Record<string, unknown> }
  | { kind: "wizard"; prefill?: Record<string, unknown> }
  | { kind: "engage"; action: string; contact?: EngageContact; onSent?: () => void }
  | { kind: "advance-lead"; suggestion: AdvanceLeadOverlay }
  | { kind: "add-task"; prefill?: Record<string, unknown> }
  | { kind: "payment-links" }
  | { kind: "campaign"; presetType?: string }
  | { kind: "command-palette" };

interface OverlayApi {
  active: OverlayState | null;
  open: (overlay: OverlayState) => void;
  close: () => void;
  openPageModal: (modal: PageModalKind, prefill?: Record<string, unknown>) => void;
  openWizard: (prefill?: Record<string, unknown>) => void;
  openEngage: (action: string, contact?: EngageContact, onSent?: () => void) => void;
  openAdvanceLead: (suggestion: AdvanceLeadOverlay) => void;
  openAddTask: (prefill?: Record<string, unknown>) => void;
  openPaymentLinks: () => void;
  openCampaign: (presetType?: string) => void;
  openCommandPalette: () => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  toast: (title: string, sub?: string) => void;
}

const OverlayContext = createContext<OverlayApi | null>(null);

export function OverlayProvider({
  host: Host,
  children,
}: {
  /** Renders the active overlay — kept separate so screens phases can extend it. */
  host: React.ComponentType<{ overlay: OverlayState; close: () => void }>;
  children: ReactNode;
}) {
  const [active, setActive] = useState<OverlayState | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const toastSeq = useRef(0);

  const open = useCallback((overlay: OverlayState) => setActive(overlay), []);
  const close = useCallback(() => setActive(null), []);

  const toast = useCallback((title: string, sub?: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, title, sub }]);
  }, []);
  const dismissToast = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const api = useMemo<OverlayApi>(
    () => ({
      active,
      open,
      close,
      openPageModal: (modal, prefill) => open({ kind: "page-modal", modal, prefill }),
      openWizard: (prefill) => open({ kind: "wizard", prefill }),
      openEngage: (action, contact, onSent) => open({ kind: "engage", action, contact, onSent }),
      openAdvanceLead: (suggestion) => open({ kind: "advance-lead", suggestion }),
      openAddTask: (prefill) => open({ kind: "add-task", prefill }),
      openPaymentLinks: () => open({ kind: "payment-links" }),
      openCampaign: (presetType) => open({ kind: "campaign", presetType }),
      openCommandPalette: () => open({ kind: "command-palette" }),
      confirm,
      toast,
    }),
    [active, open, close, confirm, toast],
  );

  return (
    <OverlayContext.Provider value={api}>
      {children}
      {active && <Host overlay={active} close={close} />}
      {confirmState && (
        <ConfirmDialog
          options={confirmState.options}
          onResolve={(ok) => {
            confirmState.resolve(ok);
            setConfirmState(null);
          }}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </OverlayContext.Provider>
  );
}

export function useOverlays(): OverlayApi {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlays must be used inside <OverlayProvider>");
  return ctx;
}
