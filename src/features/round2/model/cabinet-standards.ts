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
          .strict(),
        drawerStacksSixteenths: z
          .array(z.array(dimensionSchema).min(1))
          .min(1)
      })
      .strict(),
    upper: z
      .object({
        heightsSixteenths: ascendingDimensionsSchema
      })
      .strict(),
    vertical: z
      .object({
        counterHeightSixteenths: dimensionSchema,
        backsplashMinSixteenths: dimensionSchema,
        flatMouldingAllowanceSixteenths: dimensionSchema
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
            wallASixteenths: dimensionSchema,
            wallBSixteenths: dimensionSchema
          })
          .strict(),
        blindBase: z
          .object({
            minCabinetWidthSixteenths: dimensionSchema,
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
      },
      drawerStacksSixteenths: [
        [6, 12, 12].map((value) => value * 16),
        [6, 6, 9, 9].map((value) => value * 16)
      ]
    },
    upper: {
      heightsSixteenths: [30, 36, 42].map((value) => value * 16)
    },
    vertical: {
      counterHeightSixteenths: 34 * 16 + 8,
      backsplashMinSixteenths: 18 * 16,
      flatMouldingAllowanceSixteenths: 3 * 16
    },
    filler: {
      minSixteenths: 8,
      preferredSixteenths: 3 * 16
    },
    corner: {
      lazySusan: {
        wallASixteenths: 36 * 16,
        wallBSixteenths: 36 * 16
      },
      blindBase: {
        minCabinetWidthSixteenths: 39 * 16,
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
      tallSixteenths: 24 * 16
    }
  })
);
