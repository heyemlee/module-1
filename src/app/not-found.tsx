import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-studio-void px-6 text-center text-studio-ink">
      <p className="text-[14px] font-semibold tracking-wide text-studio-muted">404</p>
      <h1 className="text-[32px] font-semibold tracking-[-0.035em]">
        Page not found
      </h1>
      <p className="max-w-md text-[15px] leading-6 text-studio-muted">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <div className="mt-4">
        <Button asChild size="lg">
          <Link href="/projects">
            Back to projects
          </Link>
        </Button>
      </div>
    </main>
  );
}
