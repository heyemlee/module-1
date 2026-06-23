import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f5f7] px-6 text-center text-[#1d1d1f]">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#6e6e73]">404</p>
      <h1
        className="text-3xl font-bold"
        style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
      >
        Page not found
      </h1>
      <p className="max-w-md text-[#6e6e73]">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/projects"
        className="inline-flex h-[42px] items-center rounded-full bg-[#1d1d1f] px-5 text-[13px] font-semibold text-white transition hover:opacity-90"
      >
        Back to projects
      </Link>
    </main>
  );
}
