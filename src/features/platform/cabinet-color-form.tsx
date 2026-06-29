"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CabinetStyle } from "@/domain/round1";
import type { CabinetColor } from "@/server/platform/cabinet-color-repository";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/api-client";

const STYLES = [
  { value: "EUROPEAN_FRAMELESS", label: "European Frameless" },
  { value: "AMERICAN_FRAMED", label: "American Framed" }
] as const;

// Inline uploads are stored as data URLs in the existing text columns, so cap
// the file size to keep rows (and the colors API payload) reasonable.
export const MAX_CABINET_IMAGE_BYTES = 4 * 1024 * 1024;

const selectClass =
  "studio-glass-input flex h-10 w-full rounded-[11px] px-3 py-2 text-sm text-studio-ink disabled:cursor-not-allowed disabled:opacity-50";

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
  const payload: Record<string, unknown> = {
    cabinetStyle: fields.cabinetStyle,
    name: fields.name.trim(),
    promptDescription: fields.promptDescription.trim() || fields.name.trim(),
    active: fields.active,
    sortOrder: fields.sortOrder
  };

  if (fields.swatchImageUrl !== undefined) {
    payload.swatchImageUrl = fields.swatchImageUrl;
  }
  if (fields.hoverExampleImageUrl !== undefined) {
    payload.hoverExampleImageUrl = fields.hoverExampleImageUrl;
  }

  return payload;
}

export function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const max = 512;

        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

const LABEL = "mb-[7px] block font-mono text-[9.5px] tracking-[0.12em] text-[#86867f]";

export function CabinetColorForm({
  color,
  onClose
}: {
  color?: CabinetColor;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [cabinetStyle, setCabinetStyle] = useState<CabinetStyle>(
    color?.cabinetStyle ?? "EUROPEAN_FRAMELESS"
  );
  const [name, setName] = useState(color?.name ?? "");
  const [promptDescription, setPromptDescription] = useState(
    color?.promptDescription ?? ""
  );
  const [active, setActive] = useState(color?.active ?? true);

  const [swatchData, setSwatchData] = useState<string | null | undefined>(undefined);
  const [hoverData, setHoverData] = useState<string | null | undefined>(undefined);

  const [swatchPreview, setSwatchPreview] = useState<string | null>(
    color?.swatchImageUrl ?? null
  );
  const [hoverPreview, setHoverPreview] = useState<string | null>(
    color?.hoverExampleImageUrl ?? null
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleFile(
    file: File | undefined,
    setData: (data: string) => void,
    setPreview: (value: string) => void
  ) {
    if (!file) return;
    if (file.size > MAX_CABINET_IMAGE_BYTES) {
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Color name is required.");
      return;
    }
    if (!color && !swatchData) {
      setError("A swatch image is required for new finishes.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload = buildCabinetColorPayload({
        cabinetStyle,
        name,
        promptDescription,
        swatchImageUrl: swatchData,
        hoverExampleImageUrl: hoverData,
        active,
        sortOrder: color?.sortOrder ?? 0
      });

      const url = color
        ? `/api/admin/cabinet-colors/${encodeURIComponent(color.id)}`
        : `/api/admin/cabinet-colors`;

      const res = await fetchJson(url, {
        method: color ? "PUT" : "POST",
        body: payload
      });

      if (!res.ok) {
        throw new Error("API rejected the save request");
      }

      router.refresh();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="studio-anim-fade fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{
        background: "rgba(232,232,230,0.55)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)"
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={color ? "Edit color" : "Add color"}
        onClick={(event) => event.stopPropagation()}
        className="studio-anim-rise max-h-[90vh] w-[460px] max-w-full overflow-y-auto rounded-[24px]"
        style={{
          background:
            "linear-gradient(165deg,rgba(255,255,255,0.78),rgba(255,255,255,0.58))",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.95) inset,0 40px 90px -40px rgba(20,20,26,0.42)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)"
        }}
      >
        <div className="flex items-center justify-between border-b border-[rgba(20,20,26,0.08)] px-6 py-[20px]">
          <div>
            <p className="mb-[5px] font-mono text-[10px] tracking-[0.16em] text-[#86867f]">
              {color ? "EDIT COLOR" : "NEW COLOR"}
            </p>
            <h3 className="m-0 text-[20px] font-semibold text-[#16161a]">
              {color ? "Edit a color" : "Add a color"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-[10px] border border-white/85 bg-white/60 text-[15px] leading-none text-[#86867f] transition-colors hover:text-studio-ink"
          >
            ×
          </button>
        </div>

        <form ref={formRef} onSubmit={submit} className="p-6" aria-busy={busy}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cabinetStyle" className={LABEL}>
                Cabinet style
              </Label>
              <select
                id="cabinetStyle"
                value={cabinetStyle}
                onChange={(e) => setCabinetStyle(e.target.value as CabinetStyle)}
                disabled={busy}
                className={selectClass}
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="name" className={LABEL}>
                Color name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="e.g. Natural Oak"
                className="studio-glass-input rounded-[11px]"
              />
            </div>

            {color && (
              <label className="flex items-center gap-2.5">
                <Checkbox
                  checked={active}
                  onCheckedChange={(c) => setActive(c === true)}
                  disabled={busy}
                />
                <span className="text-[13px] font-medium text-studio-ink">Active</span>
              </label>
            )}

            <div>
              <Label htmlFor="swatchImage" className={LABEL}>
                Swatch image
              </Label>
              <div className="flex items-center gap-4">
                {swatchPreview ? (
                  <img
                    src={swatchPreview}
                    alt={color ? `${name || color.name} swatch` : "Preview"}
                    className="size-16 shrink-0 rounded-[10px] border border-white/85 object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-[10px] border border-white/85 bg-white/40 text-[10px] text-studio-muted">
                    No swatch
                  </div>
                )}
                <Input
                  id="swatchImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0], setSwatchData, setSwatchPreview)
                  }
                  disabled={busy}
                  aria-describedby="swatch-upload-hint"
                  className="studio-glass-input h-10 rounded-[11px] text-xs text-studio-muted file:text-studio-ink"
                />
              </div>
              <p id="swatch-upload-hint" className="mt-1.5 text-xs text-studio-muted">
                Images are resized before upload. Maximum source size: 4MB.
              </p>
            </div>

            <div>
              <Label htmlFor="hoverImage" className={LABEL}>
                Hover example image (optional)
              </Label>
              <div className="flex items-center gap-4">
                {hoverPreview ? (
                  <img
                    src={hoverPreview}
                    alt={color ? `${name || color.name} kitchen example` : "Preview"}
                    className="size-16 shrink-0 rounded-[10px] border border-white/85 object-cover"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-[10px] border border-white/85 bg-white/40 text-[10px] text-studio-muted">
                    No example
                  </div>
                )}
                <Input
                  id="hoverImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0], setHoverData, setHoverPreview)
                  }
                  disabled={busy}
                  className="studio-glass-input h-10 rounded-[11px] text-xs text-studio-muted file:text-studio-ink"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="promptDescription" className={LABEL}>
                AI description
              </Label>
              <textarea
                id="promptDescription"
                rows={3}
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                disabled={busy}
                className={`${selectClass} h-auto resize-none`}
                placeholder="Visual description for the AI"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-[11px] border px-3 py-2 text-[12.5px]"
              style={{
                borderColor: "rgba(176,90,90,0.4)",
                background: "rgba(214,138,138,0.16)",
                color: "#8a4444"
              }}
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-[10px]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] border border-white/85 bg-white/55 px-[18px] py-3 text-[13px] font-medium text-[#16161a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (!color && !swatchPreview)}
              className="rounded-[12px] px-5 py-3 text-[13px] font-medium text-white disabled:cursor-not-allowed"
              style={
                busy || (!color && !swatchPreview)
                  ? { background: "rgba(20,20,26,0.16)" }
                  : {
                      background: "linear-gradient(180deg,#2c2c30,#141416)",
                      boxShadow: "0 10px 24px -12px rgba(20,20,26,0.5)"
                    }
              }
            >
              {busy ? "Saving…" : color ? "Save changes" : "Add color"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
