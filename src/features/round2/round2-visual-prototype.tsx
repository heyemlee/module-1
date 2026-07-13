"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, Cross2Icon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/server/platform/types";
import { DrawingReview } from "./drawings/drawing-review";
import { BasisGate } from "./handoff/basis-gate";
import { MeasurementWorkspace } from "./measurement/measurement-workspace";
import { ProposalWorkspace } from "./proposal/proposal-workspace";
import { hasBlockingDecisions } from "./model/round2-model";
import {
  createRound2PrototypeState,
  proposalUnlocked,
  reduceRound2Prototype
} from "./round2-state";
import {
  archiveRound2Draft,
  browserRound2DraftStorage,
  loadRound2Draft,
  reconcileDraftWithBasis,
  saveRound2Draft
} from "./round2-draft-storage";
import { Round2TaskNavigation } from "./round2-task-navigation";
import type {
  Round1ReferenceSource,
  Round2DemoRole
} from "./round2-types";
import { Round2WorkspaceShell } from "./round2-workspace-shell";

export type DesignBasisHandle = {
  version: number;
  lockedAt: string;
};

function initialDemoRole(actualRole: UserRole): Round2DemoRole {
  return actualRole === "SALES" ? "SALES" : "DESIGNER";
}

export function Round2VisualPrototype({
  projectId,
  projectName,
  customerName,
  actualRole,
  reference,
  basis,
  hasRenderings
}: {
  projectId: string;
  projectName: string;
  customerName: string;
  actualRole: UserRole;
  /** Round 1 package resolved from the locked design basis (null when unlocked). */
  reference: Round1ReferenceSource | null;
  basis: DesignBasisHandle | null;
  hasRenderings: boolean;
}) {
  const [state, dispatch] = useReducer(
    reduceRound2Prototype,
    initialDemoRole(actualRole),
    createRound2PrototypeState
  );
  const [archivedNotice, setArchivedNotice] = useState<{
    archivedVersion: number;
    newVersion: number;
  } | null>(null);
  const draftLoadedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    const storage = browserRound2DraftStorage();
    const draft = storage ? loadRound2Draft(storage, projectId) : null;

    draftLoadedRef.current = true;

    if (!basis || !reference) {
      // Nothing adoptable; the gate renders. A leftover locked draft (from the
      // old client-side lock flow) is parked under its versioned key so later
      // saves of the fresh state can't overwrite field work; the live draft
      // stays put so a matching basis locked later still resumes it.
      if (draft?.referenceLocked && storage) {
        archiveRound2Draft(storage, projectId, draft);
      }
      return;
    }

    const decision = reconcileDraftWithBasis(draft, {
      version: basis.version,
      snapshotId: reference.id
    });

    if (decision === "RESUME" && draft) {
      skipNextSaveRef.current = true;
      dispatch({ type: "RESTORE_DRAFT", state: draft });
      return;
    }

    if (decision === "ARCHIVE_AND_ADOPT" && draft && storage) {
      archiveRound2Draft(storage, projectId, draft);
      setArchivedNotice({
        archivedVersion: draft.referenceVersion,
        newVersion: basis.version
      });
    }

    dispatch({ type: "ADOPT_BASIS", reference, version: basis.version });
  }, [projectId, basis, reference]);

  useEffect(() => {
    if (!draftLoadedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const storage = browserRound2DraftStorage();
    if (!storage) return;

    saveRound2Draft(storage, projectId, state);
  }, [projectId, state]);

  const workspace = !state.referenceLocked ? (
    <BasisGate
      confirmHref={
        hasRenderings
          ? `/projects/${projectId}/renderings`
          : `/projects/${projectId}/round1`
      }
      hasRenderings={hasRenderings}
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
                <span>TECHNICAL DESIGN</span>
                <span className="size-1 rounded-full bg-[#a7a79f]" />
                <span>VISUAL PROTOTYPE</span>
                <span className="hidden xl:inline">· DRAFT AUTOSAVED LOCALLY</span>
                {basis && (
                  <span className="hidden lg:inline">
                    · BASIS v{basis.version}
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
            {basis && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/projects/${projectId}/renderings`}>
                  Change basis
                </Link>
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
            proposalUnlocked={proposalUnlocked(state)}
            drawingsBlocked={hasBlockingDecisions(state.model)}
          />
        ) : (
          <div className="flex min-h-[58px] items-center justify-between gap-4 px-5">
            <span className="font-mono text-[9px] tracking-[0.14em] text-studio-quiet">
              DESIGN BASIS REQUIRED
            </span>
            <span className="font-mono text-[8px] tracking-[0.1em] text-studio-quiet">
              TASKS LOCKED
            </span>
          </div>
        )
      }
    >
      <div className="flex h-full flex-col">
        {archivedNotice && (
          <div
            role="status"
            className="flex shrink-0 items-center justify-between gap-4 border-b border-[#d8bd84] bg-[#fbf4e4] px-5 py-2.5"
          >
            <p className="text-[11.5px] leading-4 text-[#755827]">
              The design basis was relocked as v{archivedNotice.newVersion}. Your
              previous draft (basis v{archivedNotice.archivedVersion}) was
              archived locally and this workspace restarted from the new basis.
            </p>
            <button
              type="button"
              aria-label="Dismiss archived draft notice"
              className="shrink-0 rounded-full p-1 text-[#805617] transition-colors hover:bg-[#f2e5c8]"
              onClick={() => setArchivedNotice(null)}
            >
              <Cross2Icon aria-hidden />
            </button>
          </div>
        )}
        <div className="min-h-0 min-w-0 flex-1">{workspace}</div>
      </div>
    </Round2WorkspaceShell>
  );
}
