"use client";

import { useMemo, useState } from "react";
import { Info, Image as ImageIcon } from "lucide-react";
import {
  CabinetConstructionStylePicker,
  type CabinetConstructionOption
} from "@/components/ui/cabinet-construction-style-picker";
import type { CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  activeColorsForStyle,
  CABINET_STYLE_LABELS,
  nextRenderingPreferencesForStyle,
  renderingPreferencesForForm,
  renderingPreferencesComplete,
  selectedRenderingColor
} from "./rendering-preferences";
import { Step } from "./showroom-intake-controls";
import { cn } from "@/lib/utils";

const CABINET_STYLE_OPTIONS: CabinetConstructionOption<CabinetStyle>[] = [
  {
    value: "EUROPEAN_FRAMELESS",
    label: CABINET_STYLE_LABELS.EUROPEAN_FRAMELESS,
    image:
      "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=1200&q=80",
    description: "Clean slab lines, concealed hardware, modern frameless."
  },
  {
    value: "AMERICAN_FRAMED",
    label: CABINET_STYLE_LABELS.AMERICAN_FRAMED,
    image:
      "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1200&q=80",
    description: "Classic face-frame proportions, framed doors."
  }
];

export function RenderingPreferencesStep({
  form,
  colors,
  colorsError = false,
  onRetryLoadColors,
  onFormChange,
  onGenerateCabinetFill,
  onGenerateRendering,
  canGenerateCabinetFill,
  canGenerateRendering,
  renderingBusy
}: {
  form: Round1FormInput;
  colors: CabinetColor[];
  colorsError?: boolean;
  onRetryLoadColors?: () => void;
  onFormChange: (form: Round1FormInput) => void;
  onGenerateCabinetFill: () => void;
  onGenerateRendering: () => void;
  canGenerateCabinetFill: boolean;
  canGenerateRendering: boolean;
  renderingBusy: boolean;
}) {
  const renderingPreferences = renderingPreferencesForForm(form);
  const selectedStyle = renderingPreferences.cabinetStyle;

  const activeColors = useMemo(
    () => activeColorsForStyle(colors, selectedStyle),
    [colors, selectedStyle]
  );

  const selectedColor = selectedRenderingColor(colors, form);
  const preferencesComplete = renderingPreferencesComplete(colors, form);

  const [hoveredColor, setHoveredColor] = useState<CabinetColor | null>(null);

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

  // Determine which preview image to show
  const previewColor = hoveredColor || selectedColor;
  const previewImageUrl = previewColor?.hoverExampleImageUrl || previewColor?.swatchImageUrl;
  const fallbackImageUrl = CABINET_STYLE_OPTIONS.find(opt => opt.value === selectedStyle)?.image;
  const displayImage = previewImageUrl || fallbackImageUrl;

  return (
    <Step title="6. Rendering Preferences">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Pane: Preview Area */}
        <div className="lg:col-span-5 order-last lg:order-first">
          <div className="sticky top-6 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-sm">
            <div className="aspect-[4/3] w-full bg-slate-100 relative">
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage}
                  alt="Preview"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}

              {/* Overlay with details */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-12 text-white">
                <p className="text-xs font-bold uppercase tracking-wider text-white/80 mb-1">
                  {previewColor ? "Cabinet Finish" : "Construction Style"}
                </p>
                <h3 className="text-xl font-bold leading-tight">
                  {previewColor ? previewColor.name : CABINET_STYLE_LABELS[selectedStyle]}
                </h3>
                {previewColor?.colorCode && (
                  <p className="mt-1 text-sm font-medium text-white/70">
                    {previewColor.colorCode}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Controls */}
        <div className="lg:col-span-7 space-y-8">

          {/* Construction Style Selection */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--app-ink)]">
                1. Construction Style
              </h4>
            </div>
            <CabinetConstructionStylePicker
              value={selectedStyle}
              options={CABINET_STYLE_OPTIONS}
              onRequestSelect={setStyle}
            />
          </section>

          {/* Color Selection */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--app-ink)]">
                2. Cabinet Finish
              </h4>
              <span className="text-xs font-medium text-[var(--app-muted)]">
                {activeColors.length} available
              </span>
            </div>

            {activeColors.length === 0 ? (
              colorsError ? (
                <div className="rounded-xl border border-dashed border-red-300 bg-red-50 p-5">
                  <p className="text-sm font-bold text-red-800">
                    Couldn’t load cabinet colors
                  </p>
                  <p className="mt-1 text-sm leading-6 text-red-700/80">
                    There was a problem loading the cabinet color library. Check your
                    connection and try again.
                  </p>
                  {onRetryLoadColors && (
                    <button
                      type="button"
                      onClick={onRetryLoadColors}
                      className="mt-3 rounded-md bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        Ask an Admin to configure cabinet colors
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Active cabinet colors are required before a sales rendering can be
                        generated for this style.
                      </p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {activeColors.map((color) => {
                  const isSelected = selectedColor?.id === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => selectColor(color)}
                      onMouseEnter={() => setHoveredColor(color)}
                      onMouseLeave={() => setHoveredColor(null)}
                      aria-label={`Select ${color.name}`}
                      className={cn(
                        "group relative aspect-square w-full overflow-hidden rounded-full transition-all duration-200",
                        isSelected
                          ? "ring-2 ring-[var(--app-blue)] ring-offset-2 scale-110 shadow-md"
                          : "ring-1 ring-slate-200 hover:ring-slate-400 hover:scale-105"
                      )}
                      style={{
                        backgroundColor: color.swatchImageUrl
                          ? undefined
                          : color.swatchHex ?? "#e2e8f0"
                      }}
                    >
                      {color.swatchImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={color.swatchImageUrl}
                          alt={color.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Summary and Actions */}
          <div className="rounded-xl border border-[var(--app-border)] bg-slate-50/50 p-5 space-y-5">
            <div>
              <p className="text-xs font-bold text-[var(--app-muted)] uppercase tracking-wider mb-1">
                {selectedColor ? "Current Selection" : "Action Required"}
              </p>
              <p className="text-sm font-semibold text-[var(--app-ink)]">
                {selectedColor
                  ? `${selectedColor.name} · ${CABINET_STYLE_LABELS[selectedStyle]}`
                  : "Choose a cabinet finish to unlock rendering."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onGenerateCabinetFill}
                disabled={!canGenerateCabinetFill}
                className="uiverse-fill-button px-5 py-2.5 text-sm"
              >
                Generate Cabinet Fill
              </button>
              <span className={cn("inline-block", preferencesComplete && canGenerateRendering ? "rendering-glow-wrapper" : "")}>
                <button
                  type="button"
                  onClick={onGenerateRendering}
                  disabled={!preferencesComplete || !canGenerateRendering || renderingBusy}
                  className={cn(
                    "px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                    preferencesComplete && canGenerateRendering && !renderingBusy
                      ? "bg-[var(--app-blue)] text-white hover:bg-blue-600 shadow-md rendering-glow-button"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  )}
                >
                  {renderingBusy ? "Generating..." : "Generate Rendering"}
                </button>
              </span>
            </div>
          </div>

        </div>
      </div>
    </Step>
  );
}
