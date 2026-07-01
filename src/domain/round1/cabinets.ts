import {
  type ConfirmationItem,
  createConfirmationItem
} from "./confirmation";

export type CabinetKind = "WALL" | "BASE" | "TALL";

export type CabinetLocation =
  | "BACK_SIDE"
  | "LEFT_SIDE"
  | "RIGHT_SIDE"
  | "FRONT_SIDE"
  | "NEAR_ENTRANCE"
  | "UNDER_WINDOW"
  | "ON_MAIN_RUN"
  | "ON_ISLAND"
  | "ON_PENINSULA"
  | "NEAR_SINK"
  | "NEAR_RANGE"
  | "NEAR_FRIDGE"
  | "BEHIND_SINK"
  | "UNKNOWN";

export type Cabinet = {
  kind: CabinetKind;
  code: string;
  width: number;
  depth: number;
  actualHeight: number;
  codeHeight: number;
  location?: CabinetLocation;
  preliminary: true;
  salesEstimateOnly: true;
  notForProduction: true;
  confirmationRequired: boolean;
  confirmationReasons: string[];
};

export type CabinetRun = {
  id: string;
  kind: CabinetKind;
  width: number;
  location: CabinetLocation;
};

export type CabinetRunSplit = {
  run: CabinetRun;
  cabinets: Cabinet[];
  remainder: number;
  fillerWidth: number;
  confirmationItems: ConfirmationItem[];
};

export type PreliminaryCabinetEstimate = {
  cabinets: Cabinet[];
  confirmationItems: ConfirmationItem[];
  estimatedFillerWidth: number;
  salesEstimateOnly: true;
  notForProduction: true;
};

export type CabinetEstimateKindSummary = {
  count: number;
  linearFeet: number;
};

export type PreliminaryCabinetEstimateSummary = {
  totalCabinets: number;
  baseCabinets: CabinetEstimateKindSummary;
  wallCabinets: CabinetEstimateKindSummary;
  tallCabinets: CabinetEstimateKindSummary;
  estimatedFillerWidth: number;
  salesEstimateOnly: true;
  notForProduction: true;
};

export type CabinetReviewDraft = {
  kind: CabinetKind;
  width: number;
  location?: CabinetLocation;
  height?: number;
};

export type CabinetReviewAction =
  | {
      type: "ADD";
      cabinet: CabinetReviewDraft;
    }
  | {
      type: "EDIT";
      cabinetIndex: number;
      cabinet: CabinetReviewDraft;
    }
  | {
      type: "REMOVE";
      cabinetIndex: number;
    };

export const STANDARD_WIDTH_PRIORITY = [
  36, 33, 30, 27, 24, 21, 18, 15, 12, 9
] as const;

export const MAX_ROUND1_FILLER_WIDTH = 3;

const STANDARD_WIDTHS = new Set<number>(STANDARD_WIDTH_PRIORITY);

const CABINET_DEFAULTS: Record<
  CabinetKind,
  { prefix: string; depth: number; actualHeight: number }
> = {
  WALL: { prefix: "W", depth: 12, actualHeight: 36 },
  BASE: { prefix: "B", depth: 24, actualHeight: 34.5 },
  TALL: { prefix: "T", depth: 24, actualHeight: 84 }
};

export function createCabinetCode(
  kind: CabinetKind,
  width: number,
  depth: number,
  actualHeight: number
): string {
  const prefix = CABINET_DEFAULTS[kind].prefix;
  return `${prefix}${formatCodeNumber(width)}${formatCodeNumber(
    depth
  )}${formatCodeNumber(Math.round(actualHeight))}`;
}

export function createStandardCabinet(
  kind: CabinetKind,
  width: number,
  options: { location?: CabinetLocation; height?: number } = {}
): Cabinet {
  const defaults = CABINET_DEFAULTS[kind];
  const actualHeight = options.height ?? defaults.actualHeight;
  const confirmationReasons = STANDARD_WIDTHS.has(width)
    ? []
    : ["NON_STANDARD_CABINET_SIZE"];

  if (kind === "TALL") {
    confirmationReasons.push("TALL_OR_APPLIANCE_CABINET_ASSUMPTION");
  }

  return {
    kind,
    width,
    depth: defaults.depth,
    actualHeight,
    codeHeight: Math.round(actualHeight),
    code: createCabinetCode(kind, width, defaults.depth, actualHeight),
    location: options.location,
    preliminary: true,
    salesEstimateOnly: true,
    notForProduction: true,
    confirmationRequired: confirmationReasons.length > 0,
    confirmationReasons
  };
}

export function splitCabinetRun(run: CabinetRun): CabinetRunSplit {
  const cabinets: Cabinet[] = [];
  let remaining = run.width;

  while (remaining >= 9) {
    const nextWidth = STANDARD_WIDTH_PRIORITY.find((width) => width <= remaining);
    if (!nextWidth) {
      break;
    }
    cabinets.push(
      createStandardCabinet(run.kind, nextWidth, { location: run.location })
    );
    remaining -= nextWidth;
  }

  const fillerWidth =
    remaining > 0 && remaining <= MAX_ROUND1_FILLER_WIDTH ? remaining : 0;
  const remainder = fillerWidth > 0 ? 0 : remaining;

  const confirmationItems =
    remainder > 0
      ? [
          createConfirmationItem({
            category: "CABINET",
            code: "RUN_REMAINDER",
            message: `Run ${run.id} has a ${remainder}" remainder after standard cabinet split.`,
            path: `cabinetRuns.${run.id}`,
            severity: "REQUIRED"
          })
        ]
      : [];

  return {
    run,
    cabinets,
    remainder,
    fillerWidth,
    confirmationItems
  };
}

export function generatePreliminaryCabinetList(
  runs: CabinetRun[]
): PreliminaryCabinetEstimate {
  const splits = runs.map(splitCabinetRun);

  return {
    cabinets: splits.flatMap((split) => split.cabinets),
    confirmationItems: splits.flatMap((split) => split.confirmationItems),
    estimatedFillerWidth: splits.reduce(
      (sum, split) => sum + split.fillerWidth,
      0
    ),
    salesEstimateOnly: true,
    notForProduction: true
  };
}

export function summarizePreliminaryCabinetEstimate(
  estimate: PreliminaryCabinetEstimate
): PreliminaryCabinetEstimateSummary {
  return {
    totalCabinets: estimate.cabinets.length,
    baseCabinets: summarizeCabinetsByKind(estimate.cabinets, "BASE"),
    wallCabinets: summarizeCabinetsByKind(estimate.cabinets, "WALL"),
    tallCabinets: summarizeCabinetsByKind(estimate.cabinets, "TALL"),
    estimatedFillerWidth: estimate.estimatedFillerWidth,
    salesEstimateOnly: true,
    notForProduction: true
  };
}

export function applyCabinetReviewActions(
  estimate: PreliminaryCabinetEstimate,
  actions: CabinetReviewAction[]
): PreliminaryCabinetEstimate {
  const cabinets = [...estimate.cabinets];

  for (const action of actions) {
    if (action.type === "REMOVE") {
      cabinets.splice(action.cabinetIndex, 1);
      continue;
    }

    const cabinet = createReviewedCabinet(action.cabinet);

    if (action.type === "ADD") {
      cabinets.push(cabinet);
      continue;
    }

    cabinets[action.cabinetIndex] = cabinet;
  }

  return {
    cabinets,
    confirmationItems: [
      ...estimate.confirmationItems,
      ...cabinets.flatMap((cabinet, index) =>
        cabinet.confirmationReasons.includes("DESIGNER_MANUAL_REVIEW")
          ? [
              createConfirmationItem({
                category: "CABINET",
                code: "MANUAL_CABINET_REVIEW",
                message: `${cabinet.code} was manually reviewed outside standard Round 1 assumptions and requires designer confirmation.`,
                path: `cabinets.${index}`,
                severity: "REQUIRED"
              })
            ]
          : []
      )
    ],
    estimatedFillerWidth: estimate.estimatedFillerWidth,
    salesEstimateOnly: true,
    notForProduction: true
  };
}

function createReviewedCabinet(draft: CabinetReviewDraft): Cabinet {
  const cabinet = createStandardCabinet(draft.kind, draft.width, {
    location: draft.location,
    height: draft.height
  });

  if (!cabinet.confirmationRequired) {
    return cabinet;
  }

  return {
    ...cabinet,
    confirmationReasons: [
      ...cabinet.confirmationReasons,
      "DESIGNER_MANUAL_REVIEW"
    ]
  };
}

function summarizeCabinetsByKind(
  cabinets: Cabinet[],
  kind: CabinetKind
): CabinetEstimateKindSummary {
  const matchingCabinets = cabinets.filter((cabinet) => cabinet.kind === kind);
  const totalWidth = matchingCabinets.reduce(
    (sum, cabinet) => sum + cabinet.width,
    0
  );

  return {
    count: matchingCabinets.length,
    linearFeet: Math.round((totalWidth / 12) * 10) / 10
  };
}

function formatCodeNumber(value: number): string {
  return String(value).replace(".", "");
}
