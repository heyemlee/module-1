"use client";

import Link from "next/link";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold">Unexpected error</h1>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred. You can try again, or go back to your projects.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
        >
          Try again
        </button>
        <Link
          href="/projects"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
