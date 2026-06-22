import type { Dispatch, SetStateAction } from "react";
import { type Round1FormInput } from "@/domain/round1";
import {
  allowedDragWallsForLayout,
  type PositionOverrides
} from "./floorplan/plan-geometry";
import {
  NumberField,
  SelectField,
  Step,
  parseNullableSize
} from "./showroom-intake-controls";

const wallPositionOptions = [
  "BACK_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "FRONT_SIDE",
  "UNKNOWN"
] as const;

const doorKindOptions = ["DOOR", "OPEN_PASSAGE"] as const;

const applianceWallOptions = [
  "BACK_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "FRONT_SIDE",
  "ON_ISLAND",
  "UNKNOWN"
] as const;

const layoutPreferenceOptions = [
  "LEFT_L_SHAPE",
  "RIGHT_L_SHAPE",
  "U_SHAPE",
  "ONE_WALL",
  "GALLEY",
  "PENINSULA",
  "NO_PREFERENCE"
] as const;

const ovenMicrowaveArrangementOptions = [
  "WALL_OVEN_MICROWAVE_STACK",
  "SEPARATE_WALL_OVEN_AND_MICROWAVE",
  "UNKNOWN"
] as const;

type OvenMicrowaveArrangement =
  (typeof ovenMicrowaveArrangementOptions)[number];

function displayLayoutPreference(
  layoutPreference: Round1FormInput["layoutPreference"]
): (typeof layoutPreferenceOptions)[number] {
  if (layoutPreference === "L_SHAPE" || layoutPreference === "L_SHAPE_ISLAND") {
    return "LEFT_L_SHAPE";
  }
  if (layoutPreference === "U_SHAPE_ISLAND") {
    return "U_SHAPE";
  }
  if (layoutPreference === "ISLAND") {
    return "NO_PREFERENCE";
  }
  return layoutPreference as (typeof layoutPreferenceOptions)[number];
}

function displayOvenMicrowaveArrangement(
  configuration: Round1FormInput["layoutSensitiveCabinets"]["ovenMicrowave"]["configuration"]
): OvenMicrowaveArrangement {
  return ovenMicrowaveArrangementOptions.includes(
    configuration as OvenMicrowaveArrangement
  )
    ? (configuration as OvenMicrowaveArrangement)
    : "UNKNOWN";
}

function islandStatusForForm(
  form: Round1FormInput
): "YES" | "NO" | "UNKNOWN" {
  if (/ISLAND/.test(form.layoutPreference)) return "YES";
  return (
    form.layoutSensitiveCabinets.island.status ??
    (form.layoutSensitiveCabinets.island.requested ? "YES" : "NO")
  );
}

export function RoomStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="1. Room Size And Obstacles">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Room length (inches)"
          value={form.room.length}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, length: value } })
          }
        />
        <NumberField
          label="Room width (inches)"
          value={form.room.width}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, width: value } })
          }
        />
        <NumberField
          label="Ceiling height if known"
          value={form.room.ceilingHeight ?? null}
          onChange={(value) =>
            setForm({ ...form, room: { ...form.room, ceilingHeight: value } })
          }
        />
      </div>
    </Step>
  );
}

export function OpeningsStep({
  form,
  setForm,
  setPositionOverrides
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
  setPositionOverrides?: Dispatch<SetStateAction<PositionOverrides>>;
}) {
  const door = form.openings.doors.items[0] ?? {
    location: "FRONT_SIDE" as const,
    kind: "DOOR" as const,
    width: null
  };
  const window = form.openings.windows.items[0] ?? {
    relation: "BACK_SIDE" as const,
    width: null
  };
  const setDoorStatus = (status: Round1FormInput["openings"]["doors"]["status"]) => {
    setForm({
      ...form,
      openings: {
        ...form.openings,
        doors: {
          status,
          items: status === "NO" ? [] : form.openings.doors.items.length ? form.openings.doors.items : [door]
        }
      }
    });
  };
  const setWindowStatus = (
    status: Round1FormInput["openings"]["windows"]["status"]
  ) => {
    const sinkRelation =
      status === "NO" && form.fixtures.sink.relation === "UNDER_WINDOW"
        ? "UNKNOWN"
        : form.fixtures.sink.relation;
    setForm({
      ...form,
      openings: {
        ...form.openings,
        windows: {
          status,
          items:
            status === "NO"
              ? []
              : form.openings.windows.items.length
                ? form.openings.windows.items
                : [window]
        }
      },
      fixtures: {
        ...form.fixtures,
        sink: { ...form.fixtures.sink, relation: sinkRelation }
      }
    });
  };
  return (
    <Step title="2. Openings">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Any doors or open passages?"
          value={form.openings.doors.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={setDoorStatus}
        />
        {form.openings.doors.status !== "NO" && (
          <>
            <SelectField
              label="Door or open passage?"
              value={door.kind ?? "DOOR"}
              options={doorKindOptions}
              onChange={(value) => {
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    doors: {
                      ...form.openings.doors,
                      items: [{ ...door, kind: value }]
                    }
                  }
                });
              }}
            />
            <SelectField
              label="Door / opening wall"
              value={door.location}
              options={wallPositionOptions}
              onChange={(value) => {
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    doors: {
                      ...form.openings.doors,
                      items: [{ ...door, location: value }]
                    }
                  }
                });
                setPositionOverrides?.((prev) => {
                  const next = { ...prev };
                  delete next["door"];
                  return next;
                });
              }}
            />
          </>
        )}
        <SelectField
          label="Any windows in or near the kitchen?"
          value={form.openings.windows.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={setWindowStatus}
        />
        {form.openings.windows.status !== "NO" && (
          <>
            <SelectField
              label="Window approximate relation"
              value={window.relation}
              options={wallPositionOptions}
              onChange={(value) => {
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    windows: {
                      ...form.openings.windows,
                      items: [{ ...window, relation: value }]
                    }
                  }
                });
                setPositionOverrides?.((prev) => {
                  const next = { ...prev };
                  delete next["window"];
                  return next;
                });
              }}
            />
          </>
        )}
      </div>
    </Step>
  );
}

export function MepStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  return (
    <Step title="3. MEP">
      <div className="grid gap-4 sm:grid-cols-2">
        {(["water", "gas", "electric", "vent"] as const).map((key) => (
          <SelectField
            key={key}
            label={`${key} movable?`}
            value={form.mep[key].movable}
            options={["UNKNOWN", "YES", "NO"]}
            onChange={(value) =>
              setForm({
                ...form,
                mep: {
                  ...form.mep,
                  [key]: { ...form.mep[key], movable: value as "YES" | "NO" | "UNKNOWN" }
                }
              })
            }
          />
        ))}
      </div>
    </Step>
  );
}

export function LayoutStep({
  form,
  setForm,
  setPositionOverrides
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
  setPositionOverrides: Dispatch<SetStateAction<PositionOverrides>>;
}) {
  return (
    <Step title="3. Layout Preference">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Kitchen shape"
          value={displayLayoutPreference(form.layoutPreference)}
          options={layoutPreferenceOptions}
          onChange={(value) => {
            const newLayout = value as Round1FormInput["layoutPreference"];
            const currentIslandStatus = islandStatusForForm(form);
            setForm({
              ...form,
              layoutPreference: newLayout,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                island: {
                  ...form.layoutSensitiveCabinets.island,
                  status: currentIslandStatus,
                  requested: currentIslandStatus === "YES"
                }
              }
            });
            setPositionOverrides((prev) => {
              const allowed = allowedDragWallsForLayout(newLayout);
              const next: PositionOverrides = {};
              for (const [k, v] of Object.entries(prev)) {
                if (k === "door" || k === "window" || allowed.includes(v.wall)) {
                  next[k] = v;
                }
              }
              return next;
            });
          }}
        />
        <SelectField
          label="Need island?"
          value={islandStatusForForm(form)}
          options={["YES", "NO", "UNKNOWN"] as const}
          onChange={(status) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                island: {
                  ...form.layoutSensitiveCabinets.island,
                  status,
                  requested: status === "YES"
                }
              }
            })
          }
        />
      </div>
    </Step>
  );
}

export function AppliancesStep({
  form,
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  const cooking = form.layoutSensitiveCabinets.cookingAppliances || {
    range: { status: "YES" as const, relation: "BACK_SIDE" as const },
    cooktop: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
    wallOven: { status: "NO" as const, relation: "NOT_APPLICABLE" as const },
    microwaveOvenCombo: { status: "UNKNOWN" as const, relation: "UNKNOWN" as const }
  };
  const setCookingAppliance = (
    key: keyof Round1FormInput["layoutSensitiveCabinets"]["cookingAppliances"],
    update: Partial<
      Round1FormInput["layoutSensitiveCabinets"]["cookingAppliances"][typeof key]
    >
  ) => {
    setForm({
      ...form,
      layoutSensitiveCabinets: {
        ...form.layoutSensitiveCabinets,
        cookingAppliances: {
          ...cooking,
          [key]: {
            ...cooking[key],
            ...update
          }
        }
      }
    });
  };
  const setCookingStatus = (
    key: keyof Round1FormInput["layoutSensitiveCabinets"]["cookingAppliances"],
    status: "YES" | "NO" | "UNKNOWN"
  ) => {
    const relation =
      status === "NO"
        ? "NOT_APPLICABLE"
        : cooking[key].relation === "NOT_APPLICABLE"
          ? "UNKNOWN"
          : cooking[key].relation;
    let nextCooking = {
      ...cooking,
      [key]: { ...cooking[key], status, relation }
    };
    // Range and cooktop are mutually exclusive primary cooking surfaces: a range
    // is burners + oven, a cooktop is burners only. Choosing one clears the other.
    if (status === "YES" && (key === "range" || key === "cooktop")) {
      const other = key === "range" ? "cooktop" : "range";
      nextCooking = {
        ...nextCooking,
        [other]: { ...cooking[other], status: "NO", relation: "NOT_APPLICABLE" }
      };
    }
    let ovenMicrowave = form.layoutSensitiveCabinets.ovenMicrowave;
    if (key === "wallOven" || key === "microwaveOvenCombo") {
      const wStatus = key === "wallOven" ? status : cooking.wallOven.status;
      const mStatus =
        key === "microwaveOvenCombo" ? status : cooking.microwaveOvenCombo.status;

      let newConfig = ovenMicrowave.configuration;

      if (wStatus === "YES" && mStatus === "YES") {
        if (
          newConfig !== "WALL_OVEN_MICROWAVE_STACK" &&
          newConfig !== "SEPARATE_WALL_OVEN_AND_MICROWAVE"
        ) {
          newConfig = "UNKNOWN";
        }
      } else {
        newConfig = "UNKNOWN";
      }

      ovenMicrowave = {
        ...ovenMicrowave,
        configuration: newConfig,
        relation: "UNKNOWN" as const
      };
    }
    setForm({
      ...form,
      layoutSensitiveCabinets: {
        ...form.layoutSensitiveCabinets,
        ovenMicrowave,
        cookingAppliances: nextCooking
      }
    });
  };
  const setOvenMicrowaveArrangement = (
    configuration: OvenMicrowaveArrangement
  ) => {
    const arrangementCooking = {
      WALL_OVEN_MICROWAVE_STACK: {
        wallOven: { status: "YES" as const, relation: "UNKNOWN" as const },
        microwaveOvenCombo: {
          status: "YES" as const,
          relation: "UNKNOWN" as const
        }
      },
      SEPARATE_WALL_OVEN_AND_MICROWAVE: {
        wallOven: { status: "YES" as const, relation: "UNKNOWN" as const },
        microwaveOvenCombo: {
          status: "YES" as const,
          relation: "UNKNOWN" as const
        }
      },
      UNKNOWN: {
        wallOven: cooking.wallOven,
        microwaveOvenCombo: cooking.microwaveOvenCombo
      }
    } satisfies Record<
      OvenMicrowaveArrangement,
      Pick<typeof cooking, "wallOven" | "microwaveOvenCombo">
    >;

    setForm({
      ...form,
      layoutSensitiveCabinets: {
        ...form.layoutSensitiveCabinets,
        ovenMicrowave: {
          ...form.layoutSensitiveCabinets.ovenMicrowave,
          configuration,
          relation: "UNKNOWN"
        },
        cookingAppliances: {
          ...cooking,
          ...arrangementCooking[configuration]
        }
      }
    });
  };
  const showOvenMicrowaveArrangement =
    cooking.wallOven.status === "YES" &&
    cooking.microwaveOvenCombo.status === "YES";

  return (
    <Step title="4. Core Appliances And Fixtures">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sink included?"
          value={form.fixtures.sink.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                sink: { ...form.fixtures.sink, status: value as "YES" | "NO" | "UNKNOWN" }
              }
            })
          }
        />
        <RoughApplianceFields
          label="Range"
          value={cooking.range}
          onStatusChange={(status) => setCookingStatus("range", status)}
          onRelationChange={(relation) =>
            setCookingAppliance("range", { relation })
          }
        />
        <RoughApplianceFields
          label="Cooktop"
          value={cooking.cooktop}
          onStatusChange={(status) => setCookingStatus("cooktop", status)}
          onRelationChange={(relation) =>
            setCookingAppliance("cooktop", { relation })
          }
        />
        <RoughApplianceFields
          label="Wall oven"
          value={cooking.wallOven}
          onStatusChange={(status) => setCookingStatus("wallOven", status)}
          onRelationChange={(relation) =>
            setCookingAppliance("wallOven", { relation })
          }
        />
        <RoughApplianceFields
          label="Built-in microwave"
          value={cooking.microwaveOvenCombo}
          onStatusChange={(status) =>
            setCookingStatus("microwaveOvenCombo", status)
          }
          onRelationChange={(relation) =>
            setCookingAppliance("microwaveOvenCombo", { relation })
          }
        />
        {showOvenMicrowaveArrangement && (
          <SelectField
            label="Oven and microwave arrangement?"
            value={displayOvenMicrowaveArrangement(
              form.layoutSensitiveCabinets.ovenMicrowave.configuration
            )}
            options={ovenMicrowaveArrangementOptions}
            onChange={setOvenMicrowaveArrangement}
          />
        )}
        <SelectField
          label="Fridge included?"
          value={form.fixtures.fridge.status}
          options={["YES", "NO", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                fridge: { ...form.fixtures.fridge, status: value as "YES" | "NO" | "UNKNOWN" }
              }
            })
          }
        />
        <SelectField
          label="Dishwasher included?"
          value={form.fixtures.dishwasher.status}
          options={["YES", "NONE", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                dishwasher: {
                  ...form.fixtures.dishwasher,
                  status: value as "YES" | "NONE" | "UNKNOWN",
                  size: value === "NONE" ? null : form.fixtures.dishwasher.size,
                  relation:
                    value === "NONE"
                      ? "NOT_APPLICABLE"
                      : form.fixtures.dishwasher.relation === "NOT_APPLICABLE"
                        ? "NEAR_SINK"
                        : form.fixtures.dishwasher.relation
                }
              }
            })
          }
        />
      </div>
    </Step>
  );
}

function RoughApplianceFields({
  label,
  value,
  onStatusChange,
  onRelationChange
}: {
  label: string;
  value: { status: "YES" | "NO" | "UNKNOWN"; relation: string };
  onStatusChange: (status: "YES" | "NO" | "UNKNOWN") => void;
  onRelationChange: (relation: (typeof applianceWallOptions)[number]) => void;
}) {
  return (
    <SelectField
      label={`${label} included?`}
      value={value.status}
      options={["YES", "NO", "UNKNOWN"]}
      onChange={onStatusChange}
    />
  );
}

export function AdjustPositionsStep({
  onReset,
  onConfirmPositions,
  hasOverrides,
  fixedPositionsConfirmed,
  cabinetFillGenerated
}: {
  onReset: () => void;
  onConfirmPositions: () => void;
  hasOverrides: boolean;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
  return (
    <Step title="5. Adjust Positions">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cabinetFillGenerated ? (
            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Cabinet fill generated
            </span>
          ) : fixedPositionsConfirmed ? (
            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Fixed positions confirmed
            </span>
          ) : hasOverrides ? (
            <span className="rounded bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              Adjusted manually
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onReset}
          disabled={!hasOverrides && !fixedPositionsConfirmed && !cabinetFillGenerated}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset Positions
        </button>
        <button
          type="button"
          onClick={onConfirmPositions}
          disabled={fixedPositionsConfirmed}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {fixedPositionsConfirmed
            ? "Fixed Positions Confirmed"
            : "Confirm Fixed Positions"}
        </button>
      </div>
    </Step>
  );
}
