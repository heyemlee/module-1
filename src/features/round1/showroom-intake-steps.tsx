import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { type Round1FormInput } from "@/domain/round1";
import {
  allowedDragWallsForLayout,
  type PositionOverrides
} from "./floorplan/plan-geometry";
import {
  NumberField,
  SelectField,
  Step
} from "./showroom-intake-controls";

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
    <Step>
      <div className="grid gap-4">
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

  // Drop a stale drag override when an opening is removed; the wall/position is
  // now set by dragging the opening on the floor plan (design model).
  const clearOverride = (key: "door" | "window") =>
    setPositionOverrides?.((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const doorOn = form.openings.doors.status === "YES";
  const windowOn = form.openings.windows.status === "YES";

  const toggles = [
    {
      key: "door" as const,
      label: "Door",
      on: doorOn,
      toggle: () => {
        const next = doorOn ? "NO" : "YES";
        setDoorStatus(next);
        if (next === "NO") clearOverride("door");
      }
    },
    {
      key: "window" as const,
      label: "Window",
      on: windowOn,
      toggle: () => {
        const next = windowOn ? "NO" : "YES";
        setWindowStatus(next);
        if (next === "NO") clearOverride("window");
      }
    }
  ];

  return (
    <Step>
      <p className="studio-eyebrow mb-3">Openings</p>
      <div className="flex flex-col gap-[7px]">
        {toggles.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.toggle}
            aria-pressed={item.on}
            data-opening={item.key}
            className={cn(
              "flex items-center gap-3 rounded-[14px] px-[13px] py-[11px] text-left transition-colors",
              item.on
                ? "border border-white/85 bg-white/[0.72] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]"
                : "border border-white/55 bg-white/40 hover:bg-white/55"
            )}
          >
            <span className="flex-1 text-[13.5px] font-medium text-[#16161a]">
              {item.label}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex size-[18px] items-center justify-center rounded-[6px] text-[11px] leading-none text-white",
                item.on
                  ? "border border-[#1a1a1c] bg-[#1a1a1c]"
                  : "border border-[#cacac4] bg-white"
              )}
            >
              {item.on ? "✓" : ""}
            </span>
          </button>
        ))}
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
    <Step>
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

// Base-layout glyph tiles (design BASE LAYOUT). Maps to the existing
// layoutPreference options; the form's NO_PREFERENCE default simply shows no
// tile selected until the rep picks one.
const LAYOUT_OPTIONS = [
  { value: "LEFT_L_SHAPE", label: "L · Left", glyph: "⌐" },
  { value: "RIGHT_L_SHAPE", label: "L · Right", glyph: "¬" },
  { value: "U_SHAPE", label: "U-shape", glyph: "⊔" },
  { value: "ONE_WALL", label: "Single wall", glyph: "—" },
  { value: "GALLEY", label: "Galley", glyph: "=" },
  { value: "PENINSULA", label: "Peninsula", glyph: "⊏" }
] as const;

const ISLAND_OPTIONS = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "UNKNOWN", label: "Unsure" }
] as const;

const OVEN_PLACEMENT_OPTIONS = [
  { value: "WALL_OVEN_MICROWAVE_STACK", label: "Stacked" },
  { value: "SEPARATE_WALL_OVEN_AND_MICROWAVE", label: "Separate" }
] as const;

export function LayoutStep({
  form,
  setForm,
  setPositionOverrides
}: {
  form: Round1FormInput;
  setForm: (form: Round1FormInput) => void;
  setPositionOverrides: Dispatch<SetStateAction<PositionOverrides>>;
}) {
  const currentLayout = displayLayoutPreference(form.layoutPreference);
  const islandStatus = islandStatusForForm(form);

  const pickLayout = (value: (typeof layoutPreferenceOptions)[number]) => {
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
        if (
          k === "door" ||
          k === "window" ||
          k === "island" ||
          (v.wall !== undefined && allowed.includes(v.wall))
        ) {
          next[k] = v;
        }
      }
      return next;
    });
  };

  const setIsland = (status: "YES" | "NO" | "UNKNOWN") => {
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
    });
  };

  return (
    <Step>
      <p className="studio-eyebrow mb-2.5">Base layout</p>
      <div className="mb-[22px] grid grid-cols-2 gap-2">
        {LAYOUT_OPTIONS.map((option) => {
          const active = currentLayout === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-layout={option.value}
              aria-pressed={active}
              onClick={() => pickLayout(option.value)}
              className={cn(
                "flex items-center gap-2.5 rounded-[14px] border px-3.5 py-[13px] text-left transition-colors",
                active
                  ? "border-[#1a1a1c] bg-[#1a1a1c] text-white shadow-[0_10px_22px_-12px_rgba(20,20,26,0.5)]"
                  : "border-white/[0.78] bg-white/55 text-[#16161a] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] hover:bg-white/70"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "w-[22px] text-center text-[18px] leading-none",
                  active ? "text-white" : "text-[#86867f]"
                )}
              >
                {option.glyph}
              </span>
              <span className="text-[12.5px] font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="studio-eyebrow mb-2.5">Center island</p>
      <div className="inline-flex overflow-hidden rounded-[11px] border border-white/80 bg-white/55">
        {ISLAND_OPTIONS.map((option, index) => {
          const active = islandStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              data-island={option.value}
              aria-pressed={active}
              onClick={() => setIsland(option.value)}
              className={cn(
                "px-4 py-[9px] text-[12.5px] font-medium transition-colors",
                index > 0 && "border-l border-[rgba(20,20,26,0.08)]",
                active
                  ? "bg-[#1a1a1c] text-white"
                  : "bg-transparent text-[#6a6a64] hover:text-[#16161a]"
              )}
            >
              {option.label}
            </button>
          );
        })}
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

  const setFixtureStatus = (key: "sink" | "fridge", status: "YES" | "NO") =>
    setForm({
      ...form,
      fixtures: {
        ...form.fixtures,
        [key]: { ...form.fixtures[key], status }
      }
    });

  const setDishwasher = (status: "YES" | "NONE") =>
    setForm({
      ...form,
      fixtures: {
        ...form.fixtures,
        dishwasher: {
          ...form.fixtures.dishwasher,
          status,
          size: status === "NONE" ? null : form.fixtures.dishwasher.size,
          relation:
            status === "NONE"
              ? "NOT_APPLICABLE"
              : form.fixtures.dishwasher.relation === "NOT_APPLICABLE"
                ? "NEAR_SINK"
                : form.fixtures.dishwasher.relation
        }
      }
    });

  // Design "APPLIANCES PRESENT" rows. Each toggle flips the existing per-item
  // status (YES/NO; dishwasher uses NONE), preserving range/cooktop exclusion
  // and the oven+microwave arrangement state machine via the shared setters.
  const applianceRows: {
    key: string;
    code: string;
    label: string;
    note: string;
    on: boolean;
    toggle: () => void;
  }[] = [
    {
      key: "sink",
      code: "SK",
      label: "Sink",
      note: "",
      on: form.fixtures.sink.status === "YES",
      toggle: () =>
        setFixtureStatus(
          "sink",
          form.fixtures.sink.status === "YES" ? "NO" : "YES"
        )
    },
    {
      key: "dishwasher",
      code: "DW",
      label: "Dishwasher",
      note: "",
      on: form.fixtures.dishwasher.status === "YES",
      toggle: () =>
        setDishwasher(form.fixtures.dishwasher.status === "YES" ? "NONE" : "YES")
    },
    {
      key: "fridge",
      code: "RF",
      label: "Refrigerator",
      note: "",
      on: form.fixtures.fridge.status === "YES",
      toggle: () =>
        setFixtureStatus(
          "fridge",
          form.fixtures.fridge.status === "YES" ? "NO" : "YES"
        )
    },
    {
      key: "range",
      code: "RG",
      label: "Range (with oven)",
      note: "excl. cooktop",
      on: cooking.range.status === "YES",
      toggle: () =>
        setCookingStatus("range", cooking.range.status === "YES" ? "NO" : "YES")
    },
    {
      key: "cooktop",
      code: "CT",
      label: "Cooktop",
      note: "excl. range",
      on: cooking.cooktop.status === "YES",
      toggle: () =>
        setCookingStatus(
          "cooktop",
          cooking.cooktop.status === "YES" ? "NO" : "YES"
        )
    },
    {
      key: "wallOven",
      code: "OV",
      label: "Wall oven",
      note: "tall",
      on: cooking.wallOven.status === "YES",
      toggle: () =>
        setCookingStatus(
          "wallOven",
          cooking.wallOven.status === "YES" ? "NO" : "YES"
        )
    },
    {
      key: "microwave",
      code: "MW",
      label: "Built-in microwave",
      note: "",
      on: cooking.microwaveOvenCombo.status === "YES",
      toggle: () =>
        setCookingStatus(
          "microwaveOvenCombo",
          cooking.microwaveOvenCombo.status === "YES" ? "NO" : "YES"
        )
    }
  ];

  const ovenArrangement = displayOvenMicrowaveArrangement(
    form.layoutSensitiveCabinets.ovenMicrowave.configuration
  );

  return (
    <Step>
      <p className="studio-eyebrow mb-3">Appliances present</p>
      <div className="flex flex-col gap-[7px]">
        {applianceRows.map((row) => (
          <button
            key={row.key}
            type="button"
            data-appl={row.key}
            aria-pressed={row.on}
            onClick={row.toggle}
            className={cn(
              "flex items-center gap-3 rounded-[14px] px-[13px] py-[11px] text-left transition-colors",
              row.on
                ? "border border-white/85 bg-white/[0.72] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset]"
                : "border border-white/55 bg-white/40 hover:bg-white/55"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-[18px] items-center justify-center rounded-[6px] text-[11px] leading-none text-white",
                row.on
                  ? "border border-[#1a1a1c] bg-[#1a1a1c]"
                  : "border border-[#cacac4] bg-white"
              )}
            >
              {row.on ? "✓" : ""}
            </span>
            <span className="w-[30px] font-mono text-[10px] tracking-[0.08em] text-[#9a9a94]">
              {row.code}
            </span>
            <span className="flex-1 text-[13.5px] font-medium text-[#16161a]">
              {row.label}
            </span>
            {row.note && (
              <span className="text-[11px] text-[#aaaaa4]">{row.note}</span>
            )}
          </button>
        ))}
      </div>

      {showOvenMicrowaveArrangement && (
        <div className="mt-4 rounded-[14px] border border-white/80 bg-white/50 px-3.5 py-[13px]">
          <p className="mb-2.5 text-[12.5px] font-medium text-[#16161a]">
            Wall oven + microwave placement
          </p>
          <div className="inline-flex overflow-hidden rounded-[10px] border border-white/80 bg-white/55">
            {OVEN_PLACEMENT_OPTIONS.map((option, index) => {
              const active = ovenArrangement === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-oven={option.value}
                  aria-pressed={active}
                  onClick={() => setOvenMicrowaveArrangement(option.value)}
                  className={cn(
                    "px-3.5 py-2 text-[12px] transition-colors",
                    index > 0 && "border-l border-[rgba(20,20,26,0.08)]",
                    active
                      ? "bg-[#1a1a1c] text-white"
                      : "bg-transparent text-[#6a6a64] hover:text-[#16161a]"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Step>
  );
}

export function AdjustPositionsStep({
  hasOverrides,
  fixedPositionsConfirmed,
  cabinetFillGenerated
}: {
  hasOverrides: boolean;
  fixedPositionsConfirmed: boolean;
  cabinetFillGenerated: boolean;
}) {
  const pill =
    "rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em]";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {cabinetFillGenerated ? (
          <span className={`${pill} bg-studio-ink text-white`}>
            Cabinet fill generated
          </span>
        ) : fixedPositionsConfirmed ? (
          <span className={`${pill} bg-studio-ink text-white`}>
            Fixed positions confirmed
          </span>
        ) : hasOverrides ? (
          <span className={`${pill} border border-studio-ink/20 text-studio-ink`}>
            Adjusted manually
          </span>
        ) : null}
      </div>
    </div>
  );
}
