"use client";

import Link from "next/link";

export default function Error({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f5f7] px-6 text-center text-[#1d1d1f]">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#6e6e73]">
        Something went wrong
      </p>
      <h1
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
      >
        Unexpected error
      </h1>
      <p className="max-w-md text-[#6e6e73]">
        An unexpected error occurred. You can try again, or go back to your projects.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-[42px] items-center rounded-full border border-[#d2d2d7] bg-white px-5 text-[13px] font-semibold text-[#1d1d1f] transition hover:border-[#1d1d1f]/40"
        >
          Try again
        </button>
        <Link
          href="/projects"
          className="inline-flex h-[42px] items-center rounded-full bg-[#1d1d1f] px-5 text-[13px] font-semibold text-white transition hover:opacity-90"
        >
          Back to projects
        </Link>
      </div>
    </main>
  );
}
