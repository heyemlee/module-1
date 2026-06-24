import { RouteSkeleton } from "@/features/platform/route-skeleton";

// Global fallback: any segment without its own loading.tsx uses this, so every
// navigation shows an instant transition while the server component resolves.
export default function Loading() {
  return <RouteSkeleton variant="plain" />;
}
