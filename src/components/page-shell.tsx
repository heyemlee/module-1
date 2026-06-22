import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/components/ui/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-foreground">
        <div className="h-2 w-2 rounded-[2px] bg-background" />
      </div>
      <span className="text-[17px] font-bold tracking-tight text-foreground">kabi</span>
    </div>
  );
}

// Top bar + centered content used across all platform pages.
export function PageShell({
  children,
  width = "max-w-6xl",
  actions,
  backHref,
  backLabel = "Back"
}: {
  children: React.ReactNode;
  width?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className={cn("mx-auto flex items-center justify-between gap-4 px-6 py-3", width)}>
          <Link href="/projects" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </header>
      <main className={cn("mx-auto px-6 py-8", width)}>
        {backHref && (
          <Link
            href={backHref}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}
