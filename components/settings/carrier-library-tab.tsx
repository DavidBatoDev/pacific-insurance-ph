"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { beginLibraryUploadAction, discardLibraryUploadAction, finalizeLibraryUploadAction, setLibraryDocumentStateAction, updateLibraryDocumentAction } from "@/app/(app)/settings/actions";
import { I } from "@/components/hub/icons";
import { Modal } from "@/components/hub/overlays/modal";
import { useOverlays } from "@/components/hub/overlays/overlay-provider";
import { LIBRARY_AGE_BANDS, LIBRARY_DOCUMENT_TYPES, type LibraryDocument } from "@/lib/repositories/document-library/document-library.entity";
import type { CatalogProductVersion } from "@/lib/repositories/products/product.entity";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const INPUT = "h-9 w-full rounded-md border border-border-strong bg-card px-3 text-[13px] outline-none focus:border-brand";
type FormState = { productVersionId: string; documentName: string; documentType: string; versionLabel: string; variant: string; ageBand: string; effectiveDate: string; expiryDate: string; notes: string; distributionNotes: string };
const EMPTY: FormState = { productVersionId: "", documentName: "", documentType: "Brochure", versionLabel: "", variant: "", ageBand: "All Ages", effectiveDate: "", expiryDate: "", notes: "", distributionNotes: "" };

export function CarrierLibraryTab({ documents, productVersions }: { documents: LibraryDocument[]; productVersions: CatalogProductVersion[] }) {
  const router = useRouter(); const overlays = useOverlays();
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<LibraryDocument | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY); const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
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
    <div className="overflow-x-auto rounded-md border border-border-soft"><table className="w-full min-w-[880px] text-left text-[12px]"><thead><tr className="border-b border-border-soft text-[10.5px] uppercase tracking-[.05em] text-subtle">{["Asset","Product / variant","Version","Effective","Approval","Status",""] .map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead><tbody>{documents.map((doc) => <tr key={doc.id} className={cn("border-b border-border-soft last:border-0", doc.status === "Inactive" && "opacity-60")}><td className="px-3 py-2.5"><div className="font-semibold">{doc.documentName}</div><div className="text-[11px] text-subtle">{doc.documentType} · {doc.originalFileName}</div></td><td className="px-3 py-2.5">{doc.productName ?? "—"}<span className="block text-[11px] text-subtle">{[doc.variant, doc.ageBand].filter(Boolean).join(" · ")}</span></td><td className="px-3 py-2.5">{doc.versionLabel}</td><td className="px-3 py-2.5">{doc.effectiveDate ?? "Immediately"}<span className="block text-[11px] text-subtle">to {doc.expiryDate ?? "No expiry"}</span></td><td className="px-3 py-2.5">{doc.approvalStatus}</td><td className="px-3 py-2.5">{doc.status}</td><td className="px-3 py-2.5 text-right"><div className="flex justify-end gap-2"><a href={`/api/document-library/${doc.id}/download`} className="font-semibold text-brand-hover">Review</a><button onClick={() => edit(doc)} className="font-semibold text-brand-hover">Edit</button>{doc.approvalStatus !== "Approved" && doc.status === "Active" && <button onClick={() => operate(doc,"approve")} className="font-semibold text-brand-hover">Approve</button>}{doc.status === "Active" && <button onClick={() => operate(doc,"archive")} className="font-semibold text-red">Archive</button>}</div></td></tr>)}{documents.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No carrier assets yet. Distribution clearance is required before uploading supplied files.</td></tr>}</tbody></table></div>
    {open && <Modal onClose={close} maxWidth={680}><h3 className="mb-4 text-[16px] font-bold">{editing ? "Edit library asset" : "Upload library asset"}</h3><div className="grid grid-cols-2 gap-3">
      {!editing && <label className="col-span-2 text-[11px] font-bold uppercase text-subtle">File<input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5 block w-full text-[13px]" /></label>}
      <label className="text-[11px] font-bold uppercase text-subtle">Product version<select className={`${INPUT} mt-1.5 font-normal normal-case`} value={form.productVersionId} disabled={!!editing} onChange={(e) => set("productVersionId",e.target.value)}><option value="">Select…</option>{productVersions.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.productName} · {v.versionName}</option>)}</select></label>
      <label className="text-[11px] font-bold uppercase text-subtle">Document type<select disabled={editing?.approvalStatus === "Approved"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form.documentType} onChange={(e) => set("documentType",e.target.value)}>{LIBRARY_DOCUMENT_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label>
      {([['documentName','Document name'],['versionLabel','Version label'],['variant','Form variant'],['effectiveDate','Effective date'],['expiryDate','Expiry date']] as const).map(([key,label]) => <label key={key} className="text-[11px] font-bold uppercase text-subtle">{label}<input disabled={editing?.approvalStatus === "Approved" && !key.includes("Date")} type={key.includes("Date") ? "date" : "text"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form[key]} onChange={(e) => set(key,e.target.value)} /></label>)}
      <label className="text-[11px] font-bold uppercase text-subtle">Age band<select disabled={editing?.approvalStatus === "Approved"} className={`${INPUT} mt-1.5 font-normal normal-case disabled:opacity-60`} value={form.ageBand} onChange={(e) => set("ageBand",e.target.value)}>{LIBRARY_AGE_BANDS.map((v) => <option key={v}>{v}</option>)}</select></label>
      <label className="col-span-2 text-[11px] font-bold uppercase text-subtle">Distribution / approval note<textarea className="mt-1.5 min-h-20 w-full rounded-md border border-border-strong p-3 text-[13px] font-normal normal-case" value={form.distributionNotes} onChange={(e) => set("distributionNotes",e.target.value)} /></label>
    </div><div className="mt-5 flex justify-end gap-2"><button onClick={close} className="rounded-md border px-3 py-2 text-[13px]">Cancel</button><button disabled={pending || !form.productVersionId || !form.documentName.trim() || !form.versionLabel.trim() || (!editing && !file)} onClick={save} className="rounded-md bg-brand px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : editing ? "Save changes" : "Upload for review"}</button></div></Modal>}
  </div>;
}
