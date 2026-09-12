/**
 * CSV export.
 *
 * Two things matter here beyond quoting. Spreadsheet applications treat a cell
 * beginning with =, +, -, @, tab or CR as a formula, so user-controlled text
 * (party names, notes) could execute on open - the classic CSV injection. And
 * the byte order mark keeps UTF-8 intact in Excel.
 */

/** Characters that make Excel, Sheets and Numbers treat a cell as a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Escapes one cell.
 *
 * A value that would be read as a formula is prefixed with a single quote,
 * which spreadsheets strip on display - so the text reads correctly while never
 * being evaluated.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '""';

  const raw = String(value);

  // Detected on the raw value, before newlines are flattened: otherwise a
  // leading carriage return would become a space and slip past this check.
  const isFormula = FORMULA_PREFIXES.some((prefix) => raw.startsWith(prefix));

  let text = raw.replace(/(\r\n|\n|\r)/g, " ");
  if (isFormula) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

export interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

/**
 * Builds CSV text. Returns null when there is nothing to export, so the caller
 * decides how to tell the user rather than this module raising an alert().
 */
export function buildCSV<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[]
): string | null {
  if (!rows || rows.length === 0) return null;

  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(","));

  return [header, ...body].join("\r\n");
}

/** Triggers a browser download of the given CSV text. */
export function downloadCSV(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8 rather than ANSI.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`
  );

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convenience wrapper. Returns false when there was nothing to export.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  filename: string,
  rows: readonly T[],
  columns: readonly ExportColumn<T>[]
): boolean {
  const csv = buildCSV(rows, columns);
  if (csv === null) return false;

  downloadCSV(filename, csv);
  return true;
}
