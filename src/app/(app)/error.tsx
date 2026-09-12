"use client";

import { useEffect } from "react";

/**
 * Error boundary for the authenticated shell.
 *
 * Scoped inside (app) so the top bar and navigation survive: a failure on one
 * page leaves the rest of the workspace reachable, rather than replacing the
 * whole document as the root boundary does.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace page error:", error);
  }, [error]);

  return (
    <div className="rounded-2xl bg-surface border border-line p-6 sm:p-10 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 border border-danger/20">
        <svg
          className="h-6 w-6 text-danger"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path strokeLinecap="round" d="M12 8v5M12 16.5h.01" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-base font-bold text-fg">This page could not be loaded</h2>
        <p className="text-xs text-fg-subtle max-w-sm mx-auto leading-relaxed">
          Nothing was changed. You can retry, or use the navigation above to go
          somewhere else.
        </p>
        {error.digest && (
          <p className="text-[11px] text-fg-subtle pt-1">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover transition-all"
      >
        Try again
      </button>
    </div>
  );
}
