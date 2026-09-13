import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-lg shadow-accent/20 hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "bg-raised border border-line text-fg-muted hover:bg-line hover:text-fg disabled:hover:bg-raised",
  ghost: "text-fg-subtle hover:text-fg hover:bg-raised disabled:hover:bg-transparent",
  danger:
    "bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 disabled:hover:bg-danger/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2.5 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  isLoading?: boolean;
  /** Replaces the label while loading, so the action stays described. */
  loadingLabel?: string;
  /** Stretches to the container, for stacked mobile layouts. */
  fullWidth?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      // Defaults to "button": an unset type inside a form submits it, which is
      // rarely what a secondary action wants.
      type={type}
      disabled={disabled || isLoading}
      // Communicates the busy state to assistive technology, which a label
      // change alone does not.
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {isLoading && <Spinner />}
      {isLoading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/** Inline busy indicator. Hidden from assistive tech; aria-busy carries it. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
    />
  );
}
