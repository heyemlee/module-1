"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSixteenths } from "../model/round2-model";
import { heightProfileTotal } from "../model/adjustments";
import { CABINET_STANDARDS } from "../model/cabinet-standards";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

/**
 * The rail is a checklist, not an editor: proposal status, the open system
 * checks (click to jump to the object; edits happen on the drawing itself),
 * the global height chain, and the remeasure escape hatch.
 */
export function DecisionRail({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const remeasureRequested = state.measurementStatus === "REMEASURE_REQUESTED";
  const decisions = state.model?.decisionItems ?? [];
  const heightProfile = state.model?.heightProfile ?? null;
  const canEditGlobals =
    state.role === "DESIGNER" && state.measurementStatus === "SUBMITTED";
  const blocking = decisions.some((item) => item.severity === "blocking");
  const ready = state.proposalStatus === "READY" && decisions.length === 0;

  return (
    <aside className="h-full min-h-0 overflow-y-auto rounded-[18px] border border-studio-line bg-white/65 p-4 shadow-[0_18px_42px_-32px_rgba(20,20,26,0.28)] backdrop-blur-xl">
      <div className="border-b border-studio-line pb-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">Design proposal</h3>
          <span
            className={cn(
              "rounded-full px-2 py-1 font-mono text-[8px] tracking-[0.08em]",
              blocking
                ? "bg-[#f6dcd6] text-[#a23524]"
                : ready
                  ? "bg-[#e2efe4] text-[#2c6039]"
                  : "bg-[#f6ead4] text-[#815416]"
            )}
          >
            {blocking
              ? "BLOCKED"
              : ready
                ? "READY TO DRAW"
                : decisions.length > 0
                  ? `${decisions.length} TO CONFIRM`
                  : state.proposalStatus.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-2 text-[10.5px] leading-4 text-studio-muted">
          Built from measurement v{state.measurementVersion} (locked to Sales).
          Tap any cabinet on the drawing to adjust it.
        </p>
        {blocking && (
          <p className="mt-2 text-[10.5px] font-semibold leading-4 text-[#a23524]">
            A wall runs over its measured length. Fix the flagged cabinets or
            request a remeasure — drawings stay locked until it closes.
          </p>
        )}
      </div>

      <section className="border-b border-studio-line py-4">
        <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
          CHECKLIST
        </p>
        {decisions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                data-testid="checklist-item"
                className="rounded-studio-control border border-[#d8bd84] bg-[#fbf4e4] p-3"
              >
                <button
                  type="button"
                  className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-studio-action"
                  onClick={() =>
                    dispatch({
                      type: "SELECT_OBJECT",
                      objectId: decision.objectId,
                      wall: decision.wallId
                    })
                  }
                >
                  <p className="font-mono text-[8px] tracking-[0.12em] text-[#805617]">
                    {decision.severity === "blocking" ? "BLOCKING" : "CONFIRM"} ·
                    WALL {decision.wallId}
                  </p>
                  <p className="mt-1.5 text-[12px] font-semibold text-[#5f4318]">
                    {decision.title}
                  </p>
                  <p className="mt-1 text-[10.5px] leading-4 text-[#755827]">
                    {decision.body}
                  </p>
                </button>
                {decision.id === "decision-height-chain-overflow" &&
                  heightProfile && (
                    <HeightQuickFix
                      currentSixteenths={heightProfile.upperHeightSixteenths}
                      disabled={!canEditGlobals}
                      dispatch={dispatch}
                    />
                  )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-studio-control border border-[#bcd8c2] bg-[#eef6ef] p-3">
            <p className="font-mono text-[8px] tracking-[0.12em] text-[#2c6039]">
              ✓ ALL CHECKS PASSED
            </p>
            <p className="mt-1.5 text-[10.5px] leading-4 text-[#3d6547]">
              Every wall closes to the submitted dimensions. Continue to
              Drawings &amp; Review.
            </p>
          </div>
        )}
      </section>

      {heightProfile && (
        <section className="border-b border-studio-line py-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8px] tracking-[0.12em] text-studio-quiet">
              HEIGHTS · ALL WALLS
            </p>
            <span className="font-mono text-[8px] text-studio-muted">
              Σ {formatSixteenths(heightProfileTotal(heightProfile))} /{" "}
              {formatSixteenths(state.model?.ceilingHeightSixteenths)}
            </span>
          </div>
          <div className="mt-3 rounded-studio-control border border-studio-line bg-white/70 p-3">
            <span className="text-[10px] font-semibold">Upper height</span>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {CABINET_STANDARDS.upper.standardHeightsSixteenths.map(
                (height) => (
                  <button
                    key={height}
                    type="button"
                    disabled={!canEditGlobals}
                    aria-pressed={
                      heightProfile.upperHeightSixteenths === height
                    }
                    onClick={() =>
                      dispatch({
                        type: "SET_HEIGHT_PROFILE",
                        profile: { upperHeightSixteenths: height }
                      })
                    }
                    className={RAIL_CHIP_CLASS}
                  >
                    {height / 16}″
                  </button>
                )
              )}
            </div>
            <span className="mt-3 block text-[10px] font-semibold">
              Flat moulding
            </span>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {MOULDING_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  disabled={!canEditGlobals}
                  aria-pressed={
                    heightProfile.mouldingSixteenths === option.value
                  }
                  onClick={() =>
                    dispatch({
                      type: "SET_HEIGHT_PROFILE",
                      profile: { mouldingSixteenths: option.value }
                    })
                  }
                  className={RAIL_CHIP_CLASS}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[9.5px] leading-4 text-studio-muted">
              Counter {formatSixteenths(heightProfile.counterSixteenths)} ·
              backsplash {formatSixteenths(heightProfile.backsplashSixteenths)}.
              One change updates every wall elevation and A-sheet.
            </p>
          </div>
        </section>
      )}

      <section className="py-4">
        {remeasureRequested ? (
          <div className="rounded-studio-control border border-[#d8bd84] bg-white/70 p-3">
            <p className="text-[11px] font-semibold">
              Remeasure requested for {state.issueObjectId}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-studio-muted">
              Switch to the Sales view to submit measurement v
              {state.measurementVersion + 1}.
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
          <div className="grid gap-2">
            <Button
              type="button"
              size="sm"
              disabled={decisions.length === 0 || blocking}
              title={
                blocking
                  ? "Blocking issues can't be acknowledged — fix or remeasure"
                  : undefined
              }
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

/** One-click fix for the ceiling overflow: step the uppers down one tier. */
function HeightQuickFix({
  currentSixteenths,
  disabled,
  dispatch
}: {
  currentSixteenths: number;
  disabled: boolean;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const lower = [...CABINET_STANDARDS.upper.standardHeightsSixteenths]
    .filter((height) => height < currentSixteenths)
    .sort((a, b) => b - a)[0];
  if (lower == null) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      className="mt-2 w-full"
      onClick={() =>
        dispatch({
          type: "SET_HEIGHT_PROFILE",
          profile: { upperHeightSixteenths: lower }
        })
      }
    >
      Step uppers down to {lower / 16}″
    </Button>
  );
}

const RAIL_CHIP_CLASS =
  "h-8 rounded-[8px] border border-studio-line bg-white font-mono text-[9px] text-studio-muted outline-none transition-colors hover:border-studio-ink disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-studio-ink aria-pressed:bg-studio-ink aria-pressed:text-white";

const MOULDING_OPTIONS = [
  { label: "None", value: 0 },
  { label: "2″ flat", value: 2 * 16 },
  { label: "3″ flat", value: 3 * 16 }
];
