"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { I } from "../../icons";
import { Card, CardHead } from "../../primitives";
import type { IconName } from "../../icons";

/**
 * Card with a row list and a +-that-rotates-45° toggle revealing an entry
 * panel. The panel is hidden rather than unmounted so half-typed input (or a
 * chosen file in an uncontrolled input) survives a toggle.
 */
export function CollapsibleListCard({
  iconName,
  title,
  count,
  open,
  onToggle,
  openLabel,
  closedLabel,
  children,
  panel,
  panelClassName,
}: {
  iconName: IconName;
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** aria-label while the panel is open (e.g. "Hide the add form"). */
  openLabel: string;
  /** aria-label while the panel is closed (e.g. "Add a record"). */
  closedLabel: string;
  /** The row list (and empty state). */
  children: ReactNode;
  /** The entry panel, kept mounted and hidden while closed. */
  panel: ReactNode;
  panelClassName?: string;
}) {
  return (
    <Card>
      <CardHead
        iconName={iconName}
        title={title}
        count={count}
        action={
          <button
            aria-label={open ? openLabel : closedLabel}
            aria-expanded={open}
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            <I.plus size={16} className={cn("transition-transform", open && "rotate-45")} />
          </button>
        }
      />
      {children}
      <div className={cn("border-t border-border-soft", !open && "hidden", panelClassName)}>{panel}</div>
    </Card>
  );
}
