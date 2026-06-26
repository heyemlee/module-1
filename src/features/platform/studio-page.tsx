import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StudioPage({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn(
        "min-h-[100dvh] bg-studio-void px-4 py-6 text-studio-ink sm:px-6 lg:px-8 lg:py-8",
        className
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-[1320px]">{children}</div>
    </main>
  );
}

export function StudioPageHeader({
  title,
  description,
  action,
  meta
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-studio-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {meta && <div className="mb-3">{meta}</div>}
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-studio-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-5 text-studio-muted">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div data-page-action="true" className="shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}

export function StudioSection({
  children,
  className,
  "aria-label": ariaLabel
}: {
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "studio-glass rounded-studio-panel",
        className
      )}
    >
      {children}
    </section>
  );
}

export function StudioStat({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "action" | "warning";
}) {
  return (
    <div
      data-stat-tone={tone}
      className="min-w-0 border-l border-studio-line pl-4 first:border-l-0 first:pl-0"
    >
      <p className="text-[11px] font-medium text-studio-quiet">{label}</p>
      <p
        className={cn(
          "mt-1 text-[22px] font-semibold tabular-nums",
          tone === "action" ? "text-studio-action" : "text-studio-ink",
          tone === "warning" && "text-studio-warning"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function StudioEmptyState({
  title,
  description,
  action,
  className
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-empty-state="true"
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <h2 className="text-[18px] font-semibold text-studio-ink">{title}</h2>
      <p className="mt-2 max-w-md text-[13px] leading-5 text-studio-muted">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
