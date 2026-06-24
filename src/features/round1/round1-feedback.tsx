import {
  CheckCircledIcon,
  ClockIcon,
  CrossCircledIcon,
  ReloadIcon,
  UpdateIcon
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";

export type Round1FeedbackState =
  | "saving"
  | "saved"
  | "stale"
  | "generating"
  | "success"
  | "error";

const feedbackConfig = {
  saving: {
    Icon: UpdateIcon,
    tone: "text-studio-muted",
    iconClassName: "motion-safe:animate-spin"
  },
  saved: {
    Icon: CheckCircledIcon,
    tone: "text-studio-success",
    iconClassName: undefined
  },
  stale: {
    Icon: ClockIcon,
    tone: "text-studio-warning",
    iconClassName: undefined
  },
  generating: {
    Icon: ReloadIcon,
    tone: "text-studio-action",
    iconClassName: "motion-safe:animate-spin"
  },
  success: {
    Icon: CheckCircledIcon,
    tone: "text-studio-success",
    iconClassName: undefined
  },
  error: {
    Icon: CrossCircledIcon,
    tone: "text-studio-danger",
    iconClassName: undefined
  }
} satisfies Record<
  Round1FeedbackState,
  {
    Icon: typeof CheckCircledIcon;
    tone: string;
    iconClassName: string | undefined;
  }
>;

export function Round1Feedback({
  state,
  message,
  className
}: {
  state: Round1FeedbackState;
  message: string;
  className?: string;
}) {
  const isError = state === "error";
  const { Icon, tone, iconClassName } = feedbackConfig[state];

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      data-feedback-state={state}
      className={cn(
        "inline-flex items-center gap-2 text-[13px] font-medium",
        tone,
        className
      )}
    >
      <Icon aria-hidden="true" className={cn("size-4 shrink-0", iconClassName)} />
      <span>{message}</span>
    </div>
  );
}
