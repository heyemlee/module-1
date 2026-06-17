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
  const sideRun = Math.max(42, Math.min(form.room.width ?? 96, 120) - 48);
  const islandRun = Math.max(48, Math.min(mainRun, 72));
  const runs: CabinetRun[] = [];

  const addWallRun = (
    id: string,
    location: CabinetRun["location"],
    width: number
  ) => {
    runs.push(
      {
        id: `base-${id}`,
        kind: "BASE",
        width,
        location
      },
      {
        id: `wall-${id}`,
        kind: "WALL",
        width,
        location
      }
    );
  };

  const addIslandRun = () => {
    runs.push({
      id: "base-island",
      kind: "BASE",
      width: islandRun,
      location: "ON_ISLAND"
    });
  };

  addWallRun("main", "ON_MAIN_RUN", mainRun);

  if (
    [
      "L_SHAPE",
      "PENINSULA",
      "U_SHAPE",
      "L_SHAPE_ISLAND",
      "U_SHAPE_ISLAND",
      "NO_PREFERENCE"
    ].includes(form.layoutPreference)
  ) {
    addWallRun("left", "LEFT_SIDE", sideRun);
  }

  if (["GALLEY"].includes(form.layoutPreference)) {
    addWallRun("bottom", "FRONT_SIDE", mainRun);
  }

  if (["U_SHAPE", "U_SHAPE_ISLAND"].includes(form.layoutPreference)) {
    addWallRun("right", "RIGHT_SIDE", sideRun);
  }

  if (form.layoutPreference === "PENINSULA") {
    runs.push({
      id: "base-peninsula",
      kind: "BASE",
      width: islandRun,
      location: "FRONT_SIDE"
    });
  }

  if (
    ["ISLAND", "L_SHAPE_ISLAND", "U_SHAPE_ISLAND"].includes(
      form.layoutPreference
    ) ||
    form.layoutSensitiveCabinets.island.requested
  ) {
    addIslandRun();
  }

  return runs;
}
