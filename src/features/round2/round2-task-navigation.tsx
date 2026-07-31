"use client";

import { LockClosedIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import type { Round2Task } from "./round2-types";

const TASKS = [
  { id: "MEASUREMENT", label: "Field Measurement", meta: "SALES" },
  { id: "INTENT", label: "Design Intent", meta: "SALES" },
  { id: "PROPOSAL", label: "Design Proposal", meta: "DESIGNER" },
  { id: "DRAWINGS", label: "Drawings & Review", meta: "OUTPUT" }
] as const;

export function Round2TaskNavigation({
  task,
  onTaskChange,
  intentUnlocked = true,
  proposalUnlocked = true,
  drawingsBlocked = false,
  openIntentCount = 0
}: {
  task: Round2Task;
  onTaskChange: (task: Round2Task) => void;
  /** Design intent stays locked until the room is fully measured. */
  intentUnlocked?: boolean;
  /** Proposal/Drawings stay locked until the proposal has been generated. */
  proposalUnlocked?: boolean;
  /** Drawings stay locked while any blocking decision is unresolved. */
  drawingsBlocked?: boolean;
  /**
   * Unconfirmed design-intent questions, surfaced on the stage chip so the count
   * is visible without opening the stage.
   */
  openIntentCount?: number;
}) {
  return (
    <nav aria-label="Round 2 tasks">
      <ol className="grid grid-cols-2 sm:grid-cols-4">
        {TASKS.map((item, index) => {
          const active = item.id === task;
          const measurementLocked =
            (!proposalUnlocked &&
              (item.id === "PROPOSAL" || item.id === "DRAWINGS")) ||
            (!intentUnlocked && item.id === "INTENT");
          const blockingLocked =
            !measurementLocked && drawingsBlocked && item.id === "DRAWINGS";
          const locked = measurementLocked || blockingLocked;
          const lockTitle = blockingLocked
            ? "Resolve blocking issues to unlock"
            : item.id === "INTENT"
              ? "Capture every measurement to unlock"
              : "Generate the proposal to unlock";
          const lockMeta = blockingLocked ? "BLOCKED" : "LOCKED";
          // The intent chip carries its own outstanding count, so the number of
          // questions still open is legible from the stage bar.
          const meta =
            item.id === "INTENT" && !locked && openIntentCount > 0
              ? `${openIntentCount} OPEN`
              : item.meta;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-disabled={locked || undefined}
                disabled={locked}
                title={locked ? lockTitle : undefined}
                onClick={() => onTaskChange(item.id)}
                className={cn(
                  "flex min-h-[58px] w-full items-center justify-center gap-2 border-b-2 px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-studio-action sm:justify-start sm:px-3 lg:gap-3 lg:px-[18px]",
                  active
                    ? "border-studio-ink bg-white/70"
                    : "border-transparent hover:bg-white/40",
                  locked && "cursor-not-allowed opacity-45 hover:bg-transparent"
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full font-mono text-[10px]",
                    active
                      ? "bg-studio-ink text-white"
                      : "bg-white/65 text-studio-quiet"
                  )}
                >
                  {locked ? (
                    <LockClosedIcon aria-hidden className="size-3" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.label}
                  </span>
                  <span
                    className={cn(
                      "block font-mono text-[9px] tracking-[0.12em]",
                      !locked && meta !== item.meta
                        ? "text-[#9a5b17]"
                        : "text-studio-quiet"
                    )}
                  >
                    {locked ? lockMeta : meta}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
