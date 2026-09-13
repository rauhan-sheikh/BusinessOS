// @vitest-environment jsdom
/**
 * Allocation is where a payment stops being a number and starts changing what
 * each invoice says it owes, so these tests pin the three modes to the exact
 * request each one sends.
 *
 * The distinction that matters most: omitting `allocations` means "settle
 * oldest first", while sending an empty array means "hold all of it on
 * account". They are different instructions to the server, and confusing them
 * would silently settle invoices the user meant to leave open.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/components/ui";
import RecordPaymentModal from "./RecordPaymentModal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PARTY_ID = "11111111-1111-4111-8111-111111111111";
const OLDER_INVOICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEWER_INVOICE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Two open invoices: 1,000 owed on the older, 500 on the newer. */
const OPEN_INVOICES = [
  {
    id: NEWER_INVOICE,
    number: "INV/2026-27/0002",
    issueDate: "2026-06-01T00:00:00.000Z",
    dueDate: null,
    totalMinor: "50000",
    paidMinor: "0",
  },
  {
    id: OLDER_INVOICE,
    number: "INV/2026-27/0001",
    issueDate: "2026-04-01T00:00:00.000Z",
    dueDate: null,
    totalMinor: "100000",
    paidMinor: "0",
  },
];

function mockFetch(recorded: { calls: RequestInit[] }) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);

    if (url.startsWith("/api/invoices")) {
      return new Response(JSON.stringify({ invoices: OPEN_INVOICES }), { status: 200 });
    }

    recorded.calls.push(init as RequestInit);
    return new Response(
      JSON.stringify({ payment: { id: "pay-1", allocations: [] } }),
      { status: 201 }
    );
  });
}

function renderModal() {
  return render(
    <ToastProvider>
      <RecordPaymentModal
        isOpen
        onClose={vi.fn()}
        onRecorded={vi.fn()}
        parties={[{ id: PARTY_ID, name: "Acme Ltd" }]}
        currency="INR"
      />
    </ToastProvider>
  );
}

/** Picks the counterparty, which is what triggers the open-invoice load. */
async function chooseParty() {
  fireEvent.change(screen.getByLabelText(/^Customer/), { target: { value: PARTY_ID } });
  await screen.findByText(/2 open/);
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /Record receipt/ }));

describe("RecordPaymentModal", () => {
  it("is a dialog with an accessible name", () => {
    renderModal();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Record a receipt");
  });

  it("labels every field", () => {
    renderModal();

    for (const label of [
      /^Direction/,
      /^Customer/,
      /^Amount/,
      /^Date/,
      /^Method/,
      /^Reference/,
      /^Notes/,
    ]) {
      expect(screen.getByLabelText(label), `no control labelled ${label}`).toBeTruthy();
    }
  });

  it("asks for a counterparty before showing anything to allocate", () => {
    renderModal();
    expect(screen.getByText(/Choose a counterparty to see what is outstanding/)).toBeTruthy();
  });

  it("totals what is outstanding once a counterparty is chosen", async () => {
    mockFetch({ calls: [] });
    renderModal();
    await chooseParty();

    expect(screen.getByText(/₹1,500.00 outstanding in total/)).toBeTruthy();
  });

  it("previews the oldest-first split without settling more than is owed", async () => {
    mockFetch({ calls: [] });
    renderModal();
    await chooseParty();

    // 1,200 against a 1,000 invoice and a 500 one: 1,000 settles the older in
    // full, 200 goes to the newer, and nothing is left over.
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "1200" } });

    const applied = screen.getByText("Applied to invoices").parentElement as HTMLElement;
    expect(within(applied).getByText("₹1,200.00")).toBeTruthy();
  });

  it("holds the remainder on account when the payment exceeds what is owed", async () => {
    mockFetch({ calls: [] });
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "2000" } });

    const held = screen.getByText("Held on account").parentElement as HTMLElement;
    expect(within(held).getByText("₹500.00")).toBeTruthy();
  });

  it("omits allocations entirely when settling oldest first", async () => {
    const recorded = { calls: [] as RequestInit[] };
    mockFetch(recorded);
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "1200" } });
    submit();

    await vi.waitFor(() => expect(recorded.calls).toHaveLength(1));
    const body = JSON.parse(String(recorded.calls[0].body));

    // Absent, not empty: absent means "settle oldest first" to the server.
    expect(body).not.toHaveProperty("allocations");
    expect(body.amountMinor).toBe("1200");
  });

  it("sends an empty allocation list when holding on account", async () => {
    const recorded = { calls: [] as RequestInit[] };
    mockFetch(recorded);
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "1200" } });
    fireEvent.click(screen.getByLabelText(/Hold on account/));
    submit();

    await vi.waitFor(() => expect(recorded.calls).toHaveLength(1));
    const body = JSON.parse(String(recorded.calls[0].body));

    expect(body.allocations).toEqual([]);
  });

  it("pre-fills a manual allocation with the oldest-first split", async () => {
    mockFetch({ calls: [] });
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "1200" } });
    fireEvent.click(screen.getByLabelText(/Choose the amounts/));

    const fields = screen.getAllByLabelText(/^Apply/);
    // Oldest invoice first, so the 1,000 one is filled before the 500 one.
    expect(fields[0]).toHaveValue("1000.00");
    expect(fields[1]).toHaveValue("200.00");
  });

  it("sends only the manual allocations that carry an amount", async () => {
    const recorded = { calls: [] as RequestInit[] };
    mockFetch(recorded);
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "1200" } });
    fireEvent.click(screen.getByLabelText(/Choose the amounts/));

    const fields = screen.getAllByLabelText(/^Apply/);
    fireEvent.change(fields[1], { target: { value: "" } });
    submit();

    await vi.waitFor(() => expect(recorded.calls).toHaveLength(1));
    const body = JSON.parse(String(recorded.calls[0].body));

    expect(body.allocations).toEqual([
      { invoiceId: OLDER_INVOICE, amountMinor: "1000.00" },
    ]);
  });

  it("refuses a manual allocation larger than the invoice owes", async () => {
    const recorded = { calls: [] as RequestInit[] };
    mockFetch(recorded);
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "5000" } });
    fireEvent.click(screen.getByLabelText(/Choose the amounts/));

    const fields = screen.getAllByLabelText(/^Apply/);
    fireEvent.change(fields[0], { target: { value: "4000" } });
    submit();

    // Two things announce here: the field flags "More than is owed", and the
    // form refuses the submission. Both matter, so both are asserted.
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent).join(" ")).toMatch(/More than is owed/i);
    expect(alerts.map((a) => a.textContent).join(" ")).toMatch(
      /more than that invoice still owes/i
    );
    expect(recorded.calls).toHaveLength(0);
  });

  it("rejects an amount of zero", async () => {
    const recorded = { calls: [] as RequestInit[] };
    mockFetch(recorded);
    renderModal();
    await chooseParty();

    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "0" } });
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/greater than zero/i);
    expect(recorded.calls).toHaveLength(0);
  });
});
