"use client";

import { useEffect, useRef, useState } from "react";

import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";

/**
 * Debounced client search shared by the client pickers. The effect only ever
 * writes state from the async callback; an empty query derives an empty list
 * instead of clearing state (react-hooks/set-state-in-effect).
 */
export function useClientSearch(q: string): PaletteClientHit[] {
  const [result, setResult] = useState<{ term: string; rows: PaletteClientHit[] }>({ term: "", rows: [] });
  const seq = useRef(0);
  const term = q.trim();

  useEffect(() => {
    if (!term) return;
    const mySeq = ++seq.current;
    const t = setTimeout(() => {
      searchClientsForPalette(term)
        .then((rows) => {
          if (seq.current === mySeq) setResult({ term, rows: rows.slice(0, 5) });
        })
        .catch(() => {
          if (seq.current === mySeq) setResult({ term, rows: [] });
        });
    }, 160);
    return () => clearTimeout(t);
  }, [term]);

  return term ? result.rows : [];
}
