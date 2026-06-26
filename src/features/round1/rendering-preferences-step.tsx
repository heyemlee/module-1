"use client";

import { useMemo } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import type { CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  activeColorsForStyle,
  nextRenderingPreferencesForStyle,
  renderingPreferencesForForm,
  selectedRenderingColor
} from "./rendering-preferences";
import { Step } from "./showroom-intake-controls";
import { cn } from "@/lib/utils";

const STYLE_OPTIONS: { value: CabinetStyle; label: string; sub: string }[] = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless", sub: "FULL OVERLAY" },
  { value: "AMERICAN_FRAMED", label: "American Framed", sub: "FACE FRAME" }
];

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
              <span
                className={cn(
                  "mt-0.5 font-mono text-[9px] tracking-[0.1em]",
                  active ? "text-white/55" : "text-[#9a9a94]"
                )}
              >
                {option.sub}
              </span>
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
        <div className="grid grid-cols-3 gap-2">
          {activeColors.map((color) => {
            const isSelected = selectedColor?.id === color.id;
            const tickLight = isDarkSwatch(color.swatchHex) || Boolean(color.swatchImageUrl);
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => selectColor(color)}
                aria-label={`Select ${color.name}`}
                aria-pressed={isSelected}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-[13px] border text-left transition-colors",
                  isSelected
                    ? "border-[#1a1a1c] shadow-[0_10px_22px_-12px_rgba(20,20,26,0.45)]"
                    : "border-white/[0.78] hover:border-[rgba(20,20,26,0.22)]"
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
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(155deg,rgba(255,255,255,0.45),transparent 40%)"
                  }}
                />
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
                  style={{
                    background: "linear-gradient(180deg,transparent,rgba(10,10,12,0.8))"
                  }}
                />
                {isSelected && (
                  <span
                    className={cn(
                      "absolute right-1.5 top-1.5 text-[11px] font-bold leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
                      tickLight ? "text-white" : "text-[#1a1a1c]"
                    )}
                  >
                    ✓
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 overflow-hidden px-2 py-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="swatch-name-track text-[11.5px] font-medium text-white">
                    <span>{color.name}</span>
                    <span aria-hidden="true">{color.name}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Step>
  );
}
