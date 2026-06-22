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
import {
  rasterizeImageSourceToPngBase64,
  rasterizeRenderingReferences
} from "./rendering-references";
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
  selectedRenderingColor,
  type RenderingPreferenceStamp
} from "./rendering-preferences";
import { Panel } from "./showroom-intake-controls";
import { Panel as ResizablePanel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ArrowLeft, BotMessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { IntakeSidebar } from "./intake-sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { LogoutButton } from "@/features/platform/logout-button";
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

// Switches the shell between the desktop resizable PanelGroup and the stacked
// mobile layout. Defaults to desktop so SSR/first paint matches, then corrects.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="group flex w-1.5 items-center justify-center bg-transparent transition-colors hover:bg-surface-2">
      <div className="h-6 w-1 rounded-full bg-border-strong transition-colors group-hover:bg-accent" />
    </PanelResizeHandle>
  );
}

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
  const [cabinetColorsError, setCabinetColorsError] = useState(false);
  const [snapshot, setSnapshot] = useState<Round1Snapshot | null>(null);
  const [persistState, setPersistState] = useState<SnapshotPersistState>("idle");
  const projectIdRef = useRef<string | null>(null);
  const prefsSaveControllerRef = useRef<AbortController | null>(null);
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

    // Cancel any in-flight preference save so overlapping rapid selections can't
    // land out of order (the latest selection wins).
    prefsSaveControllerRef.current?.abort();
    const controller = new AbortController();
    prefsSaveControllerRef.current = controller;

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
          }),
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("Unable to save rendering preferences");
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
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
    if (!projectId) return;
    setPersistState("saving");
    try {
      // Authenticated project-scoped persistence. Save the editable Round 1
      // state and the frozen snapshot under the project. The server loads the
      // authoritative snapshot back by project id and never trusts client-posted
      // plan data for rendering.
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
    } catch {
      // Keep the snapshot in local state and surface "error" so the user can
      // retry the save in place (Round1SnapshotPanel onRetrySave) instead of
      // being stuck with rendering disabled.
      setPersistState("error");
    }
  }, [projectId]);

  // Re-run the snapshot save after a transient failure without rebuilding it, so
  // a network blip on save doesn't block rendering or force a destructive redo.
  const handleRetrySnapshotSave = useCallback(() => {
    if (snapshot) void persistSnapshot(snapshot);
  }, [snapshot, persistSnapshot]);

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

  // Load the cabinet color library. A failed load is tracked separately from a
  // genuinely empty library so the Rendering Preferences step can show a
  // "couldn't load — retry" state instead of the misleading "ask an Admin to
  // configure cabinet colors" empty state.
  const loadCabinetColors = useCallback(async (signal?: AbortSignal) => {
    setCabinetColorsError(false);
    try {
      const response = await fetch("/api/cabinet-colors", { signal });
      if (!response.ok) {
        setCabinetColorsError(true);
        return;
      }
      const json = await response.json();
      const colors = Array.isArray(json) ? json : json.colors;
      if (Array.isArray(colors)) {
        setCabinetColors(colors);
      }
    } catch {
      if (!signal?.aborted) setCabinetColorsError(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCabinetColors(controller.signal);
    return () => controller.abort();
  }, [loadCabinetColors]);

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
    if (
      !referenceTopDownSvg ||
      !projectId ||
      !snapshot ||
      !renderingPreferencesComplete(cabinetColors, form)
    ) {
      return;
    }

    setRenderingBusy(true);
    setRenderingError(null);
    try {
      // Persist the latest finish selection BEFORE rendering: the rendering route
      // builds the prompt from the saved server state, so an unsaved color would
      // otherwise render with the previously-saved finish.
      const savedState = await fetch(`/api/projects/${projectId}/round1/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showroomForm: form,
          positionOverrides,
          fixedPositionsConfirmed,
          cabinetFillGenerated
        })
      });
      if (!savedState.ok) {
        throw new Error("Couldn't save your color selection. Please try again.");
      }

      const referenceImagesBase64 = await rasterizeRenderingReferences([
        referenceTopDownSvg,
        referenceElevationSvg
      ]);
      // Also send the selected door color's swatch as a MATERIAL reference so the
      // image model matches the actual color/finish, not just the text prompt.
      const selectedColor = selectedRenderingColor(cabinetColors, form);
      if (selectedColor?.swatchImageUrl) {
        try {
          const swatchPng = await rasterizeImageSourceToPngBase64(
            selectedColor.swatchImageUrl
          );
          if (swatchPng) referenceImagesBase64.push(swatchPng);
        } catch {
          // Best-effort: fall back to the text prompt if the swatch can't rasterize.
        }
      }
      const response = await fetch(
        `/api/projects/${projectId}/round1/renderings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceImagesBase64 }),
          // Recover the UI if the whole request stalls (the server also caps the
          // upstream image call), instead of spinning on "Generating..." forever.
          signal: AbortSignal.timeout(120_000)
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
        error instanceof Error
          ? error.name === "TimeoutError"
            ? "Rendering timed out. Please try again."
            : error.message
          : "Rendering failed"
      );
    } finally {
      setRenderingBusy(false);
    }
  }, [
    cabinetColors,
    form,
    projectId,
    snapshot,
    positionOverrides,
    fixedPositionsConfirmed,
    cabinetFillGenerated
  ]);

  const handleResetPositions = useCallback(() => {
    localSessionChangedRef.current = true;
    setPositionOverrides({});
    setFixedPositionsConfirmed(false);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
    // Send the user back to Adjust Positions so they can't sit on the Rendering
    // step with every action disabled; they must re-confirm + regenerate fill.
    setStep(ADJUST_POSITIONS_STEP_INDEX);
    setMaxAccessibleStep(ADJUST_POSITIONS_STEP_INDEX);
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
          // A persisted snapshot proves positions were confirmed and cabinet fill
          // was generated; derive both flags from it rather than trusting a
          // possibly-skewed saved-state row (state + snapshot are written
          // non-atomically), which could otherwise land the user on a step with
          // disabled actions.
          setFixedPositionsConfirmed(true);
          setCabinetFillGenerated(true);
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

  // Warn before leaving (back link / refresh / tab close) when there are unsaved
  // in-progress intake edits that haven't been frozen and saved to the server,
  // so navigating away doesn't silently discard the work.
  useEffect(() => {
    const hasUnsavedEdits =
      localSessionChangedRef.current &&
      persistState !== "saved" &&
      persistState !== "saving";
    if (!hasUnsavedEdits) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [persistState, cabinetFillGenerated, form, positionOverrides]);

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

  const isDesktop = useIsDesktop();
  const [showChat, setShowChat] = useState(true);

  const persistBadge =
    persistState === "saving"
      ? { tone: "warning" as const, label: "Saving…" }
      : persistState === "saved"
        ? { tone: "success" as const, label: "Saved" }
        : persistState === "error"
          ? { tone: "danger" as const, label: "Save failed" }
          : { tone: "neutral" as const, label: "Draft" };

  const stepContent = (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div key={step} className="mx-auto max-w-3xl animate-blur-in">
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
              colorsError={cabinetColorsError}
              onRetryLoadColors={() => void loadCabinetColors()}
              onFormChange={updateRenderingPreferencesForm}
              onGenerateCabinetFill={handleGenerateCabinetFill}
              onGenerateRendering={handleGenerateRendering}
              canGenerateCabinetFill={fixedPositionsConfirmed && !cabinetFillGenerated}
              canGenerateRendering={
                persistState === "saved" && renderingPreferencesComplete(cabinetColors, form)
              }
              renderingBusy={renderingBusy}
            />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface px-6 py-4 lg:px-10">
        <button
          type="button"
          onClick={() => {
            localSessionChangedRef.current = true;
            setStep(Math.max(0, step - 1));
          }}
          disabled={step === 0}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <button
          type="button"
          onClick={goToNextStep}
          disabled={step === SHOWROOM_STEPS.length - 1}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  const floorPlanColumn = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4">
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
        canRender={persistState === "saved" && renderingPreferencesComplete(cabinetColors, form)}
        busy={renderingBusy}
        error={renderingError}
        stale={
          renderingImage !== null &&
          (!snapshot ||
            renderingBasedOn !== snapshot.generatedAt ||
            !renderingPreferenceStampMatches(renderingPreferencesBasedOn, form, cabinetColors))
        }
        image={renderingImage}
      />

      <Panel title="Confirmation Required">
        <div className="max-h-48 space-y-2 overflow-auto pr-1">
          {confirmationItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No current confirmation flags.</p>
          ) : (
            confirmationItems.map((item) => (
              <div key={item.id} className="rounded-md bg-warning-surface p-2 text-sm">
                <p className="font-semibold text-warning-foreground">{item.code}</p>
                <p className="text-warning-foreground/90">{item.message}</p>
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
          onRetrySave={handleRetrySnapshotSave}
        />
      </Panel>
    </div>
  );

  const chatColumn = <AgentChatPanel form={form} onFormUpdate={updateForm} />;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-4">
          <a
            href={projectId ? `/projects/${projectId}` : "/projects"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            {projectId ? "Back to project" : "Back to projects"}
          </a>
          <Badge tone={persistBadge.tone} dot className="hidden sm:inline-flex">
            {persistBadge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowChat((value) => !value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors",
              showChat
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-2"
            )}
          >
            <BotMessageSquare size={14} />
            {showChat ? "Hide AI Agent" : "AI Intake Agent"}
          </button>
          <LogoutButton />
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {isDesktop ? (
          <PanelGroup direction="horizontal" className="h-full">
            <ResizablePanel id="sidebar" order={1} defaultSize={16} minSize={12} maxSize={22}>
              <IntakeSidebar
                steps={SHOWROOM_STEPS}
                step={step}
                maxAccessibleStep={maxAccessibleStep}
                onStepClick={goToStep}
              />
            </ResizablePanel>
            <ResizeHandle />
            <ResizablePanel id="content" order={2} defaultSize={showChat ? 38 : 46} minSize={28}>
              {stepContent}
            </ResizablePanel>
            <ResizeHandle />
            <ResizablePanel id="floorplan" order={3} defaultSize={showChat ? 28 : 38} minSize={20}>
              {floorPlanColumn}
            </ResizablePanel>
            {showChat && (
              <>
                <ResizeHandle />
                <ResizablePanel id="chat" order={4} defaultSize={18} minSize={14} maxSize={28}>
                  {chatColumn}
                </ResizablePanel>
              </>
            )}
          </PanelGroup>
        ) : (
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex gap-2 overflow-x-auto border-b border-border bg-background px-4 py-3">
              {SHOWROOM_STEPS.map((label, index) => {
                const locked = index > maxAccessibleStep;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={locked}
                    onClick={() => goToStep(index)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      index === step
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground",
                      locked && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span className="font-mono">{index + 1}</span>
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="border-b border-border">{stepContent}</div>
            <div className="border-b border-border">{floorPlanColumn}</div>
            {showChat && <div className="h-[80vh]">{chatColumn}</div>}
          </div>
        )}
      </div>

      {/*
        Hidden, clean reference render bound to the frozen snapshot geometry.
        This is the image rasterized for the AI rendering — same locked source
        as the JSON prompt, with no labels/markers/drag chrome.
      */}
      {snapshot && (
        <div
          aria-hidden
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
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
          <ElevationPreview plan={snapshot.floorPlan} svgRef={referenceElevationRef} />
        </div>
      )}

      {showAdjustPositionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-blur-in rounded-lg border border-border bg-surface p-6 shadow-xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Adjust Positions
            </p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              Door, window, and appliance locations can be dragged on the plan.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Drag these rough positions first, then confirm them to generate the
              preliminary cabinet fill around those constraints.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAdjustPositionsModal(false);
                  startDraggableHighlightCue();
                }}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
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
