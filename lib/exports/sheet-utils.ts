import * as XLSX from "xlsx";

/**
 * Shared spreadsheet-building helpers for the export surfaces.
 *
 * SheetJS community edition cannot style cells (bold/fill/borders are a paid
 * feature) and does not write frozen panes, so readability has to come entirely
 * from layout: explicit column widths, real Date/number cells carrying a number
 * format, merged title rows, autofilters and blank spacer rows between
 * sections. Everything here exists to make that cheap to apply consistently.
 */

/**
 * Number formats, chosen by measuring what actually survives BOTH writers.
 *
 * The obvious spellings silently degrade in ODS: `₱#,##0.00` loses the peso
 * sign, `[$₱-3F09]#,##0.00` loses the format outright, and `yyyy-mm-dd` renders
 * as `20260803` because SheetJS's ODF writer drops unquoted `-` (it warns
 * "unrecognized character - in ODF format"). Quoting the literals is what makes
 * one format string render identically in Excel and LibreOffice — verified by
 * writing both file types and reading the rendered output back out.
 */
export const FMT = {
  PESO: '"₱"#,##0.00',
  INT: "#,##0",
  DATE: 'yyyy"-"mm"-"dd',
} as const;

/** A cell value we know how to place: primitives, dates, or blank. */
export type CellValue = string | number | boolean | Date | null | undefined;

/**
 * Parse a `yyyy-mm-dd` (or ISO timestamp) string into a Date anchored at local
 * midnight.
 *
 * `new Date("2026-08-03")` parses as UTC midnight, which in UTC+8 displays as
 * "2026-08-03 08:00" — a spurious time component on what is a date-only field.
 * Splitting the calendar parts and rebuilding locally keeps the date the user
 * stored as the date the spreadsheet shows.
 */
export function toDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [datePart] = String(iso).split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export interface ColumnSpec {
  /** Header label rendered in the sheet. */
  header: string;
  /** Column width in characters (SheetJS `wch`). */
  width: number;
  /** Number format applied to every data cell in this column. */
  format?: string;
}

export interface SheetSpec {
  /** Row 1, merged across all columns. */
  title: string;
  /** Row 2, merged across all columns — provenance and scope. */
  subtitle: string;
  columns: ColumnSpec[];
  rows: CellValue[][];
  /** Shown in place of the data when `rows` is empty. */
  emptyMessage?: string;
}

/** Row index (0-based) where the header lands: title, subtitle, spacer, header. */
const HEADER_ROW = 3;

/**
 * Build one worksheet using the shared skeleton every export sheet follows:
 * merged title, merged subtitle, spacer, header, data. Applies column widths,
 * per-column number formats, a frozen header and an autofilter.
 */
export function buildSheet(spec: SheetSpec): XLSX.WorkSheet {
  const { title, subtitle, columns, rows, emptyMessage = "No records." } = spec;
  const hasRows = rows.length > 0;

  const aoa: CellValue[][] = [
    [title],
    [subtitle],
    [],
    columns.map((c) => c.header),
    ...(hasRows ? rows : [[emptyMessage]]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

  // Number formats are applied per cell — SheetJS has no column-level format.
  if (hasRows) {
    rows.forEach((row, r) => {
      columns.forEach((col, c) => {
        if (!col.format) return;
        const value = row[c];
        if (value == null || value === "") return;
        const ref = XLSX.utils.encode_cell({ r: HEADER_ROW + 1 + r, c });
        const cell = ws[ref];
        if (cell) cell.z = col.format;
      });
    });
  }

  const lastCol = Math.max(columns.length - 1, 0);
  ws["!cols"] = columns.map((c) => ({ wch: c.width }));
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];
  // No frozen header row: SheetJS community has no `!freeze` handling at all
  // (verified — the string appears nowhere in the shipped library), so setting
  // it would be a silent no-op rather than a feature.
  //
  // An autofilter over a header with no rows beneath it confuses Excel.
  if (hasRows) {
    ws["!autofilter"] = {
      ref: `${XLSX.utils.encode_cell({ r: HEADER_ROW, c: 0 })}:${XLSX.utils.encode_cell({
        r: HEADER_ROW + rows.length,
        c: lastCol,
      })}`,
    };
  }
  return ws;
}

/**
 * Escape one CSV field (RFC 4180) and neutralise spreadsheet formula injection.
 *
 * A leading `=`, `+`, `-` or `@` makes Excel/Calc treat the value as a formula
 * on open, so it is prefixed with an apostrophe to force text. Lifted from the
 * list-screen exporter so both CSV paths share one implementation.
 */
export function escapeCsv(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Serialise rows to CSV text with a UTF-8 BOM, without which Excel renders `₱`
 * as mojibake. CRLF line endings are what RFC 4180 specifies.
 */
export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
