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

const appliancePositionOptions = [
  "UNDER_WINDOW",
  "ON_MAIN_RUN",
  "FRONT_SIDE",
  "LEFT_SIDE",
  "RIGHT_SIDE",
  "BACK_SIDE",
  "NEAR_SINK",
  "NEAR_RANGE",
  "NEAR_FRIDGE",
  "ON_ISLAND",
  "NO_PREFERENCE",
  "UNKNOWN"
] as const;

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
  setForm
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
}) {
  const door = form.openings.doors.items[0] ?? {
    location: "FRONT_SIDE" as const,
    width: null
  };
  const window = form.openings.windows.items[0] ?? {
    relation: "BEHIND_SINK" as const,
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
              label="Door / opening wall"
              value={door.location}
              options={["FRONT_SIDE", "LEFT_SIDE", "RIGHT_SIDE", "BACK_SIDE", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    doors: {
                      ...form.openings.doors,
                      items: [{ ...door, location: value }]
                    }
                  }
                })
              }
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
              options={["BEHIND_SINK", "UNDER_WINDOW", "BACK_SIDE", "LEFT_SIDE", "RIGHT_SIDE", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  openings: {
                    ...form.openings,
                    windows: {
                      ...form.openings.windows,
                      items: [{ ...window, relation: value }]
                    }
                  }
                })
              }
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
      <SelectField
        label="Kitchen shape"
        value={form.layoutPreference}
        options={[
          "ONE_WALL",
          "L_SHAPE",
          "U_SHAPE",
          "GALLEY",
          "PENINSULA",
          "ISLAND",
          "L_SHAPE_ISLAND",
          "U_SHAPE_ISLAND",
          "NO_PREFERENCE"
        ]}
        onChange={(value) => {
          const newLayout = value as Round1FormInput["layoutPreference"];
          setForm({ ...form, layoutPreference: newLayout });
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
  return (
    <Step title="4. Core Appliances And Fixtures">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Sink size"
          value={String(form.fixtures.sink.size ?? "UNKNOWN")}
          options={["30", "33", "36", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                sink: { ...form.fixtures.sink, size: parseNullableSize(value) as 30 | 33 | 36 | null }
              }
            })
          }
        />
        <SelectField
          label="Range size"
          value={String(form.fixtures.range.size ?? "UNKNOWN")}
          options={["30", "36", "48", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                range: { ...form.fixtures.range, size: parseNullableSize(value) as 30 | 36 | 48 | null }
              }
            })
          }
        />
        <SelectField
          label="Range fixed location?"
          value={form.fixtures.range.fixedLocation}
          options={["UNKNOWN", "YES", "NO"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                range: {
                  ...form.fixtures.range,
                  fixedLocation: value as "YES" | "NO" | "UNKNOWN"
                }
              }
            })
          }
        />
        <SelectField
          label="Fridge size"
          value={String(form.fixtures.fridge.size ?? "UNKNOWN")}
          options={["30", "33", "36", "42", "48", "UNKNOWN"]}
          onChange={(value) =>
            setForm({
              ...form,
              fixtures: {
                ...form.fixtures,
                fridge: { ...form.fixtures.fridge, size: parseNullableSize(value) as 30 | 33 | 36 | 42 | 48 | null }
              }
            })
          }
        />
        <SelectField
          label="Dishwasher status"
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
        {form.fixtures.dishwasher.status !== "NONE" && (
          <>
            <SelectField
              label="Dishwasher size"
              value={String(form.fixtures.dishwasher.size ?? "UNKNOWN")}
              options={["18", "24", "UNKNOWN"]}
              onChange={(value) =>
                setForm({
                  ...form,
                  fixtures: {
                    ...form.fixtures,
                    dishwasher: {
                      ...form.fixtures.dishwasher,
                      size: parseNullableSize(value) as 18 | 24 | null
                    }
                  }
                })
              }
            />
          </>
        )}
        <SelectField
          label="Oven / microwave"
          value={form.layoutSensitiveCabinets.ovenMicrowave.configuration}
          options={[
            "RANGE_INCLUDES_OVEN",
            "WALL_OVEN_MICROWAVE_STACK",
            "MICROWAVE_DRAWER",
            "UPPER_CABINET_MICROWAVE",
            "COUNTERTOP_MICROWAVE",
            "NO_MICROWAVE",
            "NO_OVEN",
            "UNKNOWN"
          ]}
          onChange={(value) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                ovenMicrowave: {
                  ...form.layoutSensitiveCabinets.ovenMicrowave,
                  configuration: value as Round1FormInput["layoutSensitiveCabinets"]["ovenMicrowave"]["configuration"]
                }
              }
            })
          }
        />
        <SelectField
          label="Oven / microwave position"
          value={form.layoutSensitiveCabinets.ovenMicrowave.relation}
          options={appliancePositionOptions}
          onChange={(value) =>
            setForm({
              ...form,
              layoutSensitiveCabinets: {
                ...form.layoutSensitiveCabinets,
                ovenMicrowave: {
                  ...form.layoutSensitiveCabinets.ovenMicrowave,
                  relation: value
                }
              }
            })
          }
        />
      </div>
    </Step>
  );
}

export function AdjustPositionsStep({
  onHighlight,
  onReset,
  onConfirmPositions,
  onGenerateCabinetFill,
  hasOverrides,
  fixedPositionsConfirmed,
  cabinetFillGenerated
}: {
  onHighlight: () => void;
  onReset: () => void;
  onConfirmPositions: () => void;
  onGenerateCabinetFill: () => void;
  hasOverrides: boolean;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
  const primaryAction = fixedPositionsConfirmed
    ? onGenerateCabinetFill
    : onConfirmPositions;
  const primaryLabel = !fixedPositionsConfirmed
    ? "Confirm Fixed Positions"
    : cabinetFillGenerated
      ? "Cabinet Fill Generated"
      : "Generate Cabinet Fill";

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
          onClick={onHighlight}
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
        >
          Highlight Draggable Items
        </button>
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
          onClick={primaryAction}
          disabled={cabinetFillGenerated}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {primaryLabel}
        </button>
      </div>
    </Step>
  );
}
