"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * An accessible dialog.
 *
 * The four hand-rolled modals this replaces shared the same overlay markup and
 * the same omissions: no role or accessible name, no focus management, no
 * Escape handling, no backdrop dismissal, and a close button whose only content
 * was a times character - so its accessible name was "×". Keyboard users could
 * tab out of an open dialog into the page behind it and never find their way
 * back.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Rendered against the bottom edge, typically the confirm/cancel pair. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      // Cycle focus within the dialog rather than letting it escape to the page
      // behind, which is inert to the mouse but was still tabbable.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus in, so the first Tab lands inside the dialog rather than at
    // the top of the document.
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusable?.[0] ?? panelRef.current)?.focus();

    // Stop the page behind from scrolling under the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      // Return focus to whatever opened the dialog.
      previouslyFocused.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm"
      // Clicking the backdrop dismisses; clicks inside the panel do not, since
      // the panel stops them below.
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full rounded-2xl bg-surface border border-line shadow-2xl",
          "max-h-[90vh] flex flex-col animate-scale-in",
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 p-4 sm:p-6 pb-0">
          <div className="space-y-1">
            <h2 id={titleId} className="text-base font-bold text-fg">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-xs text-fg-subtle">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            // A real name, rather than the times character the previous close
            // buttons announced.
            aria-label={`Close ${title}`}
            className="rounded-lg p-1 text-fg-subtle hover:text-fg hover:bg-raised transition-colors shrink-0"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        {/* Long forms scroll inside the dialog instead of past the viewport. */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {footer && (
          <div className="border-t border-line p-4 sm:px-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
