"use client";

import type { Dispatch } from "react";
import { cn } from "@/lib/utils";
import { ROUND2_CABINET_FIXTURE } from "../round2-fixtures";
import type {
  Round2PrototypeAction,
  Round2PrototypeState,
  WallId
} from "../round2-types";
import { DesignPlan } from "./design-plan";
import { DecisionRail } from "./decision-rail";
import { WallElevation } from "./wall-elevation";

const WALLS: readonly WallId[] = ["A", "B", "C"];

export function ProposalWorkspace({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selectObject = (objectId: string, wall: WallId) =>
    dispatch({ type: "SELECT_OBJECT", objectId, wall });

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-canvas">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-line bg-white/55 px-5 py-3 backdrop-blur-lg">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[9px] tracking-[0.14em] text-studio-quiet">
              DESIGN PROPOSAL v{state.proposalVersion}
            </p>
            <span className="size-1 rounded-full bg-studio-quiet" />
            <p className="font-mono text-[9px] tracking-[0.1em] text-studio-quiet">
              MEASUREMENT v{state.measurementVersion} · LOCKED
            </p>
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">
            Top view + selected elevation
          </h2>
        </div>
        <div className="flex items-center gap-1 rounded-studio-control border border-white/80 bg-white/55 p-1">
          {WALLS.map((wall) => (
            <button
              key={wall}
              type="button"
              aria-pressed={state.selectedWall === wall}
              onClick={() => dispatch({ type: "SELECT_WALL", wall })}
              className={cn(
                "grid size-9 place-items-center rounded-[9px] font-mono text-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-studio-action",
                state.selectedWall === wall
                  ? "bg-studio-ink text-white"
                  : "text-studio-muted hover:bg-white"
              )}
            >
              {wall}
            </button>
          ))}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)_280px] xl:overflow-hidden">
        <DesignPlan
          cabinets={ROUND2_CABINET_FIXTURE}
          selectedObjectId={state.selectedObjectId}
          onSelect={selectObject}
        />
        <WallElevation
          wall={state.selectedWall}
          cabinets={ROUND2_CABINET_FIXTURE}
          selectedObjectId={state.selectedObjectId}
          onSelect={selectObject}
        />
        <div className="lg:col-span-2 xl:col-span-1">
          <DecisionRail state={state} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
