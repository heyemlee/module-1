"use client";

import {
  type Dispatch,
  useEffect,
  useMemo,
  useRef
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildMeasurementFields,
  measurementsComplete,
  type MeasurementField,
  type MeasurementKey
} from "../model/round2-model";
import { MeasuredPlan } from "./measured-plan";
import type {
  Round2PrototypeAction,
  Round2PrototypeState
} from "../round2-types";

function fieldStatus(
  state: Round2PrototypeState,
  field: MeasurementField
): string {
  if (state.measurementStatus === "REMEASURE_REQUESTED") {
    return "Remeasure requested";
  }
  if (state.measurements[field.key] != null) return "Captured";
  return "Required";
}

export function MeasurementWorkspace({
  state,
  dispatch
}: {
  state: Round2PrototypeState;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  const readOnly =
    state.role === "DESIGNER" && state.measurementStatus !== "DRAFT";
  const fields = useMemo(
    () => buildMeasurementFields(state.model),
    [state.model]
  );
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const completeCount = fields.filter(
    (field) => !field.required || state.measurements[field.key] != null
  ).length;
  const requiredCount = fields.length;
  const complete = measurementsComplete(state.model, state.measurements);
  const progress =
    requiredCount === 0 ? 0 : Math.round((completeCount / requiredCount) * 100);

  useEffect(() => {
    if (!state.activeMeasurementKey) return;
    inputRefs.current[state.activeMeasurementKey]?.focus();
  }, [state.activeMeasurementKey]);

  const editMeasurement = (field: MeasurementKey, rawValue: string) => {
    dispatch({
      type: "EDIT_MEASUREMENT",
      field,
      value: rawValue === "" ? null : Math.round(Number(rawValue) * 16)
    });
  };

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
              <span
                className="block h-full rounded-full bg-studio-ink"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[9px] text-studio-quiet">
              {String(completeCount).padStart(2, "0")} /{" "}
              {String(requiredCount).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {fields.length === 0 ? (
            <div className="rounded-studio-control border border-studio-line bg-white/70 p-4">
              <p className="text-[12px] font-semibold">Lock Round 1 first</p>
              <p className="mt-1 text-[11px] leading-4 text-studio-muted">
                Measurement fields are created from the locked Round 1 topology.
              </p>
            </div>
          ) : (
            fields.map((item, index) => {
              const value = state.measurements[item.key];
              const status = fieldStatus(state, item);
              const active = state.activeMeasurementKey === item.key;

              return (
                <label
                  key={item.key}
                  className={cn(
                    "block rounded-[12px] border p-3 transition-colors",
                    active
                      ? "border-studio-ink bg-white"
                      : "border-transparent"
                  )}
                >
                  {(index === 0 || fields[index - 1]?.group !== item.group) && (
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
                      ref={(element) => {
                        inputRefs.current[item.key] = element;
                      }}
                      aria-label={item.label}
                      type="number"
                      min={0}
                      step={0.0625}
                      disabled={readOnly}
                      value={value == null ? "" : value / 16}
                      onFocus={() =>
                        dispatch({
                          type: "SET_ACTIVE_MEASUREMENT",
                          field: item.key
                        })
                      }
                      onChange={(event) =>
                        editMeasurement(item.key, event.target.value)
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
              );
            })
          )}
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
              disabled={!complete}
              onClick={() => dispatch({ type: "SUBMIT_MEASUREMENT" })}
            >
              Submit measurement v{state.measurementVersion}
            </Button>
          )}
        </div>
      </aside>

      <section className="min-h-[580px] min-w-0 bg-studio-canvas p-4 sm:p-6 md:min-h-0">
        <MeasuredPlan
          model={state.model}
          measurements={state.measurements}
          selectedWall={state.selectedWall}
          selectedObjectId={state.selectedObjectId}
          activeMeasurementKey={state.activeMeasurementKey}
          onSelectWall={(wall) => dispatch({ type: "SELECT_WALL", wall })}
          onSelectMeasurement={(field) =>
            dispatch({ type: "SET_ACTIVE_MEASUREMENT", field })
          }
        />
      </section>
    </div>
  );
}
