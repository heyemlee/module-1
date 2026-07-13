import {
  ceilingMeasurementKey,
  formatSixteenths,
  type Round2DecisionItem,
  type Round2Model,
  type WallId
} from "./round2-model";
import { deriveCorners } from "./corners";

export type CornerStrategy =
  | "lazySusan"
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
  | UpperCornerStrategy
  | FridgeAboveStrategy
  | FridgeSideStrategy
  | FridgeAboveHeight;

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

export type Round2DesignIntent = {
  answers: Record<DesignIntentKey, DesignIntentValue>;
  confirmedKeys: DesignIntentKey[];
};

export type DesignIntentQuestionKind =
  | "corner-strategy"
  | "corner-upper-strategy"
  | "upper-termination"
  | "flat-moulding"
  | "tall-location"
  | "trash-pullout"
  | "cabinet-fronts"
  | "hood-style"
  | "hardware"
  | "sink-window-alignment";

export type DesignIntentOption = {
  value: DesignIntentValue;
  label: string;
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

  // The sink cabinet is confirmed first in the design proposal: it anchors to
  // the window center and every other placement packs around it.
  for (const wall of model.walls) {
    const window = wall.fixedPoints.find((point) => point.type === "window");
    const sink = wall.fixedPoints.find(
      (point) => point.type === "appliance" && point.symbol === "sink"
    );
    if (!window || !sink) continue;
    questions.push({
      key: `sink-window.${wall.id}.alignment`,
      kind: "sink-window-alignment",
      label: `Center the sink under Wall ${wall.label} window?`,
      helper: "This becomes a fixed alignment rule during autofill.",
      defaultValue: "align",
      options: [
        { value: "align", label: "Center under window" },
        { value: "keepRound1", label: "Keep Round 1 intent" }
      ],
      wallId: wall.id,
      objectId: window.id
    });
  }

  for (const corner of deriveCorners(model)) {
    questions.push({
      key: corner.intentKey,
      kind: "corner-strategy",
      label: `Corner ${corner.primary.label}–${corner.secondary.label} strategy`,
      helper: "Default uses a true corner cabinet; blind-base options stay straight on their main wall.",
      defaultValue: "lazySusan",
      options: [
        { value: "lazySusan", label: "Lazy Susan" },
        { value: "blindBase", label: "Blind base" },
        { value: "magicCorner", label: "Blind base + Magic Corner" },
        {
          value: "blindCornerPullOut",
          label: "Blind base + Blind Corner Pull-Out"
        },
        {
          value: "cornerPullOutShelves",
          label: "Blind base + Corner Pull-Out Shelves"
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
        { value: "flat2", label: "2″ flat" },
        { value: "flat3", label: "3″ flat" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    },
    {
      key: "tall.location",
      kind: "tall-location",
      label: "Tall cabinet location",
      helper: "Auto keeps tall cabinets near a wall end and away from windows.",
      defaultValue: "auto",
      options: [
        { value: "auto", label: "Auto" },
        ...model.walls.map((wall) => ({
          value: `wall:${wall.id}` as TallCabinetLocation,
          label: `Wall ${wall.label}`
        }))
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
      key: "fronts.balance",
      kind: "cabinet-fronts",
      label: "Drawer-to-door preference",
      helper: "This sets the starting mix; individual cabinets remain editable.",
      defaultValue: "balanced",
      options: [
        { value: "drawerForward", label: "More drawers" },
        { value: "balanced", label: "Balanced" },
        { value: "doorForward", label: "More doors" }
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
    },
    {
      key: "hardware.style",
      kind: "hardware",
      label: "Global hardware default",
      helper: "The proposal can override this cabinet by cabinet.",
      defaultValue: "handle",
      options: [
        { value: "handle", label: "Handle" },
        { value: "fingerPull", label: "Finger pull" }
      ],
      wallId: firstWall.id,
      objectId: firstWall.id
    }
  );

  return questions;
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

export function buildIntentConfirmationDecisions(
  model: Round2Model,
  intent: Round2DesignIntent,
  measurements: Record<string, number | null>
): Round2DecisionItem[] {
  const confirmed = new Set(intent.confirmedKeys);
  return buildDesignIntentQuestions(model, measurements)
    .filter((question) => !confirmed.has(question.key))
    .map((question) => {
      const answer = intent.answers[question.key] ?? question.defaultValue;
      const option =
        question.options.find((item) => item.value === answer) ??
        question.options.find((item) => item.value === question.defaultValue);
      return {
        id: `decision-intent-${question.key}`,
        objectId: question.objectId,
        wallId: question.wallId,
        severity: "warning",
        title: `Confirmation required: ${question.label}`,
        body: `Default “${option?.label ?? answer}” was applied. Confirm or revise this design intent before final review.`
      };
    });
}
