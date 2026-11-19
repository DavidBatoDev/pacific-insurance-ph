"use client";

import type { ReactNode } from "react";

import { I } from "../icons";
import { useRecordNav } from "../nav";
import { Row, Table, Th, useSort } from "../table";

export interface QueueColumn<T> {
  k: keyof T;
  label: string;
  num?: boolean;
}

/**
 * One dashboard work queue's table: top-N rows, sortable columns, row click opens the
 * contact. The dashboard's tab strip names the queue and links to its full screen; the
 * four queues differ only in this config.
 */
export function QueueTable<T extends { id: string; clientId: string }>({
  rows,
  slice,
  columns,
  defaultSort,
  renderRow,
  empty,
}: {
  rows: T[];
  slice: number;
  columns: QueueColumn<T>[];
  defaultSort: { key: keyof T; dir: "asc" | "desc" };
  renderRow: (row: T) => ReactNode;
  /** Shown in place of the table body when the queue is clear. */
  empty: string;
}) {
  const top = rows.slice(0, slice);
  const { sorted, sort, toggle } = useSort(top, defaultSort.key, defaultSort.dir);
  const { openContact, prefetchContact } = useRecordNav();
  if (sorted.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-[18px] py-[22px] text-[12.5px] text-subtle">
        <I.check size={15} className="shrink-0 text-green" />
        {empty}
      </div>
    );
  }
  return (
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
          <Row key={row.id} onClick={() => openContact(row.clientId)} onMouseEnter={() => prefetchContact(row.clientId)}>
            {renderRow(row)}
          </Row>
        ))}
      </tbody>
    </Table>
  );
}
