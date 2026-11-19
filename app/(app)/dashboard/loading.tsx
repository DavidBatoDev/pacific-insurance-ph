import { Block, CardSkeleton } from "@/components/hub/skeleton";

/**
 * The dashboard is force-dynamic and fans out seven queries, so without a
 * boundary the router sits on the previous screen with no sign it is working.
 * This mirrors the real composition — header, the at-a-glance card, revenue,
 * then the tabbed work queues and activity beside tasks and relationships — so
 * the layout does not jump when data lands.
 */

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="mb-[18px]">
        <Block className="h-7 w-64" />
        <Block className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <Block className="mb-4 h-[116px]" />
      <Block className="mb-4 h-[132px]" />

      <div className="grid grid-cols-12 items-start gap-4 max-[1200px]:grid-cols-1">
        <div className="col-span-8 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={6} />
          <CardSkeleton rows={6} />
        </div>
        <div className="col-span-4 flex flex-col gap-4 max-[1200px]:col-span-1">
          <CardSkeleton rows={7} />
          <CardSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
