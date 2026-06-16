import type { ConfirmationItem } from "./confirmation";
import type { Round1FormInput, Round1Normalized } from "./schemas";

export type Round1Readiness = {
  canGenerateRound1Layout: boolean;
  canEnterProduction: false;
  confirmationRequiredCount: number;
  generationBlockers: string[];
  productionRejectionReasons: string[];
};

export function evaluateRound1Readiness(
  form: Round1FormInput,
  normalized: Round1Normalized,
  confirmationItems: ConfirmationItem[]
): Round1Readiness {
  const generationBlockers: string[] = [];

  if (!form.layoutPreference) {
    generationBlockers.push("MISSING_LAYOUT_PREFERENCE");
  }

  if (
    form.room.dimensionsKnown &&
    (normalized.room.length.value === null || normalized.room.width.value === null)
  ) {
    generationBlockers.push("MISSING_ROOM_DIMENSIONS");
  }

  return {
    canGenerateRound1Layout: generationBlockers.length === 0,
    canEnterProduction: false,
    confirmationRequiredCount: confirmationItems.length,
    generationBlockers,
    productionRejectionReasons: [
      "ROUND_1_NOT_PRODUCTION_DATA",
      "SALES_ESTIMATE_ONLY",
      "FIELD_MEASURE_REQUIRED_BEFORE_PRODUCTION"
    ]
  };
}
