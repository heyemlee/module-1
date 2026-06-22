"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

// Inline uploads are stored as data URLs in the existing text columns, so cap
// the file size to keep rows (and the colors API payload) reasonable.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

type CabinetColorPayloadFields = {
  cabinetStyle: CabinetStyle;
  name: string;
  promptDescription: string;
  // `undefined` means "leave unchanged" (edit with no new file); `null` clears.
  swatchImageUrl?: string | null;
  hoverExampleImageUrl?: string | null;
  active: boolean;
  sortOrder: number;
};

export function buildCabinetColorPayload(fields: CabinetColorPayloadFields) {
  const name = fields.name.trim();
  const payload: Record<string, unknown> = {
    cabinetStyle: fields.cabinetStyle,
    name,
    // The AI description feeds the rendering prompt; fall back to the name so
    // sales never has to write one for a quick color.
    promptDescription: fields.promptDescription.trim() || name,
    active: fields.active,
    sortOrder: fields.sortOrder
  };
  if (fields.swatchImageUrl !== undefined) payload.swatchImageUrl = fields.swatchImageUrl;
  if (fields.hoverExampleImageUrl !== undefined) {
    payload.hoverExampleImageUrl = fields.hoverExampleImageUrl;
  }
  return payload;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

export function CabinetColorForm({ color }: { color?: CabinetColor }) {
  const isEdit = Boolean(color);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [cabinetStyle, setCabinetStyle] = useState<CabinetStyle>(
    color?.cabinetStyle ?? "EUROPEAN_FRAMELESS"
  );
  const [name, setName] = useState(color?.name ?? "");
  const [promptDescription, setPromptDescription] = useState(color?.promptDescription ?? "");
  const [active, setActive] = useState(color?.active ?? true);

  // `undefined` = unchanged (keep what is stored); a string = newly picked image.
  const [swatchData, setSwatchData] = useState<string | undefined>(undefined);
  const [hoverData, setHoverData] = useState<string | undefined>(undefined);
  const [swatchPreview, setSwatchPreview] = useState<string | null>(color?.swatchImageUrl ?? null);
  const [hoverPreview, setHoverPreview] = useState<string | null>(
    color?.hoverExampleImageUrl ?? null
  );

  async function handleFile(
    file: File | undefined,
    setData: (value: string) => void,
    setPreview: (value: string) => void
  ) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large. Please choose an image under 4MB.");
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setData(dataUrl);
      setPreview(dataUrl);
      setError(null);
    } catch {
      setError("Unable to read that image. Please try another file.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = buildCabinetColorPayload({
      cabinetStyle,
      name,
      promptDescription,
      // On create, send null when no image was picked; on edit, omit (undefined)
      // so the stored image is preserved unless a new one was chosen.
      swatchImageUrl: isEdit ? swatchData : swatchData ?? null,
      hoverExampleImageUrl: isEdit ? hoverData : hoverData ?? null,
      active: isEdit ? active : true,
      sortOrder: color?.sortOrder ?? 0
    });

    try {
      const response = await fetch(
        color ? `/api/admin/cabinet-colors/${color.id}` : "/api/admin/cabinet-colors",
        {
          method: color ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) {
        setError("Unable to save cabinet color. Check the fields and try again.");
        return;
      }
      router.refresh();
      if (!isEdit) {
        // Clear the "Add color" form for the next entry (router.refresh keeps
        // client state, so reset explicitly instead of relying on a full reload).
        setName("");
        setPromptDescription("");
        setSwatchData(undefined);
        setHoverData(undefined);
        setSwatchPreview(null);
        setHoverPreview(null);
        setError(null);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border border-stone-300 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{color ? "Edit color" : "Add color"}</h2>

      <label className="block text-sm font-medium">
        Cabinet style
        <select
          value={cabinetStyle}
          onChange={(event) => setCabinetStyle(event.target.value as CabinetStyle)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        >
          {STYLES.map((style) => (
            <option key={style.value} value={style.value}>{style.label}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Color name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>

      <div className="text-sm font-medium">
        Swatch image
        <div className="mt-1 flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
            {swatchPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={swatchPreview} alt="Swatch preview" className="h-full w-full object-cover" />
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event.target.files?.[0], setSwatchData, setSwatchPreview)}
            className="text-sm"
          />
        </div>
      </div>

      <div className="text-sm font-medium">
        Hover example image (optional)
        <div className="mt-1 flex items-center gap-3">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-100">
            {hoverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hoverPreview} alt="Hover example preview" className="h-full w-full object-cover" />
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event.target.files?.[0], setHoverData, setHoverPreview)}
            className="text-sm"
          />
        </div>
      </div>

      <label className="block text-sm font-medium">
        AI description (optional)
        <textarea
          value={promptDescription}
          onChange={(event) => setPromptDescription(event.target.value)}
          rows={3}
          placeholder="Leave blank to use the color name"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
        />
      </label>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        disabled={busy || !name.trim()}
        className="w-full rounded bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save color"}
      </button>
    </form>
  );
}
