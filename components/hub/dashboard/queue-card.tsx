"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { I } from "../icons";
import { useRecordNav } from "../nav";
import { Card, CardHead } from "../primitives";
import { CardLink } from "../primitives";
import { Row, Table, Th, useSort } from "../table";
import type { ScreenId } from "../shell";

export interface QueueColumn<T> {
  k: keyof T;
  label: string;
  num?: boolean;
}

/**
 * A dashboard work queue: top-N rows, sortable columns, row click opens the
 * contact, "View all" jumps to the full screen. The four queues differ only
 * in this config.
 */
export function QueueCard<T extends { id: string; clientId: string }>({
  icon,
  title,
  count,
  screen,
  setScreen,
  rows,
  slice,
  columns,
  defaultSort,
  renderRow,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;
  rows: T[];
  slice: number;
  columns: QueueColumn<T>[];
  defaultSort: { key: keyof T; dir: "asc" | "desc" };
  renderRow: (row: T) => ReactNode;
}) {
  const top = rows.slice(0, slice);
  const { sorted, sort, toggle } = useSort(top, defaultSort.key, defaultSort.dir);
  const { openContact } = useRecordNav();
  return (
    <Card>
      <CardHead
        icon={icon}
        title={title}
        count={count}
        action={
          <CardLink onClick={() => setScreen(screen)}>
            View all <I.chevRight size={13} />
          </CardLink>
        }
      />
      <Table>
        <thead>
          <tr>
            {columns.map((c) => (
              <Th key={String(c.k)} label={c.label} k={c.k} sort={sort} toggle={toggle} num={c.num} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <Row key={row.id} onClick={() => openContact(row.clientId)}>
              {renderRow(row)}
            </Row>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
