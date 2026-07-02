"use client";

import type { ReactNode } from "react";

export function Round2WorkspaceShell({
  projectBar,
  taskBar,
  children
}: {
  projectBar: ReactNode;
  taskBar: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex h-[100dvh] min-w-0 flex-col overflow-hidden bg-studio-void text-studio-ink">
      <div
        data-round2-region="project"
        className="relative z-30 border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl"
      >
        {projectBar}
      </div>
      <div
        data-round2-region="tasks"
        className="relative z-20 border-b border-studio-line bg-white/45 backdrop-blur-md"
      >
        {taskBar}
      </div>
      <section
        data-round2-region="workspace"
        className="relative min-h-0 min-w-0 flex-1"
      >
        {children}
      </section>
    </main>
  );
}
