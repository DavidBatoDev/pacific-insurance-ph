"use client";

import { useEffect, useRef, useState } from "react";

import { searchClientsForPalette, type PaletteClientHit } from "@/app/(app)/search/actions";

/**
 * Debounced client search shared by the client pickers. The effect only ever
 * writes state from the async callback; an empty query derives an empty list
 * instead of clearing state (react-hooks/set-state-in-effect). Rows are returned
 * only for the term they answer, so a pending search never shows (and never lets
 * staff pick from) the previous query's results.
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

  return term && result.term === term ? result.rows : [];
}
