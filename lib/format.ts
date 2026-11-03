/** Shared display formatters (currency, names, avatar colours). */

export const peso = (n: number) => "₱" + n.toLocaleString("en-PH");

/** Abbreviated peso for stat strips (₱1.25M, ₱860K). */
export const pesoShort = (n: number) => {
  if (n >= 1_000_000) return "₱" + (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1_000) return "₱" + (n / 1_000).toFixed(0) + "K";
  return "₱" + n;
};

const currencyPrefix = (currency: string | null | undefined) =>
  !currency || currency === "PHP" ? "₱" : currency === "USD" ? "US$" : `${currency} `;

/** Formats an amount in its recorded currency; never converts between currencies. */
export const money = (n: number, currency?: string | null) =>
  currencyPrefix(currency) + n.toLocaleString("en-PH", { maximumFractionDigits: 2 });

/** Separately renders currency totals instead of merging non-convertible amounts. */
export const moneyTotals = (amounts: Map<string, number>) =>
  [...amounts.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([currency, amount]) => moneyShort(amount, currency))
    .join(" · ") || "—";

/** Abbreviated native-currency amount for stat strips. */
export const moneyShort = (n: number, currency?: string | null) => {
  const prefix = currencyPrefix(currency);
  if (n >= 1_000_000) return prefix + (n / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1_000) return prefix + (n / 1_000).toFixed(0) + "K";
  return prefix + n;
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
