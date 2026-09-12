import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Presentational primitives.
 *
 * Each of these replaces a string that had been pasted repeatedly: the card
 * shell appeared 29 times verbatim, and the empty state was rewritten from
 * scratch in six places with different markup each time.
 */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl bg-surface border border-line", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-6 pb-0">
      <div>
        <h2 className="text-base font-bold text-fg">{title}</h2>
        {description && <p className="text-xs text-fg-subtle mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type BadgeTone =
  | "neutral"
  | "accent"
  | "receivable"
  | "payable"
  | "danger"
  | "info";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-raised text-fg-muted border-line",
  accent: "bg-accent/10 text-accent-subtle border-accent/20",
  receivable: "bg-receivable/10 text-receivable border-receivable/20",
  payable: "bg-payable/10 text-payable border-payable/20",
  danger: "bg-danger/10 text-danger border-danger/20",
  info: "bg-info/10 text-info border-info/20",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-lg border",
        "text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4 space-y-3">
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      {description && (
        <p className="text-xs text-fg-subtle max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

/**
 * Horizontal-scroll wrapper for tables.
 *
 * AGENTS.md requires every table to scroll rather than break the layout on a
 * narrow screen; wrapping them in a component makes that hard to forget.
 */
export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  isLoading = false,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <p className="text-[11px] text-fg-subtle">
        Showing {from}&ndash;{to} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="rounded-xl bg-raised border border-line px-3 py-1.5 text-[11px] font-semibold text-fg-muted hover:bg-line transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-[11px] text-fg-subtle" aria-current="page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="rounded-xl bg-raised border border-line px-3 py-1.5 text-[11px] font-semibold text-fg-muted hover:bg-line transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
