"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

const SINK_WIDTHS = [30, 33, 36] as const;

export function DecisionRail({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const remeasureRequested =
    state.measurementStatus === "REMEASURE_REQUESTED";
  const selectedOffset = state.selectedObjectId
    ? state.cabinetOffsets[state.selectedObjectId] ?? { x: 0, y: 0 }
    : { x: 0, y: 0 };

  const updateOffset = (axis: "x" | "y", value: number) => {
    if (!state.selectedObjectId) return;
    dispatch({
      type: "SET_CABINET_OFFSET",
      objectId: state.selectedObjectId,
      x: axis === "x" ? value : selectedOffset.x,
      y: axis === "y" ? value : selectedOffset.y
    });
  };

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
              {state.selectedObjectId ?? "No selection"}
            </span>
            <span className="font-mono text-[9px] text-studio-quiet">
              WALL {state.selectedWall}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] leading-4 text-studio-muted">
            Linked selection across top view and elevation.
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
        <label className="mt-3 block">
          <span className="text-[11px] font-semibold">Sink base width</span>
          <select
            aria-label="Sink base width"
            value={state.sinkBaseWidth}
            onChange={(event) =>
              dispatch({
                type: "SET_SINK_WIDTH",
                width: Number(event.target.value) as 30 | 33 | 36
              })
            }
            className="mt-2 h-10 w-full rounded-studio-control border border-studio-line-strong bg-white px-3 font-mono text-[11px] outline-none focus:ring-2 focus:ring-studio-action/15"
          >
            {SINK_WIDTHS.map((width) => (
              <option key={width} value={width}>
                SB{width} · {width}″
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label>
            <span className="text-[10px] font-semibold">Position X</span>
            <span className="relative mt-1.5 block">
              <input
                aria-label="Cabinet position X"
                type="number"
                step="0.125"
                value={selectedOffset.x}
                disabled={!state.selectedObjectId}
                onChange={(event) =>
                  updateOffset("x", Number(event.target.value))
                }
                className="h-9 w-full rounded-[9px] border border-studio-line-strong bg-white px-2 pr-7 font-mono text-[10px] outline-none focus:ring-2 focus:ring-studio-action/15 disabled:opacity-50"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-studio-quiet">
                IN
              </span>
            </span>
          </label>
          <label>
            <span className="text-[10px] font-semibold">Position Y</span>
            <span className="relative mt-1.5 block">
              <input
                aria-label="Cabinet position Y"
                type="number"
                step="0.125"
                value={selectedOffset.y}
                disabled={!state.selectedObjectId}
                onChange={(event) =>
                  updateOffset("y", Number(event.target.value))
                }
                className="h-9 w-full rounded-[9px] border border-studio-line-strong bg-white px-2 pr-7 font-mono text-[10px] outline-none focus:ring-2 focus:ring-studio-action/15 disabled:opacity-50"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-studio-quiet">
                IN
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="py-4">
        <div className="rounded-studio-control border border-[#d8bd84] bg-[#fbf4e4] p-3">
          <p className="font-mono text-[8px] tracking-[0.12em] text-[#805617]">
            SYSTEM CHECK
          </p>
          <p className="mt-1.5 text-[12px] font-semibold text-[#5f4318]">
            Hood clearance needs a decision
          </p>
          <p className="mt-1 text-[10.5px] leading-4 text-[#755827]">
            Selected range position leaves 1½″ less than the preferred side clearance.
          </p>
        </div>

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
