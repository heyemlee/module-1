import { z } from "zod";

const relationSchema = z.enum([
  "BACK_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "FRONT_SIDE",
  "NEAR_ENTRANCE",
  "UNDER_WINDOW",
  "ON_MAIN_RUN",
  "ON_ISLAND",
  "NEAR_SINK",
  "NEAR_RANGE",
  "NEAR_FRIDGE",
  "BEHIND_SINK",
  "ABOVE_RANGE",
  "NEAR_PANTRY",
  "NEAR_PREP_AREA",
  "NO_PREFERENCE",
  "NOT_APPLICABLE",
  "UNKNOWN"
]);

const nullableNumberSchema = z.number().positive().nullable();
const statusSchema = z.enum(["YES", "NO", "UNKNOWN"]);
const cabinetStyleSchema = z.enum(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"]);

const renderingPreferencesSchema = z.object({
  cabinetStyle: cabinetStyleSchema.default("EUROPEAN_FRAMELESS"),
  doorColorId: z.string().min(1).nullable().default(null)
});
const roughApplianceSchema = z.object({
  status: statusSchema,
  relation: relationSchema.default("UNKNOWN")
});
const islandSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return value;
    }
    const island = value as {
      status?: z.infer<typeof statusSchema>;
      requested?: boolean;
      functions?: string[];
    };
    const status = island.status ?? (island.requested ? "YES" : "NO");
    return {
      status,
      requested: status === "YES",
      functions: island.functions ?? []
    };
  },
  z.object({
    status: statusSchema,
    requested: z.boolean(),
    functions: z.array(z.string())
  })
);

const defaultCookingAppliances = {
  range: { status: "YES" as const, relation: "BACK_SIDE" as const },
  cooktop: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
  wallOven: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
  microwaveOvenCombo: {
    status: "UNKNOWN" as const,
    relation: "UNKNOWN" as const
  }
};

const doorSchema = z.object({
  location: relationSchema,
  // Distinguishes a swinging door (reserves a swing-clearance zone that excludes
  // cabinets/appliances) from an open passage (a cased wall opening with no leaf,
  // so it reserves no swing clearance). Optional for backward compatibility;
  // a missing value is treated as a door (the conservative, clearance-reserving
  // default) everywhere it is read.
  kind: z.enum(["DOOR", "OPEN_PASSAGE"]).optional(),
  width: nullableNumberSchema.optional(),
  distanceFromCorner: nullableNumberSchema.optional(),
  swingDirection: z.string().optional()
});

const windowSchema = z.object({
  relation: relationSchema,
  width: nullableNumberSchema.optional(),
  sillHeight: nullableNumberSchema.optional(),
  windowHeight: nullableNumberSchema.optional(),
  topHeight: nullableNumberSchema.optional()
});

function openingGroupSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.preprocess(
    (value) => {
      if (Array.isArray(value)) {
        return {
          status: value.length > 0 ? "YES" : "UNKNOWN",
          items: value
        };
      }
      return value;
    },
    z.object({
      status: statusSchema,
      items: z.array(itemSchema).default([])
    })
  );
}

export const round1FormSchema = z.object({
  room: z.object({
    length: nullableNumberSchema,
    width: nullableNumberSchema,
    dimensionsKnown: z.boolean(),
    ceilingHeight: nullableNumberSchema.optional(),
    obstacles: z
      .array(
        z.object({
          type: z.string(),
          relation: relationSchema.default("UNKNOWN"),
          confirmationRequired: z.boolean().optional()
        })
      )
      .default([])
  }),
  openings: z.object({
    doors: openingGroupSchema(doorSchema),
    windows: openingGroupSchema(windowSchema)
  }),
  mep: z.object({
    water: z.object({ relation: relationSchema, movable: z.enum(["YES", "NO", "UNKNOWN"]) }),
    gas: z.object({ relation: relationSchema, movable: z.enum(["YES", "NO", "UNKNOWN"]) }),
    electric: z.object({
      relation: relationSchema,
      movable: z.enum(["YES", "NO", "UNKNOWN"])
    }),
    vent: z.object({ relation: relationSchema, movable: z.enum(["YES", "NO", "UNKNOWN"]) })
  }),
  layoutPreference: z.enum([
    "ONE_WALL",
    "LEFT_L_SHAPE",
    "RIGHT_L_SHAPE",
    "L_SHAPE",
    "U_SHAPE",
    "GALLEY",
    "PENINSULA",
    "ISLAND",
    "L_SHAPE_ISLAND",
    "U_SHAPE_ISLAND",
    "NO_PREFERENCE"
  ]),
  renderingPreferences: renderingPreferencesSchema.default({
    cabinetStyle: "EUROPEAN_FRAMELESS",
    doorColorId: null
  }),
  fixtures: z.object({
    sink: z.object({
      status: z.enum(["YES", "NO", "UNKNOWN"]).default("YES"),
      size: z.union([z.literal(30), z.literal(33), z.literal(36)]).nullable(),
      type: z.string(),
      relation: relationSchema
    }),
    range: z.object({
      size: z.union([z.literal(30), z.literal(36), z.literal(48)]).nullable(),
      fuel: z.string(),
      fixedLocation: z.enum(["YES", "NO", "UNKNOWN"]),
      relation: relationSchema.default("UNKNOWN")
    }),
    fridge: z.object({
      status: z.enum(["YES", "NO", "UNKNOWN"]).default("YES"),
      size: z
        .union([
          z.literal(30),
          z.literal(33),
          z.literal(36),
          z.literal(42),
          z.literal(48)
        ])
        .nullable(),
      type: z.string(),
      relation: relationSchema
    }),
    dishwasher: z.object({
      status: z.enum(["YES", "NONE", "UNKNOWN"]).default("YES"),
      size: z.union([z.literal(18), z.literal(24)]).nullable(),
      relation: relationSchema
    }),
    hood: z.object({
      relation: relationSchema
    })
  }),
  layoutSensitiveCabinets: z.object({
    cornerCabinet: z.object({
      preferredType: z.enum([
        "LAZY_SUSAN",
        "BLIND_CORNER",
        "LEMANS",
        "MAGIC_CORNER",
        "CORNER_DRAWER",
        "NO_PREFERENCE",
        "UNKNOWN"
      ])
    }),
    ovenMicrowave: z.object({
      configuration: z.enum([
        "RANGE_INCLUDES_OVEN",
        "WALL_OVEN_MICROWAVE_STACK",
        "SEPARATE_WALL_OVEN_AND_MICROWAVE",
        "MICROWAVE_DRAWER",
        "UPPER_CABINET_MICROWAVE",
        "COUNTERTOP_MICROWAVE",
        "NO_MICROWAVE",
        "NO_OVEN",
        "UNKNOWN"
      ]),
      relation: relationSchema.default("UNKNOWN")
    }),
    cookingAppliances: z
      .object({
        range: roughApplianceSchema,
        cooktop: roughApplianceSchema,
        wallOven: roughApplianceSchema,
        microwaveOvenCombo: roughApplianceSchema
      })
      .default(defaultCookingAppliances),
    island: islandSchema
  })
});

const dimensionSchema = z.object({
  value: z.number().positive().nullable(),
  unit: z.literal("inch"),
  confidence: z.enum(["ROUGH", "EXACT", "UNKNOWN"]),
  confirmationRequired: z.boolean().optional()
});

export const round1NormalizedSchema = z.object({
  round: z.literal("ROUND_1"),
  layoutGoal: z.literal("CUSTOMER_CONFIRMATION"),
  salesEstimateOnly: z.literal(true),
  notForProduction: z.literal(true),
  dimensionConfidence: z.literal("ROUGH"),
  room: z.object({
    length: dimensionSchema,
    width: dimensionSchema,
    ceilingHeight: dimensionSchema,
    obstacles: z.array(z.unknown())
  }),
  openings: z.object({
    doors: z.object({
      status: statusSchema,
      items: z.array(z.unknown())
    }),
    windows: z.object({
      status: statusSchema,
      items: z.array(z.unknown())
    })
  }),
  mep: z.record(z.unknown()),
  layoutPreference: round1FormSchema.shape.layoutPreference,
  fixtures: z.record(z.unknown()),
  layoutSensitiveCabinets: z.record(z.unknown()),
  cabinetLayersToRender: z.array(
    z.enum([
      "BASE_CABINETS",
      "WALL_CABINETS",
      "TALL_OR_APPLIANCE_CABINETS_IF_ANY"
    ])
  )
});

export type CabinetStyle = z.infer<typeof cabinetStyleSchema>;
export type Round1RenderingPreferences = z.infer<
  typeof renderingPreferencesSchema
>;
export type Round1Form = z.infer<typeof round1FormSchema>;
export type Round1FormInput = Omit<Round1Form, "renderingPreferences"> & {
  renderingPreferences?: Round1RenderingPreferences;
};
export type Round1Normalized = z.infer<typeof round1NormalizedSchema>;
