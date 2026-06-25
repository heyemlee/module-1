import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Round1Inspector({
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
      className={cn(
        "flex min-h-0 flex-col bg-studio-paper text-studio-paper-ink",
        className
      )}
    >
      {!hideHeader && (
        <header className="border-b border-studio-paper-line px-5 py-5">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 text-[12px] leading-5 text-studio-paper-muted-ink">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {children}
        {suggestion && (
          <section
            aria-label="Assistant suggestion"
            className="mt-5 rounded-studio-control bg-studio-paper-muted p-3 text-[12px] leading-5"
          >
            {suggestion}
          </section>
        )}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-studio-paper-line bg-studio-paper px-5 py-4">
        <Button
          type="button"
          variant="inspector"
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
