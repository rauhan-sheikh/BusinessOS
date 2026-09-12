import { describe, it, expect } from "vitest";
import { buildCSV, type ExportColumn } from "./export-csv";

type Row = { name: string; amount: string; notes: string | null };

const columns: ExportColumn<Row>[] = [
  { key: "name", label: "Party" },
  { key: "amount", label: "Amount" },
  { key: "notes", label: "Notes" },
];

const build = (rows: Row[]) => buildCSV(rows, columns);

describe("buildCSV", () => {
  it("returns null when there is nothing to export", () => {
    expect(build([])).toBeNull();
  });

  it("writes a quoted header and rows", () => {
    const csv = build([{ name: "Acme", amount: "1250.50", notes: null }]);
    expect(csv).toBe('"Party","Amount","Notes"\r\n"Acme","1250.50",""');
  });

  it("escapes embedded quotes by doubling them", () => {
    const csv = build([{ name: 'Acme "Ltd"', amount: "1", notes: null }]);
    expect(csv).toContain('"Acme ""Ltd"""');
  });

  it("flattens newlines so a cell cannot break the row", () => {
    const csv = build([{ name: "Acme", amount: "1", notes: "line one\nline two" }]);
    expect(csv).toContain('"line one line two"');
    expect(csv!.split("\r\n")).toHaveLength(2);
  });

  describe("formula injection", () => {
    // A spreadsheet evaluates a cell starting with any of these, so
    // user-controlled text could run on open.
    const dangerous = [
      '=HYPERLINK("http://evil.test","click")',
      "+1+1",
      "-1+1",
      "@SUM(A1:A9)",
      "\tleading tab",
      "\rleading carriage return",
    ];

    it.each(dangerous)("neutralises %j", (value) => {
      const csv = build([{ name: value, amount: "1", notes: null }])!;
      const firstCell = csv.split("\r\n")[1].split(",")[0];

      // Prefixed with an apostrophe, which spreadsheets strip on display.
      expect(firstCell.startsWith(`"'`)).toBe(true);
    });

    it("leaves ordinary text untouched", () => {
      const csv = build([{ name: "Acme Traders", amount: "1250.50", notes: null }])!;
      expect(csv).toContain('"Acme Traders"');
      expect(csv).not.toContain("'Acme");
    });

    it("does not mangle a negative amount into something unreadable", () => {
      // Negative values are legitimate here (a customer advance), so they must
      // stay readable even though "-" is a formula prefix.
      const csv = build([{ name: "Acme", amount: "-500.00", notes: null }])!;
      expect(csv).toContain(`"'-500.00"`);
    });
  });
});
