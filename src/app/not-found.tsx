import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-6 sm:p-8 text-center space-y-4">
        <p className="text-3xl font-bold text-accent-subtle">404</p>
        <div className="space-y-1.5">
          <h1 className="text-lg font-bold text-fg">Page not found</h1>
          <p className="text-xs text-fg-subtle leading-relaxed">
            That page does not exist, or you no longer have access to it.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block rounded-xl bg-accent px-5 py-2.5 text-xs font-semibold text-accent-fg hover:bg-accent-hover transition-all"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
