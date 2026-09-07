/**
 * Content-Disposition filename encoding.
 *
 * Undici rejects header values outside Latin-1, so a raw em dash throws
 * `TypeError: Invalid header value` — and carrier document names are full of
 * them ("Select Application Form — Ages 0–70"), along with en dashes, curly
 * apostrophes and commas. Commas and quotes are separately dangerous because
 * they terminate the header parameter.
 *
 * So every filename ships twice: an ASCII-safe `filename=` for legacy parsers,
 * and an RFC 5987 `filename*=` that modern browsers prefer and that carries the
 * real characters.
 */

/**
 * RFC 5987 percent-encoding. `encodeURIComponent` leaves `!'()*` unescaped and
 * none of those are `attr-char`, so they need escaping by hand — Chrome is
 * forgiving about it, Firefox is not.
 */
const rfc5987 = (value: string) =>
  encodeURIComponent(value).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Latin-1-safe, quote-safe, injection-safe fallback. */
const asciiFallback = (value: string) =>
  value
    .replace(/[‘’]/g, "'") // curly single quotes
    .replace(/[–—−]/g, "-") // en dash, em dash, minus
    .replace(/[“”]/g, "") // curly double quotes
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "") // anything still non-ASCII
    .replace(/["\\/,;\r\n]+/g, " ") // header/param breakers and path separators
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "document";

/** `Content-Disposition` value that renders in place rather than downloading. */
export const inlineDisposition = (filename: string) =>
  `inline; filename="${asciiFallback(filename)}"; filename*=UTF-8''${rfc5987(filename)}`;
