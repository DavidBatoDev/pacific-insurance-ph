"use client";

import { useMemo, useState } from "react";

import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { I } from "@/components/hub/icons";
import { Card, Pill } from "@/components/hub/primitives";
import { Row, Table, Td, Th, useSort } from "@/components/hub/table";
import type { Tone } from "@/components/hub/tone";
import type { DocumentListItem } from "@/lib/queries/documents-list";

const VIS_TONE: Record<string, Tone> = {
  "Client Visible": "green",
  "Staff Only": "blue",
  "Internal Only": "slate",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DocumentsList({ items, total }: { items: DocumentListItem[]; total: number }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return items;
    return items.filter((d) =>
      [d.name, d.documentType, d.clientName, d.referenceNo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(ql)),
    );
  }, [q, items]);

  const { sorted, sort, toggle } = useSort(filtered, "createdAt", "desc");

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-4 py-[13px]">
        <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3 text-muted-foreground focus-within:border-brand sm:max-w-[320px]">
          <I.search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents…"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
          />
        </div>
        <span className="ml-auto whitespace-nowrap text-[12.5px] font-semibold text-subtle">
          {sorted.length} of {total}
        </span>
      </div>

      <Table>
        <thead>
          <tr>
            <Th label="Document" k="name" sort={sort} toggle={toggle} />
            <Th label="Type" k="documentType" sort={sort} toggle={toggle} />
            <Th label="Client" k="clientName" sort={sort} toggle={toggle} />
            <Th label="Visibility" k="visibility" sort={sort} toggle={toggle} />
            <Th label="Status" k="status" sort={sort} toggle={toggle} />
            <Th label="Uploaded" k="createdAt" sort={sort} toggle={toggle} />
            <th className="border-b border-border-soft bg-surface px-[18px] py-[9px]" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <Row key={d.id} className="cursor-default hover:bg-transparent">
              <Td>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-surface-3 text-muted-foreground">
                    <I.doc2 size={15} />
                  </span>
                  <span className="text-[12.5px] font-semibold">{d.name}</span>
                </div>
              </Td>
              <Td className="text-muted-foreground">{d.documentType ?? "—"}</Td>
              <Td className="text-muted-foreground">{d.clientName ?? "—"}</Td>
              <Td>
                <Pill tone={VIS_TONE[d.visibility] ?? "slate"}>{d.visibility}</Pill>
              </Td>
              <Td className="text-muted-foreground">{d.status}</Td>
              <Td className="text-muted-foreground">{fmtDate(d.createdAt)}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-hover hover:bg-hover hover:text-brand"
                  >
                    <I.download size={13} /> Download
                  </a>
                  <form
                    action={deleteDocumentAction}
                    onSubmit={(e) => {
                      if (!confirm("Delete this document?")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-md px-2 py-1 text-[12px] font-semibold text-subtle hover:bg-hover hover:text-red"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </Td>
            </Row>
          ))}
          {sorted.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-12 text-center text-muted-foreground">
                No documents yet. Upload one above.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}
