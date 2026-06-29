import Link from "next/link";

import { ClientForm } from "@/components/clients/client-form";
import { PageHead } from "@/components/hub/primitives";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clients" className="mb-3 inline-block text-[12.5px] font-semibold text-subtle hover:text-foreground">
        ← Clients
      </Link>
      <PageHead
        iconName="users"
        title="Add client"
        sub="Create a new client or prospect record"
        draft={false}
      />
      <ClientForm />
    </div>
  );
}
