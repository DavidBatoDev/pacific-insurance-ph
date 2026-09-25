"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { beginLibraryUploadAction, discardLibraryUploadAction, finalizeLibraryUploadAction, setLibraryDocumentStateAction, updateLibraryDocumentAction } from "@/app/(app)/settings/actions";
import { I } from "@/components/hub/icons";
import { INPUT, SEL } from "@/components/hub/primitives";
import { DocumentViewer } from "@/components/hub/overlays/document-viewer";
import { Modal } from "@/components/hub/overlays/modal";
import { useOverlays } from "@/components/hub/overlays/overlay-provider";
import { LIBRARY_AGE_BANDS, LIBRARY_DOCUMENT_TYPES, type LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import { fmtDate } from "@/lib/format";
import type { CatalogProductVersion } from "@/lib/repositories/products/product.entity";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";


type FormState = { productVersionId: string; documentName: string; documentType: string; versionLabel: string; variant: string; ageBand: string; effectiveDate: string; expiryDate: string; notes: string; distributionNotes: string };
const EMPTY: FormState = { productVersionId: "", documentName: "", documentType: "Brochure", versionLabel: "", variant: "", ageBand: "All Ages", effectiveDate: "", expiryDate: "", notes: "", distributionNotes: "" };
// The upload action only ever accepts .pdf/.doc/.docx/.xlsx, so these four MIME values are exhaustive.
const FILE_TYPES: Record<string, string> = { "application/pdf": "PDF", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)", "application/msword": "Word (.doc)", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)" };
const DATE_CELL = "h-7 w-[122px] rounded-sm bg-transparent px-1 text-[12px] text-foreground outline-none transition-colors hover:bg-hover focus:bg-hover focus:text-foreground"; // borderless: the wrapper owns the border, matching the search field beside it

export function CarrierLibraryTab({ documents, productVersions }: { documents: LibraryDocument[]; productVersions: CatalogProductVersion[] }) {
  const router = useRouter(); const overlays = useOverlays();
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<LibraryDocument | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY); const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  // Deliberately separate from `open`/`editing`, and keyed by id rather than the row:
  // `operate()` refreshes after approve/archive, so re-deriving keeps the viewer's
  // approval pill live and self-closes it if the row disappears.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = previewId ? documents.find((d) => d.id === previewId) ?? null : null;
  const [q, setQ] = useState(""); const [productF, setProductF] = useState(""); const [typeF, setTypeF] = useState("");
  const [fileF, setFileF] = useState(""); const [fromF, setFromF] = useState(""); const [toF, setToF] = useState("");
  const filtersOn = !!(q || productF || typeF || fileF || fromF || toF);
  const clear = () => { setQ(""); setProductF(""); setTypeF(""); setFileF(""); setFromF(""); setToF(""); };
  // Options come from the rows themselves, not the catalog: only products/types that actually have assets are selectable.
  const productOptions = useMemo(() => [...new Set(documents.map((d) => d.productName).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b)), [documents]);
  const typeOptions = useMemo(() => LIBRARY_DOCUMENT_TYPES.filter((t) => documents.some((d) => d.documentType === t)), [documents]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((doc) => {
      if (needle && ![doc.documentName, doc.documentType, doc.originalFileName, doc.productName, doc.productVersionName, doc.versionLabel, doc.variant].some((v) => v?.toLowerCase().includes(needle))) return false;
      if (productF && doc.productName !== productF) return false;
      if (typeF && doc.documentType !== typeF) return false;
      if (fileF && doc.mimeType !== fileF) return false;
      // Deliberate and load-bearing: a date range asks "what took effect in this window", and an asset with no
      // effective date on record (the table shows it as "Immediately") has no answer, so it drops out of any
      // date-bounded view rather than surfacing in every one. Undated rows are the majority of the library today,
      // so the rule is symmetric — either bound excludes them — instead of silently hiding half the table on one side.
      if ((fromF || toF) && !doc.effectiveDate) return false;
      if (fromF && doc.effectiveDate && doc.effectiveDate < fromF) return false;
      if (toF && doc.effectiveDate && doc.effectiveDate > toF) return false;
      return true;
    });
  }, [documents, q, productF, typeF, fileF, fromF, toF]);
  const set = (key: keyof FormState, value: string) => setForm((state) => ({ ...state, [key]: value }));
  const close = () => { setOpen(false); setEditing(null); setFile(null); setForm(EMPTY); };
  const edit = (doc: LibraryDocument) => { setEditing(doc); setForm({ productVersionId: doc.productVersionId ?? "", documentName: doc.documentName, documentType: doc.documentType ?? "Brochure", versionLabel: doc.versionLabel, variant: doc.variant ?? "", ageBand: doc.ageBand, effectiveDate: doc.effectiveDate ?? "", expiryDate: doc.expiryDate ?? "", notes: doc.notes ?? "", distributionNotes: doc.distributionNotes ?? "" }); setOpen(true); };
  const metadata = (f: File, mimeType: string) => ({ ...form, variant: form.variant || null, effectiveDate: form.effectiveDate || null, expiryDate: form.expiryDate || null, notes: form.notes || null, distributionNotes: form.distributionNotes || null, originalFileName: f.name, mimeType, fileSizeBytes: f.size });
  const save = () => startTransition(async () => {
    if (editing) {
      const result = await updateLibraryDocumentAction(editing.id, { documentName: form.documentName, documentType: form.documentType, versionLabel: form.versionLabel, variant: form.variant || null, ageBand: form.ageBand, effectiveDate: form.effectiveDate || null, expiryDate: form.expiryDate || null, notes: form.notes || null, distributionNotes: form.distributionNotes || null });
      if (!result.ok) return overlays.toast("Couldn’t update asset", result.error);
    } else {
      if (!file) return overlays.toast("Choose a file", "PDF, DOC, or DOCX up to 25 MB.");
      const begin = await beginLibraryUploadAction({ fileName: file.name, mimeType: file.type, size: file.size });
      if (!begin.ok) return overlays.toast("Couldn’t upload asset", begin.error);
      const upload = await getSupabaseBrowser().storage.from("documents").uploadToSignedUrl(begin.data.path, begin.data.token, file, { contentType: begin.data.mimeType });
      if (upload.error) return overlays.toast("Couldn’t upload asset", upload.error.message);
      const finish = await finalizeLibraryUploadAction(begin.data.path, metadata(file, begin.data.mimeType));
      if (!finish.ok) {
        await discardLibraryUploadAction(begin.data.path);
        return overlays.toast("Couldn’t save asset", finish.error);
      }
    }
    overlays.toast(editing ? "Library asset updated" : "Library asset uploaded", editing ? "Metadata saved." : "Review and approve it before staff can select it.");
    close(); router.refresh();
  });
  const operate = (doc: LibraryDocument, operation: "approve" | "archive") => startTransition(async () => {
    const result = await setLibraryDocumentStateAction(doc.id, operation);
    overlays.toast(result.ok ? `Asset ${operation === "approve" ? "approved" : "archived"}` : `Couldn’t ${operation} asset`, result.ok ? result.data.documentName : result.error);
    router.refresh();
  });
  return <div>
    <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-[15px] font-bold">Carrier document library</h3><p className="mt-1 text-[12.5px] text-muted-foreground">Approved, versioned Pacific Cross originals. Uploads stay private and pending until reviewed.</p></div><button onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-2 text-[12.5px] font-semibold text-white"><I.upload size={14} className="mr-1 inline" /> Upload asset</button></div>
    <div className="mb-4 rounded-md border border-amber-border bg-amber-soft px-4 py-3 text-[12.5px] text-amber"><b>No email delivery yet.</b> Selecting a library asset records the intended attachment; neither the email nor binary is transmitted.</div>
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="flex h-9 min-w-[200px] items-center gap-2.5 rounded-md border border-border-strong bg-surface px-3 text-muted-foreground focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20 sm:max-w-[280px]"><I.search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library assets…" className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-subtle" /></div>
      <select aria-label="Filter by product" className={SEL} value={productF} onChange={(e) => setProductF(e.target.value)}><option value="">All products</option>{productOptions.map((p) => <option key={p}>{p}</option>)}</select>
      <select aria-label="Filter by document type" className={SEL} value={typeF} onChange={(e) => setTypeF(e.target.value)}><option value="">All types</option>{typeOptions.map((t) => <option key={t}>{t}</option>)}</select>
      <select aria-label="Filter by file type" className={SEL} value={fileF} onChange={(e) => setFileF(e.target.value)}><option value="">All files</option>{Object.entries(FILE_TYPES).map(([mime, label]) => <option key={mime} value={mime}>{label}</option>)}</select>
      <div className="flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 text-subtle focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/20"><I.calendar size={14} /><span className="text-[11px] font-bold uppercase tracking-[.04em]">Effective</span><input type="date" aria-label="Effective from" value={fromF} onChange={(e) => setFromF(e.target.value)} className={DATE_CELL} /><I.arrowRight size={13} className="text-faint" /><input type="date" aria-label="Effective to" value={toF} onChange={(e) => setToF(e.target.value)} className={DATE_CELL} /></div>
      {filtersOn && <button type="button" onClick={clear} className="text-[12px] font-semibold text-brand-hover hover:text-brand">Clear filters</button>}
      <span className="ml-auto whitespace-nowrap text-[12.5px] font-semibold text-subtle">{filtered.length} of {documents.length}</span>
    </div>
    <div className="overflow-x-auto rounded-md border border-border-soft"><table className="w-full min-w-[880px] text-left text-[12px]"><thead><tr className="border-b border-border-soft text-[10.5px] uppercase tracking-[.05em] text-subtle">{["Asset","Product / variant","Version","Effective","Approval","Status",""] .map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead><tbody>{filtered.map((doc) => <tr key={doc.id} className={cn("border-b border-border-soft last:border-0", doc.status === "Inactive" && "opacity-60")}><td className="px-3 py-2.5"><div className="font-semibold">{doc.documentName}</div><div className="text-[11px] text-subtle">{doc.documentType} · {doc.originalFileName}</div></td><td className="px-3 py-2.5">{doc.productName ?? "—"}<span className="block text-[11px] text-subtle">{[doc.variant, doc.ageBand].filter(Boolean).join(" · ")}</span></td><td className="px-3 py-2.5">{doc.versionLabel}</td><td className="px-3 py-2.5">{doc.effectiveDate ?? "Immediately"}<span className="block text-[11px] text-subtle">to {doc.expiryDate ?? "No expiry"}</span></td><td className="px-3 py-2.5">{doc.approvalStatus}</td><td className="px-3 py-2.5">{doc.status}</td><td className="px-3 py-2.5 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => setPreviewId(doc.id)} className="font-semibold text-brand-hover">Review</button><button onClick={() => edit(doc)} className="font-semibold text-brand-hover">Edit</button>{doc.approvalStatus !== "Approved" && doc.status === "Active" && <button onClick={() => operate(doc,"approve")} className="font-semibold text-brand-hover">Approve</button>}{doc.status === "Active" && <button onClick={() => operate(doc,"archive")} className="font-semibold text-red">Archive</button>}</div></td></tr>)}{filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{documents.length === 0 ? "No carrier assets yet. Distribution clearance is required before uploading supplied files." : <>No assets match these filters. <button type="button" onClick={clear} className="font-semibold text-brand-hover hover:text-brand">Clear filters</button></>}</td></tr>}</tbody></table></div>
    {open && <Modal onClose={close} maxWidth={680}><h3 className="mb-4 text-[16px] font-bold">{editing ? "Edit library asset" : "Upload library asset"}</h3><div className="grid grid-cols-2 gap-3">
      {!editing && <label className="col-span-2 text-[11px] font-bold uppercase text-subtle">File<input type="file" accept=".pdf,.doc,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-[13px]" /></label>}
      <label className="text-[11px] font-bold uppercase text-subtle">Product version<select className={`${INPUT} mt-1.5 font-normal normal-case`} value={form.productVersionId} disabled={!!editing} onChange={(e) => set("productVersionId",e.target.value)}><option value="">Select…</option>{productVersions.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.versionName}</option>)}</select></label>
      <label className="text-[11px] font-bold uppercase text-subtle">Document type<select disabled={editing?.approvalStatus === "Approved"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form.documentType} onChange={(e) => set("documentType",e.target.value)}>{LIBRARY_DOCUMENT_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label>
      {([['documentName','Document name'],['versionLabel','Version label'],['variant','Form variant'],['effectiveDate','Effective date'],['expiryDate','Expiry date']] as const).map(([key,label]) => <label key={key} className="text-[11px] font-bold uppercase text-subtle">{label}<input disabled={editing?.approvalStatus === "Approved" && !key.includes("Date")} type={key.includes("Date") ? "date" : "text"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form[key]} onChange={(e) => set(key,e.target.value)} /></label>)}
      <label className="text-[11px] font-bold uppercase text-subtle">Age band<select disabled={editing?.approvalStatus === "Approved"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form.ageBand} onChange={(e) => set("ageBand",e.target.value)}>{LIBRARY_AGE_BANDS.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="col-span-2 text-[11px] font-bold uppercase text-subtle">Distribution / approval note<textarea className="mt-1.5 min-h-20 w-full rounded-md border border-border-strong p-3 text-[13px] font-normal normal-case" value={form.distributionNotes} onChange={(e) => set("distributionNotes",e.target.value)} /></label>
    </div><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-md border px-3 py-2 text-[13px]">Cancel</button><button disabled={pending || !form.productVersionId || !form.documentName.trim() || !form.versionLabel.trim() || (!editing && !file)} onClick={save} className="rounded-md bg-brand px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : editing ? "Save changes" : "Upload for review"}</button></div></Modal>}
    {preview && <DocumentViewer
      src={`/api/document-library/${preview.id}/preview`}
      downloadHref={`/api/document-library/${preview.id}/download`}
      fileName={preview.originalFileName}
      mimeType={preview.mimeType}
      fileSizeBytes={preview.fileSizeBytes}
      previewIsPdf={!!preview.previewPath}
      title={preview.documentName}
      subtitle={preview.documentType}
      meta={[
        { label: "Product", value: [preview.productName, preview.productVersionName].filter(Boolean).join(" · ") || "—" },
        { label: "Version", value: preview.versionLabel },
        { label: "Variant", value: [preview.variant, preview.ageBand].filter(Boolean).join(" · ") || "—" },
        { label: "Effective", value: `${preview.effectiveDate ? fmtDate(preview.effectiveDate) : "Immediately"} → ${preview.expiryDate ? fmtDate(preview.expiryDate) : "No expiry"}` },
      ]}
      pills={[
        { label: preview.approvalStatus, tone: preview.approvalStatus === "Approved" ? "green" : preview.approvalStatus === "Rejected" ? "red" : "amber" },
        { label: preview.status, tone: preview.status === "Active" ? "green" : "slate" },
      ]}
      onClose={() => setPreviewId(null)}
    />}
  </div>;
}
