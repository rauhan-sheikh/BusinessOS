// @vitest-environment jsdom
/**
 * Forty-six labels in the authenticated app had no htmlFor and their inputs no
 * id, so every form was effectively unlabelled for a screen reader. These
 * assert that the wiring cannot be omitted, since the component owns it.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { InputField, SelectField, TextareaField } from "./Field";

afterEach(cleanup);

describe("form fields", () => {
  it("labels an input, so it can be found by its label text", () => {
    render(<InputField label="Amount" />);
    // getByLabelText only succeeds when label and control are actually linked.
    expect(screen.getByLabelText("Amount")).toBeInstanceOf(HTMLInputElement);
  });

  it("labels a select", () => {
    render(
      <SelectField label="Counterparty">
        <option value="a">Acme</option>
      </SelectField>
    );
    expect(screen.getByLabelText("Counterparty")).toBeInstanceOf(HTMLSelectElement);
  });

  it("labels a textarea", () => {
    render(<TextareaField label="Notes" />);
    expect(screen.getByLabelText("Notes")).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("gives every instance its own id, so repeated fields stay distinct", () => {
    render(
      <>
        <InputField label="First" />
        <InputField label="Second" />
      </>
    );
    const first = screen.getByLabelText("First");
    const second = screen.getByLabelText("Second");

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });

  it("announces an error and marks the control invalid", () => {
    render(<InputField label="Amount" error="Amount must be greater than 0" />);

    const input = screen.getByLabelText("Amount");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input).toHaveAccessibleDescription("Amount must be greater than 0");
    // role="alert" so it is read out when it appears, not only on focus.
    expect(screen.getByRole("alert").textContent).toBe("Amount must be greater than 0");
  });

  it("describes the control with its hint when there is no error", () => {
    render(<InputField label="Amount" hint="Up to two decimal places" />);

    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAccessibleDescription("Up to two decimal places");
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("prefers the error over the hint once both are present", () => {
    render(<InputField label="Amount" hint="Up to two decimals" error="Required" />);

    expect(screen.getByLabelText("Amount")).toHaveAccessibleDescription("Required");
    expect(screen.queryByText("Up to two decimals")).toBeNull();
  });

  it("passes through native attributes", () => {
    render(<InputField label="Amount" required placeholder="0.00" inputMode="decimal" />);

    const input = screen.getByLabelText(/Amount/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(input.getAttribute("placeholder")).toBe("0.00");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });
});
