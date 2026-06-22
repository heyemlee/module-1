import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center text-stone-950">
      <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-stone-600">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/projects"
        className="rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white"
      >
        Back to projects
      </Link>
    </main>
  );
}
