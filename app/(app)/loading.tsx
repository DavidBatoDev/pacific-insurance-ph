import { Block } from "@/components/hub/skeleton";

/**
 * Fallback for every (app) route without its own loading.tsx. Every page is
 * force-dynamic, so without a boundary a click waits on the full server render
 * with no sign it registered. Shaped like the list screens most routes are.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <Block className="h-7 w-52" />
          <Block className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Block className="h-9 w-28 max-[680px]:hidden" />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 max-[680px]:grid-cols-1">
        {Array.from({ length: 3 }, (_, i) => (
          <Block key={i} className="h-[66px]" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border-soft px-4 py-[13px]">
          <Block className="h-9 w-full max-w-[320px]" />
          <Block className="ml-auto h-4 w-16" />
        </div>
        <div className="flex flex-col gap-3.5 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Block key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
