"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { Button } from "@/components/ui/button";
import { buildCabinetColorPayload, resizeImageToDataUrl } from "./cabinet-color-form";

const inputCls =
  "w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";
const fileCls =
  "mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-border";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

const STYLE_LABELS = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
} as const;

type Draft = {
  cabinetStyle: CabinetStyle;
  name: string;
  promptDescription: string;
  active: boolean;
  // `undefined` = image unchanged; a string = newly picked (already downscaled).
  swatchData?: string;
  hoverData?: string;
  swatchPreview: string | null;
  hoverPreview: string | null;
};

function toDraft(color: CabinetColor): Draft {
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

function buildDrafts(colors: CabinetColor[]) {
  const map: Record<string, Draft> = {};
  for (const color of colors) map[color.id] = toDraft(color);
  return map;
}

function isDirty(color: CabinetColor, draft: Draft) {
  return (
    draft.name.trim() !== color.name ||
    draft.cabinetStyle !== color.cabinetStyle ||
    draft.promptDescription.trim() !== color.promptDescription ||
    draft.active !== color.active ||
    draft.swatchData !== undefined ||
    draft.hoverData !== undefined
  );
}

export function CabinetColorsManager({ colors }: { colors: CabinetColor[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => buildDrafts(colors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const results = await Promise.all(
        dirtyIds.map((id) => {
          const draft = drafts[id];
          const color = colors.find((c) => c.id === id)!;
          const payload = buildCabinetColorPayload({
            cabinetStyle: draft.cabinetStyle,
            name: draft.name,
            promptDescription: draft.promptDescription,
            // Omit (undefined) when unchanged so the stored image is preserved.
            swatchImageUrl: draft.swatchData,
            hoverExampleImageUrl: draft.hoverData,
            active: draft.active,
            sortOrder: color.sortOrder
          });
          return fetch(`/api/admin/cabinet-colors/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        })
      );
      if (results.some((r) => !r.ok)) {
        setError("Some colors couldn’t be saved. Check the fields and try again.");
        return;
      }
      // Clear the "new image" markers so saved rows read as clean once the
      // refreshed server data (with trimmed names etc.) flows back in.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const id of dirtyIds) {
          next[id] = {
            ...next[id],
            name: next[id].name.trim(),
            promptDescription: next[id].promptDescription.trim(),
            swatchData: undefined,
            hoverData: undefined
          };
        }
        return next;
      });
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[57px] z-10 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface/90 px-4 py-3 shadow-sm backdrop-blur-md">
        <p className="text-sm text-muted-foreground">
          {dirtyIds.length === 0
            ? "No unsaved changes"
            : `${dirtyIds.length} unsaved ${dirtyIds.length === 1 ? "change" : "changes"}`}
        </p>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-danger-foreground">{error}</p>}
          <Button type="button" size="sm" onClick={saveAll} disabled={busy || dirtyIds.length === 0}>
            {busy ? "Saving..." : "Save all changes"}
          </Button>
        </div>
      </div>

      {(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"] as const).map((style) => {
        const group = colors.filter((color) => color.cabinetStyle === style);
        return (
          <section key={style} className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <h2 className="border-b border-border px-4 py-3 text-lg font-semibold">
              {STYLE_LABELS[style]}
            </h2>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((color) => {
                const draft = drafts[color.id];
                if (!draft) return null;
                const dirty = isDirty(color, draft);
                return (
                  <article
                    key={color.id}
                    className={`rounded-lg border p-3 transition-colors ${dirty ? "border-warning bg-warning-surface" : "border-border bg-background"}`}
                  >
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                        {draft.swatchPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={draft.swatchPreview}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full" style={{ background: color.swatchHex ?? "#e7e5e4" }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={draft.name}
                          onChange={(e) => update(color.id, { name: e.target.value })}
                          className={`${inputCls} font-semibold`}
                        />
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(e) => update(color.id, { active: e.target.checked })}
                            className="accent-[var(--primary)]"
                          />
                          Active
                        </label>
                      </div>
                    </div>

                    <label className="mt-3 block text-xs font-medium text-muted-foreground">
                      Cabinet style
                      <select
                        value={draft.cabinetStyle}
                        onChange={(e) =>
                          update(color.id, { cabinetStyle: e.target.value as CabinetStyle })
                        }
                        className={`${inputCls} mt-1`}
                      >
                        {STYLES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-2 block text-xs font-medium text-muted-foreground">
                      Swatch image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => pickImage(color.id, e.target.files?.[0], "swatch")}
                        className={fileCls}
                      />
                    </label>

                    <label className="mt-2 block text-xs font-medium text-muted-foreground">
                      Hover example image (optional)
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => pickImage(color.id, e.target.files?.[0], "hover")}
                        className={fileCls}
                      />
                    </label>

                    <label className="mt-2 block text-xs font-medium text-muted-foreground">
                      AI description
                      <textarea
                        value={draft.promptDescription}
                        onChange={(e) => update(color.id, { promptDescription: e.target.value })}
                        rows={2}
                        className={`${inputCls} text-xs`}
                      />
                    </label>
                  </article>
                );
              })}
              {group.length === 0 && <p className="text-sm text-muted-foreground">No colors configured.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
