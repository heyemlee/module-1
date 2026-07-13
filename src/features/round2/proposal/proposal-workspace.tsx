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

const PROPOSAL_SURFACE_CLASS = "h-[440px] min-h-[440px] w-full shrink-0";

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
        {/* The elevation remains the primary editor; the top view is a full-size
            read-only reference stacked directly underneath it. */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <div
            data-testid="proposal-elevation-panel"
            className={PROPOSAL_SURFACE_CLASS}
          >
            <WallElevation
              wallId={state.selectedWall}
              model={state.model}
              designIntent={state.designIntent}
              selectedObjectId={state.selectedObjectId}
              lastAbsorbed={state.lastAbsorbed}
              canEdit={canEdit}
              onSelect={selectObject}
              onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
              dispatch={dispatch}
            />
          </div>
          <div
            data-testid="proposal-plan-panel"
            className={PROPOSAL_SURFACE_CLASS}
          >
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
