import { Block, CardSkeleton } from "@/components/hub/skeleton";

/**
 * Mirrors the Contact Profile: back link, header card, then the identity /
 * composer + timeline / records columns, so nothing jumps when data lands.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading contact">
      <Block className="mb-3 h-4 w-20" />

      <div className="mb-4 flex items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <Block className="size-14 shrink-0 rounded-full" />
        <div className="flex-1">
          <Block className="h-6 w-56" />
          <Block className="mt-2.5 h-4 w-80 max-w-full" />
          <div className="mt-3 flex gap-2">
            <Block className="h-6 w-20 rounded-full" />
            <Block className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 max-[900px]:hidden">
          <Block className="h-8 w-24" />
          <Block className="h-8 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={6} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={2} />
        </div>
        <div className="col-span-6 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={6} />
        </div>
        <div className="col-span-3 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
