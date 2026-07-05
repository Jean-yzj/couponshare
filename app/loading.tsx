import { Skeleton } from "@/components/ui";

// Streamed to the browser immediately (App Router wraps the page in a Suspense
// boundary with this fallback) while the server runs auth + the feed queries.
// Without it, a high-latency mobile connection stares at a blank screen for the
// full server round-trip; with it, the app frame + card skeletons appear right
// away and the real feed swaps in when ready. Mirrors the FeedView first-load
// layout so the swap is seamless.
export default function HomeLoading() {
  return (
    <div>
      <Skeleton className="mb-4 h-8 w-36" />

      <div className="-mx-4 mb-6 space-y-3 border-y border-line/70 bg-canvas px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
        <Skeleton className="h-11 rounded-xl" />
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
