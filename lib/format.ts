/** Shared display formatters (currency, names, avatar colours). */

export const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

/** Abbreviated peso for stat strips (₱1.25M, ₱860K). */
export const pesoShort = (n: number) => {
  if (n >= 1_000_000) return "₱" + (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1_000) return "₱" + (n / 1_000).toFixed(0) + "K";
  return "₱" + n;
};

/** Initials from a full name (max 2). */
export const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const AV_COLORS = [
  "#0ea5a3", "#6366f1", "#db7c2e", "#0d9488", "#7c3aed", "#e0567a",
  "#2563eb", "#059669", "#d97706", "#0891b2", "#9333ea", "#dc2626",
];

/** Deterministic avatar colour from a name. */
export const avColor = (name: string) =>
  AV_COLORS[
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length
  ];

/** en-PH short date ("Jan 5, 2026"), em-dash when unset. */
export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

/**
 * Human file size, base-1000 to match what OS file managers and browser download
 * UIs show ("4.6 MB", "998 KB"). Em dash when unset, like `fmtDate`.
 */
export const fileSize = (bytes: number | null | undefined) => {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
};
