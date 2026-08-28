import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DocumentsList } from "@/components/documents/documents-list";
import { Card, PageHead } from "@/components/hub/primitives";
import { listDocumentsWithClient } from "@/lib/queries/documents-list";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { items, total } = await listDocumentsWithClient(200);

  return (
    <div>
      <PageHead
        iconName="folder"
        title="Documents"
        sub={`${total} document${total === 1 ? "" : "s"} in the repository`}
      />

      <Card className="mb-4 p-4">
        <h3 className="mb-3 text-[13.5px] font-[650]">Upload a document</h3>
        <DocumentUploadForm />
      </Card>

      <DocumentsList items={items} total={total} />
    </div>
  );
}
