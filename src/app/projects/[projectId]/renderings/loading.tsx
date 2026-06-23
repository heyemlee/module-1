import { RouteSkeleton } from "@/features/platform/route-skeleton";

// The gallery is a card grid, so the dashboard skeleton matches it best.
export default function Loading() {
  return <RouteSkeleton variant="dashboard" />;
}
