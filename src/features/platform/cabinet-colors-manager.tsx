"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { buildCabinetColorPayload, resizeImageToDataUrl } from "./cabinet-color-form";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

const STYLE_LABELS = {
  EUROPEAN_FRAMELESS: "European Frameless",
  AMERICAN_FRAMED: "American Framed"
} as const;

const M_INPUT =
  "w-full rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[13px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]/40";

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
      <div className="sticky top-[74px] z-10 flex items-center justify-between gap-3 rounded-[14px] border border-[#d2d2d7] bg-white px-4 py-3">
        <p className="text-[13px] text-[#6e6e73]">
          {dirtyIds.length === 0
            ? "No unsaved changes"
            : `${dirtyIds.length} unsaved ${dirtyIds.length === 1 ? "change" : "changes"}`}
        </p>
        <div className="flex items-center gap-3">
          {error && <p className="text-[13px] text-[#b42318]">{error}</p>}
          <button
            type="button"
            onClick={saveAll}
            disabled={busy || dirtyIds.length === 0}
            className="inline-flex h-9 items-center rounded-full bg-[#1d1d1f] px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save all changes"}
          </button>
        </div>
      </div>

      {(["EUROPEAN_FRAMELESS", "AMERICAN_FRAMED"] as const).map((style) => {
        const group = colors.filter((color) => color.cabinetStyle === style);
        return (
          <section key={style} className="rounded-[18px] border border-[#d2d2d7] bg-white p-5">
            <h2 className="mb-4 text-[15px] font-bold text-[#1d1d1f]">{STYLE_LABELS[style]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((color) => {
                const draft = drafts[color.id];
                if (!draft) return null;
                const dirty = isDirty(color, draft);
                return (
                  <article
                    key={color.id}
                    className={`overflow-hidden rounded-[14px] border ${dirty ? "border-[#c56a16]" : "border-[#d2d2d7]"}`}
                  >
                    <div className="relative h-28 w-full bg-[#e8e8ed]">
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
                        <div className="h-full w-full" style={{ background: color.swatchHex ?? "#e8e8ed" }} />
                      )}
                      {draft.active && (
                        <span className="absolute left-2 top-2 inline-flex h-6 items-center gap-1.5 rounded-full bg-[#e6f4ef] px-2.5 text-[10px] font-bold text-[#008060]">
                          <span className="size-1.5 rounded-full bg-[#008060]" />
                          ACTIVE
                        </span>
                      )}
                      {dirty && (
                        <span className="absolute right-2 top-2 inline-flex h-6 items-center rounded-full bg-[#fff0dc] px-2.5 text-[10px] font-bold text-[#c56a16]">
                          Unsaved
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 p-3">
                      <input
                        value={draft.name}
                        onChange={(e) => update(color.id, { name: e.target.value })}
                        className={`${M_INPUT} font-semibold`}
                      />
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#6e6e73]">
                        <input
                          type="checkbox"
                          checked={draft.active}
                          onChange={(e) => update(color.id, { active: e.target.checked })}
                        />
                        Active
                      </label>

                      <label className="block text-[11px] font-semibold text-[#6e6e73]">
                        Cabinet style
                        <select
                          value={draft.cabinetStyle}
                          onChange={(e) =>
                            update(color.id, { cabinetStyle: e.target.value as CabinetStyle })
                          }
                          className={`${M_INPUT} mt-1`}
                        >
                          {STYLES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-[11px] font-semibold text-[#6e6e73]">
                        Swatch image
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => pickImage(color.id, e.target.files?.[0], "swatch")}
                          className="mt-1 block w-full text-[11px] text-[#6e6e73]"
                        />
                      </label>

                      <label className="block text-[11px] font-semibold text-[#6e6e73]">
                        Hover example image (optional)
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => pickImage(color.id, e.target.files?.[0], "hover")}
                          className="mt-1 block w-full text-[11px] text-[#6e6e73]"
                        />
                      </label>

                      <label className="block text-[11px] font-semibold text-[#6e6e73]">
                        AI description
                        <textarea
                          value={draft.promptDescription}
                          onChange={(e) => update(color.id, { promptDescription: e.target.value })}
                          rows={2}
                          className={`${M_INPUT} mt-1`}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
              {group.length === 0 && (
                <p className="text-[13px] text-[#6e6e73]">No colors configured.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
