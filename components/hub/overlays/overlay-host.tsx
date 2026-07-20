"use client";

import { Modal } from "./modal";
import { Btn } from "../primitives";
import { AddTaskDrawer, type AddTaskPrefill } from "./add-task";
import { CommandPalette } from "./command-palette";
import { EngageDrawer } from "./engage";
import { FileClaimDrawer } from "./file-claim";
import { IssuePolicyDrawer } from "./issue-policy";
import { NewLeadDrawer } from "./new-lead";
import { NewTravelQuoteDrawer } from "./new-travel-quote";
import type { OverlayState } from "./overlay-provider";

/**
 * Renders the active overlay for the app. Each build phase extends the switch
 * below as its drawers/modals are implemented; kinds not yet wired fall back
 * to a small placeholder dialog so triggers can ship ahead of their overlay.
 */
export function OverlayHost({
  overlay,
  close,
}: {
  overlay: OverlayState;
  close: () => void;
}) {
  switch (overlay.kind) {
    case "command-palette":
      return <CommandPalette onClose={close} />;
    case "add-task":
      return <AddTaskDrawer prefill={overlay.prefill as AddTaskPrefill | undefined} onClose={close} />;
    case "engage":
      return (
        <EngageDrawer
          action={overlay.action}
          contact={overlay.contact}
          onSent={overlay.onSent}
          onClose={close}
        />
      );
    case "page-modal":
      if (overlay.modal === "new-lead") return <NewLeadDrawer onClose={close} />;
      if (overlay.modal === "issue-policy") return <IssuePolicyDrawer onClose={close} />;
      if (overlay.modal === "file-claim") return <FileClaimDrawer onClose={close} />;
      if (overlay.modal === "new-travel-quote") return <NewTravelQuoteDrawer onClose={close} />;
      return <ComingSoon overlay={overlay} onClose={close} />;
    default:
      return <ComingSoon overlay={overlay} onClose={close} />;
  }
}

const LABEL: Record<OverlayState["kind"], string> = {
  "page-modal": "This form",
  wizard: "The New Application wizard",
  engage: "The Engage composer",
  "add-task": "The Add Task drawer",
  "payment-links": "The Send Payment Links drawer",
  campaign: "The New Campaign drawer",
  "command-palette": "The command palette",
};

function ComingSoon({ overlay, onClose }: { overlay: OverlayState; onClose: () => void }) {
  const what =
    overlay.kind === "page-modal" ? `The “${overlay.modal}” form` : LABEL[overlay.kind];
  return (
    <Modal onClose={onClose}>
      <div className="text-center">
        <h3 className="text-[15px] font-bold tracking-[-0.01em]">Coming in a later build phase</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {what} is part of the design sync but hasn&apos;t been wired to live data yet.
        </p>
        <div className="mt-5 flex justify-center">
          <Btn variant="primary" onClick={onClose}>
            Got it
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
