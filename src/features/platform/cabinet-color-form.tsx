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

const FIELD =
  "mt-2 w-full rounded-xl border border-[#d2d2d7] bg-white px-3.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]/40 focus:ring-2 focus:ring-[#1d1d1f]/10";
const FILE_INPUT =
  "text-[12px] text-[#6e6e73] file:mr-3 file:rounded-full file:border file:border-[#d2d2d7] file:bg-white file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-[#1d1d1f]";

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

// ponytail: downscale on the client so swatch rows stay small — was storing the
// raw upload (up to 4MB of base64) inline, which bloated every colors payload.
export function resizeImageToDataUrl(file: File, maxDim = 512, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image"));
    };
    img.src = url;
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
      const dataUrl = await resizeImageToDataUrl(file);
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
    <form
      onSubmit={submit}
      className="h-fit rounded-[18px] border border-[#d2d2d7] bg-white p-8"
    >
      <h2 className="text-[28px] font-bold text-[#1d1d1f]">
        {color ? "Edit color" : "Add finish"}
      </h2>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">Cabinet style</span>
          <select
            value={cabinetStyle}
            onChange={(event) => setCabinetStyle(event.target.value as CabinetStyle)}
            className={`${FIELD} h-11`}
          >
            {STYLES.map((style) => (
              <option key={style.value} value={style.value}>{style.label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">Color name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={`${FIELD} h-11`}
          />
        </label>

        <div>
          <span className="text-[12px] font-semibold text-[#6e6e73]">Swatch image</span>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#d2d2d7] bg-[#e8e8ed]">
              {swatchPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={swatchPreview} alt="Swatch preview" className="h-full w-full object-cover" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleFile(event.target.files?.[0], setSwatchData, setSwatchPreview)}
              className={FILE_INPUT}
            />
          </div>
        </div>

        <div>
          <span className="text-[12px] font-semibold text-[#6e6e73]">
            Hover example image (optional)
          </span>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-[#d2d2d7] bg-[#e8e8ed]">
              {hoverPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hoverPreview} alt="Hover example preview" className="h-full w-full object-cover" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleFile(event.target.files?.[0], setHoverData, setHoverPreview)}
              className={FILE_INPUT}
            />
          </div>
        </div>

        <label className="block">
          <span className="text-[12px] font-semibold text-[#6e6e73]">AI description (optional)</span>
          <textarea
            value={promptDescription}
            onChange={(event) => setPromptDescription(event.target.value)}
            rows={3}
            placeholder="Leave blank to use the color name"
            className={`${FIELD} py-2.5`}
          />
        </label>

        {isEdit && (
          <label className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f]">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active
          </label>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-[#fdeceb] px-3 py-2 text-sm text-[#b42318]">{error}</p>
      )}
      <button
        disabled={busy || !name.trim()}
        className="mt-6 inline-flex h-[42px] w-full items-center justify-center rounded-full bg-[#1d1d1f] text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save color"}
      </button>
    </form>
  );
}
