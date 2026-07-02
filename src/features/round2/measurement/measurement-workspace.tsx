"use client";

import type { Dispatch } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeasuredPlan } from "./measured-plan";
import type {
  Round2Measurements,
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

const MEASUREMENT_FIELDS: readonly {
  field: keyof Round2Measurements;
  label: string;
  group: string;
  helper: string;
}[] = [
  { field: "wallA", label: "Wall A overall length", group: "WALLS", helper: "Window wall" },
  { field: "wallB", label: "Wall B overall length", group: "WALLS", helper: "Left return" },
  { field: "wallC", label: "Wall C overall length", group: "WALLS", helper: "Right return" },
  { field: "ceiling", label: "Finished ceiling height", group: "ROOM", helper: "Floor to ceiling" },
  { field: "windowWidth", label: "Window rough width", group: "OPENINGS", helper: "Frame to frame" },
  { field: "windowOffset", label: "Window offset from Wall B", group: "OPENINGS", helper: "Left edge" }
] as const;

function fieldStatus(state: Round2PrototypeState) {
  if (state.measurementStatus === "REMEASURE_REQUESTED") {
    return "Remeasure requested";
  }
  return state.measurementStatus === "SUBMITTED" ? "Confirmed" : "Required";
}

export function MeasurementWorkspace({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const readOnly = state.role === "DESIGNER";
  const status = fieldStatus(state);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-auto md:grid-cols-[380px_minmax(0,1fr)] md:overflow-hidden">
      <aside className="min-h-0 border-b border-studio-line bg-white/50 backdrop-blur-xl md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="border-b border-studio-line px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.16em] text-studio-quiet">
                FIELD MEASUREMENT
              </p>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.025em]">
                Capture the room
              </h2>
            </div>
            <span className="rounded-full border border-studio-line-strong bg-white/75 px-2.5 py-1 font-mono text-[9px] text-studio-muted">
              v{state.measurementVersion}
            </span>
          </div>
          <p className="mt-2 max-w-[34ch] text-[12.5px] leading-5 text-studio-muted">
            Enter field dimensions in inches. The measured plan updates as each source value changes.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
              <span className="block h-full w-[72%] rounded-full bg-studio-ink" />
            </div>
            <span className="font-mono text-[9px] text-studio-quiet">06 / 08</span>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {MEASUREMENT_FIELDS.map((item, index) => (
            <label key={item.field} className="block">
              {(index === 0 ||
                MEASUREMENT_FIELDS[index - 1]?.group !== item.group) && (
                <span className="mb-2 block font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
                  {item.group}
                </span>
              )}
              <span className="flex items-center justify-between gap-4">
                <span className="text-[12px] font-semibold text-studio-ink">
                  {item.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-[8px] tracking-[0.08em]",
                    status === "Remeasure requested"
                      ? "text-[#9a5b17]"
                      : "text-studio-quiet"
                  )}
                >
                  {status.toUpperCase()}
                </span>
              </span>
              <span className="relative mt-2 block">
                <input
                  aria-label={item.label}
                  type="number"
                  min={0}
                  step={0.0625}
                  disabled={readOnly}
                  value={state.measurements[item.field] / 16}
                  onChange={(event) =>
                    dispatch({
                      type: "EDIT_MEASUREMENT",
                      field: item.field,
                      value: Math.round(Number(event.target.value) * 16)
                    })
                  }
                  className="h-11 w-full rounded-studio-control border border-studio-line-strong bg-white px-3 pr-12 font-mono text-[13px] outline-none transition-colors focus:border-studio-ink focus:ring-2 focus:ring-studio-ink/10 disabled:cursor-not-allowed disabled:bg-black/[0.035] disabled:text-studio-muted"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-studio-quiet">
                  IN
                </span>
              </span>
              <span className="mt-1.5 block text-[10.5px] text-studio-quiet">
                {item.helper}
              </span>
            </label>
          ))}
        </div>

        <div className="sticky bottom-0 border-t border-studio-line bg-[rgba(248,248,246,0.94)] p-5 backdrop-blur-xl">
          {readOnly ? (
            <div className="rounded-studio-control border border-studio-line bg-white/65 p-3">
              <p className="font-mono text-[9px] tracking-[0.1em] text-studio-quiet">
                SOURCE LOCKED
              </p>
              <p className="mt-1 text-[12px] font-semibold">
                Submitted measurement v{state.measurementVersion} · read only
              </p>
            </div>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => dispatch({ type: "SUBMIT_MEASUREMENT" })}
            >
              Submit measurement v{state.measurementVersion}
            </Button>
          )}
        </div>
      </aside>

      <section className="min-h-[580px] min-w-0 bg-studio-canvas p-4 sm:p-6 md:min-h-0">
        <MeasuredPlan
          measurements={state.measurements}
          selectedWall={state.selectedWall}
          selectedObjectId={state.selectedObjectId}
          onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
        />
      </section>
    </div>
  );
}
