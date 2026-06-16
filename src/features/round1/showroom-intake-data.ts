import type { CabinetRun, Round1FormInput } from "@/domain/round1";

export function createDefaultShowroomForm(): Round1FormInput {
  return {
    room: {
      length: 144,
      width: 120,
      dimensionsKnown: true,
      ceilingHeight: null,
      obstacles: []
    },
    openings: {
      doors: {
        status: "YES",
        items: [{ location: "FRONT_SIDE", width: null }]
      },
      windows: {
        status: "YES",
        items: [{ relation: "BEHIND_SINK", width: null }]
      }
    },
    mep: {
      water: { relation: "NEAR_SINK", movable: "UNKNOWN" },
      gas: { relation: "NEAR_RANGE", movable: "UNKNOWN" },
      electric: { relation: "NEAR_FRIDGE", movable: "UNKNOWN" },
      vent: { relation: "ABOVE_RANGE", movable: "UNKNOWN" }
    },
    layoutPreference: "L_SHAPE",
    fixtures: {
      sink: { size: 33, type: "UNKNOWN", relation: "UNDER_WINDOW" },
    range: {
      size: 30,
      fuel: "GAS",
      fixedLocation: "UNKNOWN",
      relation: "NEAR_RANGE"
    },
      fridge: { size: 36, type: "UNKNOWN", relation: "FRONT_SIDE" },
      dishwasher: { status: "YES", size: 24, relation: "NEAR_SINK" },
      hood: { relation: "ABOVE_RANGE" }
    },
    layoutSensitiveCabinets: {
      cornerCabinet: { preferredType: "NO_PREFERENCE" },
      ovenMicrowave: { configuration: "UNKNOWN", relation: "NEAR_RANGE" },
      island: { requested: false, functions: [] }
    }
  };
}

export function createDefaultCabinetRuns(form: Round1FormInput): CabinetRun[] {
  const mainRun = Math.max(60, Math.min(form.room.length ?? 120, 144) - 48);
  const sideRun =
    form.layoutPreference === "ONE_WALL"
      ? 0
      : Math.max(42, Math.min(form.room.width ?? 96, 120) - 48);

  return [
    {
      id: "base-main",
      kind: "BASE",
      width: mainRun,
      location: "ON_MAIN_RUN"
    },
    {
      id: "wall-main",
      kind: "WALL",
      width: mainRun,
      location: "ON_MAIN_RUN"
    },
    ...(sideRun > 0
      ? [
          {
            id: "base-side",
            kind: "BASE" as const,
            width: sideRun,
            location: "LEFT_SIDE" as const
          },
          {
            id: "wall-side",
            kind: "WALL" as const,
            width: sideRun,
            location: "LEFT_SIDE" as const
          }
        ]
      : [])
  ];
}
