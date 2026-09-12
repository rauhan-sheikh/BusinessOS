"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root error boundary.
 *
 * The application previously had none, so any uncaught server or render error
 * showed Next's default error screen - in production, a bare "Application error"
 * with no way back.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-6 sm:p-8 text-center space-y-4">
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
          <h1 className="text-lg font-bold text-fg">Something went wrong</h1>
          <p className="text-xs text-fg-subtle leading-relaxed">
            The page could not be loaded. Your data has not been changed.
          </p>
          {/* The digest is what correlates this with the server log. */}
          {error.digest && (
            <p className="text-[11px] text-fg-subtle pt-1">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover transition-all"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="w-full rounded-xl bg-raised border border-line px-4 py-2.5 text-xs font-semibold text-fg-muted hover:bg-line transition-all"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
