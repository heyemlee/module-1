"use client";

import { useMemo, useState } from "react";
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

const CABINET_STYLES: CabinetStyle[] = [
  "EUROPEAN_FRAMELESS",
  "AMERICAN_FRAMED"
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
    onFormChange({
      ...form,
      renderingPreferences: nextRenderingPreferencesForStyle(form, colors, style)
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
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-foreground hover:bg-surface-2"
                  }`}
                >
                  {CABINET_STYLE_LABELS[style]}
                </button>
              );
            })}
          </div>
        </div>

        {activeColors.length === 0 ? (
          colorsError ? (
            <div className="rounded-lg border border-dashed border-danger/40 bg-danger-surface p-5">
              <p className="text-sm font-semibold text-danger-foreground">
                Couldn’t load cabinet colors
              </p>
              <p className="mt-2 text-sm leading-6 text-danger-foreground">
                There was a problem loading the cabinet color library. Check your
                connection and try again.
              </p>
              {onRetryLoadColors ? (
                <button
                  type="button"
                  onClick={onRetryLoadColors}
                  className="mt-3 rounded-md bg-danger px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-surface-2 p-5">
              <p className="text-sm font-semibold text-foreground">
                Ask an Admin to configure cabinet colors
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Active cabinet colors are required before a sales rendering can be
                generated for this style.
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeColors.map((color) => {
              const isSelected = selectedColor?.id === color.id;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setPendingColor(color)}
                  className={`group rounded-lg border bg-surface p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  <span
                    className="block aspect-square w-full overflow-hidden rounded-md border border-border bg-surface-2"
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
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="mt-3 block text-base font-semibold text-foreground">
                    {color.name}
                  </span>
                  {color.colorCode ? (
                    <span className="mt-1 block font-mono text-xs font-medium uppercase tracking-wide text-subtle-foreground">
                      {color.colorCode}
                    </span>
                  ) : null}
                  {color.hoverExampleImageUrl ? (
                    <span className="mt-3 block overflow-hidden rounded-md border border-border bg-surface-2 opacity-75 transition group-hover:opacity-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={color.hoverExampleImageUrl}
                        alt={`${color.name} kitchen example`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-video w-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="mt-3 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
                    Confirm Color
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Selected finish
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {selectedColor
              ? `${selectedColor.name} · ${
                  CABINET_STYLE_LABELS[selectedColor.cabinetStyle]
                }`
              : "Choose and confirm a cabinet color before rendering."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onGenerateCabinetFill}
            disabled={!canGenerateCabinetFill}
            className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Cabinet Fill
          </button>
          <button
            type="button"
            onClick={onGenerateRendering}
            disabled={!preferencesComplete || !canGenerateRendering || renderingBusy}
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renderingBusy ? "Generating Rendering..." : "Generate Rendering"}
          </button>
        </div>

        {!preferencesComplete ? (
          <p className="text-xs leading-5 text-muted-foreground">
            Confirm a cabinet color before generating the rendering.
          </p>
        ) : null}
      </div>

      {pendingColor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-blur-in rounded-lg border border-border bg-surface p-6 shadow-xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Confirm cabinet color
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              {pendingColor.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Save this finish for the sales rendering preferences.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingColor(null)}
                className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmColor}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
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
