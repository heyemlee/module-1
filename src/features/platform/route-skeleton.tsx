import { cn } from "@/lib/utils";
import { StudioPage } from "./studio-page";

/**
 * Instant-navigation skeletons. Rendered by each segment's `loading.tsx` the
 * moment a `<Link>` is clicked, so the page switch is visible immediately while
 * the server component resolves its data — instead of the browser sitting on
 * the previous page until the remote DB queries finish.
 */

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn("studio-skeleton rounded-md bg-studio-line-strong", className)}
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
    <StudioPage aria-busy="true">
      <span className="sr-only">Loading {variant} view...</span>

      {variant !== "round1" && (
        <header className="flex flex-col gap-5 border-b border-studio-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-3">
              <Shimmer className="h-10 w-48" />
            </div>
            <Shimmer className="h-9 w-64" />
            <Shimmer className="mt-2 h-5 w-96" />
          </div>
        </header>
      )}

      {variant === "dashboard" && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-studio-panel border border-studio-line bg-studio-shell p-5">
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
            <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6">
              <Shimmer className="h-5 w-40" />
              <Shimmer className="mt-4 h-24 w-full" />
            </div>
            <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6">
              <Shimmer className="h-5 w-40" />
              <Shimmer className="mt-4 h-24 w-full" />
            </div>
          </div>
          <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="mt-4 h-40 w-full" />
          </div>
        </div>
      )}

      {variant === "table" && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="rounded-studio-panel border border-studio-line bg-studio-shell p-6">
            <Shimmer className="h-5 w-1/4 mb-4" />
            <div className="flex items-center justify-between border-b border-studio-line pb-4">
              <Shimmer className="h-8 w-64" />
              <Shimmer className="h-8 w-24" />
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-studio-line bg-studio-void">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-studio-line px-4 py-3 last:border-b-0"
                >
                  <Shimmer className="size-8 rounded-full shrink-0" />
                  <Shimmer className="h-4 w-40" />
                  <Shimmer className="h-4 w-32" />
                  <Shimmer className="ml-auto h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {variant === "plain" && (
        <div className="mt-8 space-y-4">
          <Shimmer className="h-40 w-full rounded-studio-panel bg-studio-shell" />
          <Shimmer className="h-40 w-full rounded-studio-panel bg-studio-shell" />
        </div>
      )}

      {variant === "round1" && (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-4">
            <Shimmer className="size-16 rounded-lg" />
            <Shimmer className="size-16 rounded-lg" />
            <Shimmer className="size-16 rounded-lg" />
          </div>
          <Shimmer className="h-6 w-48 mt-4" />
        </div>
      )}
    </StudioPage>
  );
}
