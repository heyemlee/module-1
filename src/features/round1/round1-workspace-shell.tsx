"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function Round1WorkspaceShell({
  projectBar,
  stepStrip,
  leftPanel,
  canvas
}: {
  projectBar: ReactNode;
  stepStrip: ReactNode;
  /** Step form panel (left, 380px). Null on canvas-only steps. */
  leftPanel?: ReactNode;
  canvas: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.2, 0.8, 0.2, 1] as const };

  return (
    <main className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-void text-studio-ink">
      <div
        data-workspace-region="bar"
        className="sticky top-0 z-30 border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl"
      >
        {projectBar}
      </div>

      <div
        data-workspace-region="steps"
        className="border-b border-[rgba(20,20,26,0.07)] bg-[rgba(247,247,245,0.6)] backdrop-blur-sm"
      >
        {stepStrip}
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1",
          leftPanel && "md:grid-cols-[380px_minmax(0,1fr)]"
        )}
      >
        {leftPanel && (
          <motion.aside
            layout
            transition={transition}
            data-workspace-region="form"
            className="min-h-0 overflow-y-auto border-b border-studio-line bg-[rgba(250,250,249,0.55)] backdrop-blur-md md:border-b-0 md:border-r"
          >
            {leftPanel}
          </motion.aside>
        )}

        <motion.section
          layout
          transition={transition}
          data-workspace-region="canvas"
          className="relative min-h-[420px] min-w-0 overflow-hidden md:min-h-0"
        >
          {canvas}
        </motion.section>
      </div>
    </main>
  );
}
