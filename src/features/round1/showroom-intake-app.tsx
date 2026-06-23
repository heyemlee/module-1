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

const PILL_TONES = {
  green: "bg-[var(--app-green-soft)] text-[var(--app-green)]",
  amber: "bg-[var(--app-amber-soft)] text-[var(--app-amber)]",
  red: "bg-[var(--app-red-soft)] text-[var(--app-red)]",
  ink: "bg-[var(--app-ink)] text-white"
} as const;

function StatusBadge({
  label,
  tone
}: {
  label: string;
  tone: keyof typeof PILL_TONES;
}) {
  return (
    <span
      className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-3 text-[11px] font-bold ${PILL_TONES[tone]}`}
    >
      {label}
    </span>
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

  // Derived header/rail UI state. The concept rendering is stale when it no
  // longer matches the current snapshot geometry or finish selection.
  const renderingStale =
    renderingImage !== null &&
    (!snapshot ||
      renderingBasedOn !== snapshot.generatedAt ||
      !renderingPreferenceStampMatches(
        renderingPreferencesBasedOn,
        form,
        cabinetColors
      ));
  const canRenderConcept =
    persistState === "saved" &&
    renderingPreferencesComplete(cabinetColors, form);
  const confirmationCount = confirmationItems.length;
  const screenTitle = `${customerName ?? projectName ?? "Showroom"} / Round 1 Intake`;
  const nextAction = NEXT_ACTIONS[step] ?? "";

  const snapshotPill: { label: string; tone: keyof typeof PILL_TONES } =
    persistState === "saving"
      ? { label: "Saving snapshot", tone: "amber" }
      : persistState === "error"
        ? { label: "Snapshot save failed", tone: "red" }
        : snapshot
          ? { label: "Snapshot saved", tone: "green" }
          : { label: "Snapshot pending", tone: "amber" };
  const renderingPill: { label: string; tone: keyof typeof PILL_TONES } | null =
    renderingBusy
      ? { label: "Rendering…", tone: "amber" }
      : renderingImage === null
        ? null
        : renderingStale
          ? { label: "Rendering stale", tone: "amber" }
          : { label: "Rendering ready", tone: "green" };

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

  return (
    <main ref={shellRef} className="min-h-screen bg-[#f5f5f7] text-[var(--app-ink)]">
      <PlatformHeader
        userName={userName}
        nav={
          <>
            <NavPill href="/projects">Projects</NavPill>
            {projectId && (
              <NavPill href={`/projects/${projectId}/round1`} active>
                Round 1
              </NavPill>
            )}
            {projectId && (
              <NavPill href={`/projects/${projectId}/renderings`}>Renderings</NavPill>
            )}
            {isAdmin && <NavPill href="/admin/users">Admin</NavPill>}
          </>
        }
      />

      <div className="mx-auto flex max-w-[1440px] flex-wrap items-end justify-between gap-4 px-6 pt-8">
        <div className="min-w-0">
          {projectId ? (
            <a
              href={`/projects/${projectId}`}
              className="block truncate text-[28px] font-bold leading-tight tracking-tight text-[var(--app-ink)] hover:underline"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {screenTitle}
            </a>
          ) : (
            <span
              className="block truncate text-[28px] font-bold leading-tight tracking-tight text-[var(--app-ink)]"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              {screenTitle}
            </span>
          )}
          <p className="mt-1 text-[13px] text-[var(--app-muted)]">
            Guided intake with persistent evidence and next-action rail
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge label={snapshotPill.label} tone={snapshotPill.tone} />
          {renderingPill ? (
            <StatusBadge label={renderingPill.label} tone={renderingPill.tone} />
          ) : null}
          <StatusBadge
            label={`${confirmationCount} confirmation${confirmationCount === 1 ? "" : "s"}`}
            tone={confirmationCount > 0 ? "amber" : "green"}
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-5 px-6 py-6 lg:grid-cols-[250px_minmax(420px,1fr)_minmax(440px,1.05fr)]">
        <aside className="round1-animate app-panel-flat h-fit p-4">
          <h2 className="text-[15px] font-bold text-[var(--app-ink)]">Round 1 progress</h2>
          <p className="mt-1 text-[12px] leading-[18px] text-[var(--app-muted)]">
            Sales-ready path with locked gates
          </p>
          <div className="mt-4 space-y-2">
            {SHOWROOM_STEPS.map((label, index) => {
              const done = index < step;
              const current = index === step;
              const locked = index > maxAccessibleStep;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goToStep(index)}
                  disabled={locked}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                    current
                      ? "border-[var(--app-ink)] bg-[var(--app-ink)] text-white"
                      : done
                        ? "border-[var(--app-border)] bg-[var(--app-green-soft)] text-[var(--app-ink)]"
                        : locked
                          ? "cursor-not-allowed border-[var(--app-border)] bg-white text-[var(--app-quiet)]"
                          : "border-[var(--app-border)] bg-white text-[var(--app-ink)] hover:bg-black/[0.03]"
                  }`}
                >
                  <span
                    className={`flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      current
                        ? "bg-white text-[var(--app-ink)]"
                        : done
                          ? "bg-[var(--app-green)] text-white"
                          : "border border-[var(--app-border-strong)] text-[var(--app-muted)]"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="text-[13px] font-semibold">{label}</span>
                </button>
              );
            })}
          </div>
          {nextAction ? (
            <div className="mt-4 rounded-lg bg-[var(--app-ink)] p-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/55">
                Next action
              </p>
              <p className="mt-1 text-[15px] font-bold leading-[20px]">{nextAction}</p>
            </div>
          ) : null}
        </aside>

        <section className="round1-animate app-panel-flat flex min-h-[560px] flex-col p-6">
          <div className="flex-1">
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
              canGenerateCabinetFill={
                fixedPositionsConfirmed && !cabinetFillGenerated
              }
              canGenerateRendering={canRenderConcept}
              renderingBusy={renderingBusy}
            />
          )}
          </div>
          <div className="mt-6 flex justify-between border-t border-[var(--app-border)] pt-5">
            <button
              type="button"
              onClick={() => {
                localSessionChangedRef.current = true;
                setStep(Math.max(0, step - 1));
              }}
              disabled={step === 0}
              className="rounded-lg border border-[var(--app-border-strong)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--app-ink)] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              disabled={step === SHOWROOM_STEPS.length - 1}
              className="rounded-lg bg-[var(--app-ink)] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </section>

        <aside className="round1-animate space-y-4">
          <h2 className="text-[16px] font-bold text-[var(--app-ink)]">Design evidence</h2>
          {(renderingBusy || renderingImage !== null) && (
            <RenderingControls
              canRender={canRenderConcept}
              busy={renderingBusy}
              error={renderingError}
              stale={renderingStale}
              image={renderingImage}
            />
          )}

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

          {!(renderingBusy || renderingImage !== null) && (
            <RenderingControls
              canRender={canRenderConcept}
              busy={renderingBusy}
              error={renderingError}
              stale={renderingStale}
              image={renderingImage}
            />
          )}


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
                <p className="text-sm text-[#6e6e73]">No current confirmation flags.</p>
              ) : (
                confirmationItems.map((item) => (
                  <div key={item.id} className="rounded-lg bg-[#fff0dc] p-2.5 text-sm">
                    <p className="font-bold text-[#c56a16]">{item.code}</p>
                    <p className="text-[#9a5a1e]">{item.message}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1d1f]/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d2d2d7] bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-[#6e6e73]">
              Adjust Positions
            </p>
            <h2 className="mt-2 text-lg font-bold text-[#1d1d1f]">
              Door, window, and appliance locations can be dragged on the plan.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6e6e73]">
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
                className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
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
