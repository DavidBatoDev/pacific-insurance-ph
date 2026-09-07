"use client";

import { useEffect, useId, useRef, useState } from "react";

import { fileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { I } from "../icons";
import { Pill } from "../primitives";
import { Modal } from "./modal";

/**
 * Reads a stored document in place instead of handing it to the browser.
 *
 * Source-agnostic on purpose — it takes URLs rather than a library row, so the
 * client-documents module can reuse it once that side grows a preview route.
 *
 * Three tiers, because the library is mostly Word: PDFs go to the browser's own
 * viewer, .docx is rendered by docx-preview, and the legacy .doc binary format
 * (no browser library reads it) gets an honest card rather than a broken frame.
 */

export interface ViewerMeta {
  label: string;
  value: string;
}

type Tier = "pdf" | "docx" | "unsupported";
type Load = { k: "loading" } | { k: "ready" } | { k: "error"; message: string };

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SESSION_EXPIRED = "Your session expired. Refresh the page and try again.";
const UNREADABLE = "Couldn’t load this document. It may have been removed from storage.";
const NOT_RENDERABLE = "This Word file couldn’t be rendered in the browser. Download it to open in Word.";

/** Fixed stops rather than free zooming: a Word page only reads well at a few sizes. */
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * docx-preview writes document-authored markup into the DOM. Text can't inject
 * — it builds nodes with createElement/textContent — but hyperlink targets are
 * carried through verbatim, so a `javascript:` href in a malicious .docx would
 * become a clickable script URL on our origin. Files here are admin-uploaded and
 * admin-approved, so the realistic case is a bad carrier file uploaded in good
 * faith; this closes it for the price of a loop. (A sandboxed iframe would need
 * the library loaded into the child document and a postMessage bridge, for a
 * threat that already requires admin access.)
 */
function hardenLinks(host: HTMLElement) {
  for (const anchor of host.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (!/^(https?:|mailto:|#)/i.test(href)) {
      anchor.removeAttribute("href");
    } else {
      anchor.setAttribute("rel", "noopener noreferrer nofollow");
      anchor.setAttribute("target", "_blank");
    }
  }
}

export function DocumentViewer({
  src,
  downloadHref,
  fileName,
  mimeType,
  fileSizeBytes,
  previewIsPdf = false,
  title,
  subtitle,
  meta = [],
  pills = [],
  onClose,
}: {
  /** Same-origin URL serving the bytes with an inline disposition. */
  src: string;
  downloadHref: string;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  /** The preview URL serves a PDF rendering, so show it in the PDF tier whatever the source is. */
  previewIsPdf?: boolean;
  title: string;
  subtitle?: string | null;
  meta?: ViewerMeta[];
  pills?: { label: string; tone: "green" | "amber" | "red" | "blue" | "violet" | "slate" }[];
  onClose: () => void;
}) {
  const titleId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [load, setLoad] = useState<Load>({ k: "loading" });
  const [zoom, setZoom] = useState(1);
  // The src the current zoom belongs to. Reopening the modal on a different
  // document has to start at 100%, and this project's react-hooks rules reject a
  // setState in an effect body — so the reset happens during render, the pattern
  // React documents for adjusting state when a prop changes. React re-runs the
  // component before committing, so no frame is painted at the stale zoom.
  const [zoomedSrc, setZoomedSrc] = useState(src);
  if (zoomedSrc !== src) {
    setZoomedSrc(src);
    setZoom(1);
  }

  const zoomIndex = ZOOM_STEPS.indexOf(zoom);
  const stepZoom = (delta: number) =>
    setZoom((z) => {
      const next = ZOOM_STEPS.indexOf(z) + delta;
      return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, next))];
    });

  // Derived, never stored: MIME first, extension as tiebreak, because the upload
  // action trusts the browser-reported type before falling back to the extension,
  // so a .docx can be stored as msword.
  const ext = (fileName ?? src).split(".").pop()?.toLowerCase();
  const tier: Tier =
    // A rendered companion outranks the source type: the browser cannot show
    // Word faithfully, so when a PDF of it exists that is what gets displayed.
    previewIsPdf || mimeType === "application/pdf" || ext === "pdf" ? "pdf"
    : mimeType === DOCX_MIME || ext === "docx" ? "docx"
    : "unsupported";

  // Focus: enter on the close button, restore to whatever opened us (the row's
  // Review button). Refs only — no setState, so this stays clean under the
  // project's react-hooks rules.
  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => restore?.focus?.();
  }, []);

  useEffect(() => {
    if (tier !== "docx") return;
    const host = hostRef.current;
    if (!host) return;
    let alive = true;

    // Every setState below sits after an await, inside the async body — never in
    // the effect's synchronous body, which the lint rejects.
    (async () => {
      try {
        const res = await fetch(src, { credentials: "same-origin" });
        // The proxy matches /api/*, so an expired session 307s to /login and
        // fetch follows it: a 200 whose body is a login page. Without this the
        // zip reader gets HTML and reports a corrupt document.
        if (res.redirected) throw new Error("session");
        if (!res.ok) throw new Error(String(res.status));
        const buffer = await res.arrayBuffer();
        if (!alive) return;
        // "PK" — a .docx is a zip. Turns an unreadable-archive stack trace into
        // the legacy-.doc card when a file is mislabelled.
        const signature = new Uint8Array(buffer, 0, 2);
        if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
          setLoad({ k: "error", message: NOT_RENDERABLE });
          return;
        }
        // Loaded here and nowhere else: a top-level import would pull the
        // library and its zip dependency into the main bundle for every screen.
        const { renderAsync } = await import("docx-preview");
        if (!alive) return;
        await renderAsync(buffer, host, host, {
          className: "pcdocx",
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          renderAltChunks: false,
          renderChanges: false,
          renderComments: false,
        });
        if (!alive) return;
        hardenLinks(host);
        setLoad({ k: "ready" });
      } catch (e) {
        if (!alive) return;
        setLoad({
          k: "error",
          message: e instanceof Error && e.message === "session" ? SESSION_EXPIRED
            : e instanceof Error && /^\d+$/.test(e.message) ? UNREADABLE
            : NOT_RENDERABLE,
        });
      }
    })();

    return () => {
      alive = false;
      // docx-preview owns this element's children; clear them so a reopen starts
      // fresh and its injected <style> tags don't accumulate.
      host.replaceChildren();
    };
  }, [tier, src]);

  /** Excludes the sentinels themselves — without that they focus each other forever. */
  const focusables = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>(
        'a[href]:not([data-sentinel]), button:not([disabled]):not([data-sentinel]), iframe, [tabindex]:not([tabindex="-1"]):not([data-sentinel])',
      ) ?? [],
    );

  return (
    <Modal onClose={onClose} maxWidth={1100}>
      <div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {/* Sentinels wrap focus at each end. They work even when focus sits
            inside the PDF iframe, which a document-level guard would not. */}
        <span data-sentinel tabIndex={0} onFocus={() => focusables().at(-1)?.focus()} />

        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand-hover">
            <I.fileText size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-[16px] font-bold leading-snug tracking-[-0.01em]">
              {title}
            </h3>
            {/* Status and actions share a row so the title gets the full width and
                the caption stays one unbroken line. The pill container is rendered
                even when empty — justify-between then still parks the actions right. */}
            <div className="mt-1 flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {pills.map((p) => (
                  <Pill key={p.label} tone={p.tone} size="sm" dot>
                    {p.label}
                  </Pill>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={downloadHref}
                  className="inline-flex h-[30px] items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold transition-colors hover:border-faint hover:bg-hover"
                >
                  <I.download size={14} /> Download
                </a>
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[30px] items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold transition-colors hover:border-faint hover:bg-hover"
                >
                  <I.arrowUpRight size={14} /> New tab
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close document viewer"
                  className="grid size-[30px] place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                >
                  <I.x size={17} />
                </button>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-subtle">
              {subtitle && <span>{subtitle}</span>}
              {subtitle && <span aria-hidden>·</span>}
              <span className="font-mono text-[11.5px]">{fileName ?? "—"}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{fileSize(fileSizeBytes)}</span>
            </div>
          </div>
        </div>

        {/* Label over value, not label-space-value: inline pairs read as a run-on
            sentence because the gap between pairs outweighs the one inside them. */}
        {meta.length > 0 && (
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2.5 border-t border-border-soft pt-3">
            {meta.map((m) => (
              <div key={m.label}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{m.label}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-snug text-foreground">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* The height must be explicit. The modal card is flex-col with only a
            max-height, so a descendant's h-full resolves to auto and an iframe
            would collapse to its 150px intrinsic default. overflow-auto rather
            than overflow-y because the modal body is deliberately
            overflow-x-hidden, which would clip a landscape page instead of
            letting it scroll. */}
        <div
          className={cn(
            "relative mt-3.5 h-[calc(100vh-17rem)] min-h-[380px] rounded-md border border-border-soft bg-surface-2",
            tier === "docx" && "docx-stage overflow-auto",
            tier !== "docx" && "overflow-hidden",
          )}
        >
          {tier === "pdf" && (
            /* iframe, not embed/object: it takes a real accessible name and a
               usable load event. No sandbox — without allow-scripts
               allow-same-origin it blanks Chromium's PDF viewer, and the body is
               same-origin with an allowlisted content type anyway. */
            <iframe
              src={src}
              title={`${title} — document preview`}
              className="h-full w-full border-0 bg-white"
              onLoad={() => setLoad({ k: "ready" })}
            />
          )}

          {/* CSS `zoom`, not `transform: scale()` — zoom participates in layout, so
              the stage's scrollbars keep matching the scaled page. A transform would
              leave the scroll extent at the unscaled size and need manual
              width/height compensation. */}
          {tier === "docx" && <div ref={hostRef} style={{ zoom }} />}

          {tier === "docx" && (
            /* Over a white document page, so it carries its own card surface. */
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-md border border-border-strong bg-card/95 p-0.5 shadow-pop backdrop-blur-sm">
              <button
                type="button"
                onClick={() => stepZoom(-1)}
                disabled={zoomIndex <= 0}
                aria-label="Zoom out"
                className="grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <I.minus size={14} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom to 100%"
                title="Reset zoom to 100%"
                className="h-7 min-w-[46px] rounded-sm px-1 text-[11.5px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => stepZoom(1)}
                disabled={zoomIndex >= ZOOM_STEPS.length - 1}
                aria-label="Zoom in"
                className="grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <I.plus size={14} />
              </button>
            </div>
          )}

          {tier === "unsupported" && (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="max-w-[380px]">
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-soft text-slate">
                  <I.fileMissing size={22} />
                </span>
                <div className="text-[14px] font-bold">Preview not available for this format</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  Legacy Word documents (the 1997–2003 <span className="font-mono text-[11.5px]">.doc</span>{" "}
                  format) can’t be rendered in a browser. Download it to open in Word.
                </p>
              </div>
            </div>
          )}

          {tier === "docx" && load.k === "loading" && (
            <div className="absolute inset-0 grid place-items-center bg-surface-2 text-[13px] text-muted-foreground">
              Loading document…
            </div>
          )}

          {tier === "docx" && load.k === "error" && (
            <div className="absolute inset-0 grid place-items-center bg-surface-2 px-6 text-center">
              <div className="max-w-[380px]">
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-soft text-red">
                  <I.alertTri size={22} />
                </span>
                <div className="text-[14px] font-bold">Couldn’t show this document</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{load.message}</p>
                <a
                  href={downloadHref}
                  className="mt-3.5 inline-flex h-[30px] items-center justify-center gap-1.5 rounded-sm border border-border-strong bg-card px-2.5 text-[12.5px] font-semibold hover:bg-hover"
                >
                  <I.download size={14} /> Download instead
                </a>
              </div>
            </div>
          )}
        </div>

        {tier === "pdf" && (
          <p className="mt-2 text-[11.5px] text-faint">
            {previewIsPdf
              ? "Rendered from the Word original for viewing. Download gives you the editable file."
              : "Not rendering? Open it in a new tab or download it."}
          </p>
        )}
        {tier === "docx" && load.k === "ready" && (
          <p className="mt-2 text-[11.5px] text-faint">
            Approximate preview — positioned images, text boxes and form-field shading are not
            reproduced in the browser. Download for the exact document.
          </p>
        )}

        <span data-sentinel tabIndex={0} onFocus={() => focusables()[0]?.focus()} />
      </div>
    </Modal>
  );
}
