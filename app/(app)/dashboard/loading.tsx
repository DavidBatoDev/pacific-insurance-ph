/**
 * The dashboard is force-dynamic and fans out seven queries, so without a
 * boundary the router sits on the previous screen with no sign it is working.
 * This mirrors the real composition — header, alerts, KPIs, revenue, then the
 * queue column beside the rail — so the layout does not jump when data lands.
 */
function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-3 ${className ?? ""}`} />;
}

function CardSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card shadow-sm ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-soft px-[18px] py-[15px]">
        <Block className="h-4 w-44" />
        <Block className="h-3.5 w-16" />
      </div>
      <div className="flex flex-col gap-3.5 p-[18px]">
        {Array.from({ length: rows }, (_, i) => (
          <Block key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="mb-[18px]">
        <Block className="h-7 w-64" />
        <Block className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="mb-[18px] grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[680px]:grid-cols-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} className="h-[66px]" />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-6 gap-3.5 max-[1200px]:grid-cols-3 max-[680px]:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Block key={i} className="h-[164px]" />
        ))}
      </div>

      <Block className="mb-4 h-[132px]" />

      <div className="grid grid-cols-12 gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={6} />
          <CardSkeleton rows={6} />
          <div className="grid grid-cols-1 gap-4 min-[1700px]:grid-cols-2">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={7} />
          <CardSkeleton rows={4} />
          <CardSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
