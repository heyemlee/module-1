"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyCabinetReviewActions,
  buildRound1LayoutPrompt,
  generatePreliminaryCabinetList,
  summarizePreliminaryCabinetEstimate,
  normalizeRound1Form,
  type Cabinet,
  type CabinetKind,
  type CabinetLocation,
  type PreliminaryCabinetEstimate,
  type PreliminaryCabinetEstimateSummary,
  type CabinetReviewAction,
  type CabinetReviewDraft,
  type Round1FormInput
} from "@/domain/round1";
import { LayoutPreview } from "./layout-preview";
import type { PositionOverrides } from "./floorplan/plan-geometry";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";

export const SHOWROOM_STEPS = [
  "Room",
  "Openings",
  "Layout",
  "Appliances",
  "Adjust Positions",
  "Cabinets"
] as const;

const ADJUST_POSITIONS_STEP_INDEX = SHOWROOM_STEPS.indexOf("Adjust Positions");

const EMPTY_PRELIMINARY_CABINET_ESTIMATE: PreliminaryCabinetEstimate = {
  cabinets: [],
  confirmationItems: [],
  estimatedFillerWidth: 0,
  salesEstimateOnly: true,
  notForProduction: true
};

const appliancePositionOptions = [
  "UNDER_WINDOW",
  "ON_MAIN_RUN",
  "FRONT_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "BACK_SIDE",
  "NEAR_SINK",
  "NEAR_RANGE",
  "NEAR_FRIDGE",
  "ON_ISLAND",
  "NO_PREFERENCE",
  "UNKNOWN"
] as const;

const cabinetKindOptions = ["BASE", "WALL", "TALL"] as const;

const cabinetLocationOptions = [
  "ON_MAIN_RUN",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "BACK_SIDE",
  "FRONT_SIDE",
  "UNDER_WINDOW",
  "NEAR_SINK",
  "NEAR_RANGE",
  "NEAR_FRIDGE",
  "ON_ISLAND",
  "UNKNOWN"
] as const satisfies readonly CabinetLocation[];

function sinkPositionOptions(windowStatus: Round1FormInput["openings"]["windows"]["status"]) {
  return windowStatus === "YES"
    ? appliancePositionOptions
    : appliancePositionOptions.filter((option) => option !== "UNDER_WINDOW");
}

export function ShowroomIntakeApp() {
  const [form, setForm] = useState<Round1FormInput>(() => createDefaultShowroomForm());
  const [step, setStep] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [positionsConfirmedForCabinets, setPositionsConfirmedForCabinets] =
    useState(false);
  const [hasEnteredAdjustPositions, setHasEnteredAdjustPositions] = useState(false);
  const [showAdjustPositionsModal, setShowAdjustPositionsModal] = useState(false);
  const [highlightDraggableItems, setHighlightDraggableItems] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cabinetReviewActions, setCabinetReviewActions] = useState<
    CabinetReviewAction[]
  >([]);

  const startDraggableHighlightCue = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightDraggableItems(true);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightDraggableItems(false);
      highlightTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    if (step !== ADJUST_POSITIONS_STEP_INDEX || hasEnteredAdjustPositions) {
      return;
    }
    setHasEnteredAdjustPositions(true);
    setShowAdjustPositionsModal(true);
  }, [hasEnteredAdjustPositions, step]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const result = useMemo(() => normalizeRound1Form(form), [form]);
  const preliminaryEstimate = useMemo(
    () =>
      positionsConfirmedForCabinets
        ? generatePreliminaryCabinetList(createDefaultCabinetRuns(form))
        : EMPTY_PRELIMINARY_CABINET_ESTIMATE,
    [form, positionsConfirmedForCabinets]
  );
  const estimate = useMemo(
    () => applyCabinetReviewActions(preliminaryEstimate, cabinetReviewActions),
    [cabinetReviewActions, preliminaryEstimate]
  );
  const estimateSummary = useMemo(
    () => summarizePreliminaryCabinetEstimate(estimate),
    [estimate]
  );
  const confirmationItems = useMemo(
    () => [...result.confirmationItems, ...estimate.confirmationItems],
    [estimate.confirmationItems, result.confirmationItems]
  );
  const prompt = useMemo(
    () => buildRound1LayoutPrompt(result.normalized),
    [result.normalized]
  );

  const goToNextStep = useCallback(() => {
    if (step === ADJUST_POSITIONS_STEP_INDEX) {
      setPositionsConfirmedForCabinets(true);
    }
    setStep(Math.min(SHOWROOM_STEPS.length - 1, step + 1));
  }, [step]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">
              Round 1 Sales Estimate Only
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-normal">
              Showroom Intake + Layout Preview
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <StatusPill label="Not Production Data" tone="red" />
            <StatusPill label="Dimension Confidence: ROUGH" tone="amber" />
            <StatusPill
              label={
                result.readiness.canGenerateRound1Layout
                  ? "Ready To Generate"
                  : "Needs Intake"
              }
              tone="green"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)_430px]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {SHOWROOM_STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={`mb-2 flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-bold ${
                step === index
                  ? "bg-sky-700 text-white"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{label}</span>
              <span>{index + 1}</span>
            </button>
          ))}
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-3 text-xs font-bold leading-5 text-slate-500">
            The top-down layout plan updates live as you fill the form.
          </p>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {step === 0 && <RoomStep form={form} setForm={setForm} />}
          {step === 1 && <OpeningsStep form={form} setForm={setForm} />}
          {step === 2 && <LayoutStep form={form} setForm={setForm} />}
          {step === 3 && <AppliancesStep form={form} setForm={setForm} />}
          {step === 4 && (
            <AdjustPositionsStep
              onHighlight={startDraggableHighlightCue}
              onReset={() => {
                setPositionOverrides({});
                setPositionsConfirmedForCabinets(false);
                setCabinetReviewActions([]);
              }}
              onConfirmPositions={() => setPositionsConfirmedForCabinets(true)}
              hasOverrides={Object.keys(positionOverrides).length > 0}
              positionsConfirmed={positionsConfirmedForCabinets}
            />
          )}
          {step === 5 && <CabinetsStep form={form} setForm={setForm} />}

          <div className="mt-6 flex justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setStep(Math.max(0, step - 1))}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
            >
              Next
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <LayoutPreview
            normalized={result.normalized}
            cabinets={estimate.cabinets}
            confirmationItems={confirmationItems}
            positionOverrides={positionOverrides}
            onPositionOverridesChange={setPositionOverrides}
            highlightDraggableItems={highlightDraggableItems}
          />

          <Panel title="Confirmation Required">
            <div className="max-h-48 space-y-2 overflow-auto pr-1">
              {confirmationItems.length === 0 ? (
                <p className="text-sm text-slate-500">No current confirmation flags.</p>
              ) : (
                confirmationItems.map((item) => (
                  <div key={item.id} className="rounded-md bg-amber-50 p-2 text-sm">
                    <p className="font-bold text-amber-900">{item.code}</p>
                    <p className="text-amber-800">{item.message}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Preliminary Cabinet Estimate">
            <CabinetReviewPanel
              cabinets={estimate.cabinets}
              summary={estimateSummary}
              positionsConfirmed={positionsConfirmedForCabinets}
              onAdd={(cabinet) =>
                setCabinetReviewActions((actions) => [
                  ...actions,
                  { type: "ADD", cabinet }
                ])
              }
              onEdit={(cabinetIndex, cabinet) =>
                setCabinetReviewActions((actions) => [
                  ...actions,
                  { type: "EDIT", cabinetIndex, cabinet }
                ])
              }
              onRemove={(cabinetIndex) =>
                setCabinetReviewActions((actions) => [
                  ...actions,
                  { type: "REMOVE", cabinetIndex }
                ])
              }
              onReset={() => setCabinetReviewActions([])}
              hasReviewActions={cabinetReviewActions.length > 0}
            />
          </Panel>

          <Panel title="Layout Prompt">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {prompt}
            </pre>
          </Panel>
        </aside>
      </div>

      {showAdjustPositionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">
              Adjust Positions
            </p>
            <h2 className="mt-2 text-lg font-black text-slate-950">
              Door, window, and appliance locations can be dragged on the plan.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Drag these rough positions first, then confirm them to generate
              the preliminary cabinet fill around those constraints.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdjustPositionsModal(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
              >
                Skip For Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustPositionsModal(false);
                  startDraggableHighlightCue();
                }}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
              >
                Start Adjusting
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RoomStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="1. Room Size And Obstacles">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Room length (inches)"
          value={form.room.length}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, length: value } })
          }
        />
        <NumberField
          label="Room width (inches)"
          value={form.room.width}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, width: value } })
          }
        />
        <NumberField
          label="Ceiling height if known"
          value={form.room.ceilingHeight ?? null}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, ceilingHeight: value } })
          }
        />
      </div>
    </Step>
  );
}

export function OpeningsStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  const door = form.openings.doors.items[0] ?? {
    location: "FRONT_SIDE" as const,
    width: null
  };
  const window = form.openings.windows.items[0] ?? {
    relation: "BEHIND_SINK" as const,
    width: null
  };
  const setDoorStatus = (status: Round1FormInput["openings"]["doors"]["status"]) => {
    setForm({
      ...form,
      openings: {
        ...form.openings,
        doors: {
          status,
          items: status === "NO" ? [] : form.openings.doors.items.length ? form.openings.doors.items : [door]
        }
      }
    });
  };
  const setWindowStatus = (
    status: Round1FormInput["openings"]["windows"]["status"]
  ) => {
    const sinkRelation =
      status === "NO" && form.fixtures.sink.relation === "UNDER_WINDOW"
        ? "UNKNOWN"
        : form.fixtures.sink.relation;
    setForm({
      ...form,
      openings: {
        ...form.openings,
        windows: {
          status,
          items:
            status === "NO"
              ? []
              : form.openings.windows.items.length
                ? form.openings.windows.items
                : [window]
        }
      },
      fixtures: {
        ...form.fixtures,
        sink: { ...form.fixtures.sink, relation: sinkRelation }
      }
    });
  };
  return (
    <Step title="2. Openings">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Any doors or open passages?"
          value={form.openings.doors.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={setDoorStatus}
        />
        {form.openings.doors.status !== "NO" && (
          <>
            <SelectField
              label="Door / opening wall"
              value={door.location}
              options={["FRONT_SIDE", "LEFT_SIDE", "RIGHT_SIDE", "BACK_SIDE", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    doors: {
                      ...form.openings.doors,
                      items: [{ ...door, location: value }]
                    }
                  }
                })
              }
            />
          </>
        )}
        <SelectField
          label="Any windows in or near the kitchen?"
          value={form.openings.windows.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={setWindowStatus}
        />
        {form.openings.windows.status !== "NO" && (
          <>
            <SelectField
              label="Window approximate relation"
              value={window.relation}
              options={["BEHIND_SINK", "UNDER_WINDOW", "BACK_SIDE", "LEFT_SIDE", "RIGHT_SIDE", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    windows: {
                      ...form.openings.windows,
                      items: [{ ...window, relation: value }]
                    }
                  }
                })
              }
            />
          </>
        )}
      </div>
    </Step>
  );
}

function MepStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="3. MEP">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["water", "gas", "electric", "vent"] as const).map((key) => (
          <SelectField
            key={key}
            label={`${key} movable?`}
            value={form.mep[key].movable}
            options={["UNKNOWN", "YES", "NO"]}
            onChange={(value) =>
              setForm({
                ...form,
                mep: {
                  ...form.mep,
                  [key]: { ...form.mep[key], movable: value as "YES" | "NO" | "UNKNOWN" }
                }
              })
            }
          />
        ))}
      </div>
    </Step>
  );
}

function LayoutStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="3. Layout Preference">
      <SelectField
        label="Kitchen shape"
        value={form.layoutPreference}
        options={[
          "ONE_WALL",
          "L_SHAPE",
          "U_SHAPE",
          "GALLEY",
          "PENINSULA",
          "ISLAND",
          "L_SHAPE_ISLAND",
          "U_SHAPE_ISLAND",
          "NO_PREFERENCE"
        ]}
        onChange={(value) =>
          setForm({ ...form, layoutPreference: value as Round1FormInput["layoutPreference"] })
        }
      />
    </Step>
  );
}

export function AppliancesStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="4. Core Appliances And Fixtures">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sink size"
          value={String(form.fixtures.sink.size ?? "UNKNOWN")}
          options={["30", "33", "36", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                sink: { ...form.fixtures.sink, size: parseNullableSize(value) as 30 | 33 | 36 | null }
              }
            })
          }
        />
        <SelectField
          label="Range size"
          value={String(form.fixtures.range.size ?? "UNKNOWN")}
          options={["30", "36", "48", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                range: { ...form.fixtures.range, size: parseNullableSize(value) as 30 | 36 | 48 | null }
              }
            })
          }
        />
        <SelectField
          label="Range fixed location?"
          value={form.fixtures.range.fixedLocation}
          options={["UNKNOWN", "YES", "NO"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                range: {
                  ...form.fixtures.range,
                  fixedLocation: value as "YES" | "NO" | "UNKNOWN"
                }
              }
            })
          }
        />
        <SelectField
          label="Fridge size"
          value={String(form.fixtures.fridge.size ?? "UNKNOWN")}
          options={["30", "33", "36", "42", "48", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                fridge: { ...form.fixtures.fridge, size: parseNullableSize(value) as 30 | 33 | 36 | 42 | 48 | null }
              }
            })
          }
        />
        <SelectField
          label="Dishwasher status"
          value={form.fixtures.dishwasher.status}
          options={["YES", "NONE", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                dishwasher: {
                  ...form.fixtures.dishwasher,
                  status: value as "YES" | "NONE" | "UNKNOWN",
                  size: value === "NONE" ? null : form.fixtures.dishwasher.size,
                  relation:
                    value === "NONE"
                      ? "NOT_APPLICABLE"
                      : form.fixtures.dishwasher.relation === "NOT_APPLICABLE"
                        ? "NEAR_SINK"
                        : form.fixtures.dishwasher.relation
                }
              }
            })
          }
        />
        {form.fixtures.dishwasher.status !== "NONE" && (
          <>
            <SelectField
              label="Dishwasher size"
              value={String(form.fixtures.dishwasher.size ?? "UNKNOWN")}
              options={["18", "24", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  fixtures: {
                    ...form.fixtures,
                    dishwasher: {
                      ...form.fixtures.dishwasher,
                      size: parseNullableSize(value) as 18 | 24 | null
                    }
                  }
                })
              }
            />
          </>
        )}
      </div>
    </Step>
  );
}

function AdjustPositionsStep({
  onHighlight,
  onReset,
  onConfirmPositions,
  hasOverrides,
  positionsConfirmed
}: {
  onHighlight: () => void;
  onReset: () => void;
  onConfirmPositions: () => void;
  hasOverrides: boolean;
  positionsConfirmed: boolean;
}) {
  return (
    <Step title="5. Adjust Positions">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onHighlight}
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
        >
          Highlight Draggable Items
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasOverrides && !positionsConfirmed}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset Positions
        </button>
        <button
          type="button"
          onClick={onConfirmPositions}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          {positionsConfirmed ? "Positions Confirmed" : "Generate Cabinet Fill"}
        </button>
      </div>
    </Step>
  );
}

function CabinetsStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="6. Layout-Sensitive Cabinet Choices">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Corner cabinet preference"
          value={form.layoutSensitiveCabinets.cornerCabinet.preferredType}
          options={[
            "LAZY_SUSAN",
            "BLIND_CORNER",
            "LEMANS",
            "MAGIC_CORNER",
            "CORNER_DRAWER",
            "NO_PREFERENCE",
            "UNKNOWN"
          ]}
          onChange={(value) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                cornerCabinet: {
                  preferredType: value as Round1FormInput["layoutSensitiveCabinets"]["cornerCabinet"]["preferredType"]
                }
              }
            })
          }
        />
        <SelectField
          label="Oven / microwave"
          value={form.layoutSensitiveCabinets.ovenMicrowave.configuration}
          options={[
            "RANGE_INCLUDES_OVEN",
            "WALL_OVEN_MICROWAVE_STACK",
            "MICROWAVE_DRAWER",
            "UPPER_CABINET_MICROWAVE",
            "COUNTERTOP_MICROWAVE",
            "NO_MICROWAVE",
            "NO_OVEN",
            "UNKNOWN"
          ]}
          onChange={(value) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                ovenMicrowave: {
                  ...form.layoutSensitiveCabinets.ovenMicrowave,
                  configuration: value as Round1FormInput["layoutSensitiveCabinets"]["ovenMicrowave"]["configuration"]
                }
              }
            })
          }
        />
        <SelectField
          label="Oven / microwave position"
          value={form.layoutSensitiveCabinets.ovenMicrowave.relation}
          options={appliancePositionOptions}
          onChange={(value) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                ovenMicrowave: {
                  ...form.layoutSensitiveCabinets.ovenMicrowave,
                  relation: value
                }
              }
            })
          }
        />
      </div>
    </Step>
  );
}

function CabinetReviewPanel({
  cabinets,
  summary,
  positionsConfirmed,
  onAdd,
  onEdit,
  onRemove,
  onReset,
  hasReviewActions
}: {
  cabinets: Cabinet[];
  summary: PreliminaryCabinetEstimateSummary;
  positionsConfirmed: boolean;
  onAdd: (cabinet: CabinetReviewDraft) => void;
  onEdit: (cabinetIndex: number, cabinet: CabinetReviewDraft) => void;
  onRemove: (cabinetIndex: number) => void;
  onReset: () => void;
  hasReviewActions: boolean;
}) {
  const [draft, setDraft] = useState<CabinetReviewDraft>({
    kind: "BASE",
    width: 30,
    location: "ON_MAIN_RUN"
  });

  if (!positionsConfirmed) {
    return (
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Position setup first
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Confirm dragged door, window, and appliance positions before cabinet fill.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Rough cabinet allowance
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <CabinetSummaryMetric
            label="Base"
            count={summary.baseCabinets.count}
            linearFeet={summary.baseCabinets.linearFeet}
          />
          <CabinetSummaryMetric
            label="Wall"
            count={summary.wallCabinets.count}
            linearFeet={summary.wallCabinets.linearFeet}
          />
          <CabinetSummaryMetric
            label="Tall"
            count={summary.tallCabinets.count}
            linearFeet={summary.tallCabinets.linearFeet}
          />
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              Filler
            </p>
            <p className="mt-1 text-lg font-black text-slate-950">
              ~{summary.estimatedFillerWidth}"
            </p>
            <p className="text-xs font-bold text-slate-500">allowance</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Approximate only. The program fills standard cabinets from rough room
          runs and allows up to 3" filler per rough run; exact
          cabinet-by-cabinet review can wait until better measurements are
          available.
        </p>
      </div>

      <details className="rounded-md border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-slate-700">
          Advanced manual cabinet review
        </summary>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs leading-5 text-slate-500">
            Use this only when sales or designer needs to override the rough
            automatic estimate.
          </p>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasReviewActions}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
          {cabinets.map((cabinet, index) => (
            <div
              key={`${cabinet.code}-${index}`}
              className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-black text-slate-900">{cabinet.code}</p>
                  <p className="text-slate-500">
                    {cabinet.width}" W · {cabinet.depth}" D · sales estimate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded-md bg-red-50 px-2.5 py-1 font-bold text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-[1fr_76px] gap-2">
                <SelectField
                  label="Kind"
                  value={cabinet.kind}
                  options={cabinetKindOptions}
                  onChange={(kind) =>
                    onEdit(index, {
                      kind: kind as CabinetKind,
                      width: cabinet.width,
                      location: cabinet.location
                    })
                  }
                />
                <NumberField
                  label="Width"
                  value={cabinet.width}
                  onChange={(width) =>
                    onEdit(index, {
                      kind: cabinet.kind,
                      width: width ?? cabinet.width,
                      location: cabinet.location
                    })
                  }
                />
              </div>
              <SelectField
                label="Location"
                value={
                  cabinet.location &&
                  (cabinetLocationOptions as readonly string[]).includes(
                    cabinet.location
                  )
                    ? cabinet.location
                    : "UNKNOWN"
                }
                options={cabinetLocationOptions}
                onChange={(location) =>
                  onEdit(index, {
                    kind: cabinet.kind,
                    width: cabinet.width,
                    location
                  })
                }
              />
              {cabinet.confirmationRequired && (
                <p className="rounded bg-amber-100 px-2 py-1 font-bold text-amber-900">
                  Confirmation Required: {cabinet.confirmationReasons.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs">
          <div className="grid grid-cols-[1fr_76px] gap-2">
            <SelectField
              label="Add kind"
              value={draft.kind}
              options={cabinetKindOptions}
              onChange={(kind) =>
                setDraft({ ...draft, kind: kind as CabinetKind })
              }
            />
            <NumberField
              label="Width"
              value={draft.width}
              onChange={(width) =>
                setDraft({ ...draft, width: width ?? draft.width })
              }
            />
          </div>
          <SelectField
            label="Add location"
            value={draft.location ?? "UNKNOWN"}
            options={cabinetLocationOptions}
            onChange={(location) => setDraft({ ...draft, location })}
          />
          <button
            type="button"
            onClick={() => onAdd(draft)}
            className="rounded-md bg-sky-700 px-3 py-2 text-sm font-black text-white"
          >
            Add Cabinet
          </button>
        </div>
      </details>
    </div>
  );
}

function CabinetSummaryMetric({
  label,
  count,
  linearFeet
}: {
  label: string;
  count: number;
  linearFeet: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-950">{count}</p>
      <p className="text-xs font-bold text-slate-500">~{linearFeet} lf</p>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-black tracking-normal">{title}</h2>
      <p className="mb-5 mt-2 text-sm leading-6 text-slate-600">
        Unknown or rough answers are allowed. They stay visible as Confirmation Required.
      </p>
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-700"
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-700"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({
  label,
  tone
}: {
  label: string;
  tone: "red" | "amber" | "green";
}) {
  const classes = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-800",
    green: "bg-emerald-50 text-emerald-700"
  };
  return <span className={`rounded px-2.5 py-1 ${classes[tone]}`}>{label}</span>;
}

function parseNullableSize(value: string) {
  return value === "UNKNOWN" ? null : Number(value);
}
