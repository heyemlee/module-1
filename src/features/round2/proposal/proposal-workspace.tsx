"use client";

import type { Dispatch } from "react";
import { cn } from "@/lib/utils";
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
  const walls = state.model?.walls ?? [];
  const selectObject = (objectId: string, wall: WallId) =>
    dispatch({ type: "SELECT_OBJECT", objectId, wall });

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-canvas">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)_280px] xl:overflow-hidden">
        <DesignPlan
          model={state.model}
          selectedObjectId={state.selectedObjectId}
          onSelect={selectObject}
        />
        <WallElevation
          wallId={state.selectedWall}
          model={state.model}
          selectedObjectId={state.selectedObjectId}
          onSelect={selectObject}
          onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
        />
        <div className="lg:col-span-2 xl:col-span-1">
          <DecisionRail state={state} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}
