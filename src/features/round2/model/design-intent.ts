import {
  ceilingMeasurementKey,
  formatSixteenths,
  wallLengthMeasurementKey,
  type Round2DecisionItem,
  type Round2Model,
  type WallId
} from "./round2-model";
import { CABINET_STANDARDS } from "./cabinet-standards";
import { deriveCorners } from "./corners";

export type CornerStrategy =
  | "lazySusan"
  | "diagonalCorner"
  | "leMans"
  | "blindBase"
  | "magicCorner"
  | "blindCornerPullOut"
  | "cornerPullOutShelves";
export type UpperTermination = "standard" | "ceiling";
export type FlatMouldingStyle = "none" | "flat2" | "flat3";
export type TallCabinetLocation = "auto" | `wall:${WallId}`;
export type TrashPulloutPreference = "sinkLeft" | "sinkRight" | "none";
export type CabinetFrontPreference =
  | "drawerForward"
  | "balanced"
  | "doorForward";
export type HoodStyle = "cabinetInsert" | "chimney" | "underCabinet";
export type HardwareStyle = "handle" | "fingerPull";
export type SinkWindowAlignment = "align" | "keepRound1";
export type DishwasherPlacement = "dockToSink" | "keepRound1";
/**
 * How a designer resolved a span that no standard cabinet-plus-filler
 * partition can close: force filler strips (split into approved widths where
 * possible) or confirm it as intentional open space. Absent = still blocking.
 */
export type GapResolution = "fillerFill" | "leaveOpen";
export type UpperCornerStrategy = "diagonalUpper" | "blindUpper" | "openUpper";
// What sits above a fridge tall unit, and which exposed sides get a finished
// panel. Both are per-fridge, keyed by the fridge fixed point (see
// fridgeAboveIntentKey / fridgeSidesIntentKey). Defaults reproduce the original
// behaviour: an empty gap above and no side panels.
export type FridgeAboveStrategy = "gap" | "wallCabinet" | "panel";
export type FridgeSideStrategy = "none" | "left" | "right" | "both";
/**
 * Height (sixteenths) of the wall cabinet / panel above a fridge, measured down
 * from the ceiling-aligned upper top. The fridge fills the remaining tall span
 * beneath it. Stored numerically so a custom height is representable.
 */
export type FridgeAboveHeight = number;

export type DesignIntentValue =
  | CornerStrategy
  | UpperTermination
  | FlatMouldingStyle
  | TallCabinetLocation
  | TrashPulloutPreference
  | CabinetFrontPreference
  | HoodStyle
  | HardwareStyle
  | SinkWindowAlignment
  | DishwasherPlacement
  | GapResolution
  | UpperCornerStrategy
  | FridgeAboveStrategy
  | FridgeSideStrategy
  | FridgeAboveHeight;

/** Per-dishwasher intent key for docking to the sink vs the Round 1 spot. */
export function dishwasherPlacementIntentKey(fixedPointId: string): string {
  return `dishwasher.${fixedPointId}.placement`;
}

/**
 * Per-span intent key for resolving an unfillable gap. The id is the gap
 * segment's deterministic id (wall + tier + span sequence), so the same
 * measurements and intent reproduce the same key across autofill reruns.
 */
export function gapResolutionIntentKey(gapSegmentId: string): string {
  return `gap.${gapSegmentId}.resolution`;
}

/** Per-fridge intent key for the treatment above the fridge tall unit. */
export function fridgeAboveIntentKey(fixedPointId: string): string {
  return `fridge.${fixedPointId}.above`;
}

/** Per-fridge intent key for finished side panels flanking the fridge. */
export function fridgeSidesIntentKey(fixedPointId: string): string {
  return `fridge.${fixedPointId}.sides`;
}

/** Per-fridge intent key for the height of the unit above the fridge. */
export function fridgeAboveHeightIntentKey(fixedPointId: string): string {
  return `fridge.${fixedPointId}.aboveHeight`;
}

export type DesignIntentKey = string;

/**
 * A dishwasher whose Round 1 spot is farther than this from its docked
 * position (one base-cabinet width) triggers a placement confirmation.
 */
const DISHWASHER_DOCK_CONFIRM_THRESHOLD_SIXTEENTHS = 24 * 16;

export type Round2DesignIntent = {
  answers: Record<DesignIntentKey, DesignIntentValue>;
  confirmedKeys: DesignIntentKey[];
};

export type DesignIntentQuestionKind =
  | "corner-strategy"
  | "corner-upper-strategy"
  | "upper-termination"
  | "flat-moulding"
  | "trash-pullout"
  | "hood-style"
  | "dishwasher-placement";

export type DesignIntentOption = {
  value: DesignIntentValue;
  label: string;
  group?: "cornerCabinet" | "blindCabinet";
};

export type DesignIntentQuestion = {
  key: DesignIntentKey;
  kind: DesignIntentQuestionKind;
  label: string;
  helper: string;
  defaultValue: DesignIntentValue;
  options: DesignIntentOption[];
  wallId: WallId;
  objectId: string;
};

export function buildDesignIntentQuestions(
  model: Round2Model | null,
  measurements: Record<string, number | null>
): DesignIntentQuestion[] {
  if (!model || model.walls.length === 0) return [];

  const firstWall = model.walls[0];
  const questions: DesignIntentQuestion[] = [];

  // The dishwasher docks against the sink by default (shared plumbing). When
  // Round 1 placed it more than one cabinet away from the docked position,
  // that may be deliberate — ask instead of silently snapping.
  for (const wall of model.walls) {
    const sink = wall.fixedPoints.find(
      (point) => point.type === "appliance" && point.symbol === "sink"
    );
    if (!sink) continue;
    const length =
      wall.lengthSixteenths ?? measurements[wallLengthMeasurementKey(wall.id)];
    if (length == null) continue;
    for (const point of wall.fixedPoints) {
      if (point.type !== "appliance" || point.symbol !== "dishwasher") continue;
      const sinkWidth =
        sink.widthSixteenths ??
        CABINET_STANDARDS.appliances.sinkBase.defaultWidthSixteenths;
      const dishwasherWidth =
        point.widthSixteenths ??
        CABINET_STANDARDS.appliances.dishwasher.defaultWidthSixteenths;
      const centerDistance =
        Math.abs(point.positionRatio - sink.positionRatio) * length;
      const dockedDistance = (sinkWidth + dishwasherWidth) / 2;
      if (
        centerDistance - dockedDistance <=
        DISHWASHER_DOCK_CONFIRM_THRESHOLD_SIXTEENTHS
      ) {
        continue;
      }
      questions.push({
        key: dishwasherPlacementIntentKey(point.id),
        kind: "dishwasher-placement",
        label: `Keep the dishwasher docked to the Wall ${wall.label} sink?`,
        helper:
          "Round 1 placed it farther away; docking shares the sink plumbing.",
        defaultValue: "dockToSink",
        options: [
          { value: "dockToSink", label: "Dock to sink" },
          { value: "keepRound1", label: "Keep Round 1 position" }
        ],
        wallId: wall.id,
        objectId: point.id
      });
    }
  }

  for (const corner of deriveCorners(model)) {
    questions.push({
      key: corner.intentKey,
      kind: "corner-strategy",
      label: `Corner ${corner.primary.label}–${corner.secondary.label} strategy`,
      helper:
        "Corner cabinets turn the corner with a carousel or diagonal door; blind cabinets close it flat and reach the dead space with hardware.",
      defaultValue: "lazySusan",
      options: [
        {
          value: "lazySusan",
          label: "Lazy Susan",
          group: "cornerCabinet"
        },
        {
          value: "diagonalCorner",
          label: "Diagonal Corner",
          group: "cornerCabinet"
        },
        { value: "leMans", label: "LeMans", group: "cornerCabinet" },
        { value: "blindBase", label: "None", group: "blindCabinet" },
        {
          value: "magicCorner",
          label: "Magic Corner",
          group: "blindCabinet"
        },
        {
          value: "blindCornerPullOut",
          label: "Blind Corner Pull-Out",
          group: "blindCabinet"
        },
        {
          value: "cornerPullOutShelves",
          label: "Pull-Out Shelves",
          group: "blindCabinet"
        }
      ],
      wallId: corner.primary.id,
      objectId: corner.objectId
    });
    questions.push({
      key: corner.upperIntentKey,
      kind: "corner-upper-strategy",
      label: `Corner ${corner.primary.label}–${corner.secondary.label} upper cabinets`,
      helper: "Default turns the corner with a diagonal wall cabinet; open leaves the upper corner empty.",
      defaultValue: "diagonalUpper",
      options: [
        { value: "diagonalUpper", label: "Diagonal corner" },
        { value: "blindUpper", label: "Blind upper" },
        { value: "openUpper", label: "Leave open" }
      ],
      wallId: corner.primary.id,
      objectId: corner.objectId
    });
  }

  const ceiling =
    measurements[ceilingMeasurementKey()] ?? model.ceilingHeightSixteenths;
  const ceilingLabel =
    ceiling == null ? "the measured ceiling" : `${formatSixteenths(ceiling)} ceiling`;

  questions.push(
    {
      key: "uppers.termination",
      kind: "upper-termination",
      label: `Run upper cabinets to ${ceilingLabel}?`,
      helper: "Phase 8 will choose the closest standard upper height.",
      defaultValue: "standard",
      options: [
        { value: "standard", label: "Standard height" },
        { value: "ceiling", label: "To ceiling" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    },
    {
      key: "uppers.moulding",
      kind: "flat-moulding",
      label: "Flat moulding treatment",
      helper: "Three inches is the preferred installation allowance.",
      defaultValue: "flat3",
      options: [
        { value: "none", label: "None" },
        { value: "flat2", label: "2″" },
        { value: "flat3", label: "3″" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    },
    {
      key: "trash.location",
      kind: "trash-pullout",
      label: "Trash pullout near the sink",
      helper: "Default places the pullout on the sink side with more open run.",
      defaultValue: "sinkRight",
      options: [
        { value: "sinkLeft", label: "Sink left" },
        { value: "sinkRight", label: "Sink right" },
        { value: "none", label: "None" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    },
    {
      key: "hood.style",
      kind: "hood-style",
      label: "Range hood form",
      helper: "Cabinet insert keeps the upper run visually continuous.",
      defaultValue: "cabinetInsert",
      options: [
        { value: "cabinetInsert", label: "Cabinet insert" },
        { value: "chimney", label: "Chimney" },
        { value: "underCabinet", label: "Under cabinet" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    }
  );

  return questions;
}

/**
 * One row in the design-intent checklist. Most questions stand alone, but a few
 * only make sense together — the upper-cabinet height and its moulding
 * treatment are one decision the user makes in one place — so the UI iterates
 * over groups rather than raw questions. That also makes the progress count
 * honest: a merged pair is one thing to confirm, not two.
 */
export type DesignIntentGroup = {
  /** Stable id for the row; the lead question's key. */
  id: string;
  kind: DesignIntentQuestionKind;
  /** Which heading the group files under in the design-intent stage. */
  section: DesignIntentSection;
  label: string;
  helper: string;
  /** Lead question first, then any follow-up shown in the same row. */
  questions: DesignIntentQuestion[];
  wallId: WallId;
  objectId: string;
};

/**
 * Headings the design-intent stage groups questions under. Corners come and go
 * with the topology and appliance questions are conditional, so a section can be
 * empty and must not render.
 */
export type DesignIntentSection = "corners" | "uppers" | "appliances";

export const DESIGN_INTENT_SECTIONS: readonly DesignIntentSection[] = [
  "corners",
  "uppers",
  "appliances"
];

function sectionFor(kind: DesignIntentQuestionKind): DesignIntentSection {
  if (kind === "corner-strategy" || kind === "corner-upper-strategy") {
    return "corners";
  }
  if (kind === "upper-termination" || kind === "flat-moulding") return "uppers";
  return "appliances";
}

export function groupDesignIntentQuestions(
  questions: readonly DesignIntentQuestion[]
): DesignIntentGroup[] {
  const followUps = questions.filter(
    (question) => question.kind === "flat-moulding"
  );
  const groups: DesignIntentGroup[] = [];

  for (const question of questions) {
    if (question.kind === "flat-moulding") continue;
    groups.push({
      id: question.key,
      kind: question.kind,
      section: sectionFor(question.kind),
      label: question.label,
      helper: question.helper,
      questions:
        question.kind === "upper-termination"
          ? [question, ...followUps]
          : [question],
      wallId: question.wallId,
      objectId: question.objectId
    });
  }

  // A follow-up with no lead question would otherwise vanish from the
  // checklist — and from the confirmation count — so give it its own row.
  if (
    followUps.length > 0 &&
    !questions.some((question) => question.kind === "upper-termination")
  ) {
    for (const question of followUps) {
      groups.push({
        id: question.key,
        kind: question.kind,
        section: sectionFor(question.kind),
        label: question.label,
        helper: question.helper,
        questions: [question],
        wallId: question.wallId,
        objectId: question.objectId
      });
    }
  }

  return groups;
}

export function initializeDesignIntent(
  model: Round2Model | null
): Round2DesignIntent {
  return {
    answers: Object.fromEntries(
      buildDesignIntentQuestions(model, {}).map((question) => [
        question.key,
        question.defaultValue
      ])
    ),
    confirmedKeys: []
  };
}

/**
 * Sets an answer and treats the edit itself as the confirmation. Used where
 * picking the control *is* the deliberate decision — the elevation's corner and
 * fridge setup cards, where a designer clicks a specific strategy on a specific
 * unit.
 */
export function setDesignIntentAnswer(
  intent: Round2DesignIntent,
  key: DesignIntentKey,
  value: DesignIntentValue
): Round2DesignIntent {
  return {
    answers: { ...intent.answers, [key]: value },
    confirmedKeys: intent.confirmedKeys.includes(key)
      ? intent.confirmedKeys
      : [...intent.confirmedKeys, key]
  };
}

/**
 * Sets an answer *without* confirming it, and drops any earlier confirmation.
 * Used by the field-measurement panel, where selecting an option and confirming
 * it are separate acts: a value the user is still trying out must not silently
 * clear its Confirmation Required item, and re-opening a settled question to
 * change it puts that question back in play.
 */
export function draftDesignIntentAnswer(
  intent: Round2DesignIntent,
  key: DesignIntentKey,
  value: DesignIntentValue
): Round2DesignIntent {
  return {
    answers: { ...intent.answers, [key]: value },
    confirmedKeys: intent.confirmedKeys.filter((item) => item !== key)
  };
}

/**
 * Confirms answers as they currently stand, changing no values. This is the
 * explicit "Keep default" / "Confirm" action: accepting a default is a real
 * click that the user can be held to, rather than something inferred from them
 * having re-picked the option that was already selected.
 */
export function confirmDesignIntentAnswers(
  intent: Round2DesignIntent,
  keys: readonly DesignIntentKey[]
): Round2DesignIntent {
  const added = keys.filter((key) => !intent.confirmedKeys.includes(key));
  if (added.length === 0) return intent;
  return {
    answers: intent.answers,
    confirmedKeys: [...intent.confirmedKeys, ...added]
  };
}

function appliedLabel(
  question: DesignIntentQuestion,
  intent: Round2DesignIntent
): string {
  const answer = intent.answers[question.key] ?? question.defaultValue;
  const option =
    question.options.find((item) => item.value === answer) ??
    question.options.find((item) => item.value === question.defaultValue);
  return option?.label ?? String(answer);
}

/**
 * One Confirmation Required item per unconfirmed *group*, matching what the
 * design-intent stage counts and asks. Emitting one per question would promise
 * the user six outstanding items and then show them seven, because the upper
 * height and its moulding are one question in the stage and two keys underneath.
 */
export function buildIntentConfirmationDecisions(
  model: Round2Model,
  intent: Round2DesignIntent,
  measurements: Record<string, number | null>
): Round2DecisionItem[] {
  const confirmed = new Set(intent.confirmedKeys);
  return groupDesignIntentQuestions(
    buildDesignIntentQuestions(model, measurements)
  )
    .filter((group) =>
      group.questions.some((question) => !confirmed.has(question.key))
    )
    .map((group) => ({
      id: `decision-intent-${group.id}`,
      objectId: group.objectId,
      wallId: group.wallId,
      severity: "warning" as const,
      title: `Confirmation required: ${group.label}`,
      body: `Default “${group.questions
        .map((question) => appliedLabel(question, intent))
        .join(" · ")}” was applied. Confirm or revise this design intent before final review.`
    }));
}
