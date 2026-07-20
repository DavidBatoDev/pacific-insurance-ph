import { PageHead } from "@/components/hub/primitives";

/** Group Account detail — wired in build phase P9. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageHead
      iconName="building"
      title="Group Account"
      sub={`Group ${id} — company-level account view arrives in an upcoming build phase.`}
    />
  );
}
