import {
  type ConfirmationItem,
  createConfirmationItem
} from "./confirmation";
import { evaluateRound1Readiness, type Round1Readiness } from "./readiness";
import {
  round1FormSchema,
  type Round1FormInput,
  type Round1Normalized
} from "./schemas";

export type Round1NormalizationResult = {
  normalized: Round1Normalized;
  confirmationItems: ConfirmationItem[];
  readiness: Round1Readiness;
};

export function normalizeRound1Form(
  input: Round1FormInput
): Round1NormalizationResult {
  const form = round1FormSchema.parse(input);
  const confirmationItems: ConfirmationItem[] = [];

  if (!form.room.ceilingHeight) {
    confirmationItems.push(
      createConfirmationItem({
        category: "ROOM",
        code: "MISSING_CEILING_HEIGHT",
        message: "Ceiling height is missing and must be confirmed before production.",
        path: "room.ceilingHeight"
      })
    );
  }

  if (form.openings.doors.status === "UNKNOWN") {
    confirmationItems.push(
      createConfirmationItem({
        category: "OPENING",
        code: "UNKNOWN_DOOR_STATUS",
        message: "Door/opening status is unknown.",
        path: "openings.doors.status"
      })
    );
  }

  if (form.openings.windows.status === "UNKNOWN") {
    confirmationItems.push(
      createConfirmationItem({
        category: "OPENING",
        code: "UNKNOWN_WINDOW_STATUS",
        message: "Window status is unknown.",
        path: "openings.windows.status"
      })
    );
  }

  if (form.layoutSensitiveCabinets.island.status === "UNKNOWN") {
    confirmationItems.push(
      createConfirmationItem({
        category: "CABINET",
        code: "UNKNOWN_ISLAND_STATUS",
        message: "Island requirement is unknown.",
        path: "layoutSensitiveCabinets.island.status"
      })
    );
  }

  if (
    form.openings.windows.status === "NO" &&
    form.fixtures.sink.relation === "UNDER_WINDOW"
  ) {
    confirmationItems.push(
      createConfirmationItem({
        category: "APPLIANCE",
        code: "SINK_UNDER_WINDOW_BUT_NO_WINDOW",
        message: "Sink was marked under window, but the intake says there are no windows.",
        path: "fixtures.sink.relation"
      })
    );
  }

  Object.entries(form.fixtures).forEach(([key, value]) => {
    if (key === "range") {
      return;
    }
    if (
      key === "dishwasher" &&
      "status" in value &&
      value.status === "NONE"
    ) {
      return;
    }
    if ("size" in value && value.size === null) {
      confirmationItems.push(
        createConfirmationItem({
          category: "APPLIANCE",
          code: "MISSING_APPLIANCE_DIMENSION",
          message: `${key} size is missing or unknown.`,
          path: `fixtures.${key}.size`
        })
      );
    }
  });

  const normalizedFixtures = {
    ...form.fixtures,
    sink: {
      ...form.fixtures.sink,
      relation:
        form.openings.windows.status === "NO" &&
        form.fixtures.sink.relation === "UNDER_WINDOW"
          ? "UNKNOWN"
          : form.fixtures.sink.relation
    },
    dishwasher:
      form.fixtures.dishwasher.status === "NONE"
        ? {
            ...form.fixtures.dishwasher,
            size: null,
            relation: "NOT_APPLICABLE" as const
          }
        : form.fixtures.dishwasher
  };

  const normalized: Round1Normalized = {
    round: "ROUND_1",
    layoutGoal: "CUSTOMER_CONFIRMATION",
    salesEstimateOnly: true,
    notForProduction: true,
    dimensionConfidence: "ROUGH",
    room: {
      length: toDimension(form.room.length, !form.room.length),
      width: toDimension(form.room.width, !form.room.width),
      ceilingHeight: toDimension(form.room.ceilingHeight ?? null, !form.room.ceilingHeight),
      obstacles: form.room.obstacles
    },
    openings: {
      doors: {
        status: form.openings.doors.status,
        items: form.openings.doors.items.map((door) => ({
          ...door,
          confirmationRequired:
            form.openings.doors.status === "YES" && !door.width
        }))
      },
      windows: {
        status: form.openings.windows.status,
        items: form.openings.windows.items.map((window) => ({
          ...window,
          confirmationRequired:
            form.openings.windows.status === "YES" && !window.width
        }))
      }
    },
    mep: form.mep,
    layoutPreference: form.layoutPreference,
    fixtures: normalizedFixtures,
    layoutSensitiveCabinets: {
      ...form.layoutSensitiveCabinets,
      cookingAppliances: enforceCookingExclusivity(
        form.layoutSensitiveCabinets.cookingAppliances
      ),
      cornerCabinet: {
        ...form.layoutSensitiveCabinets.cornerCabinet,
        confirmationRequired: false
      }
    },
    cabinetLayersToRender: [
      "BASE_CABINETS",
      "WALL_CABINETS",
      "TALL_OR_APPLIANCE_CABINETS_IF_ANY"
    ]
  };

  return {
    normalized,
    confirmationItems,
    readiness: evaluateRound1Readiness(form, normalized, confirmationItems)
  };
}

type ParsedForm = ReturnType<typeof round1FormSchema.parse>;
type CookingAppliances = ParsedForm["layoutSensitiveCabinets"]["cookingAppliances"];

/**
 * Range and cooktop are mutually exclusive primary cooking surfaces (range =
 * burners + oven; cooktop = burners only). The form UI prevents picking both,
 * but this is the deterministic safety net for other writers (e.g. the AI
 * intake agent): if both are YES, keep the range and drop the cooktop so the
 * plan/JSON never shows them coexisting.
 */
function enforceCookingExclusivity(cooking: CookingAppliances): CookingAppliances {
  if (cooking.range.status === "YES" && cooking.cooktop.status === "YES") {
    return {
      ...cooking,
      cooktop: { ...cooking.cooktop, status: "NO", relation: "NOT_APPLICABLE" }
    };
  }
  return cooking;
}

function toDimension(value: number | null, confirmationRequired: boolean) {
  return {
    value,
    unit: "inch" as const,
    confidence: value === null ? ("UNKNOWN" as const) : ("ROUGH" as const),
    confirmationRequired: confirmationRequired || undefined
  };
}
