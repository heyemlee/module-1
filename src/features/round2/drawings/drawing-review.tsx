"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";
import { CabinetSchedule } from "./cabinet-schedule";
import { DrawingSheet, drawingSheetsForModel } from "./drawing-sheet";

export function DrawingReview({
  state,
  dispatch,
  customerName,
  projectName
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
  customerName: string;
  projectName: string;
}) {
  const canReview =
    state.proposalStatus === "READY" && state.drawingStatus !== "STALE";
  const sheets = drawingSheetsForModel(state.model);
  const activeSheet =
    sheets.find((sheet) => sheet.id === state.activeSheet) ?? sheets[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#d8d9d6]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-line bg-white/70 px-5 py-3 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 font-mono text-[9px] tracking-[0.12em] text-studio-quiet">
            <span>DRAWING v{state.drawingVersion}</span>
            <span>·</span>
            <span>MEASUREMENT v{state.measurementVersion}</span>
            <span>·</span>
            <span>PROPOSAL v{state.proposalVersion}</span>
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">
            Professional drawing set
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 font-mono text-[8px] tracking-[0.08em]",
              state.drawingStatus === "REVIEWED"
                ? "bg-studio-ink text-white"
                : state.drawingStatus === "STALE"
                  ? "bg-[#f0dfd9] text-[#8a3b2f]"
                  : "bg-[#f6ead4] text-[#815416]"
            )}
          >
            {state.drawingStatus.replaceAll("_", " ")}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!canReview}
            onClick={() => dispatch({ type: "MARK_REVIEWED" })}
          >
            Mark reviewed
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white/55 px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                aria-pressed={activeSheet.id === sheet.id}
                onClick={() =>
                  dispatch({
                    type: "SET_SHEET",
                    sheet: sheet.id
                  })
                }
                className="rounded-[9px] border border-black/10 bg-white/65 px-3 py-2 font-mono text-[9px] text-[#5d5d58] outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-studio-action aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white"
              >
                {sheet.id} · {sheet.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() =>
                dispatch({
                  type: "SET_DRAWING_ZOOM",
                  zoom: state.drawingZoom - 0.25
                })
              }
              className="grid size-9 place-items-center rounded-[9px] border border-black/10 bg-white/70 font-mono text-[13px]"
            >
              −
            </button>
            <span className="min-w-14 text-center font-mono text-[9px] text-[#686863]">
              {Math.round(state.drawingZoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() =>
                dispatch({
                  type: "SET_DRAWING_ZOOM",
                  zoom: state.drawingZoom + 0.25
                })
              }
              className="grid size-9 place-items-center rounded-[9px] border border-black/10 bg-white/70 font-mono text-[13px]"
            >
              +
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5 sm:p-8">
          <div
            className="mx-auto w-full max-w-[1080px] origin-top transition-transform"
            style={{ transform: `scale(${state.drawingZoom})` }}
          >
            <div className="overflow-hidden border border-black/20 bg-white shadow-[0_28px_75px_-35px_rgba(0,0,0,0.5)]">
              {activeSheet.id === "S1" ? (
                <CabinetSchedule
                  model={state.model}
                  customerName={customerName}
                  projectName={projectName}
                  measurementVersion={state.measurementVersion}
                  proposalVersion={state.proposalVersion}
                />
              ) : (
                <DrawingSheet
                  sheet={activeSheet}
                  model={state.model}
                  measurementVersion={state.measurementVersion}
                  proposalVersion={state.proposalVersion}
                  customerName={customerName}
                  projectName={projectName}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
