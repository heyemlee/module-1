"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
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
import { PlatformHeader, NavPill } from "@/features/platform/platform-header";
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
import { useReducedMotion } from "motion/react";
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode,
  workspaceModeStorageKey,
  type WorkspaceMode
} from "./workspace-mode";
import { WorkspaceModeSwitch } from "./workspace-mode-switch";
import { Round1WorkspaceShell } from "./round1-workspace-shell";
import { Round1StepNavigation } from "./round1-step-navigation";
import { Round1Inspector } from "./round1-inspector";
import { Round1Feedback } from "./round1-feedback";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from "@/components/ui/dialog";

gsap.registerPlugin(useGSAP);

export const SHOWROOM_STEPS = [
  "Room",
  "Openings",
  "Layout",
  "Appliances",
  "Adjust Positions",
  "Rendering Preferences"
] as const;

// Short imperative cue per step for the rail's "Next action" callout.
const NEXT_ACTIONS: Record<number, string> = {
  0: "Enter room size & obstacles",
  1: "Mark doors & windows",
  2: "Choose a kitchen layout",
  3: "Set appliances & fixtures",
  4: "Confirm dragged constraints",
  5: "Generate fill & rendering"
};


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

export function RenderingPreferencesLockControl({
  preferencesLocked,
  canLock,
  onLock
}: {
  preferencesLocked: boolean;
  canLock: boolean;
  onLock: () => void;
}) {
  const disabled = preferencesLocked || !canLock;
  const title = preferencesLocked
    ? "Preferences locked. Change the selection to unlock automatically."
    : canLock
      ? "Lock preferences"
      : "Select a cabinet color before locking.";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        className={cn("lock-button", preferencesLocked ? "locked" : "unlocked")}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onLock();
        }}
        title={title}
      >
        {preferencesLocked ? (
          <svg viewBox="0 0 24 24" className="lock-svgIcon">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="lock-svgIcon">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
          </svg>
        )}
      </button>
      {!preferencesLocked && !canLock && (
        <p className="max-w-44 text-center text-[11px] font-semibold text-[#b42318]">
          Select a cabinet color before locking.
        </p>
      )}
    </div>
  );
}

export function renderingPreferencesStateAfterChange(form: Round1FormInput) {
  return {
    form,
    preferencesLocked: false
  };
}

export function ShowroomIntakeApp({
  projectId,
  customerName,
  projectName,
  userName = "Account",
  isAdmin = false
}: {
  projectId?: string;
  customerName?: string;
  projectName?: string;
  userName?: string;
  isAdmin?: boolean;
}) {
  const [form, setForm] = useState<Round1FormInput>(() => createDefaultShowroomForm());
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>(DEFAULT_WORKSPACE_MODE);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const stored = window.localStorage.getItem(workspaceModeStorageKey);
    setWorkspaceMode(parseWorkspaceMode(stored));
  }, []);

  const updateWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode);
    window.localStorage.setItem(workspaceModeStorageKey, mode);
  }, []);


  const [step, setStep] = useState(0);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [fixedPositionsConfirmed, setFixedPositionsConfirmed] = useState(false);
  const [cabinetFillGenerated, setCabinetFillGenerated] = useState(false);
  const [cabinetColors, setCabinetColors] = useState<CabinetColor[]>([]);
  const [cabinetColorsError, setCabinetColorsError] = useState(false);
  const [snapshot, setSnapshot] = useState<Round1Snapshot | null>(null);
  const [persistState, setPersistState] = useState<SnapshotPersistState>("idle");
  const [preferencesLocked, setPreferencesLocked] = useState(false);
  const [hasRenderedConcept, setHasRenderedConcept] = useState(false);
  const projectIdRef = useRef<string | null>(null);
  const prefsSaveControllerRef = useRef<AbortController | null>(null);
  const [hasEnteredAdjustPositions, setHasEnteredAdjustPositions] = useState(false);
  const [showAdjustPositionsModal, setShowAdjustPositionsModal] = useState(false);
  const [highlightDraggableItems, setHighlightDraggableItems] = useState(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSessionChangedRef = useRef(false);
  const shellRef = useRef<HTMLElement | null>(null);

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
  const [renderings, setRenderings] = useState<{ id: string; url: string; doorColorId: string | null }[]>([]);
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
    const nextState = renderingPreferencesStateAfterChange(next);
    localSessionChangedRef.current = true;
    setPreferencesLocked(nextState.preferencesLocked);
    setHasRenderedConcept(false);
    setForm(nextState.form);
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

  const preferencesComplete = renderingPreferencesComplete(cabinetColors, form);
  const canRenderConcept = persistState === "saved" && preferencesComplete;
  const nextAction = NEXT_ACTIONS[step] ?? "";

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

  useEffect(() => {
    if (step === 5 && preferencesLocked && fixedPositionsConfirmed && !cabinetFillGenerated) {
      handleGenerateCabinetFill();
    }
  }, [step, preferencesLocked, fixedPositionsConfirmed, cabinetFillGenerated, handleGenerateCabinetFill]);

  // Non-authoritative concept rendering. Rasterizes the hidden clean reference
  // render (built from the locked snapshot) and POSTs it to the rendering route,
  // which loads the authoritative snapshot server-side by id and builds the
  // prompt — the client never sends snapshot data, only the reference image.
  const handleGenerateRendering = useCallback(async () => {
    setHasRenderedConcept(true);
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
      setRenderings((prev) => [
        {
          id: json.id,
          url: `data:image/png;base64,${json.imageBase64}`,
          doorColorId: json.basedOnRenderingPreferences?.doorColorId || null
        },
        ...prev
      ]);
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

      try {
        const renderRes = await fetch(`/api/projects/${projectId}/round1/renderings`);
        if (!renderRes.ok || cancelled || localSessionChangedRef.current) return;
        const rJson = await renderRes.json();
        if (rJson.renderings && Array.isArray(rJson.renderings)) {
          setRenderings(
            rJson.renderings.map((r: any) => ({
              id: r.id,
              url: `data:image/png;base64,${r.imageBase64}`,
              doorColorId: r.basedOnRenderingPreferences?.doorColorId || null
            }))
          );
        }
      } catch (e) {
        // Ignore rendering fetch errors
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

  useGSAP(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    gsap.fromTo(
      ".round1-animate",
      { autoAlpha: 0, y: 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        ease: "power2.out",
        stagger: 0.04
      }
    );
  }, { scope: shellRef, dependencies: [step], revertOnUpdate: true });


  const projectBar = (
    <div className="flex h-14 items-center gap-3 px-4 md:px-5">
      <a
        href={projectId ? `/projects/${projectId}` : "/projects"}
        className="rounded-studio-small px-2 py-1 text-[12px] text-studio-muted transition-colors hover:bg-white/[0.05] hover:text-studio-ink"
      >
        Back
      </a>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-studio-ink">
          {projectName ?? "Round 1"}
        </p>
        {customerName && (
          <p className="truncate text-[10px] text-studio-quiet">
            {customerName}
          </p>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <Round1Feedback
          state={
            persistState === "saving"
              ? "saving"
              : snapshot
                ? "saved"
                : "stale"
          }
          message={
            persistState === "saving"
              ? "Saving"
              : snapshot
                ? "Saved"
                : "Changes not frozen"
          }
        />
        <WorkspaceModeSwitch
          mode={workspaceMode}
          onModeChange={updateWorkspaceMode}
        />
      </div>
    </div>
  );

  const stepNavigation = (
    <Round1StepNavigation
      steps={SHOWROOM_STEPS}
      currentStep={step}
      maxAccessibleStep={maxAccessibleStep}
      variant={workspaceMode === "guided" ? "expanded" : "compact"}
      onStepChange={(nextStep) => {
        localSessionChangedRef.current = true;
        setStep(nextStep);
      }}
    />
  );

  const mobileStepNavigation = (
    <Round1StepNavigation
      steps={SHOWROOM_STEPS}
      currentStep={step}
      maxAccessibleStep={maxAccessibleStep}
      variant="strip"
      onStepChange={(nextStep) => {
        localSessionChangedRef.current = true;
        setStep(nextStep);
      }}
    />
  );

  const activeStepContent = (
    <>
      {step === 0 && <RoomStep form={form} setForm={updateForm} />}
      {step === 1 && (
        <OpeningsStep
          form={form}
          setForm={updateForm}
          setPositionOverrides={updatePositionOverrides}
        />
      )}
      {step === 2 && (
        <LayoutStep
          form={form}
          setForm={updateForm}
          setPositionOverrides={updatePositionOverrides}
        />
      )}
      {step === 3 && <AppliancesStep form={form} setForm={updateForm} />}
      {step === 4 && (
        <AdjustPositionsStep
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
        />
      )}
    </>
  );

  const STEP_DESCRIPTIONS = [
    "Set the room dimensions and fixed obstacles.",
    "Place doors, passages, and windows.",
    "Choose the closest starting kitchen layout.",
    "Add the appliances and fixtures that affect placement.",
    "Fine-tune positions and confirm spatial constraints.",
    "Choose the cabinet finish and generate a concept rendering."
  ] as const;

  const canvasContent = (
    <div className="grid h-full min-h-[540px] min-w-0 gap-3">
      <div className="min-h-0 overflow-hidden rounded-studio-panel border border-studio-line bg-studio-shell">
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
          showHeader={false}
        />
      </div>
      {(renderingBusy || renderings.length > 0 || renderingError) && (
        <RenderingControls
          canRender={canRenderConcept}
          busy={renderingBusy}
          error={renderingError}
          renderings={renderings}
          cabinetColors={cabinetColors}
        />
      )}
    </div>
  );

  const renderingFooter = (
    <div className="ml-3 flex flex-1 items-center justify-between">
      <RenderingPreferencesLockControl
        preferencesLocked={preferencesLocked}
        canLock={selectedRenderingColor(cabinetColors, form) !== null}
        onLock={() => {
          localSessionChangedRef.current = true;
          setPreferencesLocked(true);
          setHasRenderedConcept(false);
          setRenderingError(null);
        }}
      />
      <button
        type="button"
        onClick={handleGenerateRendering}
        disabled={!canRenderConcept || renderingBusy}
        className="rounded-lg bg-[var(--app-ink)] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate Rendering
      </button>
    </div>
  );

  const adjustPositionSuggestion = (
    <>
      <span className="block font-bold">Assistant</span>
      Range and sink are both on the back wall. Confirm whether the window is centered over sink.
    </>
  );

  return (
    <>
      <Round1WorkspaceShell
        mode={workspaceMode}
        projectBar={projectBar}
        stepNavigation={stepNavigation}
        mobileStepNavigation={mobileStepNavigation}
        canvas={canvasContent}
        inspector={
          <Round1Inspector
            title={SHOWROOM_STEPS[step]}
            description={STEP_DESCRIPTIONS[step]}
            previousDisabled={step === 0}
            continueDisabled={step === SHOWROOM_STEPS.length - 1}
            onPrevious={() => {
              localSessionChangedRef.current = true;
              setStep(Math.max(0, step - 1));
            }}
            onContinue={goToNextStep}
            footerContent={step === 5 ? renderingFooter : undefined}
            suggestion={step === 4 ? adjustPositionSuggestion : undefined}
          >
            {activeStepContent}
          </Round1Inspector>
        }
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

      <Dialog open={showAdjustPositionsModal} onOpenChange={setShowAdjustPositionsModal}>
        <DialogContent
          overlayClassName="bg-[#1d1d1f]/40 backdrop-blur-none"
          className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-[#d2d2d7] bg-white p-6 shadow-xl"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
            Adjust Positions
          </p>
          <DialogTitle className="mt-2 text-lg font-bold text-[#1d1d1f]">
            Door, window, and appliance locations can be dragged on the plan.
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-6 text-[#6e6e73]">
            Drag these rough positions first, then confirm them to generate
            the preliminary cabinet fill around those constraints.
          </DialogDescription>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setShowAdjustPositionsModal(false);
                startDraggableHighlightCue();
              }}
              className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Got It
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
