/** Pulsing placeholder blocks for route `loading.tsx` files. */
export function Block({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-3 ${className ?? ""}`} />;
}

export function CardSkeleton({ rows, className }: { rows: number; className?: string }) {
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
