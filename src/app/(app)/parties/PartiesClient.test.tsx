// @vitest-environment jsdom
/**
 * Covers the party form at its real call site, rather than only the primitives
 * in isolation. This is the form that previously had eight labels with no
 * htmlFor and inputs with no id, inside a dialog with no role, no accessible
 * name and no way to close it from the keyboard.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import PartiesClient from "./PartiesClient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderParties(openModal = true) {
  return render(
    <PartiesClient
      initialParties={[]}
      initialTotalCount={0}
      aggregates={{ totalParties: 0, totalReceivable: 0, totalPayable: 0 }}
      pageSize={50}
      currency="INR"
      initialOpenModal={openModal}
    />
  );
}

describe("PartiesClient", () => {
  it("opens the add-party form as a named dialog", () => {
    renderParties();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Add a party");
  });

  it("labels every field in the form", () => {
    renderParties();

    // Each of these resolves only if label and control are actually linked.
    for (const label of [
      /Party name/,
      /Phone number/,
      /Email address/,
      /Billing address/,
      /GSTIN/,
      /PAN/,
      /Amount \(INR\)/,
      /Balance type/,
    ]) {
      expect(screen.getByLabelText(label), `no control labelled ${label}`).toBeTruthy();
    }
  });

  it("groups the opening balance fields under a legend", () => {
    renderParties();
    // A fieldset/legend tells a screen reader these two belong together.
    expect(
      screen.getByRole("group", { name: /Opening balance/i })
    ).toBeTruthy();
  });

  it("keeps the submit button connected to the form from the dialog footer", () => {
    renderParties();
    const submit = screen.getByRole("button", { name: /Create party/i });

    expect(submit.getAttribute("type")).toBe("submit");
    // The button sits in the footer, outside the <form>, so it relies on the
    // form attribute to submit it.
    expect(submit.getAttribute("form")).toBe("create-party-form");
  });

  it("closes on Escape", () => {
    renderParties();
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays closed when not asked to open", () => {
    renderParties(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Add Party/i })).toBeTruthy();
  });

  it("shows the empty state when the workspace has no parties", () => {
    renderParties(false);
    expect(screen.getByText(/No parties found/i)).toBeTruthy();
  });
});
