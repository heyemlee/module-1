"use client";

import type { Dispatch } from "react";
import type {
  Round2PrototypeAction,
  Round2PrototypeState,
  WallId
} from "../round2-types";
import { DesignPlan } from "./design-plan";
import { DecisionRail } from "./decision-rail";
import { WallElevation } from "./wall-elevation";

export function ProposalWorkspace({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const selectObject = (objectId: string, wall: WallId) =>
    dispatch({ type: "SELECT_OBJECT", objectId, wall });
  const canEdit =
    state.role === "DESIGNER" && state.measurementStatus === "SUBMITTED";

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-canvas">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.45fr)] lg:overflow-hidden">
        {/* The elevation is the primary editing surface; the top view shrinks
            to a read-only minimap that only navigates the selection. */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <WallElevation
              wallId={state.selectedWall}
              model={state.model}
              designIntent={state.designIntent}
              selectedObjectId={state.selectedObjectId}
              canEdit={canEdit}
              onSelect={selectObject}
              onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
              dispatch={dispatch}
            />
          </div>
          <div className="h-[236px] w-full max-w-[420px] shrink-0">
            <DesignPlan
              model={state.model}
              selectedObjectId={state.selectedObjectId}
              onSelect={selectObject}
            />
          </div>
        </div>
        <DecisionRail state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
