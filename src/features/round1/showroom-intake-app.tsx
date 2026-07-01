"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import {
  generatePreliminaryCabinetList,
  summarizePreliminaryCabinetEstimate,
  normalizeRound1Form,
  round1FormSchema,
  type PreliminaryCabinetEstimate,
  type Round1FormInput
} from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import dynamic from "next/dynamic";
import { PerspectivePreview } from "./perspective-preview";
import { buildElevationScene } from "./elevations/elevation-scene";
import Link from "next/link";
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
  renderingPreferencesForForm,
  CABINET_STYLE_LABELS,
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
  Round1InlineRenderPreview,
  Round1ElevationStrip,
  Round1ElevationLightbox,
  type SnapshotPersistState
} from "./showroom-intake-panels";
import { useReducedMotion } from "motion/react";
import { LockClosedIcon, LockOpen1Icon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { MorphingSquare } from "@/components/ui/morphing-square";
import { Round1WorkspaceShell } from "./round1-workspace-shell";

import { Round1StepNavigation } from "./round1-step-navigation";
import { Round1Inspector } from "./round1-inspector";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api-client";

// The AI assistant drawer is opened on demand, so its bundle (chat UI + speech
// recognition + motion) is code-split out of the initial Round 1 load.
const AgentChatPanel = dynamic(
  () => import("./agent-chat-panel").then((m) => m.AgentChatPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <MorphingSquare message="Loading assistant…" />
      </div>
    )
  }
);

// Stable no-op for the read-only reference render (it never drags positions),
// so the memoized LayoutPreview there isn't re-rendered by a fresh closure.
const NOOP_POSITION_OVERRIDES: Dispatch<SetStateAction<PositionOverrides>> = () => {};

export const SHOWROOM_STEPS = [
  "Room & Openings",
  "Layout & Appliances",
  "Adjust Positions",
  "Rendering Preferences"
] as const;

// Mono sub-label under each step title in the top strip (design chrome).
const STEP_META = ["GEOMETRY", "PROGRAM", "DETERMINISTIC", "FINISH"] as const;

// Short imperative cue per step for the rail's "Next action" callout.
const NEXT_ACTIONS: Record<number, string> = {
  0: "Enter room size, obstacles & openings",
  1: "Choose layout & set appliances",
  2: "Confirm dragged constraints",
  3: "Generate fill & rendering"
};


const ADJUST_POSITIONS_STEP_INDEX = SHOWROOM_STEPS.indexOf("Adjust Positions");
const PREVIEW_STAGES = [
  "openings",
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

type Round1DraftPayload = {
  showroomForm: Round1FormInput;
  positionOverrides: PositionOverrides;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
  currentStep: number;
  maxAccessibleStep: number;
};

type ConceptRendering = {
  id: string;
  url: string;
  doorColorId: string | null;
  basedOnSnapshotGeneratedAt?: string | null;
  basedOnRenderingPreferences?: RenderingPreferenceStamp | null;
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
  onLock,
  onUnlock
}: {
  preferencesLocked: boolean;
  canLock: boolean;
  onLock: () => void;
  onUnlock: () => void;
}) {
  // When locked the button stays active so the rep can toggle it back open;
  // it's only disabled when there's nothing to lock yet.
  const disabled = !preferencesLocked && !canLock;
  const title = preferencesLocked
    ? "Preferences locked. Click to unlock."
    : canLock
      ? "Lock preferences"
      : "Select a cabinet color before locking.";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (preferencesLocked) onUnlock();
        else onLock();
      }}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-[50px] w-[54px] shrink-0 items-center justify-center rounded-[12px] border transition-colors",
        preferencesLocked
          ? "border-[#1a1a1c] bg-[#1a1a1c] text-white"
          : canLock
            ? "border-[#1a1a1c] bg-white/55 text-[#16161a] hover:bg-white"
            : "cursor-not-allowed border-[rgba(20,20,26,0.14)] bg-white/55 text-[#bcbcb6]"
      )}
    >
      {preferencesLocked ? (
        <LockClosedIcon className="size-[17px]" aria-hidden />
      ) : (
        <LockOpen1Icon className="size-[17px]" aria-hidden />
      )}
    </button>
  );
}

export function renderingPreferencesStateAfterChange(form: Round1FormInput) {
  return {
    form,
    preferencesLocked: false
  };
}

export function canGenerateConceptRendering({
  persistState,
  preferencesComplete,
  preferencesLocked,
  hasCurrentRendering
}: {
  persistState: SnapshotPersistState;
  preferencesComplete: boolean;
  preferencesLocked: boolean;
  hasCurrentRendering: boolean;
}) {
  return (
    persistState === "saved" &&
    preferencesComplete &&
    preferencesLocked &&
    !hasCurrentRendering
  );
}

export function renderingMatchesCurrentInputs({
  rendering,
  snapshot,
  form,
  colors
}: {
  rendering: Pick<
    ConceptRendering,
    "basedOnSnapshotGeneratedAt" | "basedOnRenderingPreferences"
  >;
  snapshot: Round1Snapshot | null;
  form: Round1FormInput;
  colors: CabinetColor[];
}) {
  if (!snapshot || !rendering.basedOnSnapshotGeneratedAt) return false;
  return (
    rendering.basedOnSnapshotGeneratedAt === snapshot.generatedAt &&
    renderingPreferenceStampMatches(
      rendering.basedOnRenderingPreferences ?? null,
      form,
      colors
    )
  );
}

export function Round1RenderingFlow({
  rendering,
  layout,
  elevations
}: {
  rendering: ReactNode;
  layout: ReactNode;
  elevations?: ReactNode;
}) {
  return (
    <div
      data-rendering-flow="scroll"
      className="relative z-[1] min-h-0 flex-1 overflow-y-auto"
    >
      <div className="flex h-full min-h-[420px] items-center justify-center p-[14px_18px] md:min-h-0">
        {rendering}
      </div>
      <div className="h-[60vh] min-h-[420px] shrink-0 px-[2px] pb-[18px]">
        {layout}
      </div>
      {elevations}
    </div>
  );
}

export function ShowroomIntakeApp({
  projectId,
  customerName,
  projectName,
  userName = "Account",
  isAdmin = false,
  initialIntake
}: {
  projectId?: string;
  customerName?: string;
  projectName?: string;
  userName?: string;
  isAdmin?: boolean;
  initialIntake?: string;
}) {
  const [form, setForm] = useState<Round1FormInput>(() => createDefaultShowroomForm());
  // Optional conversational intake assistant, per ai_ctx.md's AI Boundary: the
  // form is the authoritative path; the assistant only helps organize customer
  // input into form fields. Rendered as a collapsible side drawer, off by default.
  const [assistantOpen, setAssistantOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Arriving from the project overview's AI-intake input opens the assistant
  // pre-seeded with the customer's description (see AgentChatPanel.initialInput).
  useEffect(() => {
    if (initialIntake) setAssistantOpen(true);
  }, [initialIntake]);


  const [step, setStep] = useState(0);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState(0);
  const [positionOverrides, setPositionOverrides] = useState<PositionOverrides>({});
  const [fixedPositionsConfirmed, setFixedPositionsConfirmed] = useState(false);
  const [cabinetFillGenerated, setCabinetFillGenerated] = useState(false);
  const [cabinetColors, setCabinetColors] = useState<CabinetColor[]>([]);
  const [cabinetColorsError, setCabinetColorsError] = useState(false);
  const [snapshot, setSnapshot] = useState<Round1Snapshot | null>(null);
  // Which wall elevation the lightbox shows (null = closed). Indexes into elevationScenes.
  const [elevationOpenIndex, setElevationOpenIndex] = useState<number | null>(null);
  const [persistState, setPersistState] = useState<SnapshotPersistState>("idle");
  const [draftPersistState, setDraftPersistState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftLoaded, setDraftLoaded] = useState(!projectId);
  const [preferencesLocked, setPreferencesLocked] = useState(false);
  const [hasRenderedConcept, setHasRenderedConcept] = useState(false);
  const projectIdRef = useRef<string | null>(null);
  const prefsSaveControllerRef = useRef<AbortController | null>(null);
  const draftSaveControllerRef = useRef<AbortController | null>(null);
  const currentDraftPayloadRef = useRef<Round1DraftPayload | null>(null);
  const draftDirtyRef = useRef(false);
  const [hasEnteredAdjustPositions, setHasEnteredAdjustPositions] = useState(false);
  const [highlightDraggableItems, setHighlightDraggableItems] = useState(false);
  // Name of the object currently dragged/hovered on the plan, shown in the
  // top-of-canvas info pill (lifted out of the SVG so it can sit by the toolbar).
  const [activeObjectLabel, setActiveObjectLabel] = useState<string | null>(null);
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
  const referencePerspectiveRef = useRef<SVGSVGElement | null>(null);
  const [renderings, setRenderings] = useState<ConceptRendering[]>([]);
  const [renderingBusy, setRenderingBusy] = useState(false);
  const [renderingError, setRenderingError] = useState<string | null>(null);
  // The in-canvas concept preview can be dismissed (×); a new generate reopens it.

  // Any manual drag invalidates the confirmed positions and the generated
  // cabinet fill, so the frozen snapshot is cleared and must be regenerated.
  const updatePositionOverrides = useCallback<Dispatch<SetStateAction<PositionOverrides>>>(
    (update) => {
      localSessionChangedRef.current = true;
      draftDirtyRef.current = true;
      setDraftPersistState("idle");
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
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
    setForm(next);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
  }, []);

  const updateRenderingPreferencesForm = useCallback((next: Round1FormInput) => {
    const nextState = renderingPreferencesStateAfterChange(next);
    localSessionChangedRef.current = true;
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
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
        const response = await fetchJson(`/api/projects/${projectId}/round1/state`, {
          method: "PUT",
          body: {
            showroomForm: next,
            positionOverrides,
            fixedPositionsConfirmed,
            cabinetFillGenerated,
            currentStep: step,
            maxAccessibleStep
          },
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
    maxAccessibleStep,
    positionOverrides,
    projectId,
    step
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
      const savedState = await fetchJson(`/api/projects/${projectId}/round1/state`, {
        method: "PUT",
        body: {
          showroomForm: snap.showroomForm,
          positionOverrides: snap.positionOverrides,
          fixedPositionsConfirmed: true,
          cabinetFillGenerated: true,
          currentStep: step,
          maxAccessibleStep
        }
      });
      if (!savedState.ok) throw new Error("Unable to save Round 1 state");
      const saved = await fetchJson(`/api/projects/${projectId}/round1/snapshot`, {
        method: "PUT",
        body: snap
      });
      if (!saved.ok) throw new Error("Unable to save snapshot");
      setPersistState("saved");
    } catch {
      // Keep the snapshot in local state and surface "error" so the user can
      // retry the save in place (Round1SnapshotPanel onRetrySave) instead of
      // being stuck with rendering disabled.
      setPersistState("error");
    }
  }, [maxAccessibleStep, projectId, step]);

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
    // Briefly pulse the draggable items as a non-intrusive hint (no modal).
    startDraggableHighlightCue();
  }, [hasEnteredAdjustPositions, startDraggableHighlightCue, step]);

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
  const hasCurrentRendering = renderings.some((rendering) =>
    renderingMatchesCurrentInputs({
      rendering,
      snapshot,
      form,
      colors: cabinetColors
    })
  );
  const canRenderConcept = canGenerateConceptRendering({
    persistState,
    preferencesComplete,
    preferencesLocked,
    hasCurrentRendering
  });
  const nextAction = NEXT_ACTIONS[step] ?? "";
  const draftPayload = useMemo<Round1DraftPayload>(() => ({
    showroomForm: form,
    positionOverrides,
    fixedPositionsConfirmed,
    cabinetFillGenerated,
    currentStep: step,
    maxAccessibleStep
  }), [
    cabinetFillGenerated,
    fixedPositionsConfirmed,
    form,
    maxAccessibleStep,
    positionOverrides,
    step
  ]);

  useEffect(() => {
    currentDraftPayloadRef.current = draftPayload;
  }, [draftPayload]);

  const saveDraftPayload = useCallback(async (
    payload: Round1DraftPayload,
    options?: { signal?: AbortSignal; keepalive?: boolean }
  ) => {
    if (!projectId) return;
    const response = await fetchJson(`/api/projects/${projectId}/round1/state`, {
      method: "PUT",
      body: payload,
      signal: options?.signal,
      keepalive: options?.keepalive
    });
    if (!response.ok) throw new Error("Unable to save Round 1 draft");
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !localSessionChangedRef.current || !draftDirtyRef.current) {
      return;
    }

    setDraftPersistState("saving");
    draftSaveControllerRef.current?.abort();
    const controller = new AbortController();
    draftSaveControllerRef.current = controller;
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          await saveDraftPayload(draftPayload, { signal: controller.signal });
          if (controller.signal.aborted) return;
          draftDirtyRef.current = false;
          setDraftPersistState("saved");
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
          setDraftPersistState("error");
        }
      })();
    }, 700);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [draftPayload, projectId, saveDraftPayload]);

  useEffect(() => {
    if (!projectId) return;
    const flushDraft = () => {
      const payload = currentDraftPayloadRef.current;
      if (!payload || !draftDirtyRef.current) return;
      void saveDraftPayload(payload, { keepalive: true }).catch(() => {});
    };
    // visibilitychange fires on both hide and show; only the hide transition is
    // a "leaving" moment worth a keepalive write. Returning to the tab doesn't
    // need one — the debounced save already covers ongoing edits.
    const flushIfHidden = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("visibilitychange", flushIfHidden);
    return () => {
      flushDraft();
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("visibilitychange", flushIfHidden);
    };
  }, [projectId, saveDraftPayload]);

  // `Generate Cabinet Fill` is the authoritative snapshot point for Module 1.
  // The estimate is computed inline (not read from the gated memo, which is
  // still empty at click time) so the snapshot freezes the exact rough fill.
  const handleGenerateCabinetFill = useCallback(() => {
    localSessionChangedRef.current = true;
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
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
    const referencePerspectiveSvg = referencePerspectiveRef.current;
    if (
      !referenceTopDownSvg ||
      !referencePerspectiveSvg ||
      !projectId ||
      !snapshot ||
      !canRenderConcept ||
      !form.renderingPreferences ||
      !cabinetColors.length
    ) {
      return;
    }

    setRenderingBusy(true);
    setRenderingError(null);
    try {
      // Persist the latest finish selection BEFORE rendering: the rendering route
      // builds the prompt from the saved server state, so an unsaved color would
      // otherwise render with the previously-saved finish.
      const savedState = await fetchJson(`/api/projects/${projectId}/round1/state`, {
        method: "PUT",
        body: {
          showroomForm: form,
          positionOverrides,
          fixedPositionsConfirmed,
          cabinetFillGenerated,
          currentStep: step,
          maxAccessibleStep
        }
      });
      if (!savedState.ok) {
        throw new Error("Couldn't save your color selection. Please try again.");
      }

      // Elevations are intentionally NOT sent to the image model: the model
      // blends references, and a head-on orthographic wall is the hardest for it
      // to reconcile with the 3/4 render. The perspective (Reference 1) now
      // carries the same vertical info via its extruded massing, so top-down +
      // perspective (both faithful re-projections of the plan) are enough. The
      // elevation strip stays in the UI for the human.
      const referenceImagesBase64 = await rasterizeRenderingReferences([
        { role: "PERSPECTIVE_STRUCTURE", svg: referencePerspectiveSvg },
        { role: "TOP_DOWN_PLAN", svg: referenceTopDownSvg }
      ]);
      // Also send the selected door color's swatch as a MATERIAL reference so the
      // image model matches the actual color/finish, not just the text prompt.
      const selectedColor = selectedRenderingColor(cabinetColors, form);
      if (selectedColor?.swatchImageUrl) {
        try {
          const swatchPng = await rasterizeImageSourceToPngBase64(
            selectedColor.swatchImageUrl
          );
          if (swatchPng) {
            referenceImagesBase64.push({ role: "MATERIAL_SWATCH", imageBase64: swatchPng });
          }
        } catch {
          // Best-effort: fall back to the text prompt if the swatch can't rasterize.
        }
      }
      const response = await fetchJson(
        `/api/projects/${projectId}/round1/renderings`,
        {
          method: "POST",
          body: { referenceImages: referenceImagesBase64 },
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
          doorColorId: json.basedOnRenderingPreferences?.doorColorId || null,
          basedOnSnapshotGeneratedAt: json.basedOnSnapshotGeneratedAt ?? null,
          basedOnRenderingPreferences: json.basedOnRenderingPreferences ?? null
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
    canRenderConcept,
    positionOverrides,
    fixedPositionsConfirmed,
    cabinetFillGenerated,
    maxAccessibleStep,
    step
  ]);

  // Clears the generated cabinet fill so the rep can keep adjusting the dragged
  // positions — it deliberately KEEPS positionOverrides (their current layout),
  // it does not scramble objects back to raw defaults.
  const handleResetPositions = useCallback(() => {
    localSessionChangedRef.current = true;
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
    setFixedPositionsConfirmed(false);
    setCabinetFillGenerated(false);
    setSnapshot(null);
    setPersistState("idle");
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
    setDraftLoaded(false);
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
              currentStep?: number;
              maxAccessibleStep?: number;
            }
          | null;
        const latestSnapshot = json.latestSnapshot?.snapshot as Round1Snapshot | undefined;

        if (savedState) {
          setForm(round1FormSchema.parse(savedState.showroomForm));
          setPositionOverrides(savedState.positionOverrides);
          setFixedPositionsConfirmed(savedState.fixedPositionsConfirmed);
          setCabinetFillGenerated(savedState.cabinetFillGenerated);
          const restoredMaxStep = Math.min(
            SHOWROOM_STEPS.length - 1,
            Math.max(0, savedState.maxAccessibleStep ?? savedState.currentStep ?? 0)
          );
          setMaxAccessibleStep(restoredMaxStep);
          setStep(
            Math.min(
              restoredMaxStep,
              Math.max(0, savedState.currentStep ?? 0)
            )
          );
          setDraftPersistState("saved");
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
      if (!cancelled) setDraftLoaded(true);

      try {
        const renderRes = await fetch(`/api/projects/${projectId}/round1/renderings`);
        if (!renderRes.ok || cancelled || localSessionChangedRef.current) return;
        const rJson = await renderRes.json();
        if (rJson.renderings && Array.isArray(rJson.renderings)) {
          type RenderingApiItem = {
            id: string;
            imageBase64?: string;
            basedOnSnapshotGeneratedAt?: string | null;
            basedOnRenderingPreferences?: RenderingPreferenceStamp | null;
          };
          setRenderings(
            (rJson.renderings as RenderingApiItem[]).map((r) => ({
              id: r.id,
              url: r.imageBase64
                ? `data:image/png;base64,${r.imageBase64}`
                : `/api/projects/${projectId}/round1/renderings/${r.id}/image`,
              doorColorId: r.basedOnRenderingPreferences?.doorColorId || null,
              basedOnSnapshotGeneratedAt: r.basedOnSnapshotGeneratedAt ?? null,
              basedOnRenderingPreferences: r.basedOnRenderingPreferences ?? null
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
      draftPersistState !== "saved" &&
      draftPersistState !== "saving";
    if (!hasUnsavedEdits) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draftPersistState, cabinetFillGenerated, form, positionOverrides]);

  const goToNextStep = useCallback(() => {
    localSessionChangedRef.current = true;
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
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
    draftDirtyRef.current = true;
    setDraftPersistState("idle");
    setStep(index);
  }, [maxAccessibleStep]);

  // Step-entrance stagger (replaces a one-off GSAP timeline). Uses the native
  // Web Animations API so we don't ship an animation library for a single effect.
  useEffect(() => {
    if (reduceMotion) return;
    const root = shellRef.current;
    if (!root) return;
    const animations = Array.from(
      root.querySelectorAll<HTMLElement>(".round1-animate")
    ).map((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: "translateY(14px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 420,
          delay: i * 40,
          easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          fill: "backwards"
        }
      )
    );
    return () => animations.forEach((animation) => animation.cancel());
  }, [step, reduceMotion]);

  // Must stay above the early return below — hooks can't sit after a conditional return.
  const elevationFloorPlan = snapshot?.floorPlan ?? null;
  const elevationScenes = useMemo(
    () => (elevationFloorPlan ? buildElevationScene(elevationFloorPlan) : []),
    [elevationFloorPlan]
  );

  if (!draftLoaded) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-studio-void text-studio-ink">
        <MorphingSquare message="Loading draft..." />
      </main>
    );
  }

  const draftSaveLabel =
    draftPersistState === "saving"
      ? "SAVING…"
      : draftPersistState === "error"
        ? "SAVE FAILED · RETRY"
        : "DRAFT SAVED";

  const projectBar = (
    <div className="flex h-14 items-center gap-4 px-[26px]">
      <Link
        href={`/projects/${projectId}`}
        aria-label="Back to project overview"
        className="flex size-[34px] shrink-0 items-center justify-center rounded-[11px] border border-white/85 bg-white/60 text-[14px] text-[#6a6a64] transition-colors hover:text-studio-ink"
      >
        ←
      </Link>
      <div className="min-w-0">
        <p className="studio-eyebrow !text-[#a4a49e]">ROUND 1 · STORE INTAKE</p>
        <p className="truncate text-[15px] font-semibold text-[#16161a]">
          {projectName ?? "Round 1"}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.06em]",
            draftPersistState === "error" ? "text-[#a85a5a]" : "text-[#86867f]"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              draftPersistState === "saving"
                ? "animate-pulse bg-[#1a1a1c]"
                : draftPersistState === "error"
                  ? "bg-[#a85a5a]"
                  : "bg-[#9a9a94]"
            )}
          />
          {draftSaveLabel}
        </span>
        {/*
          The assistant only helps fill FORM fields, so it is offered only on the
          capture steps. On Adjust Positions the form swaps into the right
          inspector (the overlay would occlude it) and there are no extractable
          fields, so the toggle is hidden there. See
          docs/decisions/2026-06-24-ai-assistant-placement.md.
        */}
        {step !== ADJUST_POSITIONS_STEP_INDEX && (
          <button
            type="button"
            onClick={() => setAssistantOpen((open) => !open)}
            aria-pressed={assistantOpen}
            title="Toggle the optional AI intake assistant"
            className={cn(
              "inline-flex h-8 items-center rounded-[11px] border px-3 text-[11px] font-semibold transition",
              assistantOpen
                ? "border-studio-action/60 bg-studio-action/10 text-studio-ink"
                : "border-white/85 bg-white/60 text-[#56564f] hover:text-studio-ink"
            )}
          >
            {assistantOpen ? "Manual form" : "AI assistant"}
          </button>
        )}
      </div>
    </div>
  );

  const stepStrip = (
    <Round1StepNavigation
      steps={SHOWROOM_STEPS}
      meta={STEP_META}
      currentStep={step}
      maxAccessibleStep={maxAccessibleStep}
      variant="top"
      onStepChange={goToStep}
    />
  );

  const activeStepContent = (
    <>
      {step === 0 && (
        <>
          <RoomStep form={form} setForm={updateForm} />
          <OpeningsStep
            form={form}
            setForm={updateForm}
            setPositionOverrides={updatePositionOverrides}
          />
        </>
      )}
      {step === 1 && (
        <>
          <LayoutStep
            form={form}
            setForm={updateForm}
            setPositionOverrides={updatePositionOverrides}
          />
          <AppliancesStep form={form} setForm={updateForm} />
        </>
      )}
      {step === 2 && (
        <AdjustPositionsStep
          hasOverrides={Object.keys(positionOverrides).length > 0}
          fixedPositionsConfirmed={fixedPositionsConfirmed}
          cabinetFillGenerated={cabinetFillGenerated}
        />
      )}
      {step === 3 && (
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

  const STEP_DESCRIPTIONS: Record<number, string> = {
    2: "Fine-tune positions and confirm spatial constraints.",
    3: "Choose the cabinet finish and generate a concept rendering."
  };

  // The plan layout, reused as-is whether it's the only canvas content or the
  // scrollable element below the pinned rendering window on the last step.
  const layoutPreviewEl = (
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
      onActiveLabelChange={setActiveObjectLabel}
    />
  );

  // On Rendering Preferences (last step) the rendering window is always pinned at
  // the top of the canvas; the layout drops below it and the canvas scrolls so
  // the rep can still scroll down to inspect the plan.
  const isRenderingStep = step === SHOWROOM_STEPS.length - 1;

  // The perspective/massing image the model actually receives as Reference 1,
  // surfaced next to the rough elevations so it can be eyeballed. Same glass
  // strip chrome as Round1ElevationStrip so it reads as one region.
  const perspectivePreviewEl = snapshot?.floorPlan ? (
    <div
      className="relative z-[3] flex shrink-0 items-end gap-[10px] border-t border-white/50 px-[18px] py-[14px]"
      style={{
        background: "rgba(246,246,244,0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)"
      }}
    >
      <div className="flex flex-col items-center gap-[5px]">
        <div className="flex aspect-square w-[132px] shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-white/80 bg-white/[0.62] p-[7px] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]">
          <PerspectivePreview plan={snapshot.floorPlan} hidden={false} />
        </div>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#9a9a94]">
          Perspective
        </span>
      </div>
    </div>
  ) : null;

  // Rough wall elevations, derived from the frozen fill snapshot. Built once and
  // shared by the thumbnail strip and the lightbox so their indexes line up.
  // Full-bleed canvas: the plan floats over the design's gridded gradient.
  const canvasContent = (
    <div
      className="relative flex h-full min-h-0 min-w-0 flex-col"
      style={{ background: "linear-gradient(160deg,#eeeeec,#e7e7e4)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(20,20,26,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(20,20,26,0.045) 1px,transparent 1px)",
          backgroundSize: "28px 28px"
        }}
      />
      {step === ADJUST_POSITIONS_STEP_INDEX && (
        <div className="relative z-[2] flex items-center justify-end gap-2 px-[18px] pb-0.5 pt-3">
          {activeObjectLabel && (
            <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[rgba(20,20,22,0.92)] px-[18px] py-[9px] text-[13px] font-semibold leading-none text-white shadow-[0_16px_36px_-16px_rgba(20,20,26,0.6)] backdrop-blur-sm">
              {activeObjectLabel}
            </span>
          )}
          <button
            type="button"
            onClick={handleResetPositions}
            title="Clear cabinet fill (keeps your positions)"
            aria-label="Clear cabinet fill"
            className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-white/85 bg-white/60 text-[17px] leading-none text-[#56564f] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-colors hover:bg-white hover:text-studio-ink"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => {
              handleGenerateCabinetFill();
              goToNextStep();
            }}
            className="inline-flex items-center gap-2.5 rounded-[11px] px-[22px] py-3 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_12px_26px_-10px_rgba(20,20,26,0.6)]"
            style={{ background: "linear-gradient(180deg,#2c2c30,#141416)" }}
          >
            <span className="size-[7px] shrink-0 rounded-[2px] bg-white" />
            Confirm
          </button>
        </div>
      )}
      {isRenderingStep ? (
        <Round1RenderingFlow
          rendering={
            <Round1InlineRenderPreview
              busy={renderingBusy}
              error={renderingError}
              renderings={renderings}
              cabinetColors={cabinetColors}
              styleLabel={
                CABINET_STYLE_LABELS[
                  renderingPreferencesForForm(form).cabinetStyle
                ]
              }
              fitViewport
            />
          }
          layout={layoutPreviewEl}
          elevations={
            perspectivePreviewEl || elevationScenes.length > 0 ? (
              <>
                {perspectivePreviewEl}
                {elevationScenes.length > 0 && (
                  <Round1ElevationStrip
                    scenes={elevationScenes}
                    onOpen={setElevationOpenIndex}
                  />
                )}
              </>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="relative z-[1] min-h-0 flex-1">{layoutPreviewEl}</div>
          {perspectivePreviewEl}
          {elevationScenes.length > 0 && (
            <Round1ElevationStrip
              scenes={elevationScenes}
              onOpen={setElevationOpenIndex}
            />
          )}
        </>
      )}
    </div>
  );

  const elevationLightbox =
    elevationOpenIndex !== null && elevationScenes[elevationOpenIndex] ? (
      <Round1ElevationLightbox
        scenes={elevationScenes}
        index={elevationOpenIndex}
        onClose={() => setElevationOpenIndex(null)}
        onSelect={setElevationOpenIndex}
      />
    ) : null;

  const renderingFooter = (
    <div className="ml-2 flex flex-1 items-center gap-2.5">
      <RenderingPreferencesLockControl
        preferencesLocked={preferencesLocked}
        canLock={selectedRenderingColor(cabinetColors, form) !== null}
        onLock={() => {
          localSessionChangedRef.current = true;
          setPreferencesLocked(true);
          setHasRenderedConcept(false);
          setRenderingError(null);
        }}
        onUnlock={() => {
          localSessionChangedRef.current = true;
          setPreferencesLocked(false);
        }}
      />
      <Button
        type="button"
        onClick={handleGenerateRendering}
        disabled={!canRenderConcept || renderingBusy}
        className="flex-1"
      >
        Generate Rendering →
      </Button>
    </div>
  );

  const adjustPositionSuggestion = (
    <>
      <span className="block font-bold">Assistant</span>
      Range and sink are both on the back wall. Confirm whether the window is centered over sink.
    </>
  );

  const inspectorContent = (
    <Round1Inspector
      eyebrow={`STEP ${String(step + 1).padStart(2, "0")}`}
      title={SHOWROOM_STEPS[step]}
      description={STEP_DESCRIPTIONS[step]}
      previousDisabled={step === 0}
      continueDisabled={step === SHOWROOM_STEPS.length - 1}
      onPrevious={() => goToStep(Math.max(0, step - 1))}
      onContinue={goToNextStep}
      footerContent={step === 3 ? renderingFooter : undefined}
      suggestion={step === 2 ? adjustPositionSuggestion : undefined}
      className="h-full"
    >
      {activeStepContent}
    </Round1Inspector>
  );

  // AI intake mode (opt-in): the prototype's chat-left + live-preview-right
  // layout. Replaces the form workspace while open; the form stays the default
  // authoritative path (exit via the bar toggle, now labelled "Manual form").
  // The live preview stays visible so the rep catches any mis-extraction as the
  // AI writes fields. Only on capture steps — Adjust Positions has no extractable
  // fields. See docs/decisions/2026-06-24-ai-assistant-placement.md (revised 2026-06-25).
  if (assistantOpen && step !== ADJUST_POSITIONS_STEP_INDEX) {
    return (
      <main className="flex min-h-[100dvh] min-w-0 flex-col bg-studio-void text-studio-ink">
        <div className="sticky top-0 z-30 border-b border-studio-line bg-studio-shell/95 backdrop-blur-xl">
          {projectBar}
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-[38dvh_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
          <section className="order-2 flex min-h-0 flex-col border-studio-line bg-studio-shell max-xl:border-t xl:order-1 xl:border-r">
            <div className="shrink-0 border-b border-studio-line px-4 py-3">
              <p className="text-[13px] font-semibold text-studio-ink">AI intake</p>
              <p className="text-[11px] text-studio-quiet">
                Describe the kitchen — I will fill in the form for you to review.
              </p>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <AgentChatPanel
                form={form}
                onFormUpdate={updateForm}
                projectId={projectId}
                initialInput={initialIntake}
              />
            </div>
          </section>
          <section className="order-1 min-h-0 min-w-0 overflow-hidden bg-studio-void xl:order-2">
            {canvasContent}
          </section>
        </div>
        {elevationLightbox}
      </main>
    );
  }

  return (
    <>
      <Round1WorkspaceShell
        projectBar={projectBar}
        stepStrip={stepStrip}
        leftPanel={
          step === ADJUST_POSITIONS_STEP_INDEX ? undefined : inspectorContent
        }
        canvas={canvasContent}
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
            onPositionOverridesChange={NOOP_POSITION_OVERRIDES}
            highlightDraggableItems={false}
            showPositionObjects
            svgRef={referenceTopDownRef}
          />
          <PerspectivePreview
            plan={snapshot.floorPlan}
            svgRef={referencePerspectiveRef}
          />
        </div>
      )}

      {elevationLightbox}
    </>
  );
}
