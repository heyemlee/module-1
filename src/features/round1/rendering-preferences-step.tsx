"use client";

import { useMemo, useState } from "react";
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

const CABINET_STYLE_OPTIONS: CabinetConstructionOption<CabinetStyle>[] = [
  {
    value: "EUROPEAN_FRAMELESS",
    label: CABINET_STYLE_LABELS.EUROPEAN_FRAMELESS,
    image:
      "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&w=1200&q=80",
    description: "Clean slab lines, concealed hardware, and modern frameless construction."
  },
  {
    value: "AMERICAN_FRAMED",
    label: CABINET_STYLE_LABELS.AMERICAN_FRAMED,
    image:
      "https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=1200&q=80",
    description: "Classic face-frame proportions with framed doors and residential detail."
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
  const [pendingStyle, setPendingStyle] = useState<CabinetStyle | null>(null);
  const [pendingColor, setPendingColor] = useState<CabinetColor | null>(null);
  const renderingPreferences = renderingPreferencesForForm(form);
  const selectedStyle = renderingPreferences.cabinetStyle;
  const activeColors = useMemo(
    () => activeColorsForStyle(colors, selectedStyle),
    [colors, selectedStyle]
  );
  const selectedColor = selectedRenderingColor(colors, form);
  const preferencesComplete = renderingPreferencesComplete(colors, form);
  const isChangingLockedColor = (color: CabinetColor) =>
    selectedColor !== null && selectedColor.id !== color.id;

  const setStyle = (style: CabinetStyle) => {
    onFormChange({
      ...form,
      renderingPreferences: nextRenderingPreferencesForStyle(form, colors, style)
    });
    setPendingColor(null);
    setPendingStyle(null);
  };

  const requestStyle = (style: CabinetStyle) => {
    setPendingStyle(style);
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
          <p className="mb-2 text-sm font-semibold text-[var(--app-muted)]">
            Cabinet construction style
          </p>
          <CabinetConstructionStylePicker
            value={selectedStyle}
            options={CABINET_STYLE_OPTIONS}
            onRequestSelect={requestStyle}
          />
        </div>

        {activeColors.length === 0 ? (
          colorsError ? (
            <div className="rounded-md border border-dashed border-red-300 bg-red-50 p-5">
              <p className="text-sm font-black text-red-700">
                Couldn’t load cabinet colors
              </p>
              <p className="mt-2 text-sm leading-6 text-red-700">
                There was a problem loading the cabinet color library. Check your
                connection and try again.
              </p>
              {onRetryLoadColors ? (
                <button
                  type="button"
                  onClick={onRetryLoadColors}
                  className="mt-3 rounded-md bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-700">
                Ask an Admin to configure cabinet colors
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
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
                  className={`group rounded-lg border bg-white p-3 text-left transition ${
                    isSelected
                      ? "border-[rgba(0,113,227,0.75)] ring-4 ring-[rgba(0,113,227,0.12)]"
                      : "border-[var(--app-border)] hover:border-[rgba(0,113,227,0.45)] hover:shadow-lg"
                  }`}
                >
                  <span
                    className="block aspect-square w-full overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
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
                  <span className="mt-3 block text-base font-bold text-[var(--app-ink)]">
                    {color.name}
                  </span>
                  {color.colorCode ? (
                    <span className="mt-1 block text-xs font-semibold text-[var(--app-muted)]">
                      {color.colorCode}
                    </span>
                  ) : null}
                  {color.hoverExampleImageUrl ? (
                    <span className="mt-3 block overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] opacity-80 transition group-hover:opacity-100">
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
                  <span className={`mt-3 inline-flex rounded-full px-3 py-2 text-xs font-bold ${
                    isSelected
                      ? "bg-[var(--app-green-soft)] text-[var(--app-green)]"
                      : "bg-[var(--app-ink)] text-white"
                  }`}>
                    {isSelected ? "Locked finish" : "Confirm Color"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-lg border border-[var(--app-border)] bg-white p-4">
          <p className="text-xs font-bold text-[var(--app-muted)]">
            {selectedColor ? "Locked finish" : "Selected finish"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-ink)]">
            {selectedColor
              ? `${selectedColor.name} · ${
                  CABINET_STYLE_LABELS[selectedColor.cabinetStyle]
                }`
              : "Choose and confirm a cabinet color before rendering."}
          </p>
          {selectedColor ? (
            <p className="mt-2 text-xs leading-5 text-[var(--app-amber)]">
              Change requires a new rendering after you confirm a different finish.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[var(--app-border)] pt-4">
          <button
            type="button"
            onClick={onGenerateCabinetFill}
            disabled={!canGenerateCabinetFill}
            className="uiverse-fill-button px-4 py-2"
          >
            Generate Cabinet Fill
          </button>
          <span className="rendering-glow-wrapper">
            <button
              type="button"
              onClick={onGenerateRendering}
              disabled={!preferencesComplete || !canGenerateRendering || renderingBusy}
              className="rendering-glow-button"
            >
              <RenderingButtonText
                text={renderingBusy ? "Generating..." : "Generate Rendering"}
              />
            </button>
          </span>
        </div>

        {!preferencesComplete ? (
          <p className="text-xs leading-5 text-[var(--app-muted)]">
            Confirm a cabinet color before generating the rendering.
          </p>
        ) : null}
      </div>

      {pendingColor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold text-[var(--app-blue)]">
              {isChangingLockedColor(pendingColor)
                ? "Change locked finish"
                : "Confirm cabinet color"}
            </p>
            <h3 className="mt-2 text-lg font-bold text-[var(--app-ink)]">
              {pendingColor.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
              {isChangingLockedColor(pendingColor)
                ? "This will replace the locked finish. The existing rendering will need to be regenerated."
                : "Save this finish for the sales rendering preferences."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingColor(null)}
                className="uiverse-fill-button px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmColor}
                className="uiverse-fill-button px-4 py-2"
              >
                {isChangingLockedColor(pendingColor) ? "Change Finish" : "Confirm Color"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingStyle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-5 shadow-2xl backdrop-blur">
            <p className="text-xs font-bold text-[var(--app-blue)]">
              {pendingStyle === selectedStyle
                ? "Confirm cabinet construction style"
                : "Change cabinet construction style"}
            </p>
            <h3 className="mt-2 text-lg font-bold text-[var(--app-ink)]">
              {CABINET_STYLE_LABELS[pendingStyle]}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
              {pendingStyle === selectedStyle
                ? "Lock this construction style for the rendering preferences."
                : "This will replace the locked construction style. You will need to generate a new rendering after changing it."}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingStyle(null)}
                className="uiverse-fill-button px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStyle(pendingStyle)}
                className="uiverse-fill-button px-4 py-2"
              >
                {pendingStyle === selectedStyle ? "Confirm Style" : "Change Style"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Step>
  );
}

function RenderingButtonText({ text }: { text: string }) {
  return (
    <span aria-label={text}>
      {text.split("").map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className="rendering-glow-letter"
          style={{ animationDelay: `${Math.min(index * 0.08, 0.96)}s` }}
          aria-hidden
        >
          {letter === " " ? "\u00a0" : letter}
        </span>
      ))}
    </span>
  );
}
