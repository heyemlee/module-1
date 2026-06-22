"use client";

import Link from "next/link";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center text-stone-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold">Unexpected error</h1>
      <p className="max-w-md text-stone-600">
        An unexpected error occurred. You can try again, or go back to your projects.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
        >
          Try again
        </button>
        <Link
          href="/projects"
          className="rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
