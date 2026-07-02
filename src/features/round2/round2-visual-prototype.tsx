"use client";

import { useReducer } from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/server/platform/types";
import { DrawingReview } from "./drawings/drawing-review";
import { Round1Handoff } from "./handoff/round1-handoff";
import { MeasurementWorkspace } from "./measurement/measurement-workspace";
import { ProposalWorkspace } from "./proposal/proposal-workspace";
import {
  createRound2PrototypeState,
  reduceRound2Prototype
} from "./round2-state";
import { Round2TaskNavigation } from "./round2-task-navigation";
import type {
  Round1ReferenceSource,
  Round2DemoRole
} from "./round2-types";
import { Round2WorkspaceShell } from "./round2-workspace-shell";

function initialDemoRole(actualRole: UserRole): Round2DemoRole {
  return actualRole === "SALES" ? "SALES" : "DESIGNER";
}

export function Round2VisualPrototype({
  projectId,
  projectName,
  customerName,
  actualRole,
  reference
}: {
  projectId: string;
  projectName: string;
  customerName: string;
  actualRole: UserRole;
  reference: Round1ReferenceSource | null;
}) {
  const [state, dispatch] = useReducer(
    reduceRound2Prototype,
    initialDemoRole(actualRole),
    createRound2PrototypeState
  );

  const workspace = !state.referenceLocked ? (
    <Round1Handoff
      reference={reference}
      role={state.role}
      round1Href={`/projects/${projectId}/round1`}
      nextReferenceVersion={state.referenceVersion + 1}
      onLock={(lockedReference) =>
        dispatch({
          type:
            state.referenceVersion === 0
              ? "LOCK_REFERENCE"
              : "REPLACE_REFERENCE",
          reference: lockedReference
        })
      }
    />
  ) : state.task === "MEASUREMENT" ? (
      <MeasurementWorkspace state={state} dispatch={dispatch} />
    ) : state.task === "PROPOSAL" ? (
      <ProposalWorkspace state={state} dispatch={dispatch} />
    ) : (
      <DrawingReview
        state={state}
        dispatch={dispatch}
        customerName={customerName}
        projectName={projectName}
      />
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
                <span className="hidden xl:inline">· CHANGES ARE NOT SAVED</span>
                {state.referenceLocked && (
                  <span className="hidden lg:inline">
                    · ROUND 1 REF v{state.referenceVersion}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-studio-line bg-white/60 px-2.5 py-1 font-mono text-[8.5px] tracking-[0.08em] text-studio-muted xl:inline">
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
            {state.referenceLocked && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  dispatch({ type: "OPEN_REFERENCE_HANDOFF" })
                }
              >
                Change Round 1
              </Button>
            )}
          </div>
        </header>
      }
      taskBar={
        state.referenceLocked ? (
          <Round2TaskNavigation
            task={state.task}
            onTaskChange={(task) => dispatch({ type: "SET_TASK", task })}
          />
        ) : (
          <div className="flex min-h-[58px] items-center justify-between gap-4 px-5">
            <span className="font-mono text-[9px] tracking-[0.14em] text-studio-quiet">
              ROUND 1 REFERENCE REQUIRED
            </span>
            <span className="font-mono text-[8px] tracking-[0.1em] text-studio-quiet">
              TASKS LOCKED
            </span>
          </div>
        )
      }
    >
      {workspace}
    </Round2WorkspaceShell>
  );
}
