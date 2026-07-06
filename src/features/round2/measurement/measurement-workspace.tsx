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
import {
  buildDesignIntentQuestions,
  type DesignIntentQuestion
} from "../model/design-intent";
import { MeasuredPlan } from "./measured-plan";
import { InchField } from "./inch-field";
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
  // Field measurement is re-editable at any point (before and after submit), so
  // the user can return from a later stage, change values, and re-submit.
  const submitted = state.measurementStatus === "SUBMITTED";
  const fields = useMemo(
    () => buildMeasurementFields(state.model),
    [state.model]
  );
  const intentQuestions = useMemo(
    () => buildDesignIntentQuestions(state.model, state.measurements),
    [state.measurements, state.model]
  );
  const confirmedIntentKeys = useMemo(
    () => new Set(state.designIntent.confirmedKeys),
    [state.designIntent.confirmedKeys]
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

  const editMeasurement = (field: MeasurementKey, sixteenths: number | null) => {
    dispatch({ type: "EDIT_MEASUREMENT", field, value: sixteenths });
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
                  <InchField
                    ariaLabel={item.label}
                    value={value ?? null}
                    inputRef={(element) => {
                      inputRefs.current[item.key] = element;
                    }}
                    onFocus={() =>
                      dispatch({
                        type: "SET_ACTIVE_MEASUREMENT",
                        field: item.key
                      })
                    }
                    onChange={(sixteenths) =>
                      editMeasurement(item.key, sixteenths)
                    }
                  />
                  <span className="mt-1.5 block text-[10.5px] text-studio-quiet">
                    {item.helper}
                  </span>
                </label>
              );
            })
          )}

          {intentQuestions.length > 0 && (
            <section className="border-t border-studio-line pt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.15em] text-studio-quiet">
                    DESIGN INTENT
                  </p>
                  <p className="mt-1 text-[10.5px] leading-4 text-studio-muted">
                    Defaults do not block submission; skipped items become
                    Confirmation Required.
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[8px] text-studio-quiet">
                  {confirmedIntentKeys.size}/{intentQuestions.length}
                </span>
              </div>

              <div className="space-y-3">
                {intentQuestions.map((question) => (
                  <DesignIntentQuestionCard
                    key={question.key}
                    question={question}
                    selectedValue={
                      state.designIntent.answers[question.key] ??
                      question.defaultValue
                    }
                    confirmed={confirmedIntentKeys.has(question.key)}
                    dispatch={dispatch}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-studio-line bg-[rgba(248,248,246,0.94)] p-5 backdrop-blur-xl">
          {submitted && (
            <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] text-studio-quiet">
              <span className="size-1.5 rounded-full bg-studio-ink" />
              MEASUREMENT v{state.measurementVersion} SUBMITTED · EDIT AND RESUBMIT
              TO UPDATE THE PROPOSAL
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!complete}
            onClick={() => dispatch({ type: "SUBMIT_MEASUREMENT" })}
          >
            {submitted
              ? `Resubmit measurement v${state.measurementVersion}`
              : `Submit measurement v${state.measurementVersion}`}
          </Button>
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

function DesignIntentQuestionCard({
  question,
  selectedValue,
  confirmed,
  dispatch
}: {
  question: DesignIntentQuestion;
  selectedValue: string;
  confirmed: boolean;
  dispatch: Dispatch<Round2PrototypeAction>;
}) {
  return (
    <div className="rounded-[12px] border border-studio-line bg-white/55 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold leading-4 text-studio-ink">
          {question.label}
        </p>
        <span
          className={cn(
            "shrink-0 font-mono text-[8px] tracking-[0.08em]",
            confirmed ? "text-studio-quiet" : "text-[#9a5b17]"
          )}
        >
          {confirmed ? "CONFIRMED" : "DEFAULT · CONFIRM"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {question.options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-ink/25",
                selected
                  ? confirmed
                    ? "border-studio-ink bg-studio-ink text-white"
                    : "border-[#c79b4b] bg-[#fbf4e4] text-[#6b4a18]"
                  : "border-studio-line-strong bg-white text-studio-muted hover:border-studio-ink hover:text-studio-ink"
              )}
              onClick={() =>
                dispatch({
                  type: "SET_DESIGN_INTENT",
                  key: question.key,
                  value: option.value
                })
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-studio-quiet">
        {question.helper}
      </p>
    </div>
  );
}
