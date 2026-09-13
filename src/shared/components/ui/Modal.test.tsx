// @vitest-environment jsdom
/**
 * The Modal exists to fix an accessibility contract, so that contract is what
 * is tested here. Each case corresponds to something the four hand-rolled
 * modals it replaces got wrong.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

afterEach(cleanup);

function open(props: Partial<React.ComponentProps<typeof Modal>> = {}) {
  const onClose = vi.fn();
  render(
    <Modal isOpen onClose={onClose} title="Reverse this transaction?" {...props}>
      <input aria-label="First field" />
      <button type="button">Middle</button>
      <input aria-label="Last field" />
    </Modal>
  );
  return { onClose };
}

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>body</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes itself as a modal dialog with an accessible name", () => {
    open();
    const dialog = screen.getByRole("dialog");

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // The name comes from the heading, so assistive tech announces what the
    // dialog is for rather than just "dialog".
    expect(dialog).toHaveAccessibleName("Reverse this transaction?");
  });

  it("links its description when one is given", () => {
    open({ description: "This posts an opposing entry." });
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "This posts an opposing entry."
    );
  });

  it("gives the close button a real name, not the times character", () => {
    open();
    // The previous modals rendered a bare &times;, so this announced as "×".
    expect(
      screen.getByRole("button", { name: "Close Reverse this transaction?" })
    ).toBeTruthy();
  });

  it("moves focus into the dialog when it opens", () => {
    open();
    const dialog = screen.getByRole("dialog");

    // The contract is that focus is inside the dialog, so the next Tab stays
    // there rather than starting at the top of the document.
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Specifically the close button, being first in DOM order. That is the
    // deliberate choice for a dialog whose primary action may be destructive:
    // a stray Enter dismisses rather than confirms.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Close/ })
    );
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop is clicked but not the panel", () => {
    const { onClose } = open();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    // The backdrop is the dialog's parent.
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("focus trap", () => {
    it("wraps forward from the last focusable element", () => {
      open();
      const close = screen.getByRole("button", { name: /^Close/ });
      const last = screen.getByLabelText("Last field");

      last.focus();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });

      // Wraps to the first focusable element, which is the close button.
      expect(document.activeElement).toBe(close);
    });

    it("wraps backward from the first focusable element", () => {
      open();
      const close = screen.getByRole("button", { name: /^Close/ });
      const last = screen.getByLabelText("Last field");

      close.focus();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });

      expect(document.activeElement).toBe(last);
    });
  });

  it("locks background scroll while open and restores it after", () => {
    const { unmount } = render(
      <Modal isOpen onClose={vi.fn()} title="Scroll test">
        <p>body</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("returns focus to whatever opened it", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <Modal isOpen onClose={vi.fn()} title="Focus return">
        <input aria-label="Inside" />
      </Modal>
    );
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
