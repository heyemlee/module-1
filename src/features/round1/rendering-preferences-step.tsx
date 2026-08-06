"use client";

import { useMemo, useState } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { CabinetKind, CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  activeColorsForStyle,
  CABINET_TIERS,
  nextRenderingPreferencesForStyle,
  preferencesWithoutTierColors,
  preferencesWithTierColor,
  renderingPreferencesForForm,
  selectedRenderingColor,
  selectedTierColor,
  CABINET_STYLE_LABELS
} from "./rendering-preferences";
import { Step } from "./showroom-intake-controls";
import { cn } from "@/lib/utils";

const STYLE_OPTIONS: { value: CabinetStyle; label: string }[] = [
  { value: "EUROPEAN_FRAMELESS", label: CABINET_STYLE_LABELS.EUROPEAN_FRAMELESS },
  { value: "AMERICAN_FRAMED", label: CABINET_STYLE_LABELS.AMERICAN_FRAMED }
];

/**
 * What the next swatch click paints while per-cabinet-type coloring is on.
 *
 * There is deliberately no "all cabinets" target here — the section's own
 * switch already is that choice. Off means one color everywhere; on means each
 * cabinet type is picked separately. The color board is expensive to show once
 * (30+ finishes), so it stays single and these targets re-point it instead of
 * every cabinet type carrying its own copy of the board.
 */
const COLOR_TARGETS = CABINET_TIERS.map((tier) => ({
  key: tier.kind,
  short: tier.label.replace(" cabinets", ""),
  long: tier.label.toLowerCase()
}));

// Pick a legible tick colour over the swatch preview.
function isDarkSwatch(hex?: string | null) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export function RenderingPreferencesStep({
  form,
  colors,
  colorsError = false,
  onRetryLoadColors,
  onFormChange
}: {
  form: Round1FormInput;
  colors: CabinetColor[];
  colorsError?: boolean;
  onRetryLoadColors?: () => void;
  onFormChange: (form: Round1FormInput) => void;
}) {
  const renderingPreferences = renderingPreferencesForForm(form);
  const selectedStyle = renderingPreferences.cabinetStyle;

  const activeColors = useMemo(
    () => activeColorsForStyle(colors, selectedStyle),
    [colors, selectedStyle]
  );
  const selectedColor = selectedRenderingColor(colors, form);
  const hasTierOverrides = CABINET_TIERS.some(({ kind }) =>
    Boolean(selectedTierColor(colors, form, kind))
  );
  const [showTierColors, setShowTierColors] = useState(hasTierOverrides);
  const [activeTarget, setActiveTarget] = useState<CabinetKind>("BASE");

  /** The color a cabinet type shows: its own pick, else the shared fallback. */
  const colorForTier = (kind: CabinetKind) =>
    selectedTierColor(colors, form, kind) ?? selectedColor;
  const activeTargetLabel =
    COLOR_TARGETS.find((target) => target.key === activeTarget)?.long ??
    "base cabinets";

  const setStyle = (style: CabinetStyle) => {
    onFormChange({
      ...form,
      renderingPreferences: nextRenderingPreferencesForStyle(form, colors, style)
    });
  };

  const selectColor = (color: CabinetColor) => {
    onFormChange({
      ...form,
      renderingPreferences: {
        ...renderingPreferences,
        cabinetStyle: color.cabinetStyle,
        doorColorId: color.id
      }
    });
  };

  const selectTierColor = (kind: CabinetKind, color: CabinetColor | null) => {
    onFormChange({
      ...form,
      renderingPreferences: preferencesWithTierColor(form, kind, color)
    });
  };

  /** Route a swatch click to the whole kitchen, or to the targeted type. */
  const applyColor = (color: CabinetColor) => {
    if (showTierColors) selectTierColor(activeTarget, color);
    else selectColor(color);
  };

  // Collapsing clears the overrides and re-aims the board at the main color: a
  // hidden control must never keep steering the rendering after the designer
  // turned it off.
  const toggleTierColors = () => {
    if (showTierColors) {
      onFormChange({
        ...form,
        renderingPreferences: preferencesWithoutTierColors(form)
      });
    }
    setActiveTarget("BASE");
    setShowTierColors((open) => !open);
  };

  return (
    <Step>
      <p className="studio-eyebrow mb-2.5">Cabinet style</p>
      <div className="mb-[22px] grid grid-cols-2 gap-2">
        {STYLE_OPTIONS.map((option) => {
          const active = selectedStyle === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setStyle(option.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-start rounded-[11px] border px-[13px] py-2.5 text-left transition-colors",
                active
                  ? "border-[#1a1a1c] bg-[#1a1a1c] text-white shadow-[0_8px_18px_-10px_rgba(20,20,26,0.45)]"
                  : "border-white/[0.78] bg-white/55 text-[#16161a] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] hover:bg-white/70"
              )}
            >
              <span className="text-[13px] font-semibold">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <p className="studio-eyebrow">Door color / finish</p>
        {activeColors.length > 0 && (
          <span className="font-mono text-[10px] tracking-[0.04em] text-[#aaaaa4]">
            {activeColors.length} AVAILABLE
          </span>
        )}
      </div>

      {activeColors.length === 0 ? (
        colorsError ? (
          <div
            role="alert"
            className="rounded-studio-control border border-studio-danger/25 bg-studio-danger/10 p-4"
          >
            <p className="text-[13px] font-semibold text-studio-danger-ink">
              Cabinet colors could not be loaded
            </p>
            <p className="mt-1 text-[12px] text-studio-danger-ink/80">
              Check the connection and try loading the catalog again.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={onRetryLoadColors}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="rounded-studio-control border border-dashed border-white/85 bg-white/40 p-5">
            <div className="flex gap-3">
              <InfoCircledIcon className="h-5 w-5 shrink-0 text-studio-muted" />
              <div>
                <p className="text-sm font-bold text-studio-ink">
                  Ask an Admin to configure cabinet colors
                </p>
                <p className="mt-1 text-sm leading-6 text-studio-muted">
                  Active cabinet colors are required before a sales rendering can be
                  generated for this style.
                </p>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="mb-2.5 rounded-[11px] border border-white/[0.78] bg-white/45 px-3 py-2.5">
              <button
                type="button"
                onClick={toggleTierColors}
                aria-expanded={showTierColors}
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <span className="block text-[12.5px] font-semibold text-[#16161a]">
                    Different color per cabinet type
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] tracking-[0.1em] text-[#9a9a94]">
                    OPTIONAL · BASE / WALL / TALL
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-3 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                    showTierColors ? "bg-[#1a1a1c]" : "bg-[#d8d6d0]"
                  )}
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full bg-white transition-transform",
                      showTierColors && "translate-x-4"
                    )}
                  />
                </span>
              </button>

              {/* One shared color board below; these chips only decide which
                  cabinet type the next swatch click paints. */}
              {showTierColors && (
                <>
                  <div
                    role="group"
                    aria-label="Cabinet type to color"
                    className="mt-2.5 grid grid-cols-3 gap-1.5"
                  >
                    {COLOR_TARGETS.map((target) => {
                      const color = colorForTier(target.key);
                      const follows = !selectedTierColor(
                        colors,
                        form,
                        target.key
                      );
                      const active = activeTarget === target.key;
                      return (
                        <button
                          key={target.key}
                          type="button"
                          onClick={() => setActiveTarget(target.key)}
                          aria-pressed={active}
                          aria-label={`Color the ${target.long}`}
                          title={color?.name}
                          className={cn(
                            "rounded-[8px] border px-1.5 pb-1.5 pt-1 text-center transition-colors",
                            active
                              ? "border-[#1a1a1c] bg-[#1a1a1c]"
                              : "border-white/[0.78] bg-white/70 hover:border-[rgba(20,20,26,0.22)]"
                          )}
                        >
                          <span
                            className={cn(
                              "block text-[10.5px] font-semibold leading-4",
                              active ? "text-white" : "text-[#16161a]"
                            )}
                          >
                            {target.short}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block h-[5px] rounded-full",
                              follows && "opacity-40"
                            )}
                            style={{
                              backgroundColor: color?.swatchHex ?? "#d8d6d0"
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-[11px] leading-4 text-studio-muted">
                    Picking a color below sets the{" "}
                    <span className="font-semibold text-[#16161a]">
                      {activeTargetLabel}
                    </span>
                    . Types you have not picked yet follow the one you did.
                  </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {activeColors.map((color) => {
              // Every finish in use keeps its frame and its badge, so switching
              // targets never looks like the previous choice was lost.
              const usedBy = showTierColors
                ? CABINET_TIERS.filter(
                    (tier) => colorForTier(tier.kind)?.id === color.id
                  )
                : [];
              return (
                <ColorSwatchButton
                  key={color.id}
                  color={color}
                  selected={
                    showTierColors
                      ? usedBy.length > 0
                      : selectedColor?.id === color.id
                  }
                  aimed={
                    showTierColors && colorForTier(activeTarget)?.id === color.id
                  }
                  badge={
                    showTierColors
                      ? usedBy.length === CABINET_TIERS.length
                        ? "ALL"
                        : usedBy
                            .map((tier) => tier.label.replace(" cabinets", ""))
                            .join(" · ")
                            .toUpperCase()
                      : undefined
                  }
                  label={
                    showTierColors
                      ? `Set ${activeTargetLabel} to ${color.name}`
                      : `Select ${color.name}`
                  }
                  onSelect={() => applyColor(color)}
                />
              );
            })}
          </div>
        </>
      )}
    </Step>
  );
}

function ColorSwatchButton({
  color,
  selected,
  label,
  onSelect,
  aimed = false,
  badge
}: {
  color: CabinetColor;
  selected: boolean;
  label: string;
  onSelect: () => void;
  /** True when this is the color the active cabinet-type target currently uses. */
  aimed?: boolean;
  /** Which cabinet types this finish covers, e.g. "ALL" or "BASE · TALL". */
  badge?: string;
}) {
  const tickLight = isDarkSwatch(color.swatchHex) || Boolean(color.swatchImageUrl);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "group relative aspect-[4/3] overflow-hidden rounded-[13px] border text-left transition-colors",
        selected
          ? "border-[#1a1a1c] shadow-[0_10px_22px_-12px_rgba(20,20,26,0.45)]"
          : "border-white/[0.78] hover:border-[rgba(20,20,26,0.22)]",
        aimed && selected && "ring-2 ring-[#1a1a1c] ring-offset-1 ring-offset-[#f6f4ef]"
      )}
      style={{ backgroundColor: color.swatchHex ?? "#e7e4dd" }}
    >
      {color.swatchImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={color.swatchImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {selected &&
        (badge ? (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-[rgba(10,10,12,0.72)] px-1.5 py-0.5 font-mono text-[8px] font-semibold leading-none tracking-[0.06em] text-white backdrop-blur-sm">
            ✓ {badge}
          </span>
        ) : (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 text-[11px] font-bold leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
              tickLight ? "text-white" : "text-[#1a1a1c]"
            )}
          >
            ✓
          </span>
        ))}
      <span className="absolute inset-x-0 bottom-0 overflow-hidden px-2 py-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="swatch-name-track text-[11.5px] font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          <span>{color.name}</span>
          <span aria-hidden="true">{color.name}</span>
        </span>
      </span>
    </button>
  );
}
