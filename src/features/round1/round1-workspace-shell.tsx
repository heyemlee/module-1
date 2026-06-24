"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { WorkspaceMode } from "./workspace-mode";

export function Round1WorkspaceShell({
  mode,
  projectBar,
  stepNavigation,
  mobileStepNavigation,
  canvas,
  inspector,
  rail
}: {
  mode: WorkspaceMode;
  projectBar: ReactNode;
  stepNavigation: ReactNode;
  mobileStepNavigation?: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  rail?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <div className="grid min-h-[100dvh] grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[188px_minmax(0,1fr)]">
      <div className="hidden md:block">{rail}</div>
      <div className="min-w-0">
        <main
          data-workspace-mode={mode}
          className="min-h-[100dvh] bg-studio-void text-studio-ink"
        >
          <div className="sticky top-0 z-30 border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl">
        {projectBar}
      </div>

      <div
        className={cn(
          "grid min-h-[calc(100dvh-56px)] grid-cols-1 bg-studio-void",
          "md:grid-cols-[minmax(0,1fr)]",
          mode === "guided"
            ? "xl:grid-cols-[176px_minmax(0,1fr)_320px]"
            : "xl:grid-cols-[56px_minmax(0,1fr)_320px]"
        )}
      >
        <motion.aside
          layout
          transition={transition}
          data-workspace-region="steps"
          className="hidden border-r border-studio-line bg-[#0e1713] p-3 xl:block"
        >
          {stepNavigation}
        </motion.aside>

        <motion.section
          layout
          transition={transition}
          data-workspace-region="canvas"
          className="relative min-h-[560px] min-w-0 overflow-hidden bg-studio-void p-3 md:min-h-[calc(100dvh-56px)]"
        >
          <div className="mb-3 xl:hidden">{mobileStepNavigation ?? stepNavigation}</div>
          {canvas}
        </motion.section>

        <motion.div
          layout
          transition={transition}
          data-workspace-region="inspector"
          className={cn(
            "min-h-0 border-studio-line",
            "max-xl:border-t",
            "xl:border-l",
            "max-md:sticky max-md:bottom-0 max-md:z-20 max-md:max-h-[52dvh] max-md:overflow-hidden max-md:rounded-t-[16px] max-md:shadow-[0_-20px_60px_rgba(0,0,0,0.34)]"
          )}
        >
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/25 md:hidden" />
          {inspector}
        </motion.div>
      </div>
        </main>
      </div>
    </div>
  );
}
