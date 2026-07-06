import { z } from "zod";

const dimensionSchema = z.number().int().positive();

const ascendingDimensionsSchema = z
  .array(dimensionSchema)
  .min(1)
  .superRefine((values, context) => {
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dimensions must be unique and strictly ascending"
        });
        return;
      }
    }
  });

const applianceSchema = z
  .object({
    widthSixteenths: dimensionSchema,
    label: z.string().min(1)
  })
  .strict();

export const cabinetStandardsSchema = z
  .object({
    base: z
      .object({
        widthsSixteenths: ascendingDimensionsSchema,
        doorRule: z
          .object({
            singleDoorMaxSixteenths: dimensionSchema,
            doubleDoorMinSixteenths: dimensionSchema
          })
          .strict()
      })
      .strict(),
    upper: z
      .object({
        standardHeightsSixteenths: ascendingDimensionsSchema,
        hoodHeightsSixteenths: ascendingDimensionsSchema,
        refrigeratorHeightsSixteenths: ascendingDimensionsSchema
      })
      .strict(),
    vertical: z
      .object({
        counterHeightSixteenths: dimensionSchema,
        backsplashMinSixteenths: dimensionSchema,
        flatMoulding: z
          .object({
            minSixteenths: dimensionSchema,
            preferredSixteenths: dimensionSchema,
            maxSixteenths: dimensionSchema
          })
          .strict()
      })
      .strict(),
    filler: z
      .object({
        minSixteenths: dimensionSchema,
        preferredSixteenths: dimensionSchema
      })
      .strict(),
    corner: z
      .object({
        lazySusan: z
          .object({
            modelNominalWidthSixteenths: dimensionSchema,
            cabinetEnvelopeWidthSixteenths: dimensionSchema,
            heightSixteenths: dimensionSchema,
            depthSixteenths: dimensionSchema
          })
          .strict(),
        blindBase: z
          .object({
            cabinetEnvelopeWidthSixteenths: dimensionSchema,
            heightSixteenths: dimensionSchema,
            depthSixteenths: dimensionSchema,
            adjacentWallPullSixteenths: dimensionSchema
          })
          .strict()
      })
      .strict(),
    appliances: z
      .object({
        dishwasher: applianceSchema,
        range: applianceSchema,
        sinkBase: z
          .object({
            widthOptionsSixteenths: ascendingDimensionsSchema,
            defaultWidthSixteenths: dimensionSchema,
            labelPrefix: z.string().min(1)
          })
          .strict(),
        refrigerator: applianceSchema,
        fallbackWidthSixteenths: dimensionSchema
      })
      .strict(),
    depths: z
      .object({
        baseSixteenths: dimensionSchema,
        upperSixteenths: dimensionSchema,
        refrigeratorUpperSixteenths: dimensionSchema,
        tallSixteenths: dimensionSchema
      })
      .strict()
  })
  .strict()
  .superRefine((standards, context) => {
    const doorRule = standards.base.doorRule;
    if (
      doorRule.singleDoorMaxSixteenths >=
      doorRule.doubleDoorMinSixteenths
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Door thresholds must not overlap",
        path: ["base", "doorRule"]
      });
    }

    const sinkBase = standards.appliances.sinkBase;
    if (
      !sinkBase.widthOptionsSixteenths.includes(
        sinkBase.defaultWidthSixteenths
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Default sink width must be an allowed option",
        path: ["appliances", "sinkBase", "defaultWidthSixteenths"]
      });
    }

    const moulding = standards.vertical.flatMoulding;
    if (
      moulding.minSixteenths > moulding.preferredSixteenths ||
      moulding.preferredSixteenths > moulding.maxSixteenths
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Flat moulding must satisfy min <= preferred <= max",
        path: ["vertical", "flatMoulding"]
      });
    }

    const lazySusan = standards.corner.lazySusan;
    if (
      lazySusan.cabinetEnvelopeWidthSixteenths <
      lazySusan.modelNominalWidthSixteenths
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lazy Susan envelope must cover its nominal model width",
        path: ["corner", "lazySusan", "cabinetEnvelopeWidthSixteenths"]
      });
    }
  });

type DeepReadonly<T> =
  T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

export type CabinetStandards = DeepReadonly<
  z.infer<typeof cabinetStandardsSchema>
>;

export const CABINET_STANDARDS: CabinetStandards = deepFreeze(
  cabinetStandardsSchema.parse({
    base: {
      widthsSixteenths: [9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(
        (value) => value * 16
      ),
      doorRule: {
        singleDoorMaxSixteenths: 21 * 16,
        doubleDoorMinSixteenths: 24 * 16
      }
    },
    upper: {
      standardHeightsSixteenths: [30, 36, 40].map((value) => value * 16),
      hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      ),
      refrigeratorHeightsSixteenths: [12, 15, 18].map(
        (value) => value * 16
      )
    },
    vertical: {
      counterHeightSixteenths: 34 * 16 + 8,
      backsplashMinSixteenths: 18 * 16,
      flatMoulding: {
        minSixteenths: 2 * 16,
        preferredSixteenths: 3 * 16,
        maxSixteenths: 3 * 16
      }
    },
    filler: {
      minSixteenths: 8,
      preferredSixteenths: 3 * 16
    },
    corner: {
      lazySusan: {
        modelNominalWidthSixteenths: 36 * 16,
        cabinetEnvelopeWidthSixteenths: 39 * 16,
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16
      },
      blindBase: {
        cabinetEnvelopeWidthSixteenths: 39 * 16,
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16,
        adjacentWallPullSixteenths: 3 * 16
      }
    },
    appliances: {
      dishwasher: { widthSixteenths: 24 * 16, label: "DW24" },
      range: { widthSixteenths: 30 * 16, label: "RNG30" },
      sinkBase: {
        widthOptionsSixteenths: [30, 33, 36].map((value) => value * 16),
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "SB"
      },
      refrigerator: { widthSixteenths: 36 * 16, label: "REF36" },
      fallbackWidthSixteenths: 30 * 16
    },
    depths: {
      baseSixteenths: 24 * 16,
      upperSixteenths: 12 * 16,
      refrigeratorUpperSixteenths: 24 * 16,
      tallSixteenths: 24 * 16
    }
  })
);
