"use client";

import { useMemo, useState } from "react";
import type { CabinetStyle, Round1FormInput } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import {
  activeColorsForStyle,
  CABINET_STYLE_LABELS,
  renderingPreferencesForForm,
  renderingPreferencesComplete,
  selectedRenderingColor
} from "./rendering-preferences";
import { Step } from "./showroom-intake-controls";

const CABINET_STYLES: CabinetStyle[] = [
  "EUROPEAN_FRAMELESS",
  "AMERICAN_FRAMED"
];

export function RenderingPreferencesStep({
  form,
  colors,
  onFormChange,
  onGenerateCabinetFill,
  onGenerateRendering,
  canGenerateCabinetFill,
  canGenerateRendering,
  renderingBusy
}: {
  form: Round1FormInput;
  colors: CabinetColor[];
  onFormChange: (form: Round1FormInput) => void;
  onGenerateCabinetFill: () => void;
  onGenerateRendering: () => void;
  canGenerateCabinetFill: boolean;
  canGenerateRendering: boolean;
  renderingBusy: boolean;
}) {
  const [pendingColor, setPendingColor] = useState<CabinetColor | null>(null);
  const renderingPreferences = renderingPreferencesForForm(form);
  const selectedStyle = renderingPreferences.cabinetStyle;
  const activeColors = useMemo(
    () => activeColorsForStyle(colors, selectedStyle),
    [colors, selectedStyle]
  );
  const selectedColor = selectedRenderingColor(colors, form);
  const preferencesComplete = renderingPreferencesComplete(colors, form);

  const setStyle = (style: CabinetStyle) => {
    const currentColor = selectedRenderingColor(colors, form);
    onFormChange({
      ...form,
      renderingPreferences: {
        ...renderingPreferences,
        cabinetStyle: style,
        doorColorId:
          currentColor && currentColor.cabinetStyle !== style
            ? null
            : renderingPreferences.doorColorId
      }
    });
    setPendingColor(null);
  };

  const confirmColor = () => {
    if (!pendingColor) return;
    onFormChange({
      ...form,
      renderingPreferences: {
        ...renderingPreferences,
        cabinetStyle: pendingColor.cabinetStyle,
        doorColorId: pendingColor.id
      }
    });
    setPendingColor(null);
  };

  return (
    <Step title="6. Rendering Preferences">
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-bold text-slate-700">
            Cabinet construction style
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CABINET_STYLES.map((style) => {
              const selected = style === selectedStyle;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setStyle(style)}
                  className={`rounded-md border px-4 py-3 text-left text-sm font-black ${
                    selected
                      ? "border-sky-700 bg-sky-50 text-sky-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {CABINET_STYLE_LABELS[style]}
                </button>
              );
            })}
          </div>
        </div>

        {activeColors.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-black text-slate-700">
              Ask an Admin to configure cabinet colors
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Active cabinet colors are required before a sales rendering can be
              generated for this style.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeColors.map((color) => {
              const isSelected = selectedColor?.id === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setPendingColor(color)}
                  className={`group rounded-md border bg-white p-3 text-left shadow-sm ${
                    isSelected
                      ? "border-sky-700 ring-2 ring-sky-100"
                      : "border-slate-200 hover:border-sky-300"
                  }`}
                >
                  <span
                    className="block aspect-square w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100"
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
                        alt={`${color.name} swatch`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="mt-3 block text-base font-black text-slate-950">
                    {color.name}
                  </span>
                  {color.colorCode ? (
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                      {color.colorCode}
                    </span>
                  ) : null}
                  {color.hoverExampleImageUrl ? (
                    <span className="mt-3 block overflow-hidden rounded-md border border-slate-200 bg-slate-50 opacity-75 transition group-hover:opacity-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={color.hoverExampleImageUrl}
                        alt={`${color.name} kitchen example`}
                        className="aspect-video w-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="mt-3 inline-flex rounded-md bg-slate-900 px-3 py-2 text-xs font-black text-white">
                    Confirm Color
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Selected finish
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800">
            {selectedColor
              ? `${selectedColor.name} · ${
                  CABINET_STYLE_LABELS[selectedColor.cabinetStyle]
                }`
              : "Choose and confirm a cabinet color before rendering."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onGenerateCabinetFill}
            disabled={!canGenerateCabinetFill}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Cabinet Fill
          </button>
          <button
            type="button"
            onClick={onGenerateRendering}
            disabled={!preferencesComplete || !canGenerateRendering || renderingBusy}
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renderingBusy ? "Generating Rendering..." : "Generate Rendering"}
          </button>
        </div>

        {!preferencesComplete ? (
          <p className="text-xs leading-5 text-slate-500">
            Confirm a cabinet color before generating the rendering.
          </p>
        ) : null}
      </div>

      {pendingColor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-wide text-sky-700">
              Confirm cabinet color
            </p>
            <h3 className="mt-2 text-lg font-black text-slate-950">
              {pendingColor.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Save this finish for the sales rendering preferences.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingColor(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmColor}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-bold text-white"
              >
                Confirm Color
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Step>
  );
}
