"use client";

import { cn } from "@/lib/utils";
import type { Round2Task } from "./round2-types";

const TASKS = [
  { id: "MEASUREMENT", label: "Field Measurement", meta: "SALES" },
  { id: "PROPOSAL", label: "Design Proposal", meta: "DESIGNER" },
  { id: "DRAWINGS", label: "Drawings & Review", meta: "OUTPUT" }
] as const;

export function Round2TaskNavigation({
  task,
  onTaskChange
}: {
  task: Round2Task;
  onTaskChange: (task: Round2Task) => void;
}) {
  return (
    <nav aria-label="Round 2 tasks">
      <ol className="grid grid-cols-3">
        {TASKS.map((item, index) => {
          const active = item.id === task;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onTaskChange(item.id)}
                className={cn(
                  "flex min-h-[58px] w-full items-center justify-center gap-2 border-b-2 px-2 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-studio-action sm:justify-start sm:gap-3 sm:px-[18px]",
                  active
                    ? "border-studio-ink bg-white/70"
                    : "border-transparent hover:bg-white/40"
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
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-[13px] font-semibold">
                    {item.label}
                  </span>
                  <span className="block font-mono text-[9px] tracking-[0.12em] text-studio-quiet">
                    {item.meta}
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
