import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Round1Inspector({
  eyebrow,
  title,
  description,
  children,
  suggestion,
  previousDisabled,
  continueDisabled,
  continueLabel = "Continue",
  onPrevious,
  onContinue,
  footerContent,
  className,
  hideHeader
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  suggestion?: ReactNode;
  previousDisabled: boolean;
  continueDisabled?: boolean;
  continueLabel?: string;
  onPrevious: () => void;
  onContinue?: () => void;
  footerContent?: ReactNode;
  className?: string;
  hideHeader?: boolean;
}) {
  return (
    <aside
      aria-label={`${title} settings`}
      className={cn("flex min-h-0 flex-col text-studio-ink", className)}
    >
      {!hideHeader && (
        <header className="px-[26px] pb-4 pt-[26px]">
          {eyebrow && <p className="studio-eyebrow mb-1.5">{eyebrow}</p>}
          <h2 className="text-[23px] font-semibold tracking-[-0.02em] text-[#16161a]">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-[12px] leading-5 text-studio-muted">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-[26px] pb-[22px] pt-2">
        {children}
        {suggestion && (
          <section
            aria-label="Assistant suggestion"
            className="mt-5 rounded-[11px] border border-white/80 bg-white/60 px-3 py-2.5 text-[12.5px] leading-[1.45] text-[#54544f]"
          >
            {suggestion}
          </section>
        )}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-[rgba(20,20,26,0.08)] px-[26px] py-4">
        <Button
          type="button"
          variant="ghost"
          disabled={previousDisabled}
          onClick={onPrevious}
        >
          Previous
        </Button>
        {footerContent ??
          (onContinue && (
            <Button
              type="button"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel}
            </Button>
          ))}
      </footer>
    </aside>
  );
}
