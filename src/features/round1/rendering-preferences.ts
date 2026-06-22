import type {
  CabinetStyle,
  Round1FormInput,
  Round1RenderingPreferences
} from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

export const DEFAULT_RENDERING_PREFERENCES: Round1RenderingPreferences = {
  cabinetStyle: "EUROPEAN_FRAMELESS",
  doorColorId: null
};

export type RenderingPreferenceStamp = {
  cabinetStyle: Round1RenderingPreferences["cabinetStyle"];
  doorColorId: string | null;
};

export const CABINET_STYLE_LABELS: Record<CabinetStyle, string> = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
};

export function renderingPreferencesForForm(form: Round1FormInput) {
  return form.renderingPreferences ?? DEFAULT_RENDERING_PREFERENCES;
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

export function nextRenderingPreferencesForStyle(
  form: Round1FormInput,
  colors: CabinetColor[],
  style: CabinetStyle
): Round1RenderingPreferences {
  const currentColor = selectedRenderingColor(colors, form);
  return {
    ...renderingPreferencesForForm(form),
    cabinetStyle: style,
    doorColorId:
      currentColor && currentColor.active && currentColor.cabinetStyle === style
        ? currentColor.id
        : null
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
  form: Round1FormInput
): RenderingPreferenceStamp {
  const preferences = renderingPreferencesForForm(form);
  return {
    cabinetStyle: preferences.cabinetStyle,
    doorColorId: preferences.doorColorId
  };
}

export function renderingPreferenceStampMatches(
  stamp: RenderingPreferenceStamp | null,
  form: Round1FormInput
) {
  if (!stamp) return false;
  const current = renderingPreferenceStampForForm(form);
  return (
    stamp.cabinetStyle === current.cabinetStyle &&
    stamp.doorColorId === current.doorColorId
  );
}
