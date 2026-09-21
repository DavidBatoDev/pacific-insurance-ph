-- A browser-rendered Word preview is an approximation: docx-preview implements
-- no floating images (wp:anchor), no VML shapes, and no legacy FORMTEXT fields,
-- which is most of what a carrier application form is made of. Storing a
-- LibreOffice-converted PDF beside the original lets the viewer show the real
-- document while Download still hands over the .docx staff have to fill in.
--
-- Nullable on purpose: a Word file uploaded through Settings has no companion
-- until the loader converts it, and PDFs never need one.
alter table public.document_library
  add column if not exists preview_path text;

comment on column public.document_library.preview_path is
  'Storage key of a PDF rendering of file_path, for previewing Word documents faithfully. Null when the asset is already a PDF or has not been converted.';
