"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { I } from "@/components/hub/icons";
import { Card, PageHead, StatusBadge } from "@/components/hub/primitives";
import { ClientCell, Row, Table, Td, Th, useSort } from "@/components/hub/table";
import type { Client } from "@/lib/repositories/clients";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClientsList({
  clients,
  total,
  groupsByClient = {},
}: {
  clients: Client[];
  total: number;
  /** Group-account membership per client id (design screens.jsx group chip). */
  groupsByClient?: Record<string, { id: string; name: string }>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return clients;
    return clients.filter((c) =>
      [c.fullName, c.email, c.mobileNumber, c.referenceNo, c.leadSource]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(ql)),
    );
  }, [q, clients]);

  const { sorted, sort, toggle } = useSort(filtered, "createdAt", "desc");

  const vip = clients.filter((c) => c.vipStatus).length;
  const prospects = clients.filter((c) => c.clientType === "Prospect").length;

  const stats = [
    { val: total, label: "Total clients" },
    { val: prospects, label: "Prospects", color: "var(--blue)" },
    { val: vip, label: "VIP", color: "var(--amber)" },
  ];

  return (
    <div>
      <PageHead
        icon={I.users}
        title="Clients"
        sub={`${total} client${total === 1 ? "" : "s"} in the system`}
        draft={false}
        actions={
          <Link
            href="/clients/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-transparent bg-brand px-3.5 text-[13px] font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            <I.plus size={15} /> Add client
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-sm">
            <div
              className="text-[22px] font-[760] leading-none tracking-[-0.02em] tabular-nums"
              style={{ color: s.color }}
            >
              {s.val}
            </div>
            <div className="mt-1.5 text-[12.5px] font-[550] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-soft px-4 py-[13px]">
          <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3 text-muted-foreground focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20 sm:max-w-[320px]">
            <I.search size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, mobile, reference…"
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
              <Th label="Client" k="fullName" sort={sort} toggle={toggle} />
              <Th label="Reference" k="referenceNo" sort={sort} toggle={toggle} />
              <Th label="Mobile" k="mobileNumber" sort={sort} toggle={toggle} />
              <Th label="Type" k="clientType" sort={sort} toggle={toggle} />
              <Th label="Status" k="status" sort={sort} toggle={toggle} />
              <Th label="Added" k="createdAt" sort={sort} toggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <Row key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                <Td>
                  <div className="flex items-center gap-2">
                    <ClientCell name={c.fullName} sub={c.email ?? undefined} />
                    {groupsByClient[c.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/group/${groupsByClient[c.id].id}`);
                        }}
                        title={`Open group account — ${groupsByClient[c.id].name}`}
                        className="inline-flex h-[21px] max-w-[140px] items-center gap-1 truncate rounded-full border border-blue-border bg-blue-soft px-2 text-[11px] font-[650] text-blue transition-opacity hover:opacity-80"
                      >
                        <I.building size={11} className="shrink-0" />
                        <span className="truncate">{groupsByClient[c.id].name}</span>
                      </button>
                    )}
                  </div>
                </Td>
                <Td className="font-mono text-[12px] text-muted-foreground">{c.referenceNo}</Td>
                <Td className="text-muted-foreground">{c.mobileNumber ?? "—"}</Td>
                <Td className="text-muted-foreground">{c.clientType}</Td>
                <Td>
                  <StatusBadge status={c.status} />
                </Td>
                <Td className="text-muted-foreground">{fmtDate(c.createdAt)}</Td>
              </Row>
            ))}
            {sorted.length === 0 && (
              <tr>
                <Td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No clients found.{" "}
                  <Link href="/clients/new" className="font-semibold text-brand-hover hover:text-brand">
                    Add the first one.
                  </Link>
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
