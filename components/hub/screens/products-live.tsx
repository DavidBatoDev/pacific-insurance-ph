"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/(app)/products/actions";
import type { CatalogProduct } from "@/lib/repositories/products/product.entity";
import { PRODUCT_CATEGORIES } from "@/lib/repositories/products/product.entity";
import { cn } from "@/lib/utils";
import { I, type IconName } from "../icons";
import { DRAWER_INPUT, DrawerField } from "../overlays/client-picker";
import { Drawer } from "../overlays/drawer";
import { useOverlays } from "../overlays/overlay-provider";
import { usePersona } from "../persona";
import { Btn, Card, PageHead } from "../primitives";

/**
 * Products — system-configuration catalog (design products.jsx §13), wired to
 * the products table. Categories are the fixed DB taxonomy; Admin gets full
 * CRUD, Staff/Agent are view-only; deletes are guarded by linked records.
 */

const CATEGORY_META: Record<string, { icon: IconName; color: string }> = {
  "Primary Medical": { icon: "shield", color: "#059669" },
  "Group Medical": { icon: "building", color: "#2563eb" },
  "Second-Layer Medical": { icon: "heart", color: "#7c3aed" },
  "Travel Insurance": { icon: "plane", color: "#d97706" },
  Other: { icon: "folder", color: "#64748b" },
};

export function ProductsLive({
  products,
  usage,
}: {
  products: CatalogProduct[];
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const overlays = useOverlays();
  const persona = usePersona();
  const canEdit = persona.can("products", "edit");
  const canDelete = persona.can("products", "delete");
  const [, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [drawer, setDrawer] = useState<CatalogProduct | "new" | null>(null);

  const filtered = useMemo(() => {
    let list = products;
    if (catFilter !== "all") list = list.filter((p) => (p.category ?? "Other") === catFilter);
    if (statusFilter !== "all") list = list.filter((p) => (statusFilter === "Active" ? p.active : !p.active));
    if (q.trim()) {
      const ql = q.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(ql) || (p.description ?? "").toLowerCase().includes(ql),
      );
    }
    return list;
  }, [products, catFilter, statusFilter, q]);

  const grouped = catFilter === "all" && statusFilter === "all" && !q.trim();
  const activeCount = products.filter((p) => p.active).length;
  const categories = [...new Set(products.map((p) => p.category ?? "Other"))];

  const toggleActive = async (p: CatalogProduct) => {
    const linked = usage[p.id] ?? 0;
    const ok = await overlays.confirm({
      kind: linked > 0 ? "warn" : "danger",
      title: p.active ? `Deactivate “${p.name}”?` : `Reactivate “${p.name}”?`,
      message: p.active
        ? linked > 0
          ? `This product is linked to ${linked} record${linked === 1 ? "" : "s"}. It will be hidden from new records but stays visible in historical data.`
          : "This product will no longer appear as a selectable option in new records."
        : "This product will become selectable again across all modules.",
      confirmLabel: p.active ? "Deactivate" : "Reactivate",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await updateProductAction(p.id, { active: !p.active });
      if (res.ok) overlays.toast(p.active ? "Product deactivated" : "Product reactivated", `“${p.name}”.`);
      else overlays.toast("Couldn’t update product", res.error);
      router.refresh();
    });
  };

  const remove = async (p: CatalogProduct) => {
    const linked = usage[p.id] ?? 0;
    if (linked > 0) {
      const deactivate = await overlays.confirm({
        kind: "warn",
        title: "Cannot delete — product in use",
        message: `“${p.name}” is linked to ${linked} record${linked === 1 ? "" : "s"}. To preserve historical data, deactivate it instead.`,
        confirmLabel: "Deactivate instead",
      });
      if (deactivate)
        startTransition(async () => {
          await updateProductAction(p.id, { active: false });
          router.refresh();
        });
      return;
    }
    const ok = await overlays.confirm({
      kind: "danger",
      title: `Delete “${p.name}”?`,
      message: "This product has no linked records and will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete permanently",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteProductAction(p.id);
      if (res.ok) overlays.toast("Product deleted", `“${p.name}” removed from the catalog.`);
      else overlays.toast("Couldn’t delete product", res.error);
      router.refresh();
    });
  };

  const rowActions = (p: CatalogProduct) =>
    canEdit && (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <IconBtn title="Edit" onClick={() => setDrawer(p)} icon="edit" />
        <IconBtn title={p.active ? "Deactivate" : "Reactivate"} onClick={() => toggleActive(p)} icon="refresh" />
        {canDelete && <IconBtn title="Delete" danger onClick={() => remove(p)} icon="fileMissing" />}
      </div>
    );

  const table = (rows: CatalogProduct[], showCategory: boolean) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border-soft text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
            <th className="px-4 py-2.5">Product</th>
            {showCategory && <th className="px-4 py-2.5">Category</th>}
            <th className="px-4 py-2.5">Provider</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Linked</th>
            {canEdit && <th className="px-4 py-2.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const meta = CATEGORY_META[p.category ?? "Other"] ?? CATEGORY_META.Other;
            return (
              <tr
                key={p.id}
                onClick={() => canEdit && setDrawer(p)}
                className={cn(
                  "border-b border-border-soft transition-colors last:border-0 hover:bg-hover",
                  canEdit && "cursor-pointer",
                  !p.active && "opacity-60",
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="text-[13px] font-[650]">{p.name}</div>
                  <div className="max-w-[360px] truncate text-[11.5px] text-subtle">{p.description ?? "—"}</div>
                </td>
                {showCategory && (
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-[550]">
                      <span className="size-2 rounded-[2px]" style={{ background: meta.color }} />
                      {p.category ?? "Other"}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2.5 text-muted-foreground">{p.provider ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-[650]",
                      p.active ? "border-green-border bg-green-soft text-green" : "border-transparent bg-slate-soft text-slate",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{usage[p.id] ?? 0}</td>
                {canEdit && <td className="px-4 py-2.5">{rowActions(p)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <PageHead
        iconName="folder"
        title="Products"
        draft={false}
        sub="Master catalog of insurance products used across leads, policies, claims, payments & reports."
        actions={
          canEdit ? (
            <Btn variant="primary" onClick={() => setDrawer("new")}>
              <I.plus size={15} /> New product
            </Btn>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-md border border-border bg-card px-4 py-3 text-[12.5px] text-muted-foreground">
        <I.shield size={16} className={cn("mt-px shrink-0", canEdit ? "text-blue" : "text-amber")} />
        {canEdit ? (
          <span>
            You&apos;re signed in as <b>{persona.userName} · {persona.roleLabel}</b> with full edit access.
            Staff and agents can view products but cannot edit them.
          </span>
        ) : (
          <span>
            Viewing as <b>{persona.userName} · {persona.roleLabel}</b> — <b>view-only</b> access. Product
            create, edit and delete are reserved for Admins.
          </span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3 max-[900px]:grid-cols-2">
        {[
          { val: categories.length, label: "Categories" },
          { val: products.length, label: "Total products" },
          { val: activeCount, label: "Active", cls: "text-brand" },
          { val: products.length - activeCount, label: "Inactive", cls: "text-subtle" },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-border bg-card px-4 py-3">
            <div className={cn("text-[19px] font-bold tabular-nums", s.cls)}>{s.val}</div>
            <div className="text-[11.5px] font-semibold text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex h-9 min-w-[200px] items-center gap-2.5 rounded-md border border-border-strong bg-card px-3 text-muted-foreground focus-within:border-brand sm:max-w-[280px]">
          <I.search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle"
          />
        </div>
        <select className={SEL} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="all">All categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className={SEL} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[12.5px] font-semibold text-subtle">
            {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center rounded-md border border-border bg-surface-3 p-0.5">
            {(["table", "cards"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={v === "table" ? "Table view" : "Card view"}
                className={cn(
                  "grid size-7 place-items-center rounded-[6px] transition-colors",
                  view === v ? "bg-card shadow-xs" : "text-muted-foreground",
                )}
              >
                {v === "table" ? <I.grid size={15} /> : <I.folder size={15} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-surface-3 text-muted-foreground">
            <I.folder size={24} />
          </div>
          <h2 className="text-[15px] font-bold">No products found</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {q || catFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Get started by adding your first product to the catalog."}
          </p>
        </Card>
      ) : grouped && view === "table" ? (
        categories.map((cat) => {
          const rows = filtered.filter((p) => (p.category ?? "Other") === cat);
          if (!rows.length) return null;
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.Other;
          const CatIco = I[meta.icon];
          return (
            <Card key={cat} className="mb-4 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border-soft px-[18px] py-3.5">
                <span className="grid size-9 place-items-center rounded-[9px]" style={{ background: meta.color + "1e", color: meta.color }}>
                  <CatIco size={18} />
                </span>
                <div className="flex-1">
                  <div className="text-[14px] font-[650]">{cat}</div>
                  <div className="text-[11.5px] text-subtle">
                    {rows.length} product{rows.length === 1 ? "" : "s"} · {rows.filter((p) => p.active).length} active
                  </div>
                </div>
              </div>
              {table(rows, false)}
            </Card>
          );
        })
      ) : view === "table" ? (
        <Card className="overflow-hidden">{table(filtered, true)}</Card>
      ) : (
        <div className="grid grid-cols-3 gap-4 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          {filtered.map((p) => {
            const meta = CATEGORY_META[p.category ?? "Other"] ?? CATEGORY_META.Other;
            return (
              <Card key={p.id} className={cn("p-4", !p.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-[650]">{p.name}</div>
                    <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: meta.color }}>
                      {p.category ?? "Other"}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-[650]",
                      p.active ? "border-green-border bg-green-soft text-green" : "border-transparent bg-slate-soft text-slate",
                    )}
                  >
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[36px] text-[12.5px] text-muted-foreground">{p.description ?? "—"}</p>
                <div className="mt-3 flex items-center justify-between border-t border-border-soft pt-3">
                  <span className="text-[11.5px] text-subtle">
                    {(usage[p.id] ?? 0)} linked record{(usage[p.id] ?? 0) === 1 ? "" : "s"}
                  </span>
                  {rowActions(p)}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {drawer && (
        <ProductDrawer
          product={drawer === "new" ? null : drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

const SEL =
  "h-9 rounded-md border border-border-strong bg-card px-2.5 text-[12.5px] outline-none focus:border-brand";

function IconBtn({
  title,
  onClick,
  icon,
  danger,
}: {
  title: string;
  onClick: () => void;
  icon: IconName;
  danger?: boolean;
}) {
  const Ico = I[icon];
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-hover",
        danger && "hover:text-red",
      )}
    >
      <Ico size={15} />
    </button>
  );
}

function ProductDrawer({
  product,
  onClose,
  onSaved,
}: {
  product: CatalogProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const overlays = useOverlays();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "Primary Medical");
  const [description, setDescription] = useState(product?.description ?? "");
  const [active, setActive] = useState(product?.active ?? true);

  const save = () =>
    startTransition(async () => {
      const res = product
        ? await updateProductAction(product.id, { name, category, description, active })
        : await createProductAction({ name, category, description, active });
      if (res.ok) {
        overlays.toast(product ? "Product saved" : "Product created", `“${res.data.name}”.`);
        onSaved();
        onClose();
      } else {
        overlays.toast("Couldn’t save product", res.error);
      }
    });

  return (
    <Drawer
      icon="fileText"
      title={product ? "Edit product" : "New product"}
      sub={product ? "Update product configuration" : "Add a product to the master catalog"}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!name.trim() || pending} onClick={save}>
            {pending ? "Saving…" : product ? "Save changes" : "Create product"}
          </Btn>
        </>
      }
    >
      <DrawerField label="Product name" required>
        <input autoFocus className={DRAWER_INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Royale" />
      </DrawerField>
      <DrawerField label="Category" required className="mt-4">
        <select className={DRAWER_INPUT} value={category ?? "Other"} onChange={(e) => setCategory(e.target.value)}>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </DrawerField>
      <DrawerField label="Short description" className="mt-4">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-border-strong bg-card px-3 py-2 text-[13px] outline-none focus:border-brand"
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One-line summary shown across the platform"
        />
      </DrawerField>
      <div className="mt-4 flex items-center justify-between rounded-md border border-border-soft bg-surface-2 px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-[600]">{active ? "Active" : "Inactive"}</div>
          <div className="text-[11.5px] text-subtle">
            Inactive products are hidden from new records but stay in historical data.
          </div>
        </div>
        <button
          onClick={() => setActive(!active)}
          className={cn("relative h-[22px] w-[40px] rounded-full transition-colors", active ? "bg-brand" : "bg-border-strong")}
        >
          <span className={cn("absolute top-[2px] size-[18px] rounded-full bg-white shadow-sm transition-all", active ? "left-[20px]" : "left-[2px]")} />
        </button>
      </div>
    </Drawer>
  );
}
