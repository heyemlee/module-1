import { cn } from "@/lib/utils";

/**
 * Instant-navigation skeletons. Rendered by each segment's `loading.tsx` the
 * moment a `<Link>` is clicked, so the page switch is visible immediately while
 * the server component resolves its data — instead of the browser sitting on
 * the previous page until the remote DB queries finish.
 */

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[#1d1d1f]/[0.07]", className)}
      aria-hidden
    />
  );
}


type SkeletonVariant = "dashboard" | "detail" | "table" | "plain" | "round1";

export function RouteSkeleton({
  variant = "plain",
}: {
  variant?: SkeletonVariant;
}) {
  return (
    <main className="min-h-[100dvh] bg-[#f5f5f7]" aria-busy>

      <div className="mx-auto max-w-[1320px] px-8 py-10">
        <Shimmer className="h-9 w-64" />
        <Shimmer className="mt-3 h-4 w-80" />

        {variant === "dashboard" && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[18px] border border-[#d2d2d7] bg-white p-5">
                <Shimmer className="h-5 w-1/2" />
                <Shimmer className="mt-3 h-4 w-3/4" />
                <Shimmer className="mt-6 h-8 w-24 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {variant === "detail" && (
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="rounded-[18px] border border-[#d2d2d7] bg-white p-6">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="mt-4 h-24 w-full" />
              </div>
              <div className="rounded-[18px] border border-[#d2d2d7] bg-white p-6">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="mt-4 h-24 w-full" />
              </div>
            </div>
            <div className="rounded-[18px] border border-[#d2d2d7] bg-white p-6">
              <Shimmer className="h-5 w-32" />
              <Shimmer className="mt-4 h-40 w-full" />
            </div>
          </div>
        )}

        {variant === "table" && (
          <div className="mt-8 overflow-hidden rounded-[18px] border border-[#d2d2d7] bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-[#ededf0] px-6 py-4 last:border-b-0"
              >
                <Shimmer className="h-4 w-40" />
                <Shimmer className="h-4 w-32" />
                <Shimmer className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {variant === "plain" && (
          <div className="mt-8 space-y-4">
            <Shimmer className="h-40 w-full rounded-[18px]" />
            <Shimmer className="h-40 w-full rounded-[18px]" />
          </div>
        )}
      </div>
    </main>
  );
}
