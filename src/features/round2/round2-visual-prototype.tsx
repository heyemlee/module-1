"use client";

import { useReducer } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/server/platform/types";
import { DrawingReview } from "./drawings/drawing-review";
import { MeasurementWorkspace } from "./measurement/measurement-workspace";
import { ProposalWorkspace } from "./proposal/proposal-workspace";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "./round2-state";
import { Round2TaskNavigation } from "./round2-task-navigation";
import type { Round2DemoRole } from "./round2-types";
import { Round2WorkspaceShell } from "./round2-workspace-shell";

function initialDemoRole(actualRole: UserRole): Round2DemoRole {
  return actualRole === "SALES" ? "SALES" : "DESIGNER";
}

export function Round2VisualPrototype({
  projectId,
  projectName,
  customerName,
  actualRole
}: {
  projectId: string;
  projectName: string;
  customerName: string;
  actualRole: UserRole;
}) {
  const [state, dispatch] = useReducer(
    reduceRound2Prototype,
    initialDemoRole(actualRole),
    createRound2PrototypeState
  );

  const workspace =
    state.task === "MEASUREMENT" ? (
      <MeasurementWorkspace state={state} dispatch={dispatch} />
    ) : state.task === "PROPOSAL" ? (
      <ProposalWorkspace state={state} dispatch={dispatch} />
    ) : (
      <DrawingReview state={state} dispatch={dispatch} />
    );

  return (
    <Round2WorkspaceShell
      projectBar={
        <header className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Button asChild variant="ghost" size="icon" className="shrink-0">
              <Link href={`/projects/${projectId}`} aria-label="Back to project">
                <ChevronLeftIcon aria-hidden />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-studio-ink">
                  {projectName}
                </span>
                <span className="hidden font-mono text-[9px] tracking-[0.12em] text-studio-quiet sm:inline">
                  · {customerName.toUpperCase()}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[8.5px] tracking-[0.12em] text-studio-quiet">
                <span>ROUND 2</span>
                <span className="size-1 rounded-full bg-[#a7a79f]" />
                <span>VISUAL PROTOTYPE</span>
                <span className="hidden sm:inline">· CHANGES ARE NOT SAVED</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-studio-line bg-white/60 px-2.5 py-1 font-mono text-[8.5px] tracking-[0.08em] text-studio-muted md:inline">
              {state.role} VIEW
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                dispatch({
                  type: "SET_ROLE",
                  role: state.role === "SALES" ? "DESIGNER" : "SALES"
                })
              }
            >
              View as {state.role === "SALES" ? "Designer" : "Sales"}
            </Button>
          </div>
        </header>
      }
      taskBar={
        <Round2TaskNavigation
          task={state.task}
          onTaskChange={(task) => dispatch({ type: "SET_TASK", task })}
        />
      }
    >
      {workspace}
    </Round2WorkspaceShell>
  );
}
