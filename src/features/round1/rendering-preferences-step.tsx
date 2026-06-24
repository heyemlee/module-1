import { Button } from "@/components/ui/button";
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
    label: "European",
    image:
      "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=1200&q=80"
  },
  {
    value: "AMERICAN_FRAMED",
    label: "American",
    image:
      "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1200&q=80"
  }
];

export function RenderingPreferencesStep({
  form,
  colors,
  colorsError = false,
  onRetryLoadColors,
  onFormChange,

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
    <Step>
      <div className="grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Left Pane: Preview Area */}
        <div className="lg:col-start-1 lg:row-start-1">
          <div className="overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-sm">
            <div className="aspect-[4/3] w-full bg-[#e8e8ed] relative">
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
                <div className="flex h-full w-full items-center justify-center text-[#aeaeb2]">
                  <ImageIcon className="h-12 w-12" />
                </div>
              )}

              {/* Overlay with details */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3 pt-8 text-white">

                <h3 className="text-sm font-bold truncate">
                  {previewColor ? previewColor.name : CABINET_STYLE_LABELS[selectedStyle]}
                </h3>
                {previewColor?.colorCode && (
                  <p className="mt-0.5 text-xs font-medium text-white/70 truncate">
                    {previewColor.colorCode}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Construction Style Selection */}
        <div className="lg:col-start-2 lg:row-start-1">
          <section>

            <CabinetConstructionStylePicker
              value={selectedStyle}
              options={CABINET_STYLE_OPTIONS}
              onRequestSelect={setStyle}
            />
          </section>
        </div>

        {/* Color Selection */}
        <div className="lg:col-span-2 lg:row-start-2 overflow-hidden">
          <section>


            {activeColors.length === 0 ? (
              colorsError ? (
                <div
                  role="alert"
                  className="rounded-studio-control border border-studio-danger/25 bg-studio-danger/10 p-4"
                >
                  <p className="text-[13px] font-semibold text-[#8e312b]">
                    Cabinet colors could not be loaded
                  </p>
                  <p className="mt-1 text-[12px] text-[#6f4b47]">
                    Check the connection and try loading the catalog again.
                  </p>
                  <Button
                    type="button"
                    variant="inspector"
                    className="mt-3"
                    onClick={onRetryLoadColors}
                  >
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#d2d2d7] bg-[#f5f5f7] p-5">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-[#86868b] shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-[#1d1d1f]">
                        Ask an Admin to configure cabinet colors
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#6e6e73]">
                        Active cabinet colors are required before a sales rendering can be
                        generated for this style.
                      </p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-rows-3 grid-flow-col gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#d2d2d7] scrollbar-track-transparent">
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
                        "group relative shrink-0 w-16 h-16 overflow-hidden rounded-lg transition-all duration-200",
                        isSelected
                          ? "ring-2 ring-[var(--app-ink)] ring-offset-2 scale-105 shadow-md"
                          : "ring-1 ring-[#d2d2d7] hover:ring-[#6e6e73]"
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
        </div>
      </div>
    </Step>
  );
}
