"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  findSegment,
  findWall,
  formatSixteenths,
  type CabinetKind
} from "../model/round2-model";
import { standardWidthOptionsSixteenths } from "../model/adjustments";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

export function DecisionRail({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const remeasureRequested =
    state.measurementStatus === "REMEASURE_REQUESTED";
  const selectedSegment = findSegment(state.model, state.selectedObjectId);
  const selectedWall = findWall(state.model, state.selectedWall);
  const decisions = state.model?.decisionItems ?? [];
  const canAdjust =
    state.role === "DESIGNER" &&
    state.measurementStatus === "SUBMITTED" &&
    Boolean(selectedSegment);
  const canResize =
    canAdjust &&
    selectedSegment != null &&
    (selectedSegment.kind === "cabinet" ||
      selectedSegment.kind === "appliance");
  const canMoveFiller =
    canAdjust && selectedSegment?.kind === "filler";

  return (
    <aside className="h-full min-h-0 overflow-y-auto rounded-[18px] border border-studio-line bg-white/65 p-4 shadow-[0_18px_42px_-32px_rgba(20,20,26,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3 border-b border-studio-line pb-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
            DECISION QUEUE
          </p>
          <h3 className="mt-1.5 text-[16px] font-semibold">Design context</h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 font-mono text-[8px] tracking-[0.08em]",
            state.proposalStatus === "READY"
              ? "bg-black/8 text-studio-muted"
              : "bg-[#f6ead4] text-[#815416]"
          )}
        >
          {state.proposalStatus.replaceAll("_", " ")}
        </span>
      </div>

      <section className="border-b border-studio-line py-4">
        <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
          SELECTED OBJECT
        </p>
        <div className="mt-2 rounded-studio-control border border-studio-line bg-white/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold">
              {selectedSegment?.code ?? selectedSegment?.label ?? "No selection"}
            </span>
            <span className="font-mono text-[9px] text-studio-quiet">
              {selectedWall ? `WALL ${selectedWall.label}` : "NO WALL"}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] leading-4 text-studio-muted">
            {selectedSegment
              ? `${selectedSegment.kind.toUpperCase()} · ${formatSixteenths(selectedSegment.widthSixteenths)}`
              : "Submit measurements to create a constrained proposal."}
          </p>
        </div>
      </section>

      <section className="border-b border-studio-line py-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
            SOURCE GEOMETRY
          </p>
          <span className="rounded-full bg-studio-ink px-2 py-1 font-mono text-[7px] tracking-[0.08em] text-white">
            MEASUREMENTS LOCKED
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-studio-muted">
          Measurement v{state.measurementVersion} belongs to Sales. Design review cannot overwrite it.
        </p>
      </section>

      <section className="border-b border-studio-line py-4">
        <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
          CONSTRAINED ADJUSTMENT
        </p>
        <div className="mt-3 rounded-studio-control border border-studio-line bg-white/70 p-3">
          {selectedSegment ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold">
                  {selectedSegment.label}
                </span>
                <span className="font-mono text-[9px] text-studio-muted">
                  {formatSixteenths(selectedSegment.widthSixteenths)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAdjust || selectedSegment.kind === "opening"}
                  aria-label="Nudge selected group left"
                  onClick={() =>
                    dispatch({
                      type: "NUDGE_GROUP",
                      objectId: selectedSegment.id,
                      direction: "left"
                    })
                  }
                >
                  ← 1/16″
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAdjust || selectedSegment.kind === "opening"}
                  aria-label="Nudge selected group right"
                  onClick={() =>
                    dispatch({
                      type: "NUDGE_GROUP",
                      objectId: selectedSegment.id,
                      direction: "right"
                    })
                  }
                >
                  1/16″ →
                </Button>
              </div>

              <div className="mt-4">
                <span className="text-[10px] font-semibold">Width</span>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {standardWidthOptionsSixteenths().map((width) => (
                    <button
                      key={width}
                      type="button"
                      disabled={!canResize}
                      aria-pressed={selectedSegment.widthSixteenths === width}
                      onClick={() =>
                        dispatch({
                          type: "STEP_CABINET_WIDTH",
                          objectId: selectedSegment.id,
                          widthSixteenths: width
                        })
                      }
                      className="h-8 rounded-[8px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted outline-none transition-colors hover:border-studio-ink disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white"
                    >
                      {width / 16}″
                    </button>
                  ))}
                </div>
              </div>

              {canResize && (
                <div className="mt-4">
                  <span className="text-[10px] font-semibold">Kind</span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {kindOptions(selectedSegment.tier).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={
                          selectedSegment.cabinetKind === option.value
                        }
                        onClick={() =>
                          dispatch({
                            type: "SET_SEGMENT_KIND",
                            objectId: selectedSegment.id,
                            cabinetKind: option.value
                          })
                        }
                        className="h-8 rounded-[8px] border border-studio-line bg-white text-[9px] font-semibold text-studio-muted outline-none transition-colors hover:border-studio-ink aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canMoveFiller && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dispatch({
                        type: "MOVE_FILLER_END",
                        objectId: selectedSegment.id,
                        end: "start"
                      })
                    }
                  >
                    Move start
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      dispatch({
                        type: "MOVE_FILLER_END",
                        objectId: selectedSegment.id,
                        end: "end"
                      })
                    }
                  >
                    Move end
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-[10.5px] leading-4 text-studio-muted">
              Select a cabinet or filler after submitting measurements.
            </p>
          )}
        </div>
      </section>

      <section className="border-b border-studio-line py-4">
        <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
          WALL BALANCE
        </p>
        <div className="mt-3 space-y-2">
          {(state.model?.walls ?? []).map((wall) => {
            const baseTotal = wall.segments
              .filter((segment) => segment.tier === "base")
              .reduce((sum, segment) => sum + segment.widthSixteenths, 0);
            return (
              <div
                key={wall.id}
                className="flex items-center justify-between rounded-[9px] border border-studio-line bg-white/65 px-2.5 py-2"
              >
                <span className="text-[10px] font-semibold">
                  Wall {wall.label}
                </span>
                <span className="font-mono text-[9px] text-studio-muted">
                  {formatSixteenths(baseTotal)} / {formatSixteenths(wall.lengthSixteenths)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-4">
        {decisions.length > 0 ? (
          <div className="space-y-2">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="rounded-studio-control border border-[#d8bd84] bg-[#fbf4e4] p-3"
              >
                <p className="font-mono text-[8px] tracking-[0.12em] text-[#805617]">
                  SYSTEM CHECK
                </p>
                <p className="mt-1.5 text-[12px] font-semibold text-[#5f4318]">
                  {decision.title}
                </p>
                <p className="mt-1 text-[10.5px] leading-4 text-[#755827]">
                  {decision.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-studio-control border border-studio-line bg-white/70 p-3">
            <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
              SYSTEM CHECK
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-studio-ink">
              No filler decisions
            </p>
            <p className="mt-1 text-[10.5px] leading-4 text-studio-muted">
              Autofill segments close to the submitted wall dimensions.
            </p>
          </div>
        )}

        {remeasureRequested ? (
          <div className="mt-3 rounded-studio-control border border-[#d8bd84] bg-white/70 p-3">
            <p className="text-[11px] font-semibold">
              Remeasure requested for {state.issueObjectId}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-studio-muted">
              Switch to the Sales view to submit measurement v{state.measurementVersion + 1}.
            </p>
            {state.role === "SALES" && (
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                onClick={() => dispatch({ type: "SUBMIT_NEW_MEASUREMENT" })}
              >
                Submit measurement v{state.measurementVersion + 1}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            <Button
              type="button"
              size="sm"
              disabled={decisions.length === 0}
              onClick={() => dispatch({ type: "RESOLVE_DESIGN_DECISION" })}
            >
              Resolve decision
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!state.selectedObjectId}
              onClick={() => {
                if (state.selectedObjectId) {
                  dispatch({
                    type: "REQUEST_REMEASURE",
                    objectId: state.selectedObjectId
                  });
                }
              }}
            >
              Request remeasure
            </Button>
          </div>
        )}
      </section>
    </aside>
  );
}

function kindOptions(
  tier: "upper" | "base" | "full"
): { value: CabinetKind; label: string }[] {
  if (tier === "upper") return [{ value: "upper", label: "Upper" }];
  return [
    { value: "base", label: "Base" },
    { value: "sink", label: "Sink" },
    { value: "tall", label: "Tall" }
  ];
}
