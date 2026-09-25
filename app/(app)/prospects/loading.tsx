import { Block } from "@/components/hub/skeleton";

/** Mirrors the Prospects board: header, six KPI tiles, then the six stage columns. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading prospects">
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <Block className="h-7 w-56" />
          <Block className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Block className="h-9 w-32 max-[680px]:hidden" />
      </div>

      <div className="mb-4 grid grid-cols-6 gap-3 max-[1200px]:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Block key={i} className="h-[92px]" />
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1080px] grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, col) => (
            <div key={col} className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-2 p-2.5">
              <Block className="h-5 w-24" />
              {Array.from({ length: 3 - (col % 2) }, (_, i) => (
                <Block key={i} className="h-[88px] w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
