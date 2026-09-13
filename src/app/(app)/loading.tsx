/**
 * Shown while an authenticated page streams in.
 *
 * A skeleton rather than a spinner: these pages render a header, summary tiles
 * and a list, so holding that shape avoids the layout jumping once data lands.
 */
export default function AppLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-raised" />
        <div className="h-4 w-80 max-w-full rounded bg-raised/60" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface border border-line p-5 space-y-3">
            <div className="h-3 w-24 rounded bg-raised" />
            <div className="h-7 w-32 rounded-lg bg-raised" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-surface border border-line p-6 space-y-4">
        <div className="h-4 w-48 rounded bg-raised" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-2">
              <div className="h-3.5 w-40 rounded bg-raised" />
              <div className="h-3 w-24 rounded bg-raised/60" />
            </div>
            <div className="h-4 w-20 rounded bg-raised" />
          </div>
        ))}
      </div>
    </div>
  );
}
