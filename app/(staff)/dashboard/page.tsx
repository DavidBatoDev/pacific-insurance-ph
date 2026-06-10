import { Button } from "@/components/ui/button";
import { getClientsRepository } from "@/lib/repositories/clients";

// Render at request time, not at build — the data fetch needs live credentials.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let total: number | null = null;
  let error: string | null = null;

  try {
    total = (await getClientsRepository().list({ limit: 5 })).total;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground text-sm">
          Repository pattern smoke test — App &rarr; Repository &rarr; supabase-js
          (service role) &rarr; Postgres.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        {error ? (
          <div className="space-y-2">
            <p className="text-destructive text-sm font-medium">
              Supabase not reachable yet
            </p>
            <p className="text-muted-foreground text-xs">
              Fill <code>.env.local</code> with your hosted project credentials
              and create a <code>clients</code> table, then reload.
            </p>
            <p className="text-muted-foreground font-mono text-xs">{error}</p>
          </div>
        ) : (
          <p className="text-sm">
            <span className="text-2xl font-semibold">{total}</span> client
            record(s) found.
          </p>
        )}
      </div>

      <Button>Example shadcn/ui button</Button>
    </div>
  );
}
