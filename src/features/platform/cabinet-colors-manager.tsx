"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { buildCabinetColorPayload, resizeImageToDataUrl, MAX_CABINET_IMAGE_BYTES } from "./cabinet-color-form";
import { StudioSection, StudioEmptyState } from "./studio-page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

type Draft = {
  cabinetStyle: CabinetStyle;
  name: string;
  promptDescription: string;
  active: boolean;
  swatchData?: string;
  hoverData?: string;
  swatchPreview: string | null;
  hoverPreview: string | null;
};

export function toDraft(color: CabinetColor): Draft {
  return {
    cabinetStyle: color.cabinetStyle,
    name: color.name,
    promptDescription: color.promptDescription,
    active: color.active,
    swatchData: undefined,
    hoverData: undefined,
    swatchPreview: color.swatchImageUrl,
    hoverPreview: color.hoverExampleImageUrl
  };
}

export function buildDrafts(colors: CabinetColor[]) {
  const map: Record<string, Draft> = {};
  for (const color of colors) map[color.id] = toDraft(color);
  return map;
}

export function isDirty(color: CabinetColor, draft: Draft) {
  return (
    draft.name.trim() !== color.name ||
    draft.cabinetStyle !== color.cabinetStyle ||
    draft.promptDescription.trim() !== color.promptDescription ||
    draft.active !== color.active ||
    draft.swatchData !== undefined ||
    draft.hoverData !== undefined
  );
}

const selectClass = "flex h-10 w-full rounded-studio-small border border-studio-line-strong bg-studio-surface px-3 py-2 text-sm text-studio-ink ring-offset-studio-void file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-studio-quiet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-studio-action/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function CabinetColorsManager({ colors }: { colors: CabinetColor[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => buildDrafts(colors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  const dirtyIds = colors.filter((c) => drafts[c.id] && isDirty(c, drafts[c.id])).map((c) => c.id);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function pickImage(
    id: string,
    file: File | undefined,
    field: "swatch" | "hover"
  ) {
    if (!file) return;
    if (file.size > MAX_CABINET_IMAGE_BYTES) {
      setError("Image is too large. Please choose an image under 4MB.");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      update(
        id,
        field === "swatch"
          ? { swatchData: dataUrl, swatchPreview: dataUrl }
          : { hoverData: dataUrl, hoverPreview: dataUrl }
      );
      setError(null);
    } catch {
      setError("Unable to read that image. Please try another file.");
    }
  }

  async function saveAll() {
    if (dirtyIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const requests = dirtyIds.map((id) => {
        const color = colors.find((c) => c.id === id)!;
        const draft = drafts[id];
        return fetch(`/api/admin/cabinet-colors/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildCabinetColorPayload({
              cabinetStyle: draft.cabinetStyle,
              name: draft.name,
              promptDescription: draft.promptDescription,
              swatchImageUrl: draft.swatchData,
              hoverExampleImageUrl: draft.hoverData,
              active: draft.active,
              sortOrder: color.sortOrder
            })
          )
        });
      });

      const results = await Promise.allSettled(requests);
      const failed = results.filter(
        (result) => result.status === "rejected" || !result.value.ok
      ).length;

      if (failed > 0) {
        setError(`Failed to save ${failed} color(s).`);
      } else {
        router.refresh();
        setSavedAt(Date.now());
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setDrafts(buildDrafts(colors));
  }, [colors]);

  return (
    <div className="space-y-6">
      <div className="sticky top-[74px] z-10 flex items-center justify-between gap-3 rounded-studio-panel border border-studio-line bg-studio-void px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-studio-secondary">
            {dirtyIds.length === 0
              ? "No unsaved changes"
              : `${dirtyIds.length} unsaved change(s)`}
          </p>
          {error && <div role="alert" className="text-xs font-semibold text-studio-danger">{error}</div>}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={saveAll}
            disabled={busy || dirtyIds.length === 0}
            className="w-36"
          >
            {busy ? "Saving..." : "Save all changes"}
          </Button>
        </div>
      </div>
      
      <div aria-live="polite" className="sr-only">
        {savedAt > 0 ? "Changes saved" : ""}
      </div>

      {STYLES.map((style) => {
        const styleColors = colors.filter((c) => c.cabinetStyle === style.value);

        return (
          <StudioSection key={style.value} aria-label={style.label}>
            <h2 className="mb-4 text-base font-bold text-studio-ink">{style.label}</h2>
            {styleColors.length === 0 ? (
              <StudioEmptyState
                title={`No ${style.label} finishes`}
                description={`Add the first ${style.label} finish with the form.`}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {styleColors.map((color) => {
                  const draft = drafts[color.id] || toDraft(color);
                  const isColorDirty = isDirty(color, draft);

                  return (
                    <article
                      key={color.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-studio-line bg-studio-void"
                    >
                      <div
                        className="relative h-32 w-full shrink-0"
                        style={{ backgroundColor: color.swatchHex || "#e8e8ed" }}
                      >
                        {draft.swatchPreview && (
                          <img
                            src={draft.swatchPreview}
                            alt={`${draft.name || color.name} swatch`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        )}
                        <div className="absolute left-2 top-2 flex flex-col gap-1">
                          {draft.active ? (
                            <span className="inline-flex items-center rounded-full bg-studio-success/20 px-2 py-0.5 text-xs font-semibold text-studio-success">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-studio-line-strong px-2 py-0.5 text-xs font-semibold text-studio-secondary">
                              Inactive
                            </span>
                          )}
                          {isColorDirty && (
                            <span className="inline-flex items-center rounded-full bg-studio-action/20 px-2 py-0.5 text-xs font-semibold text-studio-action">
                              Unsaved
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <Input
                          value={draft.name}
                          onChange={(e) => update(color.id, { name: e.target.value })}
                          className="font-semibold"
                          aria-label={`${color.name} name`}
                          disabled={busy}
                        />
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`active-${color.id}`}
                            checked={draft.active}
                            onCheckedChange={(c) => update(color.id, { active: c === true })}
                            disabled={busy}
                          />
                          <Label htmlFor={`active-${color.id}`}>Active</Label>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`style-${color.id}`} className="text-xs text-studio-secondary">Cabinet style</Label>
                          <select
                            id={`style-${color.id}`}
                            className={selectClass}
                            value={draft.cabinetStyle}
                            onChange={(e) =>
                              update(color.id, { cabinetStyle: e.target.value as CabinetStyle })
                            }
                            disabled={busy}
                          >
                            {STYLES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`swatch-${color.id}`} className="text-xs text-studio-secondary">Swatch image</Label>
                          <Input
                            id={`swatch-${color.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => pickImage(color.id, e.target.files?.[0], "swatch")}
                            disabled={busy}
                            className="text-xs text-studio-secondary file:text-studio-ink h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`hover-${color.id}`} className="text-xs text-studio-secondary">Hover example image (optional)</Label>
                          {draft.hoverPreview && (
                            <div className="mb-2 h-16 w-full overflow-hidden rounded-md border border-studio-line bg-studio-line/20">
                              <img
                                src={draft.hoverPreview}
                                alt={`${draft.name || color.name} kitchen example`}
                                loading="lazy"
                                className="h-full w-full object-cover opacity-80"
                              />
                            </div>
                          )}
                          <Input
                            id={`hover-${color.id}`}
                            type="file"
                            accept="image/*"
                            onChange={(e) => pickImage(color.id, e.target.files?.[0], "hover")}
                            disabled={busy}
                            className="text-xs text-studio-secondary file:text-studio-ink h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`ai-${color.id}`} className="text-xs text-studio-secondary">AI description</Label>
                          <textarea
                            id={`ai-${color.id}`}
                            rows={2}
                            value={draft.promptDescription}
                            onChange={(e) => update(color.id, { promptDescription: e.target.value })}
                            disabled={busy}
                            className={`${selectClass} resize-none h-auto`}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </StudioSection>
        );
      })}
    </div>
  );
}
