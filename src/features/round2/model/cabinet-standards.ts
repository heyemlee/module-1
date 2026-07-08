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
    widthOptionsSixteenths: ascendingDimensionsSchema,
    defaultWidthSixteenths: dimensionSchema,
    labelPrefix: z.string().min(1),
    customerProvided: z.literal(true)
  })
  .strict();

export const cabinetStandardsSchema = z
  .object({
    base: z
      .object({
        widthsSixteenths: ascendingDimensionsSchema,
        heightSixteenths: dimensionSchema,
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
        countertopThicknessSixteenths: dimensionSchema,
        finishedCounterHeightSixteenths: dimensionSchema,
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
        preferredSixteenths: dimensionSchema,
        maxSixteenths: dimensionSchema,
        commonWidthsSixteenths: ascendingDimensionsSchema
      })
      .strict(),
    corner: z
      .object({
        lazySusan: z
          .object({
            widthOptionsSixteenths: ascendingDimensionsSchema,
            heightSixteenths: dimensionSchema,
            depthSixteenths: dimensionSchema
          })
          .strict(),
        blindBase: z
          .object({
            widthOptionsSixteenths: ascendingDimensionsSchema,
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
        sinkBase: applianceSchema,
        refrigerator: applianceSchema
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

    for (const [key, appliance] of Object.entries(standards.appliances)) {
      if (
        !appliance.widthOptionsSixteenths.includes(
          appliance.defaultWidthSixteenths
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Default appliance width must be an allowed option",
          path: ["appliances", key, "defaultWidthSixteenths"]
        });
      }
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

    if (
      standards.base.heightSixteenths +
        standards.vertical.countertopThicknessSixteenths !==
      standards.vertical.finishedCounterHeightSixteenths
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Base height plus countertop thickness must equal finished counter height",
        path: ["vertical", "finishedCounterHeightSixteenths"]
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
      heightSixteenths: 34 * 16 + 8,
      doorRule: {
        singleDoorMaxSixteenths: 21 * 16,
        doubleDoorMinSixteenths: 24 * 16
      }
    },
    upper: {
      standardHeightsSixteenths: [30, 36, 40, 42].map(
        (value) => value * 16
      ),
      hoodHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      ),
      refrigeratorHeightsSixteenths: [12, 15, 18, 21, 24].map(
        (value) => value * 16
      )
    },
    vertical: {
      countertopThicknessSixteenths: 1 * 16 + 8,
      finishedCounterHeightSixteenths: 36 * 16,
      backsplashMinSixteenths: 18 * 16,
      flatMoulding: {
        minSixteenths: 2 * 16,
        preferredSixteenths: 3 * 16,
        maxSixteenths: 3 * 16
      }
    },
    filler: {
      minSixteenths: 3 * 16,
      preferredSixteenths: 3 * 16,
      maxSixteenths: 6 * 16,
      commonWidthsSixteenths: [3, 4, 5, 6].map((value) => value * 16)
    },
    corner: {
      lazySusan: {
        widthOptionsSixteenths: [33, 36].map((value) => value * 16),
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16
      },
      blindBase: {
        widthOptionsSixteenths: [39, 42, 45].map((value) => value * 16),
        heightSixteenths: 34 * 16 + 8,
        depthSixteenths: 24 * 16,
        adjacentWallPullSixteenths: 3 * 16
      }
    },
    appliances: {
      dishwasher: {
        widthOptionsSixteenths: [24 * 16],
        defaultWidthSixteenths: 24 * 16,
        labelPrefix: "DW",
        customerProvided: true
      },
      range: {
        widthOptionsSixteenths: [30, 33].map((value) => value * 16),
        defaultWidthSixteenths: 30 * 16,
        labelPrefix: "RNG",
        customerProvided: true
      },
      sinkBase: {
        widthOptionsSixteenths: [30, 33, 36, 39].map(
          (value) => value * 16
        ),
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "SB",
        customerProvided: true
      },
      refrigerator: {
        widthOptionsSixteenths: [36 * 16],
        defaultWidthSixteenths: 36 * 16,
        labelPrefix: "REF",
        customerProvided: true
      }
    },
    depths: {
      baseSixteenths: 24 * 16,
      upperSixteenths: 12 * 16,
      refrigeratorUpperSixteenths: 24 * 16,
      tallSixteenths: 24 * 16
    }
  })
);
