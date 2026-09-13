// @vitest-environment jsdom
/**
 * The invoice form shows a running total before anything is saved, which means
 * two separate pieces of arithmetic could disagree: the one on screen and the
 * one the server posts to the books. They do not, because the form imports the
 * same calculateInvoice the repository uses - and these tests hold that to it
 * by computing the expectation from that function rather than from a literal.
 *
 * A figure typed into an invoice is what a customer is asked to pay, so a
 * preview that is even a paisa out is a real defect, not a cosmetic one.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/components/ui";
import {
  calculateInvoice,
  type LineInput,
} from "@/modules/invoices/calculate";
import { formatCurrency } from "@/shared/utils/currency";
import NewInvoiceClient from "./NewInvoiceClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Maharashtra (27) and Karnataka (29), so the two GST paths are distinct. */
const MAHARASHTRA_GSTIN = "27AABCU9603R1ZM";
const KARNATAKA_GSTIN = "29AABCU9603R1ZX";

const PARTIES = [
  { id: "11111111-1111-4111-8111-111111111111", name: "In-state Ltd", gstin: MAHARASHTRA_GSTIN },
  { id: "22222222-2222-4222-8222-222222222222", name: "Far Away Ltd", gstin: KARNATAKA_GSTIN },
];

function renderForm(items: React.ComponentProps<typeof NewInvoiceClient>["items"] = []) {
  return render(
    <ToastProvider>
      <NewInvoiceClient
        parties={PARTIES}
        items={items}
        currency="INR"
        businessGstin={MAHARASHTRA_GSTIN}
      />
    </ToastProvider>
  );
}

/** Fills the first line, which is the only one present on a fresh form. */
function fillFirstLine({
  description = "Consulting",
  quantity = "1",
  unitPrice = "",
  discount = "",
  taxRate = "18",
}: Partial<Record<string, string>> = {}) {
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: description },
  });
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: quantity } });
  fireEvent.change(screen.getByLabelText(/^Unit price/), { target: { value: unitPrice } });
  if (discount) {
    fireEvent.change(screen.getByLabelText(/^Discount/), { target: { value: discount } });
  }
  fireEvent.change(screen.getByLabelText(/^Tax rate/), { target: { value: taxRate } });
}

/** What the server would compute for the same input. */
function expectedTotal(
  lines: LineInput[],
  treatment: "INTRA_STATE" | "INTER_STATE" | "EXEMPT"
) {
  return calculateInvoice(lines, treatment, { roundTotalToUnit: true });
}

function totalsRegion() {
  // The totals list, scoped so a line total cannot satisfy an assertion about
  // the document total.
  return screen.getByRole("heading", { name: "Totals" }).parentElement as HTMLElement;
}

describe("NewInvoiceClient", () => {
  it("labels every field in the form", () => {
    renderForm();

    for (const label of [
      /^Type/,
      /^Customer/,
      /^Issue date/,
      /^Due date/,
      /^Description/,
      /^HSN \/ SAC/,
      /^Quantity/,
      /^Unit price/,
      /^Discount/,
      /^Tax rate/,
      /^Notes/,
      /^Terms/,
    ]) {
      expect(screen.getByLabelText(label), `no control labelled ${label}`).toBeTruthy();
    }
  });

  it("shows no totals until a line has a quantity and a price", () => {
    renderForm();
    expect(screen.getByText(/Totals appear once a line/)).toBeTruthy();
  });

  it("previews the total the server would calculate", () => {
    renderForm();
    fillFirstLine({ quantity: "2.5", unitPrice: "1999.99", taxRate: "18" });

    const expected = expectedTotal(
      [
        {
          description: "Consulting",
          quantityMilli: 2500n,
          unitPriceMinor: 199999n,
          discountMinor: 0n,
          taxRateBps: 1800,
        },
      ],
      "INTRA_STATE"
    );

    const totals = within(totalsRegion());
    expect(totals.getByText(formatCurrency(expected.totalMinor, "INR"))).toBeTruthy();
    expect(totals.getByText(formatCurrency(expected.subtotalMinor, "INR"))).toBeTruthy();
  });

  it("splits tax as CGST and SGST within the state", () => {
    renderForm();
    fillFirstLine({ unitPrice: "1000" });

    const totals = within(totalsRegion());
    expect(totals.getByText("CGST")).toBeTruthy();
    expect(totals.getByText("SGST")).toBeTruthy();
    expect(totals.queryByText("IGST")).toBeNull();
  });

  it("charges IGST when the counterparty is in another state", () => {
    renderForm();

    // Same rate, different state: the split follows the place of supply, never
    // the rate. This is the rule the whole GST module turns on.
    fireEvent.change(screen.getByLabelText(/^Customer/), {
      target: { value: PARTIES[1].id },
    });
    fillFirstLine({ unitPrice: "1000" });

    const totals = within(totalsRegion());
    expect(totals.getByText("IGST")).toBeTruthy();
    expect(totals.queryByText("CGST")).toBeNull();
    expect(totals.queryByText("SGST")).toBeNull();
  });

  it("drops the tax entirely when the supply is exempt", () => {
    renderForm();
    fillFirstLine({ unitPrice: "1000" });

    fireEvent.click(screen.getByLabelText(/exempt from GST/i));

    const totals = within(totalsRegion());
    expect(totals.queryByText("CGST")).toBeNull();
    expect(totals.queryByText("IGST")).toBeNull();
    // Subtotal and total are both the bare 1,000 - nothing was added on top.
    expect(totals.getAllByText(formatCurrency(100000n, "INR"))).toHaveLength(2);
  });

  it("holds the preview back when a discount exceeds its line", () => {
    renderForm();
    // The server rejects this, so showing a total for it would promise a
    // document that cannot be saved.
    fillFirstLine({ unitPrice: "100", discount: "500" });

    expect(screen.getByText(/Totals appear once a line/)).toBeTruthy();
  });

  it("refuses to submit without a complete line", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: /Save as draft/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least one line/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the amounts as typed, letting the server do the conversion", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ invoice: { id: "abc" } }), { status: 201 })
    );

    renderForm();
    fillFirstLine({ quantity: "2", unitPrice: "150.25", taxRate: "5" });
    fireEvent.click(screen.getByRole("button", { name: /Save as draft/ }));

    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/invoices");
    const body = JSON.parse(String((init as RequestInit).body));

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]).toMatchObject({
      description: "Consulting",
      quantityMilli: "2",
      unitPriceMinor: "150.25",
      // Basis points, so 5% is 500 and no rate is ever fractional.
      taxRateBps: 500,
    });
    expect(body.partyId).toBe(PARTIES[0].id);
  });

  it("says the draft survived when issuing it fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/issue")) {
        return new Response(JSON.stringify({ error: "Numbering is locked." }), {
          status: 409,
        });
      }
      return new Response(JSON.stringify({ invoice: { id: "abc" } }), { status: 201 });
    });

    renderForm();
    fillFirstLine({ unitPrice: "100" });
    fireEvent.click(screen.getByRole("button", { name: /Save and issue/ }));

    // Telling the user only "could not issue" would invite them to enter the
    // same invoice a second time, and the draft is already there.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Saved as a draft/);
    expect(alert).toHaveTextContent(/Numbering is locked/);
  });

  it("copies a catalogue item onto the line rather than referencing it", () => {
    renderForm([
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Audit retainer",
        description: "Quarterly audit retainer",
        hsnSacCode: "998221",
        unitOfMeasure: "job",
        unitPriceMinor: "2500000",
        taxRateBps: 1800,
      },
    ]);

    fireEvent.change(screen.getByLabelText(/From the catalogue/), {
      target: { value: "33333333-3333-4333-8333-333333333333" },
    });

    expect(screen.getByLabelText(/^Description/)).toHaveValue("Quarterly audit retainer");
    expect(screen.getByLabelText(/^Unit price/)).toHaveValue("25000.00");
    expect(screen.getByLabelText(/^HSN \/ SAC/)).toHaveValue("998221");
    expect(screen.getByLabelText(/^Tax rate/)).toHaveValue("18");
  });

  it("adds and removes lines", () => {
    renderForm();
    expect(screen.getAllByRole("group")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Add line/ }));
    expect(screen.getAllByRole("group")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Remove line 2/ }));
    expect(screen.getAllByRole("group")).toHaveLength(1);
  });
});
