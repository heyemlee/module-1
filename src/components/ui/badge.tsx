import { cn } from "./cn";

type Tone = "neutral" | "primary" | "warning" | "success" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  warning: "bg-warning-surface text-warning-foreground border-warning/20",
  success: "bg-success-surface text-success-foreground border-success/20",
  danger: "bg-danger-surface text-danger-foreground border-danger/20",
  info: "bg-info/10 text-info border-info/20"
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium tracking-wide",
        tones[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
