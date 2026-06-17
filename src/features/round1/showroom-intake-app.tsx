"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  generatePreliminaryCabinetList,
  summarizePreliminaryCabinetEstimate,
  normalizeRound1Form,
  type PreliminaryCabinetEstimate,
  type PreliminaryCabinetEstimateSummary,
  type Round1FormInput
} from "@/domain/round1";
import { LayoutPreview } from "./layout-preview";
import { rasterizeSvgElement } from "./rasterize-svg";
import { allowedDragWallsForLayout, type PositionOverrides } from "./floorplan/plan-geometry";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import {
  buildRound1Snapshot,
  summarizeRound1Snapshot,
  type Round1Snapshot
} from "./snapshot";

export const SHOWROOM_STEPS = [
  "Room",
  "Openings",
  "Layout",
  "Appliances",
  "Adjust Positions"
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

function sinkPositionOptions(windowStatus: Round1FormInput["openings"]["windows"]["status"]) {
  return windowStatus === "YES"
    ? appliancePositionOptions
    : appliancePositionOptions.filter((option) => option !== "UNDER_WINDOW");
}

const PROJECT_ID_STORAGE_KEY = "round1ProjectId";
const DEFAULT_PROJECT_CUSTOMER_NAME = "Showroom Round 1";

type SnapshotPersistState = "idle" | "saving" | "saved" | "error";

export function ShowroomIntakeApp() {
  const [form, setForm] = useState<Round1FormInput>(() => createDefaultShowroomForm());
  const [step, setStep] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [fixedPositionsConfirmed, setFixedPositionsConfirmed] = useState(false);
  const [cabinetFillGenerated, setCabinetFillGenerated] = useState(false);
  const [snapshot, setSnapshot] = useState<Round1Snapshot | null>(null);
  const [persistState, setPersistState] = useState<SnapshotPersistState>("idle");
  const projectIdRef = useRef<string | null>(null);
  const [hasEnteredAdjustPositions, setHasEnteredAdjustPositions] = useState(false);
  const [showAdjustPositionsModal, setShowAdjustPositionsModal] = useState(false);
  const [highlightDraggableItems, setHighlightDraggableItems] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Concept rendering is a non-authoritative customer preview derived from the
  // frozen snapshot. It is persisted separately (never part of the snapshot) so
  // the last preview survives a reload. `renderingBasedOn` records which
  // snapshot it was built from, so the UI can flag it stale once the snapshot
  // changes; the image itself is kept (not cleared) across edits.
  const floorPlanSvgRef = useRef<SVGSVGElement | null>(null);
  // Hidden, clean render built from the frozen snapshot geometry. This — not the
  // live editable preview — is what gets rasterized and sent to the image model,
  // so the reference image and the JSON prompt come from the identical locked
  // snapshot, with no labels/markers/chrome.
  const referenceTopDownRef = useRef<SVGSVGElement | null>(null);
  const [renderingImage, setRenderingImage] = useState<string | null>(null);
  const [renderingBasedOn, setRenderingBasedOn] = useState<string | null>(null);
  const [renderingBusy, setRenderingBusy] = useState(false);
  const [renderingError, setRenderingError] = useState<string | null>(null);

  // Any manual drag invalidates the confirmed positions and the generated
  // cabinet fill, so the frozen snapshot is cleared and must be regenerated.
  const updatePositionOverrides = useCallback<Dispatch<SetStateAction<PositionOverrides>>>(
    (update) => {
      setPositionOverrides(update);
      setFixedPositionsConfirmed(false);
      setCabinetFillGenerated(false);
      setSnapshot(null);
      setPersistState("idle");
      // Keep the last rendering visible; it will surface as stale.
      setRenderingError(null);
    },
    []
  );

  // Form values are layout-critical in Round 1. Editing any of them after a
  // snapshot exists makes the rough cabinet fill stale, so it must be
  // regenerated before the snapshot is valid again.
  const updateForm = useCallback((next: Round1FormInput) => {
    setForm(next);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
    // Keep the last rendering visible; it will surface as stale.
    setRenderingError(null);
  }, []);

  // Persists the frozen snapshot to the server repository. Lazily creates the
  // project on first save and remembers its id so refreshes can restore it.
  const persistSnapshot = useCallback(async (snap: Round1Snapshot) => {
    setPersistState("saving");
    try {
      let id = projectIdRef.current;
      if (!id) {
        const created = await fetch("/api/round1/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerName: DEFAULT_PROJECT_CUSTOMER_NAME })
        });
        if (!created.ok) throw new Error("Unable to create project");
        const json = await created.json();
        id = json.project.id as string;
        projectIdRef.current = id;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(PROJECT_ID_STORAGE_KEY, id);
        }
      }
      const saved = await fetch(`/api/round1/projects/${id}/snapshot`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snap)
      });
      if (!saved.ok) throw new Error("Unable to save snapshot");
      setPersistState("saved");
    } catch {
      // Keep the snapshot in local state; the server copy can be retried on the
      // next generation. Surface a non-blocking error in the panel.
      setPersistState("error");
    }
  }, []);

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
      cabinetFillGenerated
        ? generatePreliminaryCabinetList(createDefaultCabinetRuns(form))
        : EMPTY_PRELIMINARY_CABINET_ESTIMATE,
    [cabinetFillGenerated, form]
  );
  const estimateSummary = useMemo(
    () => summarizePreliminaryCabinetEstimate(preliminaryEstimate),
    [preliminaryEstimate]
  );
  const confirmationItems = useMemo(
    () => [...result.confirmationItems, ...preliminaryEstimate.confirmationItems],
    [preliminaryEstimate.confirmationItems, result.confirmationItems]
  );

  // `Generate Cabinet Fill` is the authoritative snapshot point for Module 1.
  // The estimate is computed inline (not read from the gated memo, which is
  // still empty at click time) so the snapshot freezes the exact rough fill.
  const handleGenerateCabinetFill = useCallback(() => {
    const estimate = generatePreliminaryCabinetList(createDefaultCabinetRuns(form));
    const snapshotConfirmationItems = [
      ...result.confirmationItems,
      ...estimate.confirmationItems
    ];
    const snap = buildRound1Snapshot({
      showroomForm: form,
      normalized: result.normalized,
      positionOverrides,
      preliminaryCabinets: estimate,
      confirmationItems: snapshotConfirmationItems,
      readiness: result.readiness
    });
    setSnapshot(snap);
    setCabinetFillGenerated(true);
    // A freshly frozen snapshot supersedes any prior concept rendering, but the
    // last preview is kept and shown as stale until it is regenerated.
    setRenderingError(null);
    void persistSnapshot(snap);
  }, [form, persistSnapshot, positionOverrides, result]);

  // Generates the non-authoritative concept rendering: rasterizes the clean
  // reference view(s) built from the frozen snapshot geometry into reference
  // PNG(s), then asks the server (which loads the authoritative snapshot by
  // project id and builds the matching prompt) to render. The result is shown as
  // a concept preview only and is never authoritative.
  const handleGenerateRendering = useCallback(async () => {
    const referenceSvg = referenceTopDownRef.current;
    const projectId = projectIdRef.current;
    if (!referenceSvg || !projectId || !snapshot) return;

    setRenderingBusy(true);
    setRenderingError(null);
    try {
      const referenceImagesBase64 = [await rasterizeSvgElement(referenceSvg)];
      const response = await fetch(
        `/api/round1/projects/${projectId}/rendering`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceImagesBase64 })
        }
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          detail?.reason || detail?.error || `Request failed (${response.status})`
        );
      }
      const json = await response.json();
      setRenderingImage(`data:image/png;base64,${json.imageBase64}`);
      setRenderingBasedOn(json.basedOnSnapshotGeneratedAt ?? null);
    } catch (error) {
      setRenderingError(
        error instanceof Error ? error.message : "Rendering failed"
      );
    } finally {
      setRenderingBusy(false);
    }
  }, [snapshot]);

  const handleResetPositions = useCallback(() => {
    setPositionOverrides({});
    setFixedPositionsConfirmed(false);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
    // Keep the last rendering visible; it will surface as stale.
    setRenderingError(null);
  }, []);

  // On mount, restore the last persisted snapshot (if any) so a refresh keeps
  // the frozen Round 1 result. The snapshot carries everything needed to
  // rehydrate the editing session consistently.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedId = window.localStorage.getItem(PROJECT_ID_STORAGE_KEY);
    if (!storedId) return;
    projectIdRef.current = storedId;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/round1/projects/${storedId}`);
        if (!response.ok) {
          if (response.status === 404) {
            window.localStorage.removeItem(PROJECT_ID_STORAGE_KEY);
            projectIdRef.current = null;
          }
          return;
        }
        const json = await response.json();
        const saved = json.project?.snapshot as Round1Snapshot | undefined;
        if (cancelled || !saved) return;
        setForm(saved.showroomForm);
        setPositionOverrides(saved.positionOverrides);
        setFixedPositionsConfirmed(true);
        setCabinetFillGenerated(true);
        setSnapshot(saved);
        setPersistState("saved");
        // Restore the last non-authoritative concept preview, if any. Staleness
        // is derived from `basedOnSnapshotGeneratedAt` vs the restored snapshot.
        const rendering = json.project?.latestRendering as
          | { imageBase64?: string; basedOnSnapshotGeneratedAt?: string }
          | undefined;
        if (rendering?.imageBase64) {
          setRenderingImage(`data:image/png;base64,${rendering.imageBase64}`);
          setRenderingBasedOn(rendering.basedOnSnapshotGeneratedAt ?? null);
        }
      } catch {
        // Ignore restore failures; the user can regenerate the snapshot.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const goToNextStep = useCallback(() => {
    if (step === ADJUST_POSITIONS_STEP_INDEX && !fixedPositionsConfirmed) {
      setFixedPositionsConfirmed(true);
    }
    setStep(Math.min(SHOWROOM_STEPS.length - 1, step + 1));
  }, [fixedPositionsConfirmed, step]);

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
          {step === 0 && <RoomStep form={form} setForm={updateForm} />}
          {step === 1 && <OpeningsStep form={form} setForm={updateForm} />}
          {step === 2 && <LayoutStep form={form} setForm={updateForm} setPositionOverrides={updatePositionOverrides} />}
          {step === 3 && <AppliancesStep form={form} setForm={updateForm} />}
          {step === 4 && (
            <AdjustPositionsStep
              onHighlight={startDraggableHighlightCue}
              onReset={handleResetPositions}
              onConfirmPositions={() => setFixedPositionsConfirmed(true)}
              onGenerateCabinetFill={handleGenerateCabinetFill}
              hasOverrides={Object.keys(positionOverrides).length > 0}
              fixedPositionsConfirmed={fixedPositionsConfirmed}
              cabinetFillGenerated={cabinetFillGenerated}
            />
          )}
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
            cabinets={preliminaryEstimate.cabinets}
            confirmationItems={confirmationItems}
            positionOverrides={positionOverrides}
            onPositionOverridesChange={updatePositionOverrides}
            highlightDraggableItems={highlightDraggableItems}
            showPositionObjects={step >= ADJUST_POSITIONS_STEP_INDEX}
            svgRef={floorPlanSvgRef}
          />

          {/*
            Hidden, clean reference render bound to the frozen snapshot geometry.
            This is the image rasterized for the AI rendering — same locked
            source as the JSON prompt, with no labels/markers/drag chrome.
          */}
          {snapshot && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                width: 0,
                height: 0,
                overflow: "hidden",
                pointerEvents: "none"
              }}
            >
              <LayoutPreview
                plan={snapshot.floorPlan}
                referenceMode
                normalized={snapshot.normalized}
                cabinets={snapshot.preliminaryCabinets.cabinets}
                confirmationItems={snapshot.confirmationItems}
                positionOverrides={snapshot.positionOverrides}
                onPositionOverridesChange={() => {}}
                highlightDraggableItems={false}
                showPositionObjects
                svgRef={referenceTopDownRef}
              />
            </div>
          )}

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

          <Panel title="Rough Cabinet Fill">
            <CabinetFillSummaryPanel
              summary={estimateSummary}
              positionsConfirmed={fixedPositionsConfirmed}
              cabinetFillGenerated={cabinetFillGenerated}
            />
          </Panel>

          <Panel title="Round 1 Snapshot">
            <Round1SnapshotPanel
              snapshot={snapshot}
              persistState={persistState}
              renderingBusy={renderingBusy}
              renderingImage={renderingImage}
              renderingError={renderingError}
              renderingStale={
                renderingImage !== null &&
                (!snapshot || renderingBasedOn !== snapshot.generatedAt)
              }
              canRender={persistState === "saved"}
              onGenerateRendering={handleGenerateRendering}
            />
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
  setForm,
  setPositionOverrides
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
  setPositionOverrides: Dispatch<SetStateAction<PositionOverrides>>;
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
        onChange={(value) => {
          const newLayout = value as Round1FormInput["layoutPreference"];
          setForm({ ...form, layoutPreference: newLayout });
          setPositionOverrides((prev) => {
            const allowed = allowedDragWallsForLayout(newLayout);
            const next: PositionOverrides = {};
            for (const [k, v] of Object.entries(prev)) {
              if (k === "door" || k === "window" || allowed.includes(v.wall)) {
                next[k] = v;
              }
            }
            return next;
          });
        }}
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

function AdjustPositionsStep({
  onHighlight,
  onReset,
  onConfirmPositions,
  onGenerateCabinetFill,
  hasOverrides,
  fixedPositionsConfirmed,
  cabinetFillGenerated
}: {
  onHighlight: () => void;
  onReset: () => void;
  onConfirmPositions: () => void;
  onGenerateCabinetFill: () => void;
  hasOverrides: boolean;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
  const primaryAction = fixedPositionsConfirmed
    ? onGenerateCabinetFill
    : onConfirmPositions;
  const primaryLabel = !fixedPositionsConfirmed
    ? "Confirm Fixed Positions"
    : cabinetFillGenerated
      ? "Cabinet Fill Generated"
      : "Generate Cabinet Fill";

  return (
    <Step title="5. Adjust Positions">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cabinetFillGenerated ? (
            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Cabinet fill generated
            </span>
          ) : fixedPositionsConfirmed ? (
            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Fixed positions confirmed
            </span>
          ) : hasOverrides ? (
            <span className="rounded bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              Adjusted manually
            </span>
          ) : null}
        </div>
      </div>
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
          disabled={!hasOverrides && !fixedPositionsConfirmed && !cabinetFillGenerated}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset Positions
        </button>
        <button
          type="button"
          onClick={primaryAction}
          disabled={cabinetFillGenerated}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {primaryLabel}
        </button>
      </div>
    </Step>
  );
}

export function CabinetFillSummaryPanel({
  summary,
  positionsConfirmed,
  cabinetFillGenerated
}: {
  summary: PreliminaryCabinetEstimateSummary;
  positionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
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

  if (!cabinetFillGenerated) {
    return (
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Fixed positions confirmed
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Generate cabinet fill when the fixed positions are ready.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Rough cabinet fill
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
          Approximate only. The plan fills standard cabinets from rough room
          runs so sales and the customer can confirm the general direction.
        </p>
        <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Pricing reserved
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Dollar pricing is intentionally left for a later quote step.
          </p>
        </div>
      </div>
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

function RenderingControls({
  canRender,
  busy,
  error,
  stale,
  image,
  onGenerate
}: {
  canRender: boolean;
  busy: boolean;
  error: string | null;
  stale: boolean;
  image: string | null;
  onGenerate?: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canRender || busy}
        className="w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Generating Rendering…"
          : image && stale
            ? "Regenerate Rendering"
            : "Generate Rendering"}
      </button>
      {!canRender ? (
        <p className="text-xs leading-5 text-slate-500">
          {image
            ? "Regenerate cabinet fill, then re-run to refresh this preview."
            : "Available after cabinet fill is generated."}
        </p>
      ) : (
        <p className="text-xs leading-5 text-slate-500">
          Sends a clean deterministic layout image plus a wall-by-wall
          description of this locked snapshot to the image model. The result is a
          concept preview only.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          Could not generate the rendering: {error}
        </p>
      )}
      {image && (
        <figure className="space-y-1">
          {stale && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] font-bold leading-4 text-amber-800">
              Outdated — this concept is based on an earlier snapshot. Regenerate
              cabinet fill, then re-run Generate Rendering to refresh it.
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Round 1 concept rendering"
            className={`w-full rounded-md border border-slate-200 ${
              stale ? "opacity-60" : ""
            }`}
          />
          <figcaption className="text-[11px] leading-4 text-slate-500">
            Concept preview only — never the source of truth for cabinet data,
            dimensions, counts, geometry, or quotes.
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function Round1SnapshotPanel({
  snapshot,
  persistState = "idle",
  renderingBusy = false,
  renderingImage = null,
  renderingError = null,
  renderingStale = false,
  canRender = false,
  onGenerateRendering
}: {
  snapshot: Round1Snapshot | null;
  persistState?: SnapshotPersistState;
  renderingBusy?: boolean;
  renderingImage?: string | null;
  renderingError?: string | null;
  renderingStale?: boolean;
  canRender?: boolean;
  onGenerateRendering?: () => void;
}) {
  const renderingControls = (
    <RenderingControls
      canRender={canRender}
      busy={renderingBusy}
      error={renderingError}
      stale={renderingStale}
      image={renderingImage}
      onGenerate={onGenerateRendering}
    />
  );

  if (!snapshot) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            No snapshot yet
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Generate cabinet fill to freeze the authoritative Round 1 sales
            snapshot. Until then, form and position changes stay draft only.
          </p>
        </div>
        {renderingControls}
      </div>
    );
  }

  const summary = summarizeRound1Snapshot(snapshot);

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-emerald-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Snapshot ready
        </p>
        <p className="mt-1 text-xs font-bold text-emerald-800">
          Generated {snapshot.generatedAt}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            {summary.totalCabinets} cabinets
          </span>
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            {summary.confirmationCount} to confirm
          </span>
          <span className="rounded bg-white px-2 py-1 text-slate-700">
            ~{summary.estimatedFillerWidth}&quot; filler
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">
            Not production
          </span>
          <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
            ROUGH
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
            Sales estimate only
          </span>
        </div>
        <SnapshotPersistStatus persistState={persistState} />
      </div>

      {renderingControls}

      <details className="rounded-md border border-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">
          View snapshot JSON
        </summary>
        <pre className="max-h-64 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-4 text-slate-700">
{JSON.stringify(snapshot, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SnapshotPersistStatus({
  persistState
}: {
  persistState: SnapshotPersistState;
}) {
  if (persistState === "idle") return null;

  const config = {
    saving: { text: "Saving to server…", className: "text-slate-500" },
    saved: { text: "Saved to server", className: "text-emerald-700" },
    error: {
      text: "Couldn’t reach server — snapshot kept locally.",
      className: "text-amber-700"
    }
  }[persistState];

  return (
    <p className={`mt-2 text-[11px] font-bold ${config.className}`}>
      {config.text}
    </p>
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
