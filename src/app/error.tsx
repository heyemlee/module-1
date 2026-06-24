"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-studio-void px-6 text-center text-studio-ink">
      <p className="text-[14px] font-semibold tracking-wide text-studio-muted">
        Something went wrong
      </p>
      <h1 className="text-[32px] font-semibold tracking-[-0.035em]">
        Unexpected error
      </h1>
      <p className="max-w-md text-[15px] leading-6 text-studio-muted">
        An unexpected error occurred. You can try again, or go back to your projects.
      </p>
      <div className="mt-4 flex gap-3">
        <Button
          type="button"
          onClick={reset}
          variant="secondary"
          size="lg"
        >
          Try again
        </Button>
        <Button asChild size="lg">
          <Link href="/projects">
            Back to projects
          </Link>
        </Button>
      </div>
    </main>
  );
}
