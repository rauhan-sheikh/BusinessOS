"use client";

import { useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

/**
 * Form controls that are labelled by construction.
 *
 * Forty-six labels across the authenticated app had no `htmlFor`, and their
 * inputs no `id` - so every form was effectively unlabelled for a screen
 * reader, and clicking a label did not focus its field. Generating the id here
 * with useId() means a caller cannot forget to connect them.
 */

const CONTROL_BASE =
  "w-full rounded-xl bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg " +
  "placeholder:text-fg-subtle transition-all " +
  "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/40";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-medium text-fg-subtle">
        {label}
        {required && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[11px] text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        // role="alert" so the message is announced when it appears.
        <p id={`${id}-error`} role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Links a control to whichever of hint/error is currently shown. */
function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type CommonProps = {
  label: string;
  hint?: string;
  error?: string;
};

export interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">,
    CommonProps {}

export function InputField({ label, hint, error, className, ...props }: InputFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_BASE, className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">,
    CommonProps {
  children: ReactNode;
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_BASE, className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export interface TextareaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">,
    CommonProps {}

export function TextareaField({
  label,
  hint,
  error,
  className,
  ...props
}: TextareaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={props.required}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL_BASE, className)}
        {...props}
      />
    </FieldShell>
  );
}

/** A labelled control for cases where the label should not be visible. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
