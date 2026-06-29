import { MorphingSquare } from "@/components/ui/morphing-square";

// Matches the client-side draft loader in ShowroomIntakeApp so route-level and
// in-app loading look identical — no second, different spinner.
export default function Loading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-studio-void text-studio-ink">
      <MorphingSquare message="Loading draft..." />
    </main>
  );
}
