// @vitest-environment jsdom
/**
 * A printed invoice is the artefact that leaves the business, so what appears
 * on it is a compliance question rather than a styling one: a GST tax invoice
 * has to identify both parties, carry HSN/SAC codes, and show the tax split
 * that actually applies.
 *
 * These tests pin the parts that would be wrong silently - the wrong tax
 * columns for the place of supply, a draft that looks like a real invoice.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import PrintInvoiceClient, {
  type PrintInvoice,
  type PrintBusiness,
} from "./PrintInvoiceClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BUSINESS: PrintBusiness = {
  name: "Acme",
  legalName: "Acme Enterprises Private Limited",
  gstin: "27AABCU9603R1ZM",
  pan: "AABCU9603R",
  email: "billing@acme.test",
  phone: "+91 22 1234 5678",
  address: "12 Marine Drive\nMumbai 400020",
  currency: "INR",
};

/** An intra-state invoice: 1,000 taxable, 18% split as 9% + 9%. */
function invoice(overrides: Partial<PrintInvoice> = {}): PrintInvoice {
  return {
    id: "inv-1",
    number: "INV/2026-27/0001",
    status: "ISSUED",
    kind: "SALES",
    issueDate: "2026-04-05T00:00:00.000Z",
    dueDate: "2026-05-05T00:00:00.000Z",
    placeOfSupply: "27",
    gstTreatment: "INTRA_STATE",
    subtotalMinor: "100000",
    discountMinor: "0",
    cgstMinor: "9000",
    sgstMinor: "9000",
    igstMinor: "0",
    roundingMinor: "0",
    totalMinor: "118000",
    paidMinor: "0",
    notes: null,
    terms: null,
    party: {
      name: "Reliance Digital",
      gstin: "27BBBBB1111B1Z5",
      pan: "BBBBB1111B",
      email: "ap@reliance.test",
      phone: "+91 22 9999 0000",
      address: "1 Nariman Point\nMumbai 400021",
    },
    lines: [
      {
        id: "l1",
        description: "Consulting services",
        hsnSacCode: "998311",
        quantityMilli: "1000",
        unitOfMeasure: null,
        unitPriceMinor: "100000",
        discountMinor: "0",
        taxRateBps: 1800,
        lineSubtotalMinor: "100000",
        cgstMinor: "9000",
        sgstMinor: "9000",
        igstMinor: "0",
        lineTotalMinor: "118000",
      },
    ],
    ...overrides,
  };
}

const renderPrint = (over: Partial<PrintInvoice> = {}) =>
  render(<PrintInvoiceClient invoice={invoice(over)} business={BUSINESS} />);

describe("PrintInvoiceClient", () => {
  it("identifies both parties with their GSTINs", () => {
    renderPrint();

    // A tax invoice that names only one side is not a tax invoice. The
    // supplier's GSTIN appears twice by design: on the letterhead and in the
    // addressed block.
    expect(screen.getAllByText("27AABCU9603R1ZM").length).toBeGreaterThan(0);
    expect(screen.getByText("27BBBBB1111B1Z5")).toBeTruthy();
    expect(screen.getByText("Reliance Digital")).toBeTruthy();
    expect(screen.getAllByText("Acme Enterprises Private Limited").length).toBeGreaterThan(0);
  });

  it("carries the HSN/SAC code for each line", () => {
    renderPrint();
    expect(screen.getByText("998311")).toBeTruthy();
  });

  it("shows CGST and SGST within the state, at half the rate each", () => {
    renderPrint();

    const table = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(table).getByText("CGST")).toBeTruthy();
    expect(within(table).getByText("SGST")).toBeTruthy();
    expect(within(table).queryByText("IGST")).toBeNull();

    // 1800bps is 18% total, so each half prints as 9%.
    expect(within(table).getByText("9%")).toBeTruthy();
  });

  it("shows a single IGST column across states, at the full rate", () => {
    renderPrint({
      gstTreatment: "INTER_STATE",
      placeOfSupply: "29",
      cgstMinor: "0",
      sgstMinor: "0",
      igstMinor: "18000",
      lines: [
        {
          ...invoice().lines[0],
          cgstMinor: "0",
          sgstMinor: "0",
          igstMinor: "18000",
        },
      ],
    });

    const table = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(table).getByText("IGST")).toBeTruthy();
    expect(within(table).queryByText("CGST")).toBeNull();
    expect(within(table).getByText("18%")).toBeTruthy();
  });

  it("drops the tax columns entirely when the supply is exempt", () => {
    renderPrint({
      gstTreatment: "EXEMPT",
      cgstMinor: "0",
      sgstMinor: "0",
      igstMinor: "0",
      totalMinor: "100000",
    });

    const table = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(table).queryByText("CGST")).toBeNull();
    expect(within(table).queryByText("IGST")).toBeNull();
    expect(screen.getByText(/exempt from GST/i)).toBeTruthy();
  });

  it("states the total in words, from the same integer as the figure", () => {
    renderPrint();
    expect(
      screen.getByText("Rupees One Thousand One Hundred Eighty Only")
    ).toBeTruthy();
  });

  it("warns that a draft is not a valid tax invoice", () => {
    renderPrint({ status: "DRAFT", number: null });

    // Printing an unnumbered draft and sending it would be a real problem.
    expect(screen.getByText(/not a valid tax invoice yet/i)).toBeTruthy();
  });

  it("marks a cancelled invoice on the document itself", () => {
    renderPrint({ status: "CANCELLED" });
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("shows the balance due once something has been paid", () => {
    renderPrint({ paidMinor: "18000" });

    const totals = within(screen.getByRole("table", { name: "Invoice totals" }));

    // Asserted on the row rather than the figure: the taxable value happens to
    // be 1,000.00 too, so a bare text match would pass on the wrong cell.
    const paidRow = totals.getByText("Paid").closest("tr") as HTMLElement;
    expect(within(paidRow).getByText("₹180.00")).toBeTruthy();

    const dueRow = totals.getByText("Balance due").closest("tr") as HTMLElement;
    expect(within(dueRow).getByText("₹1,000.00")).toBeTruthy();
  });

  it("keeps the screen controls out of the printed sheet", () => {
    const { container } = renderPrint();

    const button = screen.getByRole("button", { name: /Print \/ Save as PDF/ });
    // The controls live inside .no-print, which the print stylesheet removes.
    expect(button.closest(".no-print")).not.toBeNull();
    expect(container.querySelector(".sheet")).not.toBeNull();
  });

  it("omits the discount column when no line carries one", () => {
    renderPrint();
    const table = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(table).queryByText("Disc.")).toBeNull();
  });

  it("shows the discount column as soon as one line carries a discount", () => {
    renderPrint({
      discountMinor: "10000",
      lines: [{ ...invoice().lines[0], discountMinor: "10000" }],
    });

    const table = screen.getByRole("table", { name: "Invoice lines" });
    expect(within(table).getByText("Disc.")).toBeTruthy();
  });

  it("titles a supplier bill differently from a sales invoice", () => {
    renderPrint({ kind: "PURCHASE" });
    expect(screen.getAllByText("Purchase Bill").length).toBeGreaterThan(0);
    expect(screen.queryByText("Tax Invoice")).toBeNull();
  });
});
