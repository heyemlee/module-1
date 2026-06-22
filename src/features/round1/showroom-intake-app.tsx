"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  generatePreliminaryCabinetList,
  summarizePreliminaryCabinetEstimate,
  normalizeRound1Form,
  round1FormSchema,
  type PreliminaryCabinetEstimate,
  type Round1FormInput
} from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { AgentChatPanel } from "./agent-chat-panel";
import { ElevationPreview } from "./elevations/elevation-preview";
import { LayoutPreview } from "./layout-preview";
import { RenderingPreferencesStep } from "./rendering-preferences-step";
import { rasterizeRenderingReferences } from "./rendering-references";
import { type PositionOverrides } from "./floorplan/plan-geometry";
import {
  createDefaultCabinetRuns,
  createDefaultShowroomForm
} from "./showroom-intake-data";
import { buildRound1Snapshot, type Round1Snapshot } from "./snapshot";
import {
  renderingPreferenceStampForForm,
  renderingPreferenceStampMatches,
  renderingPreferencesComplete,
  type RenderingPreferenceStamp
} from "./rendering-preferences";
import { Panel } from "./showroom-intake-controls";
import {
  AdjustPositionsStep,
  AppliancesStep,
  LayoutStep,
  OpeningsStep,
  RoomStep
} from "./showroom-intake-steps";
import {
  CabinetFillSummaryPanel,
  Round1SnapshotPanel,
  RenderingControls,
  type SnapshotPersistState
} from "./showroom-intake-panels";

export const SHOWROOM_STEPS = [
  "Room",
  "Openings",
  "Layout",
  "Appliances",
  "Adjust Positions",
  "Rendering Preferences"
] as const;

const ADJUST_POSITIONS_STEP_INDEX = SHOWROOM_STEPS.indexOf("Adjust Positions");
const PREVIEW_STAGES = [
  "room",
  "openings",
  "layout",
  "appliances",
  "adjust",
  "adjust"
] as const;

const EMPTY_PRELIMINARY_CABINET_ESTIMATE: PreliminaryCabinetEstimate = {
  cabinets: [],
  confirmationItems: [],
  estimatedFillerWidth: 0,
  salesEstimateOnly: true,
  notForProduction: true
};

const PROJECT_ID_STORAGE_KEY = "round1ProjectId";
const DEFAULT_PROJECT_CUSTOMER_NAME = "Showroom Round 1";

export function shouldApplySnapshotRestore({
  cancelled,
  hasSavedSnapshot,
  localSessionChanged
}: {
  cancelled: boolean;
  hasSavedSnapshot: boolean;
  localSessionChanged: boolean;
}) {
  return !cancelled && hasSavedSnapshot && !localSessionChanged;
}

export function ShowroomIntakeApp({ projectId }: { projectId?: string }) {
  const [form, setForm] = useState<Round1FormInput>(() => createDefaultShowroomForm());
  const [step, setStep] = useState(0);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [fixedPositionsConfirmed, setFixedPositionsConfirmed] = useState(false);
  const [cabinetFillGenerated, setCabinetFillGenerated] = useState(false);
  const [cabinetColors, setCabinetColors] = useState<CabinetColor[]>([]);
  const [snapshot, setSnapshot] = useState<Round1Snapshot | null>(null);
  const [persistState, setPersistState] = useState<SnapshotPersistState>("idle");
  const projectIdRef = useRef<string | null>(null);
  const [hasEnteredAdjustPositions, setHasEnteredAdjustPositions] = useState(false);
  const [showAdjustPositionsModal, setShowAdjustPositionsModal] = useState(false);
  const [highlightDraggableItems, setHighlightDraggableItems] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSessionChangedRef = useRef(false);

  // Concept rendering is a non-authoritative customer preview derived from the
  // frozen snapshot. It is persisted separately (never part of the snapshot) so
  // the last preview survives a reload. `renderingBasedOn` records which
  // snapshot it was built from, and `renderingPreferencesBasedOn` records the
  // finish selection used, so the UI can flag it stale once either changes; the
  // image itself is kept (not cleared) across edits.
  const floorPlanSvgRef = useRef<SVGSVGElement | null>(null);
  // Hidden, clean render built from the frozen snapshot geometry. This — not the
  // live editable preview — is what gets rasterized and sent to the image model,
  // so the reference image and the JSON prompt come from the identical locked
  // snapshot, with no labels/markers/chrome.
  const referenceTopDownRef = useRef<SVGSVGElement | null>(null);
  const referenceElevationRef = useRef<SVGSVGElement | null>(null);
  const [renderingImage, setRenderingImage] = useState<string | null>(null);
  const [renderingBasedOn, setRenderingBasedOn] = useState<string | null>(null);
  const [renderingPreferencesBasedOn, setRenderingPreferencesBasedOn] =
    useState<RenderingPreferenceStamp | null>(null);
  const [renderingBusy, setRenderingBusy] = useState(false);
  const [renderingError, setRenderingError] = useState<string | null>(null);

  // Any manual drag invalidates the confirmed positions and the generated
  // cabinet fill, so the frozen snapshot is cleared and must be regenerated.
  const updatePositionOverrides = useCallback<Dispatch<SetStateAction<PositionOverrides>>>(
    (update) => {
      localSessionChangedRef.current = true;
      setPositionOverrides(update);
      setFixedPositionsConfirmed(false);
      setCabinetFillGenerated(false);
      setSnapshot(null);
      setPersistState("idle");
    },
    []
  );

  // Form values are layout-critical in Round 1. Editing any of them after a
  // snapshot exists makes the rough cabinet fill stale, so it must be
  // regenerated before the snapshot is valid again.
  const updateForm = useCallback((next: Round1FormInput) => {
    localSessionChangedRef.current = true;
    setForm(next);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
  }, []);

  const updateRenderingPreferencesForm = useCallback((next: Round1FormInput) => {
    localSessionChangedRef.current = true;
    setForm(next);
    setRenderingError(null);
    if (!projectId) return;

    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/round1/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showroomForm: next,
            positionOverrides,
            fixedPositionsConfirmed,
            cabinetFillGenerated
          })
        });
        if (!response.ok) {
          throw new Error("Unable to save rendering preferences");
        }
      } catch {
        setRenderingError(
          "Unable to save rendering preferences. The current selection is kept locally."
        );
      }
    })();
  }, [
    cabinetFillGenerated,
    fixedPositionsConfirmed,
    positionOverrides,
    projectId
  ]);

  // Persists the frozen snapshot to the server repository. Lazily creates the
  // project on first save and remembers its id so refreshes can restore it.
  const persistSnapshot = useCallback(async (snap: Round1Snapshot) => {
    setPersistState("saving");
    try {
      if (projectId) {
        // Authenticated project-scoped persistence. Save the editable Round 1
        // state and the frozen snapshot under the project. The server loads the
        // authoritative snapshot back by project id and never trusts
        // client-posted plan data for rendering.
        projectIdRef.current = projectId;
        const savedState = await fetch(`/api/projects/${projectId}/round1/state`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showroomForm: snap.showroomForm,
            positionOverrides: snap.positionOverrides,
            fixedPositionsConfirmed: true,
            cabinetFillGenerated: true
          })
        });
        if (!savedState.ok) throw new Error("Unable to save Round 1 state");
        const saved = await fetch(`/api/projects/${projectId}/round1/snapshot`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snap)
        });
        if (!saved.ok) throw new Error("Unable to save snapshot");
        setPersistState("saved");
        return;
      }

      // Legacy localStorage-scoped path for the standalone dev workflow.
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
  }, [projectId]);

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
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/cabinet-colors");
        if (!response.ok || cancelled) return;
        const json = await response.json();
        const colors = Array.isArray(json) ? json : json.colors;
        if (Array.isArray(colors)) {
          setCabinetColors(colors);
        }
      } catch {
        if (!cancelled) setCabinetColors([]);
      }
    })();

    return () => {
      cancelled = true;
    };
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
  const previewStage = PREVIEW_STAGES[step] ?? "room";

  // `Generate Cabinet Fill` is the authoritative snapshot point for Module 1.
  // The estimate is computed inline (not read from the gated memo, which is
  // still empty at click time) so the snapshot freezes the exact rough fill.
  const handleGenerateCabinetFill = useCallback(() => {
    localSessionChangedRef.current = true;
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
    void persistSnapshot(snap);
  }, [form, persistSnapshot, positionOverrides, result]);

  // Non-authoritative concept rendering. Rasterizes the hidden clean reference
  // render (built from the locked snapshot) and POSTs it to the rendering route,
  // which loads the authoritative snapshot server-side by id and builds the
  // prompt — the client never sends snapshot data, only the reference image.
  const handleGenerateRendering = useCallback(async () => {
    const referenceTopDownSvg = referenceTopDownRef.current;
    const referenceElevationSvg = referenceElevationRef.current;
    const resolvedProjectId = projectId ?? projectIdRef.current;
    if (
      !referenceTopDownSvg ||
      !resolvedProjectId ||
      !snapshot ||
      !renderingPreferencesComplete(cabinetColors, form)
    ) {
      return;
    }

    setRenderingBusy(true);
    setRenderingError(null);
    try {
      const referenceImagesBase64 = await rasterizeRenderingReferences([
        referenceTopDownSvg,
        referenceElevationSvg
      ]);
      const response = await fetch(
        projectId
          ? `/api/projects/${resolvedProjectId}/round1/renderings`
          : `/api/round1/projects/${resolvedProjectId}/rendering`,
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
      setRenderingPreferencesBasedOn(
        json.basedOnRenderingPreferences ??
          renderingPreferenceStampForForm(form, cabinetColors)
      );
    } catch (error) {
      setRenderingError(
        error instanceof Error ? error.message : "Rendering failed"
      );
    } finally {
      setRenderingBusy(false);
    }
  }, [cabinetColors, form, projectId, snapshot]);

  const handleResetPositions = useCallback(() => {
    localSessionChangedRef.current = true;
    setPositionOverrides({});
    setFixedPositionsConfirmed(false);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
    // Keep the last rendering visible; it will surface as stale.
    setRenderingError(null);
  }, []);

  // Authenticated project-scoped restore. When rendered under a project route,
  // rehydrate the editable Round 1 state and the latest frozen snapshot from the
  // server (Postgres-backed) instead of localStorage.
  useEffect(() => {
    if (!projectId) return;
    projectIdRef.current = projectId;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/round1/state`);
        if (!response.ok || cancelled || localSessionChangedRef.current) return;
        const json = await response.json();
        const savedState = json.state as
          | {
              showroomForm: Round1FormInput;
              positionOverrides: PositionOverrides;
              fixedPositionsConfirmed: boolean;
              cabinetFillGenerated: boolean;
            }
          | null;
        const latestSnapshot = json.latestSnapshot?.snapshot as Round1Snapshot | undefined;

        if (savedState) {
          setForm(round1FormSchema.parse(savedState.showroomForm));
          setPositionOverrides(savedState.positionOverrides);
          setFixedPositionsConfirmed(savedState.fixedPositionsConfirmed);
          setCabinetFillGenerated(savedState.cabinetFillGenerated);
        }
        if (latestSnapshot) {
          setSnapshot(latestSnapshot);
          setPersistState("saved");
          setMaxAccessibleStep(SHOWROOM_STEPS.length - 1);
        }
      } catch {
        setPersistState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // On mount, restore the last persisted snapshot (if any) so a refresh keeps
  // the frozen Round 1 result. The snapshot carries everything needed to
  // rehydrate the editing session consistently. Standalone dev workflow only;
  // the project-scoped effect above owns restore when a projectId is present.
  useEffect(() => {
    if (projectId) return;
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
        if (!saved) return;
        if (
          !shouldApplySnapshotRestore({
            cancelled,
            hasSavedSnapshot: true,
            localSessionChanged: localSessionChangedRef.current
          })
        ) {
          return;
        }
        
        // Parse the showroom form using round1FormSchema to ensure all defaults are populated
        let restoredForm: Round1FormInput;
        try {
          restoredForm = round1FormSchema.parse(saved.showroomForm);
        } catch (e) {
          console.warn("Failed to parse saved showroomForm with round1FormSchema, attempting partial recovery", e);
          // Defensive fallback: merge defaults with whatever was saved
          restoredForm = {
            ...createDefaultShowroomForm(),
            ...saved.showroomForm,
            layoutSensitiveCabinets: {
              ...createDefaultShowroomForm().layoutSensitiveCabinets,
              ...(saved.showroomForm.layoutSensitiveCabinets || {}),
              cookingAppliances: {
                ...createDefaultShowroomForm().layoutSensitiveCabinets.cookingAppliances,
                ...(saved.showroomForm.layoutSensitiveCabinets?.cookingAppliances || {})
              }
            }
          };
        }
        setForm(restoredForm);
        setPositionOverrides(saved.positionOverrides);
        setFixedPositionsConfirmed(true);
        setCabinetFillGenerated(true);
        setSnapshot(saved);
        setPersistState("saved");
        setMaxAccessibleStep(SHOWROOM_STEPS.length - 1);
        // Restore the last non-authoritative concept preview, if any. Staleness
        // is derived from `basedOnSnapshotGeneratedAt` vs the restored snapshot.
        const rendering = json.project?.latestRendering as
          | {
              imageBase64?: string;
              basedOnSnapshotGeneratedAt?: string;
              basedOnRenderingPreferences?: RenderingPreferenceStamp;
            }
          | undefined;
        if (rendering?.imageBase64) {
          setRenderingImage(`data:image/png;base64,${rendering.imageBase64}`);
          setRenderingBasedOn(rendering.basedOnSnapshotGeneratedAt ?? null);
          setRenderingPreferencesBasedOn(
            rendering.basedOnRenderingPreferences ??
              renderingPreferenceStampForForm(restoredForm, cabinetColors)
          );
        }
      } catch {
        // Ignore restore failures; the user can regenerate the snapshot.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const goToNextStep = useCallback(() => {
    localSessionChangedRef.current = true;
    if (step === ADJUST_POSITIONS_STEP_INDEX && !fixedPositionsConfirmed) {
      setFixedPositionsConfirmed(true);
    }
    const nextStep = Math.min(SHOWROOM_STEPS.length - 1, step + 1);
    setStep(nextStep);
    setMaxAccessibleStep((current) => Math.max(current, nextStep));
  }, [fixedPositionsConfirmed, step]);

  const goToStep = useCallback((index: number) => {
    if (index > maxAccessibleStep) return;
    localSessionChangedRef.current = true;
    setStep(index);
  }, [maxAccessibleStep]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-normal">
              Showroom Intake + Layout Preview
            </h1>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[260px_minmax(0,1fr)_430px]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          {SHOWROOM_STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(index)}
              disabled={index > maxAccessibleStep}
              className={`mb-2 flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-bold ${
                step === index
                  ? "bg-sky-700 text-white"
                  : index > maxAccessibleStep
                    ? "cursor-not-allowed bg-slate-50 text-slate-300"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>{label}</span>
              <span>{index + 1}</span>
            </button>
          ))}
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {step === 0 && <RoomStep form={form} setForm={updateForm} />}
          {step === 1 && <OpeningsStep form={form} setForm={updateForm} setPositionOverrides={updatePositionOverrides} />}
          {step === 2 && <LayoutStep form={form} setForm={updateForm} setPositionOverrides={updatePositionOverrides} />}
          {step === 3 && <AppliancesStep form={form} setForm={updateForm} />}
          {step === 4 && (
            <AdjustPositionsStep
              onReset={handleResetPositions}
              onConfirmPositions={() => setFixedPositionsConfirmed(true)}
              hasOverrides={Object.keys(positionOverrides).length > 0}
              fixedPositionsConfirmed={fixedPositionsConfirmed}
              cabinetFillGenerated={cabinetFillGenerated}
            />
          )}
          {step === 5 && (
            <RenderingPreferencesStep
              form={form}
              colors={cabinetColors}
              onFormChange={updateRenderingPreferencesForm}
              onGenerateCabinetFill={handleGenerateCabinetFill}
              onGenerateRendering={handleGenerateRendering}
              canGenerateCabinetFill={
                fixedPositionsConfirmed && !cabinetFillGenerated
              }
              canGenerateRendering={
                persistState === "saved" &&
                renderingPreferencesComplete(cabinetColors, form)
              }
              renderingBusy={renderingBusy}
            />
          )}
          <div className="mt-6 flex justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                localSessionChangedRef.current = true;
                setStep(Math.max(0, step - 1));
              }}
              disabled={step === 0}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              disabled={step === SHOWROOM_STEPS.length - 1}
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
            previewStage={previewStage}
            svgRef={floorPlanSvgRef}
          />

          {snapshot && <ElevationPreview plan={snapshot.floorPlan} />}

          <RenderingControls
            canRender={
              persistState === "saved" &&
              renderingPreferencesComplete(cabinetColors, form)
            }
            busy={renderingBusy}
            error={renderingError}
            stale={
              renderingImage !== null &&
              (!snapshot ||
                renderingBasedOn !== snapshot.generatedAt ||
                !renderingPreferenceStampMatches(
                  renderingPreferencesBasedOn,
                  form,
                  cabinetColors
                ))
            }
            image={renderingImage}
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
              <ElevationPreview
                plan={snapshot.floorPlan}
                svgRef={referenceElevationRef}
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
            />
          </Panel>

          {/*
            Optional conversational intake assistant. It edits the live form via
            the same `updateForm` path manual edits use, so the deterministic
            preview updates in place and snapshot staleness rules still apply. It
            has no snapshot-freeze authority — that stays on Generate Cabinet Fill.
          */}
          <AgentChatPanel form={form} onFormUpdate={updateForm} />
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
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustPositionsModal(false);
                  startDraggableHighlightCue();
                }}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
