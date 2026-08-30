/**
 * Enterprise-grade Client-side CSV export utility.
 * Uses a binary Blob with UTF-8 Byte Order Mark (\uFEFF) to guarantee
 * pristine formatting in Microsoft Excel, Apple Numbers, Google Sheets, and ERP tools.
 */
export function exportToCSV<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string }[]
) {
  if (!rows || rows.length === 0) {
    alert("No records match the current filters to export.");
    return;
  }

  // 1. Header row
  const headerLine = columns
    .map((col) => `"${String(col.label).replace(/"/g, '""')}"`)
    .join(",");

  // 2. Data rows
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) {
          return '""';
        }
        // Normalize string, sanitize quotes and multiline linebreaks
        const sanitized = String(val).replace(/"/g, '""').replace(/(\r\n|\n|\r)/gm, " ");
        return `"${sanitized}"`;
      })
      .join(",")
  );

  const csvContent = [headerLine, ...dataLines].join("\r\n");

  // 3. UTF-8 Byte Order Mark (\uFEFF) ensures Excel reads UTF-8 correctly
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

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
