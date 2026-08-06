import type {
  CabinetKind,
  CabinetStyle,
  Round1FormInput,
  Round1RenderingPreferences,
  Round1TierColorIds
} from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

export const DEFAULT_RENDERING_PREFERENCES: Round1RenderingPreferences = {
  cabinetStyle: "EUROPEAN_FRAMELESS",
  doorColorId: null
};

export const EMPTY_TIER_COLOR_IDS: Round1TierColorIds = {
  BASE: null,
  WALL: null,
  TALL: null
};

/**
 * Cabinet types a designer can paint separately in the concept rendering.
 * The order is the one the UI shows AND the order material swatches are sent
 * to the image model, so the prompt's reference numbering stays predictable.
 */
export const CABINET_TIERS: {
  kind: CabinetKind;
  label: string;
  hint: string;
}[] = [
  { kind: "BASE", label: "Base cabinets", hint: "LOWER RUN" },
  { kind: "WALL", label: "Wall cabinets", hint: "UPPERS" },
  { kind: "TALL", label: "Tall cabinets", hint: "PANTRY / OVEN" }
];

export const CABINET_TIER_LABELS: Record<CabinetKind, string> = {
  BASE: "base cabinets",
  WALL: "wall (upper) cabinets",
  TALL: "tall (pantry and appliance) cabinets"
};

export type RenderingPreferenceStamp = {
  cabinetStyle: Round1RenderingPreferences["cabinetStyle"];
  doorColorId: string | null;
  colorUpdatedAt?: string | null;
  /**
   * Effective per-tier overrides at generation time. A tier that resolved to
   * the main door color is stored as `null`, so a single-color project stamps
   * the same all-null shape whether or not the designer ever opened the
   * per-type section.
   */
  tierColorIds?: Round1TierColorIds | null;
};

export const CABINET_STYLE_LABELS: Record<CabinetStyle, string> = {
  EUROPEAN_FRAMELESS: "Frameless",
  AMERICAN_FRAMED: "Framed"
};

export function renderingPreferencesForForm(form: Round1FormInput) {
  return form.renderingPreferences ?? DEFAULT_RENDERING_PREFERENCES;
}

export function tierColorIdsForForm(form: Round1FormInput): Round1TierColorIds {
  return {
    ...EMPTY_TIER_COLOR_IDS,
    ...(renderingPreferencesForForm(form).tierColorIds ?? {})
  };
}

export function activeColorsForStyle(
  colors: CabinetColor[],
  style: CabinetStyle
) {
  return colors
    .filter((color) => color.active && color.cabinetStyle === style)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function selectedRenderingColor(
  colors: CabinetColor[],
  form: Round1FormInput
) {
  const id = renderingPreferencesForForm(form).doorColorId;
  if (!id) return null;
  return colors.find((color) => color.id === id) ?? null;
}

/**
 * The override a designer picked for one cabinet type, or `null` when that type
 * follows the main door color. A stored id that no longer resolves to an active
 * color of the current style (the admin retired it after it was picked) reads
 * as "follows the main color" here and everywhere downstream — a decorative
 * override must never be the thing that blocks a rendering.
 */
export function selectedTierColor(
  colors: CabinetColor[],
  form: Round1FormInput,
  kind: CabinetKind
): CabinetColor | null {
  const id = tierColorIdsForForm(form)[kind];
  if (!id) return null;
  const style = renderingPreferencesForForm(form).cabinetStyle;
  const color = colors.find((entry) => entry.id === id);
  if (!color || !color.active || color.cabinetStyle !== style) return null;
  return color;
}

export type RenderingColorPlan = {
  /** Main door color — what a single-color project renders everywhere. */
  primary: CabinetColor;
  /** The color each cabinet type actually renders in (override or primary). */
  byTier: Record<CabinetKind, CabinetColor>;
  /** Only the types the designer explicitly repainted. */
  overrides: Partial<Record<CabinetKind, CabinetColor>>;
  /** True when the rendering uses more than one door color. */
  multiColor: boolean;
  /** Distinct colors used, primary first, then tier order. */
  uniqueColors: CabinetColor[];
};

export function buildRenderingColorPlan(input: {
  primary: CabinetColor;
  tierColors?: Partial<Record<CabinetKind, CabinetColor | null>>;
}): RenderingColorPlan {
  const overrides: Partial<Record<CabinetKind, CabinetColor>> = {};
  const byTier = {} as Record<CabinetKind, CabinetColor>;

  for (const { kind } of CABINET_TIERS) {
    const override = input.tierColors?.[kind] ?? null;
    // An override that just repeats the main color is not an override.
    if (override && override.id !== input.primary.id) {
      overrides[kind] = override;
      byTier[kind] = override;
    } else {
      byTier[kind] = input.primary;
    }
  }

  const uniqueColors: CabinetColor[] = [input.primary];
  for (const { kind } of CABINET_TIERS) {
    const color = byTier[kind];
    if (!uniqueColors.some((entry) => entry.id === color.id)) {
      uniqueColors.push(color);
    }
  }

  return {
    primary: input.primary,
    byTier,
    overrides,
    multiColor: uniqueColors.length > 1,
    uniqueColors
  };
}

export function resolveRenderingColorPlan(
  colors: CabinetColor[],
  form: Round1FormInput
): RenderingColorPlan | null {
  const primary = selectedRenderingColor(colors, form);
  if (!primary) return null;
  return buildRenderingColorPlan({
    primary,
    tierColors: {
      BASE: selectedTierColor(colors, form, "BASE"),
      WALL: selectedTierColor(colors, form, "WALL"),
      TALL: selectedTierColor(colors, form, "TALL")
    }
  });
}

/** Effective overrides, with "same as main" normalized to null. */
export function effectiveTierColorIds(
  plan: RenderingColorPlan | null
): Round1TierColorIds {
  if (!plan) return { ...EMPTY_TIER_COLOR_IDS };
  return {
    BASE: plan.overrides.BASE?.id ?? null,
    WALL: plan.overrides.WALL?.id ?? null,
    TALL: plan.overrides.TALL?.id ?? null
  };
}

export type RenderingReferenceRole =
  | "PERSPECTIVE_STRUCTURE"
  | "TOP_DOWN_PLAN"
  | "MATERIAL_SWATCH"
  | "MATERIAL_SWATCH_BASE"
  | "MATERIAL_SWATCH_WALL"
  | "MATERIAL_SWATCH_TALL";

export const MATERIAL_SWATCH_ROLES: RenderingReferenceRole[] = [
  "MATERIAL_SWATCH",
  "MATERIAL_SWATCH_BASE",
  "MATERIAL_SWATCH_WALL",
  "MATERIAL_SWATCH_TALL"
];

export type RenderingSwatchGroup = {
  role: RenderingReferenceRole;
  /** Cabinet types this swatch governs. */
  tiers: CabinetKind[];
  color: CabinetColor;
};

/** Cabinet types bucketed by the color they render in, in tier order. */
export function groupTiersByColor(plan: RenderingColorPlan) {
  const groups: { tiers: CabinetKind[]; color: CabinetColor }[] = [];
  for (const { kind } of CABINET_TIERS) {
    const color = plan.byTier[kind];
    const existing = groups.find((group) => group.color.id === color.id);
    if (existing) existing.tiers.push(kind);
    else groups.push({ tiers: [kind], color });
  }
  return groups;
}

/**
 * The material swatches to send with a rendering, in reference order.
 *
 * Single-color projects keep sending exactly one `MATERIAL_SWATCH`, so nothing
 * changes for them. Multi-color projects send one swatch per distinct color,
 * carried by the first cabinet type that uses it, so two types sharing a color
 * never pay for the same image twice. Colors with no swatch image fall back to
 * the text prompt and are simply absent here.
 */
export function renderingSwatchGroups(
  plan: RenderingColorPlan
): RenderingSwatchGroup[] {
  if (!plan.multiColor) {
    return plan.primary.swatchImageUrl
      ? [
          {
            role: "MATERIAL_SWATCH",
            tiers: CABINET_TIERS.map((tier) => tier.kind),
            color: plan.primary
          }
        ]
      : [];
  }

  return groupTiersByColor(plan)
    .map((group) => ({
      role: `MATERIAL_SWATCH_${group.tiers[0]}` as RenderingReferenceRole,
      ...group
    }))
    .filter((group) => Boolean(group.color.swatchImageUrl));
}

export function nextRenderingPreferencesForStyle(
  form: Round1FormInput,
  colors: CabinetColor[],
  style: CabinetStyle
): Round1RenderingPreferences {
  const currentColor = selectedRenderingColor(colors, form);
  const keepColor = (color: CabinetColor | null) =>
    color && color.active && color.cabinetStyle === style ? color.id : null;
  const tierColorIds = tierColorIdsForForm(form);

  return {
    ...renderingPreferencesForForm(form),
    cabinetStyle: style,
    doorColorId: keepColor(currentColor),
    // Colors are style-specific, so overrides picked for the other style are
    // dropped rather than silently carried into an incompatible catalog.
    tierColorIds: {
      BASE: keepColor(colors.find((c) => c.id === tierColorIds.BASE) ?? null),
      WALL: keepColor(colors.find((c) => c.id === tierColorIds.WALL) ?? null),
      TALL: keepColor(colors.find((c) => c.id === tierColorIds.TALL) ?? null)
    }
  };
}

/**
 * Sets one cabinet type's color (`null` = follow the shared fallback).
 *
 * While this is the only cabinet type with a color of its own, it defines the
 * whole kitchen: it also becomes the fallback color, so the types the designer
 * has not picked yet follow it rather than some earlier single-color choice.
 * Once a second type is picked they diverge normally. This keeps per-type
 * coloring self-contained — one pick is enough to lock and render, with no
 * detour back through the single-color swatch.
 */
export function preferencesWithTierColor(
  form: Round1FormInput,
  kind: CabinetKind,
  color: CabinetColor | null
): Round1RenderingPreferences {
  const preferences = renderingPreferencesForForm(form);
  const tierColorIds = { ...tierColorIdsForForm(form), [kind]: color?.id ?? null };
  const isOnlyPickedTier =
    color !== null &&
    CABINET_TIERS.every(
      ({ kind: other }) => other === kind || !tierColorIds[other]
    );

  return {
    ...preferences,
    cabinetStyle: color?.cabinetStyle ?? preferences.cabinetStyle,
    doorColorId: isOnlyPickedTier
      ? color.id
      : preferences.doorColorId ?? color?.id ?? null,
    tierColorIds
  };
}

export function preferencesWithoutTierColors(
  form: Round1FormInput
): Round1RenderingPreferences {
  return {
    ...renderingPreferencesForForm(form),
    tierColorIds: { ...EMPTY_TIER_COLOR_IDS }
  };
}

export function renderingPreferencesComplete(
  colors: CabinetColor[],
  form: Round1FormInput
) {
  const color = selectedRenderingColor(colors, form);
  return Boolean(
    color &&
      color.active &&
      color.cabinetStyle === renderingPreferencesForForm(form).cabinetStyle
  );
}

export function renderingPreferenceStampForForm(
  form: Round1FormInput,
  colors: CabinetColor[] = []
): RenderingPreferenceStamp {
  const preferences = renderingPreferencesForForm(form);
  const plan = resolveRenderingColorPlan(colors, form);
  return {
    cabinetStyle: preferences.cabinetStyle,
    doorColorId: preferences.doorColorId,
    // Latest edit across every color in use, so re-uploading any swatch marks
    // the rendering stale — not just an edit to the main color.
    colorUpdatedAt: latestColorUpdatedAt(plan),
    tierColorIds: effectiveTierColorIds(plan)
  };
}

/**
 * Distinct color ids a saved rendering was generated with, main color first.
 * Used to label a rendering with every finish it actually shows.
 */
export function stampedColorIds(
  stamp: RenderingPreferenceStamp | null | undefined,
  fallbackDoorColorId: string | null = null
): string[] {
  const ids = [
    stamp?.doorColorId ?? fallbackDoorColorId,
    ...CABINET_TIERS.map(({ kind }) => stamp?.tierColorIds?.[kind] ?? null)
  ];
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export function latestColorUpdatedAt(plan: RenderingColorPlan | null) {
  if (!plan) return null;
  return (
    plan.uniqueColors
      .map((color) => color.updatedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

export function renderingPreferenceStampMatches(
  stamp: RenderingPreferenceStamp | null,
  form: Round1FormInput,
  colors: CabinetColor[] = []
) {
  if (!stamp) return false;
  const current = renderingPreferenceStampForForm(form, colors);
  return (
    stamp.cabinetStyle === current.cabinetStyle &&
    stamp.doorColorId === current.doorColorId &&
    tierColorIdsMatch(stamp.tierColorIds, current.tierColorIds) &&
    (stamp.colorUpdatedAt === undefined ||
      stamp.colorUpdatedAt === current.colorUpdatedAt)
  );
}

function tierColorIdsMatch(
  stamped: Round1TierColorIds | null | undefined,
  current: Round1TierColorIds | null | undefined
) {
  // A rendering saved before per-type colors existed carries no tier stamp, but
  // it was necessarily generated with none — so it reads as "no overrides", not
  // as "matches whatever the form says now". Treating a missing stamp as a
  // wildcard would leave those renderings looking current after a cabinet type
  // was recolored, which blocks the regenerate the recolor just earned.
  const left = stamped ?? EMPTY_TIER_COLOR_IDS;
  const right = current ?? EMPTY_TIER_COLOR_IDS;
  return CABINET_TIERS.every(({ kind }) => left[kind] === right[kind]);
}
