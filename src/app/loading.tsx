/**
 * Route-level loading UI (Next.js loading.js convention) — shown instantly
 * while a page's server component fetches data from Supabase.
 * Applies to every route under the root layout.
 */
export default function Loading() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ minHeight: '55vh', color: 'var(--text-faint)' }}
      role="status"
      aria-label="Loading"
    >
      <span className="app-spinner" aria-hidden />
      <span className="text-[13px]">Loading stats…</span>
    </div>
  )
}
